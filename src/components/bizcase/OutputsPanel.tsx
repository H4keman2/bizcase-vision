import { useState } from "react";
import { Card, Metric, Btn } from "./ui";
import { CashFlowChart } from "./CashFlowChart";
import { fmtCompact, fmtCurrency, fmtMonths, fmtNumber, fmtPercent } from "@/lib/bizcase/format";
import type { CaseInputs, CaseMode, CaseOutputs } from "@/lib/bizcase/types";

export function OutputsPanel({
  inputs,
  outputs,
  onExecSummary,
  onImport,
  mode = "detailed",
}: {
  inputs: CaseInputs;
  outputs: CaseOutputs;
  onExecSummary: () => void;
  onImport: () => void;
  mode?: CaseMode;
}) {
  const [showChart] = useState(true);
  const chartData = outputs.cashFlowSeries.map((p) => ({ month: p.month, a: p.cumulative }));
  const m = mode === "simple" ? null : outputs.margins;
  const rmType = inputs.benefits.revenueModel.type;


  return (
    <div className="flex flex-col gap-4">
      <Card label="Results">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="NPV" value={fmtCompact(outputs.npv)} tone={outputs.npv >= 0 ? "positive" : "negative"} />
          <Metric label="IRR" value={fmtPercent(outputs.irr)} />
          <Metric label="Payback" value={fmtMonths(outputs.paybackMonths)} />
          <Metric label="ROI" value={fmtPercent(outputs.roi, 0)} tone={outputs.roi >= 0 ? "positive" : "negative"} />
          <Metric label="Total Investment" value={fmtCompact(outputs.totalInvestment)} />
          {mode === "detailed" && (
            <Metric label="Total Revenue" value={fmtCompact(outputs.totalRevenue)} />
          )}

        </div>
      </Card>

      <Card label="Cumulative Cash Flow">
        {showChart && <CashFlowChart data={chartData} />}
      </Card>

      {m && (
        <Card label="Margin Analysis">
          <div className="grid grid-cols-2 gap-3">
            {rmType === "aggregate" ? (
              <Metric label="Gross Margin" value={fmtPercent(m.grossMarginPercent)} />
            ) : (
              <>
                <Metric
                  label="Contribution / Unit"
                  value={fmtCurrency(m.contributionMarginPerUnit, 2)}
                />
                <Metric label="Contribution %" value={fmtPercent(m.contributionMarginPercent)} />
                <Metric
                  label="Breakeven Units / Yr"
                  value={m.breakevenUnitsPerYear === null ? "—" : fmtNumber(m.breakevenUnitsPerYear)}
                />
              </>
            )}
            {inputs.benefits.overhead.enabled && (
              <Metric label="Overhead / Yr" value={fmtCurrency(m.overheadAnnual)} />
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Btn variant="primary" onClick={onExecSummary}>
          Generate Executive Summary
        </Btn>
        <Btn onClick={onImport}>Import from Excel</Btn>
      </div>
    </div>
  );
}
