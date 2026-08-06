import * as XLSX from "xlsx";
import {
  describeManualTimelineShort,
  manualTimelinePeriods,
  resolveManualSchedule,
  REGIONS,
  REGION_LABEL,
  type CaseInputs,
  type CaseMode,
  type CaseOutputs,
} from "./types";
import type { ExecSummary } from "./ai.functions";
import { SCHEMA_FIELDS } from "./import";
import { isLicensed } from "./license";

export interface ExcelCase {
  name: string;
  versionLabel: string;
  inputs: CaseInputs;
  outputs: CaseOutputs;
  mode: CaseMode;
  summary?: ExecSummary | null;
}

function slug(s: string) {
  return (s.trim() || "Case").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface SheetRow {
  [key: string]: string | number;
}

function inputRows(c: ExcelCase): SheetRow[] {
  const i = c.inputs;
  const rm = i.benefits.revenueModel;
  const tl = i.benefits.timeline;
  const rows: SheetRow[] = [
    { Metric: "NRE", Value: i.investment.nre },
    { Metric: "Upfront Capex", Value: i.investment.upfront },
    { Metric: "Cost Savings / Yr", Value: i.benefits.costSavingsAnnual },
    { Metric: "Time Savings / Yr", Value: i.benefits.timeSavingsAnnual },
    { Metric: "Horizon (Years)", Value: i.horizonYears },
    { Metric: "Discount Rate (Annual)", Value: i.discountRateAnnual / 100 },
  ];
  i.investment.phased.forEach((p) => {
    rows.push({ Metric: `Phased Capex · M${p.month}`, Value: p.amount });
  });
  rows.push({
    Metric: "Timeline",
    Value:
      tl.type === "ramp"
        ? `Ramp ${tl.ramp.year1Percent}% +${tl.ramp.growthRatePercent}%/yr`
        : tl.type === "manual"
          ? describeManualTimelineShort(tl.manual)
          : "Flat",
  });
  if (c.mode === "detailed") {
    rows.push({
      Metric: "Revenue Model",
      Value: rm.type === "unit" ? "Unit-Level" : rm.type === "aggregate" ? "Aggregate" : "None",
    });
    if (rm.type === "aggregate") {
      rows.push({ Metric: "Revenue Lift / Yr", Value: rm.aggregate.revenueLiftAnnual });
      rows.push({ Metric: "COGS / Yr", Value: rm.aggregate.cogsAnnual });
    }
    if (rm.type === "unit") {
      rows.push({ Metric: "Price / Unit", Value: rm.unit.pricePerUnit });
      rows.push({ Metric: "Variable Cost / Unit", Value: rm.unit.variableCostPerUnit });
      rows.push({ Metric: "Fixed Costs / Yr", Value: rm.unit.fixedCostsAnnual });
      rows.push({ Metric: "Units / Yr", Value: rm.unit.unitsPerYear });
    }
    if (i.benefits.overhead.enabled) {
      rows.push({
        Metric: `Overhead (${i.benefits.overhead.basis === "cogs" ? "COGS" : "Revenue"})`,
        Value: i.benefits.overhead.percent / 100,
      });
    }
  }
  return rows;
}

function outputRows(c: ExcelCase): SheetRow[] {
  const o = c.outputs;
  const rows: SheetRow[] = [
    { Metric: "NPV", Value: o.npv },
    { Metric: "IRR", Value: o.irr ?? "" },
    { Metric: "Payback (Months)", Value: o.paybackMonths ?? "" },
    { Metric: "ROI", Value: o.roi },
    { Metric: "Total Investment", Value: o.totalInvestment },
    { Metric: "Total Revenue", Value: o.totalRevenue },
  ];
  const m = o.margins;
  if (c.mode === "detailed" && m) {
    if (m.grossMarginPercent !== null)
      rows.push({ Metric: "Gross Margin", Value: m.grossMarginPercent / 100 });
    if (m.contributionMarginPerUnit !== null)
      rows.push({ Metric: "Contribution / Unit", Value: m.contributionMarginPerUnit });
    if (m.contributionMarginPercent !== null)
      rows.push({ Metric: "Contribution %", Value: m.contributionMarginPercent / 100 });
    if (m.breakevenUnitsPerYear !== null)
      rows.push({ Metric: "Breakeven Units / Yr", Value: m.breakevenUnitsPerYear });
    if (c.inputs.benefits.overhead.enabled)
      rows.push({ Metric: "Overhead / Yr", Value: m.overheadAnnual });
  }
  return rows;
}

const CURRENCY_FMT = "$#,##0;($#,##0);-";
const PERCENT_FMT = "0.0%";

/** Bold, light-grey header row across the sheet's first row. */
function styleHeaderRow(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (!cell) continue;
    cell.s = {
      font: { bold: true },
      fill: { patternType: "solid", fgColor: { rgb: "FFD9D9D9" } },
    };
  }
}

