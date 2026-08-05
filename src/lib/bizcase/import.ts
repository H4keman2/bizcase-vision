import readXlsxFile from "read-excel-file/browser";
import type { CaseInputs } from "./types";

export const SCHEMA_FIELDS = [
  { key: "nre", label: "NRE", type: "currency", note: "One-time non-recurring engineering cost" },
  { key: "upfront", label: "Upfront Capex", type: "currency", note: "Capital spent at month 0" },
  {
    key: "phasedMonth1",
    label: "Phased Capex 1 Month",
    type: "number",
    note: "Leave blank if not used.",
  },
  {
    key: "phasedAmount1",
    label: "Phased Capex 1 Amount",
    type: "currency",
    note: "Leave blank if not used.",
  },
  {
    key: "phasedMonth2",
    label: "Phased Capex 2 Month",
    type: "number",
    note: "Leave blank if not used.",
  },
  {
    key: "phasedAmount2",
    label: "Phased Capex 2 Amount",
    type: "currency",
    note: "Leave blank if not used.",
  },
  {
    key: "phasedMonth3",
    label: "Phased Capex 3 Month",
    type: "number",
    note: "Leave blank if not used.",
  },
  {
    key: "phasedAmount3",
    label: "Phased Capex 3 Amount",
    type: "currency",
    note: "Leave blank if not used.",
  },
  {
    key: "phasedMonth4",
    label: "Phased Capex 4 Month",
    type: "number",
    note: "Leave blank if not used.",
  },
  {
    key: "phasedAmount4",
    label: "Phased Capex 4 Amount",
    type: "currency",
    note: "Leave blank if not used.",
  },
  {
    key: "timelineMode",
    label: "Timeline Mode",
    type: "text",
    note: 'One of "flat", "manual", or "ramp". Leave blank for flat.',
  },
  {
    key: "rampYear1Percent",
    label: "Ramp Year 1 %",
    type: "percent",
    note: 'Only used when Timeline Mode is "ramp". Leave blank if not used.',
  },
  {
    key: "rampGrowthRatePercent",
    label: "Ramp Growth Rate %/Yr",
    type: "percent",
    note: 'Only used when Timeline Mode is "ramp". Leave blank if not used.',
  },
  {
    key: "costSavingsAnnual",
    label: "Cost Savings / Yr",
    type: "currency",
    note: "Annual hard cost savings",
  },
  {
    key: "timeSavingsAnnual",
    label: "Time Savings / Yr",
    type: "currency",
    note: "Annual value of time saved",
  },
  {
    key: "revenueLiftAnnual",
    label: "Revenue Lift / Yr",
    type: "currency",
    note: "Aggregate revenue model — annual revenue added",
  },
  {
    key: "cogsAnnual",
    label: "COGS / Yr",
    type: "currency",
    note: "Aggregate revenue model — annual cost of goods sold",
  },
  {
    key: "pricePerUnit",
    label: "Price / Unit",
    type: "currency",
    note: "Unit-level revenue model — price per unit sold",
  },
  {
    key: "variableCostPerUnit",
    label: "Variable Cost / Unit",
    type: "currency",
    note: "Unit-level revenue model — variable cost per unit",
  },
  {
    key: "fixedCostsAnnual",
    label: "Fixed Costs / Yr",
    type: "currency",
    note: "Unit-level revenue model — annual fixed costs",
  },
  {
    key: "unitsPerYear",
    label: "Units / Yr",
    type: "number",
    note: "Unit-level revenue model — units sold annually",
  },
  {
    key: "overheadPercent",
    label: "Overhead %",
    type: "percent",
    note: "Optional — only applied if present",
  },
  {
    key: "overheadBasis",
    label: "Overhead Basis",
    type: "text",
    note: 'Optional — "cogs" or "revenue"',
  },
  { key: "horizonYears", label: "Horizon (Years)", type: "number", note: "Analysis horizon" },
  {
    key: "discountRateAnnual",
    label: "Discount Rate (Annual)",
    type: "percent",
    note: "Annual discount rate, percent",
  },
] as const;

