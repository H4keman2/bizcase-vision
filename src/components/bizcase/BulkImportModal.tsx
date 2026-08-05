import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Modal, Btn, LoadingLine } from "./ui";
import { UpgradeNotice } from "./LicenseModals";
import { isLicensed } from "@/lib/bizcase/license";
import { extractCaseFromSheet } from "@/lib/bizcase/ai.functions";
import { calculate } from "@/lib/bizcase/calc";
import { createCase, saveCase, saveVersion } from "@/lib/bizcase/storage";
import { effectiveInputs } from "@/lib/bizcase/types";
import {
  MAX_BATCH_FILES,
  SCHEMA_FIELDS,
  applyToInputs,
  countMapped,
  extractionErrorMessage,
  fileToSheetText,
  hasCriticalFields,
  mapExtracted,
  validateFile,
  validateImport,
  type Extracted,
} from "@/lib/bizcase/import";
import { cn } from "@/lib/utils";

type RowStatus = "success" | "review" | "invalid" | "failed";

interface BulkRow {
  fileName: string;
  name: string;
  status: RowStatus;
  reason?: string;
  mapped: number;
  values?: Extracted;
}

const STATUS_LABEL: Record<RowStatus, string> = {
  success: "Success",
  review: "Needs Review",
  invalid: "Invalid",
  failed: "Failed",
};

export function BulkImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const run = useServerFn(extractCaseFromSheet);
  const [status, setStatus] = useState<"idle" | "parsing" | "review">("idle");
  const [batchError, setBatchError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [licensed, setLicensed] = useState<boolean | null>(null);

  useEffect(() => setLicensed(isLicensed()), []);

  const handleFiles = async (fileList: FileList) => {
    const files = Array.from(fileList);
    if (files.length > MAX_BATCH_FILES) {
      setBatchError(
        `Too many files — up to ${MAX_BATCH_FILES} files can be imported at once (${files.length} selected).`,
      );
      return;
    }
    setBatchError(null);
    setStatus("parsing");

    const out: BulkRow[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Processing ${i + 1} of ${files.length}: ${file.name}`);
      const base: BulkRow = {
        fileName: file.name,
        name: file.name.replace(/\.[^.]+$/, ""),
        status: "failed",
        mapped: 0,
      };
      const invalid = validateFile(file);
      if (invalid) {
        out.push({ ...base, reason: invalid });
        continue;
      }
      try {
        const text = await fileToSheetText(file);
        const res = await run({ data: { sheetText: text } });
        const values = mapExtracted(res.fields);
        const issues = validateImport(values);
        const complete = hasCriticalFields(values);
        out.push({
          ...base,
          status: issues.length ? "invalid" : complete ? "success" : "review",
          reason: issues.length
            ? issues.map((i) => i.message).join(" ")
            : complete
              ? undefined
              : "Missing investment or benefit data — case will show $0 returns until completed.",
          mapped: countMapped(values),
          values,
        });
      } catch (e) {
        out.push({ ...base, reason: extractionErrorMessage(e) });
      }
    }

    setRows(out);
    setStatus("review");
  };

  const importable = rows.filter(
    (r) => r.status !== "failed" && r.status !== "invalid" && r.values,
  );

  const confirm = () => {
    importable.forEach((row) => {
      const record = createCase(row.name.trim() || row.fileName);
      const inputs = applyToInputs(record.draft.inputs, row.values!);
      const mode = record.mode ?? "simple";
      const outputs = calculate(effectiveInputs(inputs, mode));
      const draft = { inputs, outputs };
      saveCase({ ...record, draft });
      saveVersion(record.id, "v1 — Imported", draft);
    });
    onImported();
  };

  if (licensed === false) {
    return (
      <Modal title="Import Multiple Cases" onClose={onClose}>
        <UpgradeNotice reason="Bulk Excel import is part of the full version." />
        <div className="mt-5">
          <Btn onClick={onClose}>Close</Btn>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Import Multiple Cases" onClose={onClose} wide>
      {status === "idle" && (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            Select up to {MAX_BATCH_FILES} .xlsx workbooks (max 5MB each). Each file becomes its own
            case. Nothing is created until you confirm.
          </p>
          <label className="inline-block cursor-pointer border border-primary px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
            Choose files
            <input
              type="file"
              accept=".xlsx"
              multiple
              aria-label="Choose .xlsx workbooks to import"
              className="sr-only"
              onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
            />
          </label>
          {batchError && <p className="mt-4 font-mono text-xs text-decline">{batchError}</p>}
        </div>
      )}

      {status === "parsing" && <LoadingLine label={progress} />}

      {status === "review" && (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            {importable.length} of {rows.length} file{rows.length === 1 ? "" : "s"} ready to import.
            Files with errors are skipped — fix them in the workbook and re-import.
          </p>
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
            {rows.map((row, i) => (
              <div key={`${row.fileName}-${i}`} className="border border-border bg-card-inset p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {row.fileName}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[9px] font-bold uppercase tracking-widest",
                      row.status === "success" && "text-primary",
                      row.status === "review" && "text-warning",
                      row.status === "invalid" && "text-decline",
                      row.status === "failed" && "text-decline",
                    )}
                  >
                    {STATUS_LABEL[row.status]}
                  </span>
                </div>
                {row.status !== "failed" && row.status !== "invalid" ? (
                  <>
                    <input
                      className="field-inset"
                      value={row.name}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)),
                        )
                      }
                    />
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {row.mapped} of {SCHEMA_FIELDS.length} fields mapped
                    </p>
                  </>
                ) : null}
                {row.reason ? (
                  <p
                    className={cn(
                      "mt-2 font-mono text-[11px]",
                      row.status === "failed" || row.status === "invalid"
                        ? "text-decline"
                        : "text-warning",
                    )}
                  >
                    {row.reason}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Btn variant="primary" onClick={confirm} disabled={importable.length === 0}>
              Create {importable.length} Case{importable.length === 1 ? "" : "s"}
            </Btn>
            <Btn onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