/** Applies a number format to every numeric cell in a column (skipping the header). */
function formatColumn(ws: XLSX.WorkSheet, col: number, fmt: string) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = 1; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
    if (cell && typeof cell.v === "number") cell.z = fmt;
  }
}

/** Applies a number format to a single cell by row/column index. */
function formatCell(ws: XLSX.WorkSheet, row: number, col: number, fmt: string) {
  const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
  if (cell && typeof cell.v === "number") cell.z = fmt;
}

/** Month-by-month cash flow sheet shared by the single-case and comparison exports. */
function cashFlowSheet(c: ExcelCase): XLSX.WorkSheet {
  const rows: SheetRow[] = c.outputs.cashFlowSeries.map((p) => ({
    Month: p.month,
    Revenue: p.revenue ?? 0,
    Cost: p.cost ?? 0,
    "Net Cash Flow": p.net ?? 0,
    "Discounted Cash Flow": p.discounted ?? 0,
    "Cumulative Cash Flow": p.cumulative,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 22 }];
  styleHeaderRow(ws);
  for (let col = 1; col <= 5; col++) formatColumn(ws, col, CURRENCY_FMT);
  return ws;
}

/** One row per period (year/quarter/month/week) for a manual timeline, so ramp
 *  volumes and other schedule details are never crammed into a single cell. */
function timelineSheet(c: ExcelCase): XLSX.WorkSheet | null {
  const tl = c.inputs.benefits.timeline;
  if (tl.type !== "manual") return null;
  const periods = manualTimelinePeriods(tl.manual);
  if (!periods.length) return null;

  const isMultiplier = periods[0].isMultiplier;
  const basis = resolveManualSchedule(tl.manual).basis;
  const valueLabel = isMultiplier ? "Multiplier" : basis === "units" ? "Units" : "Amount";

  const rows: SheetRow[] = periods.map((p) => ({ Period: p.label, [valueLabel]: p.value }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 16 }, { wch: 16 }];
  styleHeaderRow(ws);
  if (!isMultiplier && basis !== "units") formatColumn(ws, 1, CURRENCY_FMT);
  return ws;
}

/** Regional units/revenue breakdown, one row per region, when the unit-level
 *  revenue model has a regional split enabled. */
function regionalSheet(c: ExcelCase): XLSX.WorkSheet | null {
  const rm = c.inputs.benefits.revenueModel;
  if (rm.type !== "unit" || !rm.unit.regional?.enabled || !isLicensed()) return null;

  const pricePerUnit = rm.unit.pricePerUnit || 0;
  const totalUnits = REGIONS.reduce((s, r) => s + (rm.unit.regional!.unitsPerYear[r] || 0), 0);

  const rows: SheetRow[] = REGIONS.map((r) => {
    const units = rm.unit.regional!.unitsPerYear[r] || 0;
    return {
      Region: REGION_LABEL[r],
      "Units / Yr": units,
      "Revenue / Yr": units * pricePerUnit,
      Share: totalUnits > 0 ? units / totalUnits : 0,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 10 }];
  styleHeaderRow(ws);
  formatColumn(ws, 1, "#,##0");
  formatColumn(ws, 2, CURRENCY_FMT);
  formatColumn(ws, 3, PERCENT_FMT);
  return ws;
}

/** Builds an .xlsx workbook for a single case and triggers a download. */
export function exportCaseExcel(c: ExcelCase) {
  const wb = XLSX.utils.book_new();

  // Summary sheet — key outputs + assumptions stacked.
  const summary: SheetRow[] = [];
  summary.push({ Metric: "BizCase Builder", Value: c.name });
  summary.push({ Metric: "Version", Value: c.versionLabel });
  summary.push({ Metric: "Mode", Value: c.mode.toUpperCase() });
  summary.push({ Metric: "Generated", Value: today() });
  summary.push({ Metric: "", Value: "" });
  summary.push({ Metric: "— Key Outputs —", Value: "" });
  outputRows(c).forEach((r) => summary.push(r));
  summary.push({ Metric: "", Value: "" });
  summary.push({ Metric: "— Assumptions —", Value: "" });
  inputRows(c).forEach((r) => summary.push(r));
  const summarySheet = XLSX.utils.json_to_sheet(summary);
  summarySheet["!cols"] = [{ wch: 34 }, { wch: 52 }];
  styleHeaderRow(summarySheet);

  // Percent-based rows are stored as fractions — format them as percentages.
  const percentLabels = new Set([
    "Discount Rate (Annual)",
    "Gross Margin",
    "Contribution %",
    "ROI",
  ]);
  summary.forEach((row, idx) => {
    const label = String(row.Metric ?? "");
    if (!percentLabels.has(label)) return;
    const r = idx + 1; // +1 for the header row
    if (label === "ROI") {
      // ROI is stored as a whole-number percentage; convert so 0.0% renders right.
      const cell = summarySheet[XLSX.utils.encode_cell({ r, c: 1 })];
      if (cell && typeof cell.v === "number") cell.v = cell.v / 100;
    }
    formatCell(summarySheet, r, 1, PERCENT_FMT);
  });

  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
  const tlSheet = timelineSheet(c);
  if (tlSheet) XLSX.utils.book_append_sheet(wb, tlSheet, "Timeline");
  const regSheet = regionalSheet(c);
  if (regSheet) XLSX.utils.book_append_sheet(wb, regSheet, "Regional");
  XLSX.utils.book_append_sheet(wb, cashFlowSheet(c), "Cash Flow");

  XLSX.writeFile(wb, `BizCase_${slug(c.name)}_${slug(c.versionLabel)}_${today()}.xlsx`);
}

type LedgerKind = "currency" | "percent" | "number";

/** Short text summary of a case's timeline, safe for a single sheet cell. */
function timelineSummary(c: ExcelCase): string {
  const tl = c.inputs.benefits.timeline;
  if (tl.type === "ramp") return `Ramp ${tl.ramp.year1Percent}% +${tl.ramp.growthRatePercent}%/yr`;
  if (tl.type === "manual") return describeManualTimelineShort(tl.manual);
  return "Flat";
}

/** Side-by-side assumptions/inputs sheet for the comparison workbook — mirrors the
 *  single-case Assumptions rows, but as A/B columns instead of one flat list. */
function assumptionsCompareSheet(a: ExcelCase, b: ExcelCase): XLSX.WorkSheet {
  type Def = {
    label: string;
    kind: LedgerKind | "text";
    get: (c: ExcelCase) => number | string | null;
  };
  const unit = (c: ExcelCase) => c.inputs.benefits.revenueModel.unit;
  const aggregate = (c: ExcelCase) => c.inputs.benefits.revenueModel.aggregate;
  const isDetailed = (c: ExcelCase) => c.mode === "detailed";
  const rm = (c: ExcelCase) => c.inputs.benefits.revenueModel.type;

  const defs: Def[] = [
    { label: "NRE", kind: "currency", get: (c) => c.inputs.investment.nre },
    { label: "Upfront Capex", kind: "currency", get: (c) => c.inputs.investment.upfront },
    {
      label: "Phased Capex Total",
      kind: "currency",
      get: (c) => c.inputs.investment.phased.reduce((sum, p) => sum + p.amount, 0) || null,
    },
    {
      label: "Cost Savings / Yr",
      kind: "currency",
      get: (c) => c.inputs.benefits.costSavingsAnnual,
    },
    {
      label: "Time Savings / Yr",
      kind: "currency",
      get: (c) => c.inputs.benefits.timeSavingsAnnual,
    },
    { label: "Horizon (Years)", kind: "number", get: (c) => c.inputs.horizonYears },
    {
      label: "Discount Rate (Annual)",
      kind: "percent",
      get: (c) => c.inputs.discountRateAnnual / 100,
    },
    { label: "Timeline", kind: "text", get: (c) => timelineSummary(c) },
    {
      label: "Revenue Model",
      kind: "text",
      get: (c) =>
        isDetailed(c)
          ? rm(c) === "unit"
            ? "Unit-Level"
            : rm(c) === "aggregate"
              ? "Aggregate"
              : "None"
          : null,
    },
    {
      label: "Revenue Lift / Yr",
      kind: "currency",
      get: (c) => (isDetailed(c) && rm(c) === "aggregate" ? aggregate(c).revenueLiftAnnual : null),
    },
    {
      label: "COGS / Yr",
      kind: "currency",
      get: (c) => (isDetailed(c) && rm(c) === "aggregate" ? aggregate(c).cogsAnnual : null),
    },
    {
      label: "Price / Unit",
      kind: "currency",
      get: (c) => (isDetailed(c) && rm(c) === "unit" ? unit(c).pricePerUnit : null),
    },
    {
      label: "Variable Cost / Unit",
      kind: "currency",
      get: (c) => (isDetailed(c) && rm(c) === "unit" ? unit(c).variableCostPerUnit : null),
    },
    {
      label: "Fixed Costs / Yr",
      kind: "currency",
      get: (c) => (isDetailed(c) && rm(c) === "unit" ? unit(c).fixedCostsAnnual : null),
    },
    {
      label: "Units / Yr",
      kind: "number",
      get: (c) => (isDetailed(c) && rm(c) === "unit" ? unit(c).unitsPerYear : null),
    },
    {
      label: "Overhead",
      kind: "percent",
      get: (c) =>
        isDetailed(c) && c.inputs.benefits.overhead.enabled
          ? c.inputs.benefits.overhead.percent / 100
          : null,
    },
  ];

  const rows: SheetRow[] = [];
  const kinds: Def["kind"][] = [];
  for (const d of defs) {
    const va = d.get(a);
    const vb = d.get(b);
    if (va === null && vb === null) continue; // not applicable to either case
    rows.push({
      Metric: d.label,
      [`A · ${a.versionLabel}`]: va ?? "",
      [`B · ${b.versionLabel}`]: vb ?? "",
    });
    kinds.push(d.kind);
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 26 }, { wch: 28 }, { wch: 28 }];
  styleHeaderRow(ws);
  kinds.forEach((kind, i) => {
    if (kind === "number" || kind === "text") return;
    const fmt = kind === "percent" ? PERCENT_FMT : CURRENCY_FMT;
    for (let col = 1; col <= 2; col++) formatCell(ws, i + 1, col, fmt);
  });
  return ws;
}

/** Side-by-side comparison workbook: metrics ledger + one cash flow sheet per case. */
export function exportComparisonExcel(opts: { name: string; a: ExcelCase; b: ExcelCase }) {
  const { name, a, b } = opts;
  const wb = XLSX.utils.book_new();

  const defs: { label: string; kind: LedgerKind; get: (c: ExcelCase) => number | null }[] = [
    { label: "NPV", kind: "currency", get: (c) => c.outputs.npv },
    {
      label: "IRR",
      kind: "percent",
      get: (c) => (c.outputs.irr === null ? null : c.outputs.irr / 100),
    },
    { label: "Payback (Months)", kind: "number", get: (c) => c.outputs.paybackMonths },
    { label: "ROI", kind: "percent", get: (c) => c.outputs.roi / 100 },
    { label: "Total Investment", kind: "currency", get: (c) => c.outputs.totalInvestment },
    { label: "Total Revenue", kind: "currency", get: (c) => c.outputs.totalRevenue },
    {
      label: "Gross Margin",
      kind: "percent",
      get: (c) =>
        c.outputs.margins?.grossMarginPercent == null
          ? null
          : c.outputs.margins.grossMarginPercent / 100,
    },
    {
      label: "Contribution Margin %",
      kind: "percent",
      get: (c) =>
        c.outputs.margins?.contributionMarginPercent == null
          ? null
          : c.outputs.margins.contributionMarginPercent / 100,
    },
    {
      label: "Contribution Margin / Unit",
      kind: "currency",
      get: (c) => c.outputs.margins?.contributionMarginPerUnit ?? null,
    },
    {
      label: "Breakeven Units / Yr",
      kind: "number",
      get: (c) => c.outputs.margins?.breakevenUnitsPerYear ?? null,
    },
  ];

  const rows: SheetRow[] = [];
  const kinds: LedgerKind[] = [];
  for (const d of defs) {
    const va = d.get(a);
    const vb = d.get(b);
    if (va === null && vb === null) continue; // metric not applicable to either case
    rows.push({
      Metric: d.label,
      [`A · ${a.versionLabel}`]: va ?? "",
      [`B · ${b.versionLabel}`]: vb ?? "",
      Delta: va !== null && vb !== null ? vb - va : "",
    });
    kinds.push(d.kind);
  }

  const ledger = XLSX.utils.json_to_sheet(rows);
  ledger["!cols"] = [{ wch: 26 }, { wch: 24 }, { wch: 24 }, { wch: 18 }];
  styleHeaderRow(ledger);
  kinds.forEach((kind, i) => {
    if (kind === "number") return;
    const fmt = kind === "percent" ? PERCENT_FMT : CURRENCY_FMT;
    for (let col = 1; col <= 3; col++) formatCell(ledger, i + 1, col, fmt);
  });
  XLSX.utils.book_append_sheet(wb, ledger, "Metrics Ledger");
  XLSX.utils.book_append_sheet(wb, assumptionsCompareSheet(a, b), "Assumptions");

  // Excel sheet names cap at 31 chars and reject several punctuation marks.
  const sheetName = (prefix: string, side: string, label: string) =>
    `${prefix} ${side} ${label}`.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
  XLSX.utils.book_append_sheet(wb, cashFlowSheet(a), sheetName("CF", "A", a.versionLabel));
  XLSX.utils.book_append_sheet(wb, cashFlowSheet(b), sheetName("CF", "B", b.versionLabel));

  const tlA = timelineSheet(a);
  if (tlA) XLSX.utils.book_append_sheet(wb, tlA, sheetName("TL", "A", a.versionLabel));
  const tlB = timelineSheet(b);
  if (tlB) XLSX.utils.book_append_sheet(wb, tlB, sheetName("TL", "B", b.versionLabel));

  const regA = regionalSheet(a);
  if (regA) XLSX.utils.book_append_sheet(wb, regA, sheetName("Reg", "A", a.versionLabel));
  const regB = regionalSheet(b);
  if (regB) XLSX.utils.book_append_sheet(wb, regB, sheetName("Reg", "B", b.versionLabel));

  XLSX.writeFile(wb, `BizCase_Comparison_${slug(name)}_${today()}.xlsx`);
}

/** Downloads a blank Excel template users can fill in and re-import.
 *  Generated directly from SCHEMA_FIELDS so it can never drift out of sync
 *  with what the import pipeline actually reads. Every field is optional —
 *  leave a row blank and it's simply skipped on import. */
export function downloadImportTemplate() {
  const rows: SheetRow[] = SCHEMA_FIELDS.map((f) => ({
    Field: f.label,
    Value: "",
    Notes: `${f.note} (optional)`,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 52 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BizCase Template");
  XLSX.writeFile(wb, `BizCase_Import_Template_${today()}.xlsx`);
}