export type FieldKey = (typeof SCHEMA_FIELDS)[number]["key"];
export type Extracted = Record<string, { value: string; confidence: string | null }>;

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_BATCH_FILES = 10;

/** Human-readable, specific failure reasons for the import pipeline. */
export class ImportError extends Error {}

export function validateFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".xlsx"))
    return "Unsupported file type. Only .xlsx files can be imported.";
  if (file.size > MAX_FILE_BYTES) return "File is larger than 5MB.";
  return null;
}

/** Reads an .xlsx file into the flat row text the AI extractor expects. */
export async function fileToSheetText(file: File): Promise<string> {
  let sheets: { sheet: string; data: (string | number | boolean | null)[][] }[];
  try {
    sheets = (await readXlsxFile(file)) as unknown as {
      sheet: string;
      data: (string | number | boolean | null)[][];
    }[];
  } catch {
    throw new ImportError("File could not be read — it may be corrupt or not a valid .xlsx file.");
  }

  let text = "";
  let rowCount = 0;
  for (const sheet of sheets) {
    text += `\n--- Sheet: ${sheet.sheet} ---\n`;
    (sheet.data ?? []).forEach((row, i) => {
      const cells = row.map((c) => (c === null || c === undefined ? "" : String(c)));
      if (cells.some((c) => c !== "")) {
        text += `Row ${i + 1}: ${cells.join(" | ")}\n`;
        rowCount++;
      }
    });
  }

  if (rowCount === 0) throw new ImportError("File was empty — no readable rows were found.");
  return text.slice(0, 12000);
}

type RawFields = Record<string, { value: number | string | null; confidence: string | null }>;

export function mapExtracted(fields: RawFields | undefined): Extracted {
  const mapped: Extracted = {};
  SCHEMA_FIELDS.forEach((f) => {
    const entry = fields?.[f.key];
    mapped[f.key] = {
      value: entry?.value === null || entry?.value === undefined ? "" : String(entry.value),
      confidence: entry?.confidence ?? null,
    };
  });
  return mapped;
}

/** Normalizes anything thrown during extraction into a specific, user-facing reason. */
export function extractionErrorMessage(e: unknown): string {
  if (e instanceof ImportError) return e.message;
  const msg = e instanceof Error ? e.message : String(e);
  if (/could not read the ai response/i.test(msg))
    return "AI response could not be parsed — try importing this file again.";
  if (/timeout|timed out|abort|network|fetch/i.test(msg))
    return "AI field extraction timed out — try importing this file again.";
  if (/rate limit|credits|AI request failed|not configured/i.test(msg))
    return `AI field extraction errored — ${msg}`;
  return msg || "Import failed for an unknown reason.";
}

