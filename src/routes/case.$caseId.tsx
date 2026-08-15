import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Screen, PageHeader, Btn, Modal, SegToggle, LockedHover } from "@/components/bizcase/ui";
import { InfoTooltip } from "@/components/bizcase/InfoTooltip";
import { InputsPanel } from "@/components/bizcase/InputsPanel";
import { OutputsPanel } from "@/components/bizcase/OutputsPanel";
import { ExecSummaryModal, buildSummaryPayload } from "@/components/bizcase/ExecSummaryModal";
import { ExcelImportModal } from "@/components/bizcase/ExcelImportModal";
import { UpgradeModal } from "@/components/bizcase/LicenseModals";
import { LicenseLimitError, isLicensed, useLicensed } from "@/lib/bizcase/license";
import { calculate } from "@/lib/bizcase/calc";
import { getCase, saveCase, saveVersion, listVersions, createCase } from "@/lib/bizcase/storage";
import { fmtCompact, fmtDate } from "@/lib/bizcase/format";
import { effectiveInputs, zeroInputs, applyScenario } from "@/lib/bizcase/types";
import { exportCasePdf } from "@/lib/bizcase/pdf";
import { exportCaseExcel, downloadImportTemplate } from "@/lib/bizcase/excel";
import { generateExecSummary, type ExecSummary } from "@/lib/bizcase/ai.functions";
import { loadSettings } from "@/lib/bizcase/settings";
import type { CaseInputs, CaseMode, CaseRecord, CaseVersion, Scenario } from "@/lib/bizcase/types";
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
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CaseEditor,
});

