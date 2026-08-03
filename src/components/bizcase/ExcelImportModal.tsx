import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { Modal, Btn } from "./ui";
import { extractCaseFromSheet } from "@/lib/bizcase/ai.functions";
import type { CaseInputs } from "@/lib/bizcase/types";
import { cn } from "@/lib/utils";

const SCHEMA_FIELDS = [
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

type FieldKey = (typeof SCHEMA_FIELDS)[number]["key"];
type Extracted = Record<string, { value: string; confidence: string | null }>;

function sheetToText(workbook: XLSX.WorkBook) {
  let text = "";
  workbook.SheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
    });
    text += `\n--- Sheet: ${sheetName} ---\n`;
    rows.forEach((row, i) => {
      if (row.some((cell) => cell !== "")) text += `Row ${i + 1}: ${row.join(" | ")}\n`;
    });
  });
  return text.slice(0, 12000);
}

function applyToInputs(inputs: CaseInputs, values: Extracted): CaseInputs {
  const next = JSON.parse(JSON.stringify(inputs)) as CaseInputs;
  const num = (k: FieldKey) => {
    const raw = values[k]?.value;
    if (raw === undefined || raw === "") return null;
    const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const set = (k: FieldKey, apply: (n: number) => void) => {
    const n = num(k);
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

export function ExcelImportModal({
  inputs,
  onClose,
  onConfirm,
}: {
  inputs: CaseInputs;
  onClose: () => void;
  onConfirm: (next: CaseInputs) => void;
}) {
  const run = useServerFn(extractCaseFromSheet);
  const [status, setStatus] = useState<"idle" | "parsing" | "review" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Extracted>({});

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large, please upload a file under 5MB");
      setStatus("error");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Unsupported file type. Please upload an .xlsx file.");
      setStatus("error");
      return;
    }
    setStatus("parsing");
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const text = sheetToText(wb);
      const res = await run({ data: { sheetText: text } });
      const fields = res.fields ?? {};
      const mapped: Extracted = {};
      SCHEMA_FIELDS.forEach((f) => {
        const entry = fields[f.key];
        mapped[f.key] = {
          value: entry?.value === null || entry?.value === undefined ? "" : String(entry.value),
          confidence: entry?.confidence ?? null,
        };
      });
      setValues(mapped);
      setStatus("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
      setStatus("error");
    }
  };

  return (
    <Modal title="Import from Excel" onClose={onClose} wide>
      {(status === "idle" || status === "error") && (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload an .xlsx workbook (max 5MB). Values are reviewed before anything is written to the case.
          </p>
          <label className="inline-block cursor-pointer border border-primary px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
            Choose file
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
          {error && <p className="mt-4 font-mono text-xs text-decline">{error}</p>}
        </div>
      )}

      {status === "parsing" && (
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          Reading workbook and mapping fields…
        </p>
      )}

      {status === "review" && (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            Review the extracted values. Nothing is written until you confirm.
          </p>
          <div className="grid max-h-[50vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {SCHEMA_FIELDS.map((f) => {
              const v = values[f.key];
              const found = v?.value !== "";
              return (
                <div
                  key={f.key}
                  className={cn(
                    "border p-3",
                    found ? "border-border bg-card-inset" : "border-dashed border-border/70",
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {f.label}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[9px] font-bold uppercase tracking-widest",
                        !found && "text-muted-foreground",
                        found && v.confidence === "high" && "text-primary",
                        found && v.confidence === "medium" && "text-foreground",
                        found && v.confidence === "low" && "text-decline",
                      )}
                    >
                      {found ? (v.confidence ?? "unrated") : "not found"}
                    </span>
                  </div>
                  <input
                    className="field-inset"
                    value={v?.value ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [f.key]: { ...prev[f.key], value: e.target.value },
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex gap-2">
            <Btn variant="primary" onClick={() => onConfirm(applyToInputs(inputs, values))}>
              Confirm & Populate Case
            </Btn>
            <Btn onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
