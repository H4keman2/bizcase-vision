import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Modal, Btn, LoadingLine } from "./ui";
import { generateExecSummary, type ExecSummary } from "@/lib/bizcase/ai.functions";
import { calculate } from "@/lib/bizcase/calc";
import { loadSettings } from "@/lib/bizcase/settings";
import {
  isLicensed,
  canGenerateExecSummary,
  incrementExecSummaryCount,
} from "@/lib/bizcase/license";
import { UpgradeNotice } from "./LicenseModals";
import {
  applyScenario,
  REGIONS,
  REGION_LABEL,
  type CaseInputs,
  type CaseOutputs,
} from "@/lib/bizcase/types";

export function buildContexts(inputs: CaseInputs, outputs: CaseOutputs) {
  const rm = inputs.benefits.revenueModel;
  const m = outputs.margins;
  let revenueContext = "This case is driven by cost and time savings, with no new revenue stream.";
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

/** Margin / breakeven figures, when the active revenue model produces them. */
function marginContext(outputs: CaseOutputs): string {
  const m = outputs.margins;
  if (!m) return "";
  const parts: string[] = [];
  if (m.grossMarginPercent !== null && m.grossMarginPercent !== undefined)
    parts.push(`gross margin is ${m.grossMarginPercent.toFixed(0)}%`);
  if (m.contributionMarginPercent !== null && m.contributionMarginPercent !== undefined)
    parts.push(`contribution margin is ${m.contributionMarginPercent.toFixed(0)}%`);
  if (m.breakevenUnitsPerYear !== null && m.breakevenUnitsPerYear !== undefined)
    parts.push(
      `breakeven is about ${Math.round(m.breakevenUnitsPerYear).toLocaleString()} units per year`,
    );
  return parts.length ? `Margins: ${parts.join(", ")}.` : "";
}

/** One-line description of phased capex timing, when any is scheduled. */
function phasedCapexContext(inputs: CaseInputs): string {
  const phased = inputs.investment.phased.filter((p) => p.amount !== 0);
  if (!phased.length) return "";
  const list = phased
    .map((p) => `$${Math.round(p.amount).toLocaleString()} at month ${p.month}`)
    .join(", ");
  return `Phased capex: ${list}.`;
}

/** Regional unit mix, when a regional breakdown is enabled — paid feature, only
 *  included for licensed users even if the case data has it set. */
function regionalContext(inputs: CaseInputs): string {
  const rm = inputs.benefits.revenueModel;
  if (rm.type !== "unit" || !rm.unit.regional?.enabled || !isLicensed()) return "";
  const total = REGIONS.reduce((s, r) => s + (rm.unit.regional!.unitsPerYear[r] || 0), 0);
  if (total <= 0) return "";
  const parts = REGIONS.map((r) => {
    const units = rm.unit.regional!.unitsPerYear[r] || 0;
    const pct = Math.round((units / total) * 100);
    return `${REGION_LABEL[r]} ${pct}%`;
  });
  return `Regional mix (share of annual units): ${parts.join(", ")}.`;
}

/** Full model payload for a case, including worst/best case NPV from the saved scenario adjustments. */
export function buildSummaryPayload(name: string, inputs: CaseInputs, outputs: CaseOutputs) {
  const { revenueContext, timelineContext } = buildContexts(inputs, outputs);
  const adjustments = loadSettings().scenario;
  let npvWorst: number | null = null;
  let npvBest: number | null = null;
  try {
    npvWorst = calculate(applyScenario(inputs, "worst", adjustments)).npv;
    npvBest = calculate(applyScenario(inputs, "best", adjustments)).npv;
  } catch {
    npvWorst = null;
    npvBest = null;
  }

  return {
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
    npvWorst,
    npvBest,
    marginContext: marginContext(outputs),
    phasedCapexContext: phasedCapexContext(inputs),
    regionalContext: regionalContext(inputs),
  };
}

/** Plain-text rendering for clipboard, email and Slack. */
export function summaryToPlainText(s: ExecSummary): string {
  const lines: string[] = [s.verdict, ""];
  if (s.drivers.length) {
    lines.push("KEY DRIVERS");
    s.drivers.forEach((d) => lines.push(`- ${d}`));
    lines.push("");
  }
  if (s.risks.length) {
    lines.push("RISKS & SENSITIVITIES");
    s.risks.forEach((r) => lines.push(`- ${r}`));
    lines.push("");
  }
  if (s.nextStep) {
    lines.push("RECOMMENDED NEXT STEP");
    lines.push(s.nextStep);
  }
  return lines.join("\n").trim();
}

function SectionLabel({ children, tone }: { children: string; tone?: "risk" }) {
  return (
    <p
      className={`mb-2 font-mono text-[10px] font-bold uppercase tracking-widest ${
        tone === "risk" ? "text-decline" : "text-muted-foreground"
      }`}
    >
      {children}
    </p>
  );
}

export function ExecSummaryModal({
  caseId,
  name,
  inputs,
  outputs,
  onClose,
  onGenerated,
}: {
  caseId: string;
  name: string;
  inputs: CaseInputs;
  outputs: CaseOutputs;
  onClose: () => void;
  onGenerated?: (summary: ExecSummary) => void;
}) {
  const run = useServerFn(generateExecSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ExecSummary | null>(null);
  const [copied, setCopied] = useState(false);
  const [capped, setCapped] = useState(false);

  const generate = async () => {
    if (!canGenerateExecSummary(caseId)) {
      setCapped(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await run({ data: buildSummaryPayload(name, inputs, outputs) });
      setSummary(res);
      incrementExecSummaryCount(caseId);
      onGenerated?.(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const locked = !isLicensed() && (capped || !canGenerateExecSummary(caseId));

  return (
    <Modal title="Executive Summary" onClose={onClose} wide>
      {!summary && !loading && !error && (
        <div>
          {locked ? (
            <UpgradeNotice reason="You've used your free executive summary for this case. Unlock the full version for unlimited summaries on all cases." />
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Generate a plain-English summary of this case for non-financial stakeholders.
              </p>
              <Btn variant="primary" onClick={generate}>
                Generate
              </Btn>
            </>
          )}
        </div>
      )}

      {loading && <LoadingLine label="Generating summary…" />}

      {error && (
        <div>
          <p className="mb-4 font-mono text-xs text-decline">{error}</p>
          <Btn onClick={generate}>Retry</Btn>
        </div>
      )}


      {summary && !loading && (
        <div>
          {summary.verdict && (
            <div className="mb-5 border border-primary bg-primary/10 px-4 py-3">
              <p className="text-base font-bold leading-snug tracking-tight text-primary md:text-lg">
                {summary.verdict}
              </p>
            </div>
          )}

          {summary.drivers.length > 0 && (
            <div className="mb-5 border border-border bg-card-inset p-4">
              <SectionLabel>Key Drivers</SectionLabel>
              <ul className="space-y-1.5">
                {summary.drivers.map((d, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed">
                    <span aria-hidden className="text-primary">
                      •
                    </span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.risks.length > 0 && (
            <div className="mb-5 border border-decline/60 bg-decline/5 p-4">
              <SectionLabel tone="risk">Risks &amp; Sensitivities</SectionLabel>
              <ul className="space-y-1.5">
                {summary.risks.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed">
                    <span aria-hidden className="text-decline">
                      •
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.nextStep && (
            <div className="mb-5 border border-border bg-card-inset p-4">
              <SectionLabel>Recommended Next Step</SectionLabel>
              <p className="text-sm leading-relaxed">{summary.nextStep}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Btn
              variant="primary"
              onClick={async () => {
                await navigator.clipboard.writeText(summaryToPlainText(summary));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Btn>
            {!locked && <Btn onClick={generate}>Regenerate</Btn>}
          </div>

          {locked && (
            <div className="mt-5">
              <UpgradeNotice reason="You've used your free executive summary for this case. Unlock the full version for unlimited summaries on all cases." />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
