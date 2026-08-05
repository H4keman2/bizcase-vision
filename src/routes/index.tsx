import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Screen, Btn, Modal } from "@/components/bizcase/ui";
import { SettingsGear } from "@/components/bizcase/settings-context";
import { createCase, listCases, deleteCase } from "@/lib/bizcase/storage";
import { fmtCompact, fmtDate, fmtPercent, fmtMonths } from "@/lib/bizcase/format";
import type { CaseRecord } from "@/lib/bizcase/types";
import { BulkImportModal } from "@/components/bizcase/BulkImportModal";
import { CashFlowChart } from "@/components/bizcase/CashFlowChart";
import { aggregateCashFlowSeries } from "@/lib/bizcase/calc";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BizCase Builder — NPV, IRR & ROI Modeling" },
      {
        name: "description",
        content:
          "Model investment decisions with live NPV, IRR, payback and margin analysis. Save versions and compare business cases side by side.",
      },
      { property: "og:title", content: "BizCase Builder — NPV, IRR & ROI Modeling" },
      {
        property: "og:description",
        content:
          "Model investment decisions with live NPV, IRR, payback and margin analysis. Save versions and compare business cases side by side.",
      },
    ],
  }),
  component: CaseList,
});

function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const prefersReduced = useRef(false);

  useEffect(() => {
    prefersReduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (prefersReduced.current) {
      setValue(target);
      return;
    }
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Working late";
}

/** Stable SSR value; the real greeting is applied after hydration so the
 *  server (UTC) and client (local) times don't cause a hydration mismatch. */
const SSR_GREETING = "Welcome back";

function StatTile({
  label,
  value,
  format,
  delay = 0,
  tone = "default",
}: {
  label: string;
  value: number | null;
  format: (v: number) => string;
  delay?: number;
  tone?: "default" | "positive" | "negative";
}) {
  const animated = useCountUp(value ?? 0);
  const accent =
    tone === "positive"
      ? "var(--color-primary)"
      : tone === "negative"
        ? "var(--color-decline)"
        : null;
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 border border-border bg-card-inset px-3 py-3 duration-500"
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: "backwards",
        ...(accent ? { borderLeft: `3px solid ${accent}` } : null),
      }}
    >

      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={`data-mono text-lg font-bold ${
          tone === "positive"
            ? "text-primary"
            : tone === "negative"
              ? "text-decline"
              : "text-foreground"
        }`}
      >
        {value === null ? "—" : format(animated)}
      </p>
    </div>
  );
}

function BackdropChart({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 200"
      preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      {[40, 80, 120, 160].map((y) => (
        <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="var(--color-border)" strokeWidth="1" />
      ))}
      <polyline
        points="0,170 75,158 150,150 225,126 300,118 375,86 450,72 525,44 600,20"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2.5"
      />
      <polyline
        points="0,188 75,180 150,176 225,166 300,158 375,146 450,138 525,124 600,110"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="1.5"
        strokeDasharray="6 6"
      />
    </svg>
  );
}

/** Faint full-page texture — the same data-line motif used in the empty state,
 *  stretched behind the whole screen so it doesn't feel like a void once
 *  cases exist. Fixed to the viewport, sits behind all content. */
function PageBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <BackdropChart className="opacity-[0.14]" />
      <div
        className="absolute left-1/2 top-0 h-[520px] w-[1000px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-[0.16] blur-3xl"
        style={{ background: "var(--color-primary)" }}
      />
    </div>
  );
}

/** Aggregate cumulative cash flow across every saved case — real content and
 *  real color for the space below the case list. */
function PortfolioChart({ cases }: { cases: CaseRecord[] }) {

  const data = aggregateCashFlowSeries(cases.map((c) => c.draft.outputs.cashFlowSeries ?? []));
  if (data.length < 2) return null;
  const final = data[data.length - 1].a;
  const breakEven = data.find((d) => d.a >= 0 && d.month > 0)?.month ?? null;

  return (
    <section className="surface-card mt-4 p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Portfolio</p>
          <h2 className="text-base font-bold uppercase tracking-tight">
            Aggregate Cumulative Cash Flow
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            All {cases.length} {cases.length === 1 ? "case" : "cases"} combined
          </p>
        </div>
        <div className="flex gap-6">
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Net at horizon
            </p>
            <p
              className={`data-mono text-lg font-bold ${final >= 0 ? "text-primary" : "text-decline"}`}
            >
              {fmtCompact(final)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Break-even
            </p>
            <p className="data-mono text-lg font-bold">
              {breakEven === null ? "—" : fmtMonths(breakEven)}
            </p>
          </div>
        </div>
      </div>
      <CashFlowChart data={data} labelA="Portfolio" />
    </section>
  );
}



function AboutSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/85 p-4 py-10 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="surface-card w-full max-w-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="label-eyebrow">About BizCase Builder</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="border border-transparent px-2 py-1 font-mono text-xs text-muted-foreground hover:border-border hover:text-foreground"
          >
            ESC
          </button>
        </div>
        <div className="space-y-2 p-5 text-sm leading-relaxed text-muted-foreground">
          <p>
            BizCase Builder turns investment assumptions — capital, NRE, cost savings and revenue
            impact — into live NPV, IRR, payback and margin numbers.
          </p>
          <p>
            It is built for product managers and business leads who need a defensible case without
            wrestling a spreadsheet.
          </p>
          <p>
            Save named versions as your thinking changes, then compare them side by side to show
            exactly what moved the return.
          </p>
        </div>
      </div>
    </div>
  );
}

