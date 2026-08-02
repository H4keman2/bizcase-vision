import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Screen, PageHeader, Btn, Modal, SegToggle } from "@/components/bizcase/ui";
import { InfoTooltip } from "@/components/bizcase/InfoTooltip";
import { InputsPanel } from "@/components/bizcase/InputsPanel";
import { OutputsPanel } from "@/components/bizcase/OutputsPanel";
import { ExecSummaryModal, buildContexts } from "@/components/bizcase/ExecSummaryModal";
import { ExcelImportModal } from "@/components/bizcase/ExcelImportModal";
import { calculate } from "@/lib/bizcase/calc";
import { getCase, saveCase, saveVersion, listVersions, createCase } from "@/lib/bizcase/storage";
import { fmtCompact, fmtDate } from "@/lib/bizcase/format";
import { effectiveInputs, zeroInputs } from "@/lib/bizcase/types";
import { exportCasePdf } from "@/lib/bizcase/pdf";
import { exportCaseExcel } from "@/lib/bizcase/excel";
import { generateExecSummary } from "@/lib/bizcase/ai.functions";
import type { CaseInputs, CaseMode, CaseRecord, CaseVersion } from "@/lib/bizcase/types";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/case/$caseId")({
  head: () => ({
    meta: [
      { title: "Case Editor · BizCase Builder" },
      {
        name: "description",
        content:
          "Adjust investment, benefits, overhead and timeline assumptions and watch NPV, IRR, payback and ROI update live.",
      },
      { property: "og:title", content: "Case Editor · BizCase Builder" },
      {
        property: "og:description",
        content: "Live NPV, IRR, payback and margin analysis for your business case.",
      },
    ],
  }),
  component: CaseEditor,
});

