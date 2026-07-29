import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Modal, Btn } from "./ui";
import { generateExecSummary } from "@/lib/bizcase/ai.functions";
import type { CaseInputs, CaseOutputs } from "@/lib/bizcase/types";

function buildContexts(inputs: CaseInputs, outputs: CaseOutputs) {
  const rm = inputs.benefits.revenueModel;
  const m = outputs.margins;
  let revenueContext =
    "This case is driven by cost and time savings, with no new revenue stream.";
  if (rm.type === "unit" && m) {
    revenueContext = `Revenue is modeled at the unit level with a contribution margin of $${(m.contributionMarginPerUnit ?? 0).toFixed(2)} per unit (${(m.contributionMarginPercent ?? 0).toFixed(0)}%), requiring roughly ${Math.round(m.breakevenUnitsPerYear ?? 0)} units per year to break even on fixed costs.`;
  } else if (rm.type === "aggregate" && m) {
    revenueContext = `Gross margin on the added revenue is ${(m.grossMarginPercent ?? 0).toFixed(0)}%.`;
  }

  const tl = inputs.benefits.timeline;
  const timelineContext =
    tl.type === "ramp"
      ? `Benefits ramp in starting at ${tl.ramp.year1Percent}% of full run rate in year one, growing ${tl.ramp.growthRatePercent}% annually after that.`
      : tl.type === "manual"
        ? "Benefits vary by year per a custom schedule rather than a flat run rate."
        : "Benefits are modeled at a flat run rate across the full horizon.";

  return { revenueContext, timelineContext };
}

export function ExecSummaryModal({
  name,
  inputs,
  outputs,
  onClose,
}: {
  name: string;
  inputs: CaseInputs;
  outputs: CaseOutputs;
  onClose: () => void;
}) {
  const run = useServerFn(generateExecSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { revenueContext, timelineContext } = buildContexts(inputs, outputs);
      const res = await run({
        data: {
          name,
          horizonYears: inputs.horizonYears,
          discountRateAnnual: inputs.discountRateAnnual,
          nre: inputs.investment.nre,
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
      setSummary(res.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Executive Summary" onClose={onClose} wide>
      {!summary && !loading && !error && (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            Generate a plain-English summary of this case for non-financial stakeholders.
          </p>
          <Btn variant="primary" onClick={generate}>
            Generate
          </Btn>
        </div>
      )}

      {loading && (
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          Generating summary…
        </p>
      )}

      {error && (
        <div>
          <p className="mb-4 font-mono text-xs text-decline">{error}</p>
          <Btn onClick={generate}>Retry</Btn>
        </div>
      )}

      {summary && !loading && (
        <div>
          <p className="mb-5 whitespace-pre-wrap border border-border bg-card-inset p-4 text-sm leading-relaxed">
            {summary}
          </p>
          <div className="flex gap-2">
            <Btn
              variant="primary"
              onClick={async () => {
                await navigator.clipboard.writeText(summary);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Btn>
            <Btn onClick={generate}>Regenerate</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