function CaseList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [about, setAbout] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CaseRecord | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [greetingText, setGreetingText] = useState(SSR_GREETING);

  useEffect(() => setCases(listCases()), []);
  useEffect(() => setGreetingText(greeting()), []);

  const onNew = () => {
    const record = createCase("Untitled Case");
    navigate({ to: "/case/$caseId", params: { caseId: record.id } });
  };

  return (
    <Screen>
      <PageBackdrop />
      <div className="mb-8 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold uppercase tracking-tight text-primary md:text-4xl">
              BizCase Builder
            </h1>
            <p className="mt-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {greetingText} —{" "}
              {cases.length === 0 ? "let's build your first case" : "ready when you are"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:hidden">
            <button
              type="button"
              aria-label="About BizCase Builder"
              onClick={() => setAbout(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs font-bold text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              ?
            </button>
            <SettingsGear />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Btn variant="primary" onClick={onNew}>
            + New Case
          </Btn>
          <Btn onClick={() => setBulkOpen(true)}>Import Multiple Cases</Btn>
          <button
            type="button"
            aria-label="About BizCase Builder"
            onClick={() => setAbout(true)}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs font-bold text-muted-foreground transition-colors hover:border-foreground hover:text-foreground sm:flex"
          >
            ?
          </button>
          <span className="hidden sm:block">
            <SettingsGear />
          </span>
        </div>
      </div>


      {cases.length === 0 ? (
        <div className="surface-card relative overflow-hidden p-10 text-center">
          <BackdropChart className="opacity-[0.13]" />
          <div className="relative animate-in fade-in zoom-in-95 duration-500">
            <p className="mb-2 text-base font-semibold">Ready when you are</p>
            <p className="mb-6 text-sm text-muted-foreground">
              Create a case to model investment, benefits and returns.
            </p>
            <Btn variant="primary" onClick={onNew}>
              + New Case
            </Btn>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="mb-1 grid grid-cols-3 gap-3">
            <StatTile label="Cases" value={cases.length} format={(v) => String(Math.round(v))} />
            <StatTile
              label="Avg ROI Modeled"
              delay={60}
              tone={
                cases.length
                  ? cases.reduce((s, c) => s + c.draft.outputs.roi, 0) / cases.length >= 0
                    ? "positive"
                    : "negative"
                  : "default"
              }
              value={
                cases.length
                  ? cases.reduce((s, c) => s + c.draft.outputs.roi, 0) / cases.length
                  : null
              }
              format={(v) => fmtPercent(v, 0)}
            />
            <StatTile
              label="Fastest Payback"
              delay={120}
              value={(() => {
                const paybacks = cases
                  .map((c) => c.draft.outputs.paybackMonths)
                  .filter((p): p is number => p !== null);
                return paybacks.length ? Math.min(...paybacks) : null;
              })()}
              format={(v) => fmtMonths(v)}
            />
          </div>
          {cases.map((c, i) => {
            const positive = c.draft.outputs.npv >= 0;
            return (
              <div
                key={c.id}
                className="group surface-card animate-in fade-in slide-in-from-bottom-2 flex items-center justify-between gap-4 px-5 py-4 duration-500"
                style={{
                  animationDelay: `${Math.min(i, 8) * 40}ms`,
                  animationFillMode: "backwards",
                  borderLeft: `3px solid ${
                    positive ? "var(--color-primary)" : "var(--color-decline)"
                  }`,
                }}
              >

                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => navigate({ to: "/case/$caseId", params: { caseId: c.id } })}
                >
                  <p className="mb-1 truncate text-base font-semibold group-hover:text-primary">
                    {c.name}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Updated {fmtDate(c.updatedAt)} · NPV{" "}
                    <span className={positive ? "text-primary" : "text-decline"}>
                      {fmtCompact(c.draft.outputs.npv)}
                    </span>
                  </p>
                </button>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
                      {c.latestVersion} {c.latestVersion === 1 ? "version" : "versions"}
                    </p>
                  </div>
                  <Btn variant="danger" onClick={() => setPendingDelete(c)}>
                    Delete
                  </Btn>
                </div>
              </div>
            );
          })}
          <PortfolioChart cases={cases} />
        </div>
      )}


      {pendingDelete && (
        <Modal title="Delete Case" onClose={() => setPendingDelete(null)}>
          <p className="mb-5 text-sm text-muted-foreground">
            Delete “{pendingDelete.name}”? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Btn
              variant="danger"
              onClick={() => {
                deleteCase(pendingDelete.id);
                setCases(listCases());
                setPendingDelete(null);
              }}
            >
              Delete
            </Btn>
            <Btn onClick={() => setPendingDelete(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {bulkOpen && (
        <BulkImportModal
          onClose={() => setBulkOpen(false)}
          onImported={() => {
            setBulkOpen(false);
            setCases(listCases());
          }}
        />
      )}

      {about ? <AboutSheet onClose={() => setAbout(false)} /> : null}
    </Screen>
  );
}