function CaseEditor() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const licensed = useLicensed();
  const [inputs, setInputs] = useState<CaseInputs | null>(null);
  const [versions, setVersions] = useState<CaseVersion[]>([]);
  const [modal, setModal] = useState<null | "save" | "history" | "summary" | "import" | "reset">(
    null,
  );
  const [scenario, setScenario] = useState<Scenario>("expected");
  const [versionLabel, setVersionLabel] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [execSummary, setExecSummary] = useState<ExecSummary | null>(null);
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const runSummary = useServerFn(generateExecSummary);
  const [scenarioAdjustments, setScenarioAdjustments] = useState(loadSettings().scenario);

  useEffect(() => {
    const r = getCase(caseId);
    if (!r) {
      setNotFound(true);
      return;
    }
    setRecord(r);
    setInputs(r.draft.inputs);
    setVersions(listVersions(caseId));
    setScenarioAdjustments(loadSettings().scenario);
  }, [caseId]);

  const mode: CaseMode = record?.mode ?? "simple";

  const outputs = useMemo(
    () =>
      inputs
        ? calculate(applyScenario(effectiveInputs(inputs, mode), scenario, scenarioAdjustments))
        : null,
    [inputs, mode, scenario, scenarioAdjustments],
  );

  const scenarioRange = useMemo(() => {
    if (!inputs) return null;
    const base = effectiveInputs(inputs, mode);
    return {
      best: calculate(applyScenario(base, "best", scenarioAdjustments)).npv,
      worst: calculate(applyScenario(base, "worst", scenarioAdjustments)).npv,
    };
  }, [inputs, mode, scenarioAdjustments]);

  const baseOutputs = useMemo(
    () => (inputs ? calculate(effectiveInputs(inputs, mode)) : null),
    [inputs, mode],
  );

  useEffect(() => {
    if (!isLicensed() && scenario !== "expected") setScenario("expected");
  }, [scenario]);

  useEffect(() => {
    if (!record || !inputs || !baseOutputs) return;
    const next = { ...record, draft: { inputs, outputs: baseOutputs } };
    saveCase(next);
  }, [inputs, baseOutputs, record]);

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

  if (!record || !inputs || !outputs || !baseOutputs) return <Screen>{null}</Screen>;

  const openSave = () => {
    const label = `${record.name} · v${record.latestVersion + 1} · ${fmtDate(new Date().toISOString())}`;
    setVersionLabel(label);
    setModal("save");
  };

  const confirmSave = () => {
    saveVersion(caseId, versionLabel.trim() || `${record.name} · v${record.latestVersion + 1}`, {
      inputs,
      outputs: baseOutputs,
    });
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

  const eff = applyScenario(effectiveInputs(inputs, mode), scenario, scenarioAdjustments);

  const handleNewCase = () => {
    try {
      const created = createCase("Untitled Case");
      navigate({ to: "/case/$caseId", params: { caseId: created.id } });
    } catch (e) {
      if (e instanceof LicenseLimitError) setUpgrade(e.message);
      else throw e;
    }
  };

  const handleReset = () => {
    setInputs(zeroInputs());
    setModal(null);
  };

  const handleExport = async () => {
    setExporting(true);
    let summary = execSummary;
    if (!summary) {
      try {
        const res = await runSummary({ data: buildSummaryPayload(record.name, eff, outputs) });
        summary = res;
        setExecSummary(res);
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
        titleAction={
          <Btn variant="primary" onClick={handleNewCase}>
            + New Case
          </Btn>
        }
        titleSlot={
          <input
            value={record.name}
            aria-label="Business case name"
            onChange={(e) => setRecord({ ...record, name: e.target.value })}
            onBlur={() => saveCase(record)}
            className="w-full max-w-lg border border-border/60 bg-card-inset/40 px-2 py-1 text-2xl font-bold tracking-tight text-foreground outline-none hover:border-border focus:border-primary focus:bg-card-inset md:text-3xl"
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
            <div className="w-[260px]">
              <SegToggle<Scenario>
                value={scenario}
                onChange={setScenario}
                onLockedClick={() =>
                  setUpgrade("Best and worst case scenarios are part of the full version.")
                }
                options={[
                  { value: "worst", label: "Worst", disabled: !licensed },
                  { value: "expected", label: "Expected" },
                  { value: "best", label: "Best", disabled: !licensed },
                ]}
              />
            </div>
            <InfoTooltip field="scenario" className="self-center" />
            {!licensed ? (
              <LockedHover>
                <Btn onClick={() => setModal("import")}>Import from Excel</Btn>
              </LockedHover>
            ) : (
              <Btn onClick={() => setModal("import")}>Import from Excel</Btn>
            )}
            {!licensed ? (
              <LockedHover>
                <button
                  type="button"
                  aria-disabled={true}
                  onClick={() =>
                    setUpgrade("Downloading the import template is part of the full version.")
                  }
                  className={cn(
                    "px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors",
                    "cursor-not-allowed text-muted-foreground/30",
                  )}
                >
                  Download Template
                </button>
              </LockedHover>
            ) : (
              <button
                type="button"
                onClick={() => downloadImportTemplate()}
                className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
              >
                Download Template
              </button>
            )}
            <Btn onClick={() => navigate({ to: "/" })}>Cases</Btn>
            <Btn onClick={() => setModal("history")}>History</Btn>

            <Btn
              onClick={() =>
                navigate({
                  to: "/compare/$caseId",
                  params: { caseId },
                  search: { a: "draft", b: "draft" },
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,780px)_1fr]">
        <InputsPanel
          inputs={inputs}
          onChange={setInputs}
          mode={mode}
          onLockedFeature={(reason) => setUpgrade(reason)}
        />
        <div className="lg:sticky lg:top-6 lg:self-start">
          <OutputsPanel
            inputs={inputs}
            outputs={outputs}
            caseId={caseId}
            mode={mode}
            onExecSummary={() => setModal("summary")}
            onExport={handleExport}
            scenarioRange={scenarioRange}
            onLockedFeature={(reason) => setUpgrade(reason)}
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
            onReset={() => setModal("reset")}
          />
        </div>
      </div>

      {modal === "reset" && (
        <Modal title="Reset Case" onClose={() => setModal(null)}>
          <p className="mb-5 text-sm text-muted-foreground">
            Reset all investment, benefit and timeline inputs for “{record.name}” back to zero? This
            cannot be undone.
          </p>
          <div className="flex gap-2">
            <Btn variant="danger" onClick={handleReset}>
              Reset
            </Btn>
            <Btn onClick={() => setModal(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}

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
          caseId={caseId}
          name={record.name}
          inputs={eff}
          outputs={outputs}
          onGenerated={setExecSummary}
          onClose={() => setModal(null)}
        />
      )}

      {upgrade && <UpgradeModal reason={upgrade} onClose={() => setUpgrade(null)} />}

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
        selected
          ? "border-primary bg-card-inset"
          : "border-border bg-card-inset hover:border-muted-foreground",
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
