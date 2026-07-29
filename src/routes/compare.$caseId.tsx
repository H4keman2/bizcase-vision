import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Screen, PageHeader, Btn, Card } from "@/components/bizcase/ui";
import { CashFlowChart } from "@/components/bizcase/CashFlowChart";
import { getCase, listVersions } from "@/lib/bizcase/storage";
import { fmtCompact, fmtNumber, fmtPercent } from "@/lib/bizcase/format";
import type { CaseDraft, CaseRecord, CaseVersion } from "@/lib/bizcase/types";
import { cn } from "@/lib/utils";

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
    ],
  }),
  component: Compare,
});

type Option = { id: string; label: string; draft: CaseDraft };

const METRICS = [
  { key: "npv", label: "NPV", fmt: (v: number | null) => fmtCompact(v) },
  { key: "irr", label: "IRR", fmt: (v: number | null) => fmtPercent(v) },
  { key: "payback", label: "Payback", fmt: (v: number | null) => (v === null ? "NEVER" : `${v.toFixed(1)} MO`), inverse: true },
  { key: "roi", label: "ROI", fmt: (v: number | null) => fmtPercent(v, 0) },
  {
    key: "breakeven",
    label: "Breakeven Units / Yr",
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
  const [versions, setVersions] = useState<CaseVersion[]>([]);
  const [showA, setShowA] = useState(true);

  useEffect(() => {
    setRecord(getCase(caseId));
    setVersions(listVersions(caseId));
  }, [caseId]);

  const options: Option[] = useMemo(() => {
    if (!record) return [];
    return [
      { id: "draft", label: "Draft (unsaved)", draft: record.draft },
      ...versions.map((v) => ({
        id: `v${v.versionNumber}`,
        label: v.versionLabel,
        draft: { inputs: v.inputs, outputs: v.outputs } as CaseDraft,
      })),
    ];
  }, [record, versions]);

  if (!record) {
    return (
      <Screen>
        <PageHeader eyebrow="Case Comparison" title="Case not found" />
      </Screen>
    );
  }

  const optA = options.find((o) => o.id === search.a) ?? options[0];
  const optB = options.find((o) => o.id === search.b) ?? options[0];
  if (!optA || !optB) return <Screen>{null}</Screen>;

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

  const select = (side: "a" | "b", id: string) =>
    navigate({ to: "/compare/$caseId", params: { caseId }, search: { ...search, [side]: id } });

  return (
    <Screen>
      <PageHeader
        eyebrow="Case Comparison"
        title={record.name}
        action={
          <Btn onClick={() => navigate({ to: "/case/$caseId", params: { caseId } })}>
            Back to Editor
          </Btn>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {(["a", "b"] as const).map((side) => {
          const opt = side === "a" ? optA : optB;
          return (
            <div
              key={side}
              className={cn(
                "bg-card p-4",
                side === "b" ? "border border-primary" : "border border-border",
              )}
            >
              <p className="label-eyebrow mb-2">Case {side.toUpperCase()}</p>
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

      <div className="mb-4 bg-primary px-5 py-4 text-primary-foreground">
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
          <span className="text-right">Delta</span>
        </div>
        <div className="mt-2 flex flex-col">
          {METRICS.map((m) => {
            const va = metricValue(optA.draft, m.key);
            const vb = metricValue(optB.draft, m.key);
            const hasDelta = va !== null && vb !== null;
            const diff = hasDelta ? vb - va : null;
            const inverse = "inverse" in m ? m.inverse : false;
            const isEven = diff !== null && Math.abs(diff) < 1e-9;
            const better =
              diff === null || isEven ? null : inverse ? diff < 0 : diff > 0;
            return (
              <div
                key={m.key}
                className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center border-t border-border py-3"
              >
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {m.label}
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
