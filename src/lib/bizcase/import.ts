import readXlsxFile from "read-excel-file/browser";
import type { CaseInputs } from "./types";

export const SCHEMA_FIELDS = [
  { key: "nre", label: "NRE", type: "currency" },
  { key: "upfront", label: "Upfront Capex", type: "currency" },
  { key: "costSavingsAnnual", label: "Cost Savings / Yr", type: "currency" },
  { key: "timeSavingsAnnual", label: "Time Savings / Yr", type: "currency" },
  { key: "revenueLiftAnnual", label: "Revenue Lift / Yr", type: "currency" },
  { key: "cogsAnnual", label: "COGS / Yr", type: "currency" },
  { key: "pricePerUnit", label: "Price / Unit", type: "currency" },
  { key: "variableCostPerUnit", label: "Variable Cost / Unit", type: "currency" },
  { key: "fixedCostsAnnual", label: "Fixed Costs / Yr", type: "currency" },
  { key: "unitsPerYear", label: "Units / Yr", type: "number" },
  { key: "overheadPercent", label: "Overhead %", type: "percent" },
  { key: "overheadBasis", label: "Overhead Basis", type: "text" },
  { key: "horizonYears", label: "Horizon (Years)", type: "number" },
  { key: "discountRateAnnual", label: "Discount Rate (Annual)", type: "percent" },
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
  let sheets: { name: string }[];
  try {
    sheets = (await readXlsxFile(file, { getSheets: true })) as { name: string }[];
  } catch {
    throw new ImportError("File could not be read — it may be corrupt or not a valid .xlsx file.");
  }

  let text = "";
  let rowCount = 0;
  for (const sheet of sheets) {
    let rows: unknown[][];
    try {
      rows = (await readXlsxFile(file, { sheet: sheet.name })) as unknown[][];
    } catch {
      throw new ImportError(
        `Sheet "${sheet.name}" could not be read — the file may be corrupt or unsupported.`,
      );
    }
    text += `\n--- Sheet: ${sheet.name} ---\n`;
    rows.forEach((row, i) => {
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

  return next;
}
