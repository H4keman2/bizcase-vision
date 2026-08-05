import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Modal, Btn, LoadingLine } from "./ui";
import { extractCaseFromSheet } from "@/lib/bizcase/ai.functions";
import type { CaseInputs } from "@/lib/bizcase/types";
import {
  SCHEMA_FIELDS,
  applyToInputs,
  extractionErrorMessage,
  fileToSheetText,
  hasCriticalFields,
  mapExtracted,
  validateFile,
  type Extracted,
} from "@/lib/bizcase/import";
import { cn } from "@/lib/utils";

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
    const invalid = validateFile(file);
    if (invalid) {
      setError(invalid);
      setStatus("error");
      return;
    }
    setStatus("parsing");
    setError(null);
    try {
      const text = await fileToSheetText(file);
      const res = await run({ data: { sheetText: text } });
      setValues(mapExtracted(res.fields));
      setStatus("review");
    } catch (e) {
      setError(extractionErrorMessage(e));
      setStatus("error");
    }
  };

  const incomplete = status === "review" && !hasCriticalFields(values);

  return (
    <Modal title="Import from Excel" onClose={onClose} wide>
      {(status === "idle" || status === "error") && (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload an .xlsx workbook (max 5MB). Values are reviewed before anything is written to
            the case.
          </p>
          <label className="inline-block cursor-pointer border border-primary px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
            Choose file
            <input
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
          {error && <p className="mt-4 font-mono text-xs text-decline">{error}</p>}
        </div>
      )}

      {status === "parsing" && <LoadingLine label="Reading workbook and mapping fields…" />}

      {status === "review" && (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            Review the extracted values. Nothing is written until you confirm.
          </p>
          {incomplete && (
            <p className="mb-4 border border-warning bg-warning/10 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-warning">
              Missing investment or benefit data — case will show $0 returns until completed.
            </p>
          )}
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
              Confirm &amp; Populate Case
            </Btn>
            <Btn onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
