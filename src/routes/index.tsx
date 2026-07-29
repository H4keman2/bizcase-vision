import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Screen, PageHeader, Btn } from "@/components/bizcase/ui";
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

function CaseList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRecord[]>([]);

  useEffect(() => setCases(listCases()), []);

  const onNew = () => {
    const record = createCase("Untitled Case");
    navigate({ to: "/case/$caseId", params: { caseId: record.id } });
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="BizCase Builder"
        title="Your Business Cases"
        action={
          <Btn variant="primary" onClick={onNew}>
            + New Case
          </Btn>
        }
      />

      {cases.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <p className="mb-2 text-base font-semibold">No cases yet</p>
          <p className="mb-6 text-sm text-muted-foreground">
            Create a case to model investment, benefits and returns.
          </p>
          <Btn variant="primary" onClick={onNew}>
            + New Case
          </Btn>
        </div>
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
                  onClick={() => {
                    deleteCase(c.id);
                    setCases(listCases());
                  }}
                >
                  Delete
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