const numOf = (values: Extracted, k: FieldKey): number | null => {
  const raw = values[k]?.value;
  if (raw === undefined || raw === "") return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function countMapped(values: Extracted): number {
  return SCHEMA_FIELDS.filter((f) => (values[f.key]?.value ?? "") !== "").length;
}

const INVESTMENT_KEYS: FieldKey[] = ["nre", "upfront"];
const BENEFIT_KEYS: FieldKey[] = [
  "costSavingsAnnual",
  "timeSavingsAnnual",
  "revenueLiftAnnual",
  "pricePerUnit",
  "unitsPerYear",
];

/** A case needs at least one nonzero investment AND one nonzero benefit to model returns. */
export function hasCriticalFields(values: Extracted): boolean {
  const nonzero = (k: FieldKey) => {
    const n = numOf(values, k);
    return n !== null && n !== 0;
  };
  return INVESTMENT_KEYS.some(nonzero) && BENEFIT_KEYS.some(nonzero);
}

export interface ImportIssue {
  field: FieldKey;
  message: string;
}

const isRampMode = (values: Extracted) =>
  (values.timelineMode?.value ?? "").trim().toLowerCase() === "ramp";

/**
 * Blocking validation. Ramp timelines cannot be imported without both ramp
 * parameters, since the schedule is meaningless (and silently flat) without them.
 */
export function validateImport(values: Extracted): ImportIssue[] {
  const issues: ImportIssue[] = [];

  const mode = (values.timelineMode?.value ?? "").trim().toLowerCase();
  if (mode !== "" && mode !== "flat" && mode !== "manual" && mode !== "ramp") {
    issues.push({
      field: "timelineMode",
      message: `Unrecognized timeline mode "${values.timelineMode?.value}" — use flat, manual, or ramp.`,
    });
  }

  if (isRampMode(values)) {
    const checks: { key: FieldKey; label: string; min: number; max: number }[] = [
      { key: "rampYear1Percent", label: "Ramp Year 1 %", min: 0, max: 100 },
      { key: "rampGrowthRatePercent", label: "Ramp Growth Rate %/Yr", min: -100, max: 1000 },
    ];
    checks.forEach(({ key, label, min, max }) => {
      const raw = (values[key]?.value ?? "").trim();
      if (raw === "") {
        issues.push({ field: key, message: `${label} is required when Timeline Mode is "ramp".` });
        return;
      }
      const n = numOf(values, key);
      if (n === null) {
        issues.push({ field: key, message: `${label} must be a number.` });
      } else if (n < min || n > max) {
        issues.push({ field: key, message: `${label} must be between ${min} and ${max}.` });
      }
    });
  }

  return issues;
}

export function applyToInputs(inputs: CaseInputs, values: Extracted): CaseInputs {
  const next = JSON.parse(JSON.stringify(inputs)) as CaseInputs;
  const set = (k: FieldKey, apply: (n: number) => void) => {
    const n = numOf(values, k);
    if (n !== null) apply(n);
  };

  set("nre", (n) => (next.investment.nre = n));
  set("upfront", (n) => (next.investment.upfront = n));
  set("costSavingsAnnual", (n) => (next.benefits.costSavingsAnnual = n));
  set("timeSavingsAnnual", (n) => (next.benefits.timeSavingsAnnual = n));
  set("revenueLiftAnnual", (n) => {
    next.benefits.revenueModel.aggregate.revenueLiftAnnual = n;
    if (next.benefits.revenueModel.type === "none") next.benefits.revenueModel.type = "aggregate";
  });
  set("cogsAnnual", (n) => (next.benefits.revenueModel.aggregate.cogsAnnual = n));
  set("pricePerUnit", (n) => {
    next.benefits.revenueModel.unit.pricePerUnit = n;
    next.benefits.revenueModel.type = "unit";
  });
  set("variableCostPerUnit", (n) => (next.benefits.revenueModel.unit.variableCostPerUnit = n));
  set("fixedCostsAnnual", (n) => (next.benefits.revenueModel.unit.fixedCostsAnnual = n));
  set("unitsPerYear", (n) => (next.benefits.revenueModel.unit.unitsPerYear = n));
  set("overheadPercent", (n) => {
    next.benefits.overhead.percent = n;
    next.benefits.overhead.enabled = true;
  });
  const basis = values.overheadBasis?.value?.toLowerCase();
  if (basis === "cogs" || basis === "revenue") next.benefits.overhead.basis = basis;
  set("horizonYears", (n) => (next.horizonYears = Math.max(1, Math.round(n))));
  set("discountRateAnnual", (n) => (next.discountRateAnnual = n));

  const phased: { month: number; amount: number }[] = [];
  for (let i = 1; i <= 4; i++) {
    const m = numOf(values, `phasedMonth${i}` as FieldKey);
    const a = numOf(values, `phasedAmount${i}` as FieldKey);
    if (m === null && a === null) continue;
    phased.push({ month: Math.max(0, Math.round(m ?? 0)), amount: a ?? 0 });
  }
  if (phased.length) next.investment.phased = phased;

  const mode = values.timelineMode?.value?.trim().toLowerCase();
  if (mode === "flat" || mode === "manual" || mode === "ramp") {
    next.benefits.timeline.type = mode;
    if (mode === "ramp") {
      set("rampYear1Percent", (n) => (next.benefits.timeline.ramp.year1Percent = n));
      set("rampGrowthRatePercent", (n) => (next.benefits.timeline.ramp.growthRatePercent = n));
    }
  }

  return next;
}
