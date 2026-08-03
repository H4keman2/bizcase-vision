import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Screen, Btn, Modal } from "@/components/bizcase/ui";
import { createCase, listCases, deleteCase } from "@/lib/bizcase/storage";
import { fmtCompact, fmtDate } from "@/lib/bizcase/format";
import type { CaseRecord } from "@/lib/bizcase/types";

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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card-inset px-3 py-3">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="data-mono text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function BackdropChart() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 200"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.13]"
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

function AboutSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/85" onClick={onClose}>
      <div
        className="surface-card w-full max-w-2xl animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="label-eyebrow">About BizCase Builder</p>
          <button
            onClick={onClose}
            className="font-mono text-xs text-muted-foreground hover:text-foreground"
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

  useEffect(() => setCases(listCases()), []);

  const onNew = () => {
    const record = createCase("Untitled Case");
    navigate({ to: "/case/$caseId", params: { caseId: record.id } });
  };

  return (
    <Screen>
      <div className="mb-8 flex items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold uppercase tracking-tight text-primary md:text-4xl">
            BizCase Builder
          </h1>
          <p className="mt-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Case Library
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Btn variant="primary" onClick={onNew}>
            + New Case
          </Btn>
          <button
            type="button"
            aria-label="About BizCase Builder"
            onClick={() => setAbout(true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs font-bold text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            ?
          </button>
        </div>
      </div>

      {cases.length === 0 ? (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatTile label="Cases Created" value="0" />
            <StatTile label="Avg ROI Modeled" value="—" />
            <StatTile label="Fastest Payback" value="—" />
          </div>

          <div className="surface-card relative overflow-hidden p-10 text-center">
            <BackdropChart />
            <div className="relative">
              <p className="mb-2 text-base font-semibold">No cases yet</p>
              <p className="mb-6 text-sm text-muted-foreground">
                Create a case to model investment, benefits and returns.
              </p>
              <Btn variant="primary" onClick={onNew}>
                + New Case
              </Btn>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {cases.map((c) => (
            <div
              key={c.id}
              className="surface-card flex items-center justify-between gap-4 px-5 py-4"
            >
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => navigate({ to: "/case/$caseId", params: { caseId: c.id } })}
              >
                <p className="mb-1 truncate text-base font-semibold">{c.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  Updated {fmtDate(c.updatedAt)} · NPV {fmtCompact(c.draft.outputs.npv)}
                </p>
              </button>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
                    {c.latestVersion} {c.latestVersion === 1 ? "version" : "versions"}
                  </p>
                </div>
                <Btn
                  variant="danger"
                  onClick={() => setPendingDelete(c)}
                >
                  Delete
                </Btn>
              </div>
            </div>
          ))}
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

      {about ? <AboutSheet onClose={() => setAbout(false)} /> : null}
    </Screen>
  );
}
