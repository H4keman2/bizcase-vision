import * as XLSX from "xlsx";
import type { CaseInputs, CaseMode, CaseOutputs } from "./types";

export interface ExcelCase {
  name: string;
  versionLabel: string;
  inputs: CaseInputs;
  outputs: CaseOutputs;
  mode: CaseMode;
  summary?: string | null;
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
          ? `Manual (${tl.manual.yearlyMultipliers.slice(0, Math.ceil(i.horizonYears)).join(", ")})`
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
    if (m.grossMarginPercent !== null) rows.push({ Metric: "Gross Margin", Value: m.grossMarginPercent / 100 });
    if (m.contributionMarginPerUnit !== null)
      rows.push({ Metric: "Contribution / Unit", Value: m.contributionMarginPerUnit });
    if (m.contributionMarginPercent !== null)
      rows.push({ Metric: "Contribution %", Value: m.contributionMarginPercent / 100 });
    if (m.breakevenUnitsPerYear !== null) rows.push({ Metric: "Breakeven Units / Yr", Value: m.breakevenUnitsPerYear });
    if (c.inputs.benefits.overhead.enabled) rows.push({ Metric: "Overhead / Yr", Value: m.overheadAnnual });
  }
  return rows;
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
  if (c.summary) {
    summary.push({ Metric: "", Value: "" });
    summary.push({ Metric: "— Executive Summary —", Value: "" });
    summary.push({ Metric: "Narrative", Value: c.summary });
  }
  const summarySheet = XLSX.utils.json_to_sheet(summary);
  summarySheet["!cols"] = [{ wch: 34 }, { wch: 52 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // Cash flow sheet — monthly series.
  const cf: SheetRow[] = c.outputs.cashFlowSeries.map((p) => ({
    Month: p.month,
    "Cumulative Cash Flow": p.cumulative,
  }));
  const cfSheet = XLSX.utils.json_to_sheet(cf);
  cfSheet["!cols"] = [{ wch: 10 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, cfSheet, "Cash Flow");

  XLSX.writeFile(wb, `BizCase_${slug(c.name)}_${slug(c.versionLabel)}_${today()}.xlsx`);
}
