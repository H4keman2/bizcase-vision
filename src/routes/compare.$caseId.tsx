import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Screen, PageHeader, Btn, Card } from "@/components/bizcase/ui";
import { CashFlowChart } from "@/components/bizcase/CashFlowChart";
import { InfoTooltip } from "@/components/bizcase/InfoTooltip";
import { getCase, listCases, listVersions } from "@/lib/bizcase/storage";
import { calculate } from "@/lib/bizcase/calc";
import { exportComparisonPdf } from "@/lib/bizcase/pdf";
import { exportComparisonExcel } from "@/lib/bizcase/excel";
import { fmtCompact, fmtDate, fmtIrr, fmtNumber, fmtPercent } from "@/lib/bizcase/format";
import { effectiveInputs } from "@/lib/bizcase/types";
import type { CaseDraft, CaseRecord } from "@/lib/bizcase/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Search = { a: string; b: string };

export const Route = createFileRoute("/compare/$caseId")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    a: typeof search.a === "string" ? search.a : "draft",
    b: typeof search.b === "string" ? search.b : "draft",
  }),
  head: () => ({
    meta: [
      { title: "Compare Versions · BizCase Builder" },
      {
        name: "description",
        content:
          "Side by side comparison of two business case versions: NPV, IRR, payback, ROI and cumulative cash flow.",
      },
      { property: "og:title", content: "Compare Versions · BizCase Builder" },
      {
        property: "og:description",
        content: "Compare two business case versions on NPV, IRR, payback, ROI and cash flow.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Compare,
});

type Option = { id: string; label: string; draft: CaseDraft };

const METRICS = [
  { key: "npv", label: "NPV", info: "npv", fmt: (v: number | null) => fmtCompact(v) },
  { key: "irr", label: "IRR", info: "irr", fmt: (v: number | null) => fmtIrr(v) },
  {
    key: "payback",
    label: "Payback",
    info: "payback",
    fmt: (v: number | null) => (v === null ? "NEVER" : `${v.toFixed(1)} MO`),
    inverse: true,
  },
  { key: "roi", label: "ROI", info: "roi", fmt: (v: number | null) => fmtPercent(v, 0) },
  {
    key: "breakeven",
    label: "Breakeven Units / Yr",
    info: "breakevenUnits",
    fmt: (v: number | null) => (v === null ? "—" : fmtNumber(v)),
    inverse: true,
  },
] as const;

function metricValue(d: CaseDraft, key: string): number | null {
  const o = d.outputs;
  switch (key) {
    case "npv":
      return o.npv;
    case "irr":
      return o.irr;
    case "payback":
      return o.paybackMonths;
    case "roi":
      return o.roi;
    case "breakeven":
      return o.margins?.breakevenUnitsPerYear ?? null;
    default:
      return null;
  }
}

function Compare() {
  const { caseId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [allCases, setAllCases] = useState<CaseRecord[]>([]);
  const [showA, setShowA] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setRecord(getCase(caseId));
    setAllCases(listCases());
  }, [caseId]);

  const options: Option[] = useMemo(() => {
    const ordered = [
      ...allCases.filter((c) => c.id === caseId),
      ...allCases.filter((c) => c.id !== caseId),
    ];
    const out: Option[] = [];
    for (const c of ordered) {
      const mode = c.mode ?? "detailed";
      // Only saved versions are selectable; unsaved drafts are excluded.
      for (const v of listVersions(c.id)) {
        out.push({
          id: `${c.id}::v${v.versionNumber}`,
          label: `${c.name} · v${v.versionNumber} · ${fmtDate(v.savedAt)}`,
          draft: {
            inputs: v.inputs,
            outputs: calculate(effectiveInputs(v.inputs, mode)),
          },
        });
      }
    }
    return out;
  }, [allCases, caseId]);

  if (!record) {
    return (
      <Screen>
        <PageHeader eyebrow="Compare" title="Case not found" />
      </Screen>
    );
  }

  // Bare ids ("draft" / "v2") refer to the current case for backwards compatibility.
  const resolveExplicit = (id: string) =>
    options.find((o) => o.id === id) ?? options.find((o) => o.id === `${caseId}::${id}`) ?? null;

  const explicitA = resolveExplicit(search.a);
  const explicitB = resolveExplicit(search.b);

  // If either side wasn't an explicit, resolvable selection (i.e. we're on a
  // bare/default landing rather than a user-picked comparison), fall back to
  // two distinct options instead of silently comparing a version against itself.
  // Prefer pairing two different cases; only fall back to two versions of the
  // same case when no other case has a saved version to compare against.
  let optA = explicitA;
  let optB = explicitB;
  if (!optA || !optB || optA.id === optB.id) {
    optA = optA ?? options[0] ?? null;
    const caseIdA = optA?.id.split("::")[0] ?? null;
    optB =
      (optB && optB.id !== optA?.id ? optB : null) ??
      options.find((o) => o.id !== optA?.id && o.id.split("::")[0] !== caseIdA) ??
      options.find((o) => o.id !== optA?.id) ??
      null;
  }

  if (!optA || !optB)
    return (
      <Screen>
        <PageHeader
          eyebrow="Compare"
          title="Case Comparison"
          action={
            <Btn onClick={() => navigate({ to: "/case/$caseId", params: { caseId } })}>
              Back to Editor
            </Btn>
          }
        />
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {options.length === 0
            ? "No saved versions yet — save a version to use the compare feature."
            : "Only one saved version available to compare. Save another version, or create a new case, then try again."}
        </p>
      </Screen>
    );

  const npvDelta = optB.draft.outputs.npv - optA.draft.outputs.npv;
  const verdict =
    Math.abs(npvDelta) < 1
      ? "Both options are effectively even"
      : npvDelta > 0
        ? "Case B is the stronger bet"
        : "Case A is the stronger bet";

  const maxLen = Math.max(
    optA.draft.outputs.cashFlowSeries.length,
    optB.draft.outputs.cashFlowSeries.length,
  );
  const chartData = Array.from({ length: maxLen }).map((_, m) => ({
    month: m,
    a: optA.draft.outputs.cashFlowSeries[m]?.cumulative ?? NaN,
    b: optB.draft.outputs.cashFlowSeries[m]?.cumulative ?? NaN,
  }));

  const exportPdf = () =>
    exportComparisonPdf({
      name: "Case Comparison",
      a: {
        name: record.name,
        versionLabel: optA.label,
        inputs: optA.draft.inputs,
        outputs: optA.draft.outputs,
        mode: record.mode ?? "detailed",
      },
      b: {
        name: record.name,
        versionLabel: optB.label,
        inputs: optB.draft.inputs,
        outputs: optB.draft.outputs,
        mode: record.mode ?? "detailed",
      },
    });

  const excelCases = () => ({
    name: "Case Comparison",
    a: {
      name: record.name,
      versionLabel: optA.label,
      inputs: optA.draft.inputs,
      outputs: optA.draft.outputs,
      mode: record.mode ?? ("detailed" as const),
    },
    b: {
      name: record.name,
      versionLabel: optB.label,
      inputs: optB.draft.inputs,
      outputs: optB.draft.outputs,
      mode: record.mode ?? ("detailed" as const),
    },
  });

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const cases = excelCases();
      const missing = (["a", "b"] as const).filter(
        (k) => !cases[k]?.inputs || !cases[k]?.outputs?.cashFlowSeries?.length,
      );
      if (missing.length) {
        throw new Error(
          `Missing case data for ${missing.map((m) => `Case ${m.toUpperCase()}`).join(" and ")}.`,
        );
      }
      // Yield a frame so the button can paint its loading state before the
      // synchronous workbook build blocks the main thread.
      await new Promise((r) => setTimeout(r, 0));
      exportComparisonExcel(cases);
      toast.success("Excel comparison exported");
    } catch (err) {
      toast.error("Excel export failed", {
        description:
          err instanceof Error ? err.message : "Unexpected error while building the workbook.",
      });
    } finally {
      setExporting(false);
    }
  };

  const select = (side: "a" | "b", id: string) =>
    navigate({ to: "/compare/$caseId", params: { caseId }, search: { ...search, [side]: id } });

  return (
    <Screen>
      <PageHeader
        eyebrow="Compare"
        title="Case Comparison"
        action={
          <>
            <Btn onClick={() => exportPdf()}>Export PDF</Btn>
            <Btn onClick={handleExportExcel} disabled={exporting}>
              {exporting ? "Exporting…" : "Export Excel"}
            </Btn>
            <Btn onClick={() => navigate({ to: "/case/$caseId", params: { caseId } })}>
              Back to Editor
            </Btn>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {(["a", "b"] as const).map((side) => {
          const opt = side === "a" ? optA : optB;
          return (
            <div
              key={side}
              className={cn(
                "bg-card p-4 transition-colors",
                side === "b"
                  ? "border border-primary"
                  : "border border-border hover:border-muted-foreground",
              )}
            >
              <p className="label-eyebrow mb-2 flex items-center gap-1.5">
                Case {side.toUpperCase()}
                <InfoTooltip field="compareSelect" />
              </p>
              <select
                className="field-inset"
                value={opt.id}
                onChange={(e) => select(side, e.target.value)}
              >
                {options.map((o) => (
                  <option key={o.id} value={o.id} className="bg-card">
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="data-mono mt-3 text-xl font-bold">
                {fmtCompact(opt.draft.outputs.npv)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mb-4 bg-primary px-5 py-4 text-primary-foreground animate-in fade-in slide-in-from-top-2 duration-300">
        <p className="font-mono text-sm font-bold uppercase tracking-wide">
          {verdict} · {npvDelta >= 0 ? "+" : "-"}
          {fmtCompact(Math.abs(npvDelta))} NPV
        </p>
      </div>

      <Card label="Metrics Ledger" className="mb-4">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-y-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span>Metric</span>
          <span className="text-right">Case A</span>
          <span className="text-right">Case B</span>
          <span className="flex items-center justify-end gap-1.5 text-right">
            Delta
            <InfoTooltip field="compareDelta" />
          </span>
        </div>
        <div className="mt-2 flex flex-col">
          {METRICS.map((m) => {
            const va = metricValue(optA.draft, m.key);
            const vb = metricValue(optB.draft, m.key);
            const hasDelta = va !== null && vb !== null;
            const diff = hasDelta ? vb - va : null;
            const inverse = "inverse" in m ? m.inverse : false;
            const isEven = diff !== null && Math.abs(diff) < 1e-9;
            const better = diff === null || isEven ? null : inverse ? diff < 0 : diff > 0;
            return (
              <div
                key={m.key}
                className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center border-t border-border py-3 transition-colors hover:bg-card-inset/60"
              >
                <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {m.label}
                  <InfoTooltip field={m.info} />
                </span>
                <span className="data-mono text-right text-sm">{m.fmt(va)}</span>
                <span className="data-mono text-right text-sm font-bold">{m.fmt(vb)}</span>
                <span
                  className={cn(
                    "data-mono text-right text-sm font-bold",
                    better === null && "text-muted-foreground",
                    better === true && "text-primary",
                    better === false && "text-decline",
                  )}
                >
                  {diff === null
                    ? "—"
                    : `${better ? "▲" : "▼"} ${m.fmt(Math.abs(diff)).replace("-", "")}`}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        label="Cumulative Cash Flow"
        action={
          <Btn onClick={() => setShowA((s) => !s)}>{showA ? "Hide Case A" : "Show Case A"}</Btn>
        }
      >
        <CashFlowChart
          data={chartData}
          seriesB
          showA={showA}
          labelA={optA.label}
          labelB={optB.label}
        />
      </Card>
    </Screen>
  );
}
