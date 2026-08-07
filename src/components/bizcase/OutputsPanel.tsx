import { useState } from "react";
import { Lock } from "lucide-react";
import { Card, Metric, Btn, LockedOverlay } from "./ui";
import { CashFlowChart } from "./CashFlowChart";
import { SeriesChart } from "./SeriesChart";
import {
  fmtCompact,
  fmtCurrency,
  fmtIrr,
  fmtMonths,
  fmtNumber,
  fmtPercent,
} from "@/lib/bizcase/format";
import { exportCaseExcel } from "@/lib/bizcase/excel";
import { useLicensed } from "@/lib/bizcase/license";
import { REGIONS } from "@/lib/bizcase/types";
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
  scenarioRange,
  onLockedFeature,
}: {
  inputs: CaseInputs;
  outputs: CaseOutputs;
  onExecSummary: () => void;
  onExport: () => void;
  exporting: boolean;
  onExportExcel: () => void;
  onReset?: () => void;
  mode?: CaseMode;
  scenarioRange?: { best: number; worst: number } | null;
  onLockedFeature?: (reason: string) => void;
}) {
  const [showChart] = useState(true);
  const chartData = outputs.cashFlowSeries.map((p) => ({ month: p.month, a: p.cumulative }));
  const m = mode === "simple" ? null : outputs.margins;
  const rmType = inputs.benefits.revenueModel.type;
  // Regional is a paid feature — fall back to the flat series if the license
  // was removed after regional data was set (e.g. after signing out).
  const licensed = useLicensed();
  const regionalUnlocked = outputs.regionalEnabled && licensed;
  // Sample even NA/LA/APAC/EMEA split used purely for the blurred locked preview.
  const sampleRegional = outputs.revenueSeries.map((p) => ({
    month: p.month,
    value: p.revenue,
    byRegion: Object.fromEntries(REGIONS.map((r) => [r, p.revenue / REGIONS.length])) as Record<
      (typeof REGIONS)[number],
      number
    >,
  }));

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
          <Metric label="IRR" info="irr" value={fmtIrr(outputs.irr)} />
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

      {mode === "detailed" && rmType !== "none" && (
        <Card label="Revenue Over Time" info="revenueOverTime">
          <SeriesChart
            data={outputs.revenueSeries.map((p) => ({
              month: p.month,
              value: p.revenue,
              byRegion: p.byRegion,
            }))}
            regional={regionalUnlocked}
            valueFormatter={fmtCompact}
            seriesLabel="Revenue"
          />
        </Card>
      )}

      {mode === "detailed" && rmType === "unit" && (
        <Card label="Units Over Time" info="unitsOverTime">
          <SeriesChart
            data={outputs.unitsSeries.map((p) => ({
              month: p.month,
              value: p.units,
              byRegion: p.byRegion,
            }))}
            regional={regionalUnlocked}
            valueFormatter={(v) => fmtNumber(v, 0)}
            seriesLabel="Units"
          />
        </Card>
      )}

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

      {/* Locked/paid previews grouped together after all free content. */}
      {scenarioRange &&
        (licensed ? (
          <Card label="Scenario Range">
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Worst Case NPV"
                value={fmtCompact(scenarioRange.worst)}
                tone={scenarioRange.worst >= 0 ? "positive" : "negative"}
              />
              <Metric
                label="Best Case NPV"
                value={fmtCompact(scenarioRange.best)}
                tone={scenarioRange.best >= 0 ? "positive" : "negative"}
              />
            </div>
          </Card>
        ) : (
          <Card label="Scenario Range">
            <LockedOverlay
              label="Unlock best & worst case"
              onClick={() =>
                onLockedFeature?.("Best and worst case scenarios are part of the full version.")
              }
            >
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Worst Case NPV" value={fmtCompact(scenarioRange.worst)} />
                <Metric label="Best Case NPV" value={fmtCompact(scenarioRange.best)} />
              </div>
            </LockedOverlay>
          </Card>
        ))}

      {mode === "detailed" && rmType !== "none" && !licensed && (
        <Card label="Regional Breakdown">
          <LockedOverlay
            label="Unlock regional breakdown"
            onClick={() =>
              onLockedFeature?.(
                "Regional revenue and unit breakdowns are part of the full version.",
              )
            }
          >
            <SeriesChart
              data={sampleRegional}
              regional
              valueFormatter={fmtCompact}
              seriesLabel="Revenue"
            />
          </LockedOverlay>
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
          {!licensed && (
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <Lock className="h-3 w-3" />
              Free plan exports include a watermark
            </p>
          )}
          <Btn onClick={onExportExcel}>Export to Excel</Btn>
          {onReset && <Btn onClick={onReset}>Reset</Btn>}
        </div>
      </div>
    </div>
  );
}
