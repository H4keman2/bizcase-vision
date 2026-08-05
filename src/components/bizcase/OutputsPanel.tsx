import { useState } from "react";
import { Card, Metric, Btn } from "./ui";
import { CashFlowChart } from "./CashFlowChart";
import { fmtCompact, fmtCurrency, fmtMonths, fmtNumber, fmtPercent } from "@/lib/bizcase/format";
import { exportCaseExcel } from "@/lib/bizcase/excel";
import type { CaseInputs, CaseMode, CaseOutputs } from "@/lib/bizcase/types";

export function OutputsPanel({
  inputs,
  outputs,
  onExecSummary,
  onExport,
  exporting,
  onExportExcel,
  onReset,
  mode = "detailed",
}: {
  inputs: CaseInputs;
  outputs: CaseOutputs;
  onExecSummary: () => void;
  onExport: () => void;
  exporting: boolean;
  onExportExcel: () => void;
  onReset?: () => void;
  mode?: CaseMode;
}) {
  const [showChart] = useState(true);
  const chartData = outputs.cashFlowSeries.map((p) => ({ month: p.month, a: p.cumulative }));
  const m = mode === "simple" ? null : outputs.margins;
  const rmType = inputs.benefits.revenueModel.type;

  return (
    <div className="flex flex-col gap-4">
      <Card label="Results">
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Metric
            label="NPV"
            info="npv"
            size="hero"
            value={fmtCompact(outputs.npv)}
            tone={outputs.npv >= 0 ? "positive" : "negative"}
          />
          <Metric
            label="ROI"
            info="roi"
            size="hero"
            value={fmtPercent(outputs.roi, 0)}
            tone={outputs.roi >= 0 ? "positive" : "negative"}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="IRR" info="irr" value={fmtPercent(outputs.irr)} />
          <Metric label="Payback" info="payback" value={fmtMonths(outputs.paybackMonths)} />
          <Metric
            label="Total Investment"
            info="totalInvestment"
            value={fmtCompact(outputs.totalInvestment)}
          />
          {mode === "detailed" && (
            <Metric
              label="Total Revenue"
              info="totalRevenue"
              value={fmtCompact(outputs.totalRevenue)}
            />
          )}
        </div>
      </Card>

      <Card label="Cumulative Cash Flow" info="cumulativeCashFlow">
        {showChart && <CashFlowChart data={chartData} />}
      </Card>

      {m && (
        <Card label="Margin Analysis">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {rmType === "aggregate" ? (
              <Metric
                label="Gross Margin"
                info="grossMargin"
                value={fmtPercent(m.grossMarginPercent)}
              />
            ) : (
              <>
                <Metric
                  label="Contribution / Unit"
                  info="contributionPerUnit"
                  value={fmtCurrency(m.contributionMarginPerUnit, 2)}
                />
                <Metric
                  label="Contribution %"
                  info="contributionMargin"
                  value={fmtPercent(m.contributionMarginPercent)}
                />
                <Metric
                  label="Breakeven Units / Yr"
                  info="breakevenUnits"
                  value={
                    m.breakevenUnitsPerYear === null ? "—" : fmtNumber(m.breakevenUnitsPerYear)
                  }
                />
              </>
            )}
            {inputs.benefits.overhead.enabled && (
              <Metric
                label="Overhead / Yr"
                info="overheadAnnual"
                value={fmtCurrency(m.overheadAnnual)}
              />
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Btn variant="primary" onClick={onExecSummary}>
          Generate Executive Summary
        </Btn>
        <div className="flex flex-col gap-2">
          <Btn onClick={onExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Export to PDF"}
          </Btn>
          <Btn onClick={onExportExcel}>Export to Excel</Btn>
          {onReset && <Btn onClick={onReset}>Reset</Btn>}
        </div>
      </div>
    </div>
  );
}