function CaseEditor() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [inputs, setInputs] = useState<CaseInputs | null>(null);
  const [versions, setVersions] = useState<CaseVersion[]>([]);
  const [modal, setModal] = useState<null | "save" | "history" | "summary" | "import">(null);
  const [versionLabel, setVersionLabel] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [execSummary, setExecSummary] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const runSummary = useServerFn(generateExecSummary);

  useEffect(() => {
    const r = getCase(caseId);
    if (!r) {
      setNotFound(true);
      return;
    }
    setRecord(r);
    setInputs(r.draft.inputs);
    setVersions(listVersions(caseId));
  }, [caseId]);

  const mode: CaseMode = record?.mode ?? "simple";

  const outputs = useMemo(
    () => (inputs ? calculate(effectiveInputs(inputs, mode)) : null),
    [inputs, mode],
  );


  useEffect(() => {
    if (!record || !inputs || !outputs) return;
    const next = { ...record, draft: { inputs, outputs } };
    saveCase(next);
  }, [inputs, outputs, record]);

  if (notFound) {
    return (
      <Screen>
        <PageHeader eyebrow="BizCase Builder" title="Case not found" />
        <Link to="/" className="font-mono text-xs uppercase tracking-widest text-primary">
          ← Back to cases
        </Link>
      </Screen>
    );
  }

  if (!record || !inputs || !outputs) return <Screen>{null}</Screen>;

  const openSave = () => {
    const label = `v${record.latestVersion + 1} · ${fmtDate(new Date().toISOString())}`;
    setVersionLabel(label);
    setModal("save");
  };

  const confirmSave = () => {
    saveVersion(caseId, versionLabel.trim() || `v${record.latestVersion + 1}`, { inputs, outputs });
    const fresh = getCase(caseId);
    if (fresh) setRecord(fresh);
    setVersions(listVersions(caseId));
    setModal(null);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-2),
    );
  };

  const eff = effectiveInputs(inputs, mode);

  const handleNewCase = () => {
    const created = createCase("Untitled Case");
    navigate({ to: "/case/$caseId", params: { caseId: created.id } });
  };

  const handleReset = () => {
    setInputs(zeroInputs());
  };


  const handleExport = async () => {
    setExporting(true);
    let summary = execSummary;
    if (!summary) {
      try {
        const { revenueContext, timelineContext } = buildContexts(eff, outputs);
        const res = await runSummary({
          data: {
            name: record.name,
            horizonYears: eff.horizonYears,
            discountRateAnnual: eff.discountRateAnnual,
            nre: eff.investment.nre,
            totalInvestment: outputs.totalInvestment,
            totalRevenue: outputs.totalRevenue,
            npv: outputs.npv,
            irr: outputs.irr,
            paybackMonths: outputs.paybackMonths,
            roi: outputs.roi,
            revenueContext,
            timelineContext,
          },
        });
        summary = res.summary;
        setExecSummary(res.summary);
      } catch {
        summary = null;
      }
    }
    exportCasePdf({
      name: record.name,
      versionLabel: versions[0] ? `Draft (after ${versions[0].versionLabel})` : "Draft",
      inputs: eff,
      outputs,
      mode,
      summary,
    });
    setExporting(false);
  };



  return (
    <Screen>
      <PageHeader
        eyebrow="Case Editor"
        titleSlot={
          <input
            value={record.name}
            onChange={(e) => setRecord({ ...record, name: e.target.value })}
            onBlur={() => saveCase(record)}
            className="w-full max-w-lg border border-transparent bg-transparent text-2xl font-bold tracking-tight outline-none focus:border-border focus:bg-card-inset md:text-3xl"
          />
        }
        action={
          <>
            <div className="w-[170px]">
              <SegToggle<CaseMode>
                value={mode}
                onChange={(v) => setRecord({ ...record, mode: v })}
                options={[
                  { value: "simple", label: "Simple" },
                  { value: "detailed", label: "Detailed" },
                ]}
              />
            </div>
            <InfoTooltip field="caseMode" className="self-center" />
            <Btn onClick={() => setModal("import")}>Import from Excel</Btn>
            <Btn onClick={() => navigate({ to: "/" })}>Cases</Btn>
            <Btn variant="primary" onClick={handleNewCase}>
              + New Case
            </Btn>
            <Btn onClick={() => setModal("history")}>History</Btn>
            <Btn
              onClick={() =>
                navigate({
                  to: "/compare/$caseId",
                  params: { caseId },
                  search: { a: versions[0]?.versionNumber ? `v${versions[0].versionNumber}` : "draft", b: "draft" },
                })
              }
            >
              Compare
            </Btn>
            <Btn variant="primary" onClick={openSave}>
              Save Version
            </Btn>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <InputsPanel inputs={inputs} onChange={setInputs} mode={mode} />
        <div className="lg:sticky lg:top-6 lg:self-start">
          <OutputsPanel
            inputs={inputs}
            outputs={outputs}
            mode={mode}
            onExecSummary={() => setModal("summary")}
            onExport={handleExport}
            exporting={exporting}
            onExportExcel={() =>
              exportCaseExcel({
                name: record.name,
                versionLabel: versions[0] ? `Draft (after ${versions[0].versionLabel})` : "Draft",
                inputs: eff,
                outputs,
                mode,
                summary: execSummary,
              })
            }
          />
        </div>
      </div>


      {modal === "save" && (
        <Modal title="Save Version" info="versionLabel" onClose={() => setModal(null)}>
          <label className="mb-4 block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Version label
            </span>
            <input
              className="field-inset"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <Btn variant="primary" onClick={confirmSave}>
              Save
            </Btn>
            <Btn onClick={() => setModal(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {modal === "history" && (
        <Modal title="Version History" info="versionHistory" onClose={() => setModal(null)} wide>
          <div className="flex flex-col gap-2">
            <HistoryRow
              label="Draft (unsaved)"
              sub="Just now"
              npv={outputs.npv}
              isDraft
              selected={selected.includes("draft")}
              onSelect={() => toggleSelect("draft")}
            />
            {versions.map((v) => (
              <HistoryRow
                key={v.versionNumber}
                label={v.versionLabel}
                sub={fmtDate(v.savedAt)}
                npv={v.outputs.npv}
                selected={selected.includes(`v${v.versionNumber}`)}
                onSelect={() => toggleSelect(`v${v.versionNumber}`)}
              />
            ))}
            {versions.length === 0 && (
              <p className="font-mono text-[11px] text-muted-foreground">
                No saved versions yet. Use Save Version to snapshot this draft.
              </p>
            )}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Btn
              variant="primary"
              disabled={selected.length !== 2}
              onClick={() =>
                navigate({
                  to: "/compare/$caseId",
                  params: { caseId },
                  search: { a: selected[0], b: selected[1] },
                })
              }
            >
              Compare Selected
            </Btn>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {selected.length}/2 selected
            </span>
          </div>
        </Modal>
      )}

      {modal === "summary" && (
        <ExecSummaryModal
          name={record.name}
          inputs={eff}
          outputs={outputs}
          onGenerated={setExecSummary}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "import" && (
        <ExcelImportModal
          inputs={inputs}
          onClose={() => setModal(null)}
          onConfirm={(next) => {
            setInputs(next);
            setModal(null);
          }}
        />
      )}
    </Screen>
  );
}

function HistoryRow({
  label,
  sub,
  npv,
  isDraft,
  selected,
  onSelect,
}: {
  label: string;
  sub: string;
  npv: number;
  isDraft?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between border px-4 py-3 text-left",
        selected ? "border-primary bg-card-inset" : "border-border bg-card-inset",
        isDraft && "border-dashed",
      )}
    >
      <div>
        <p className={cn("text-sm font-semibold", isDraft && "text-primary")}>{label}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <p className="data-mono text-sm font-bold">{fmtCompact(npv)}</p>
    </button>
  );
}

