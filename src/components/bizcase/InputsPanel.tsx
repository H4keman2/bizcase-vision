import { Card, NumField, SegToggle, Btn } from "./ui";
import { InfoTooltip } from "./InfoTooltip";
import { cn } from "@/lib/utils";
import {
  periodCount,
  PERIODS_PER_YEAR,
  resolveManualSchedule,
  GRANULARITY_LABEL,
  type CaseInputs,
  type CaseMode,
  type RevenueModelType,
  type TimelineType,
  type TimelineGranularity,
  type OverheadBasis,
  type ManualBasis,
} from "@/lib/bizcase/types";
import { resolveRevenueModel, computeOverheadAnnual, distributeEvenly } from "@/lib/bizcase/calc";

type Patch = (fn: (draft: CaseInputs) => void) => void;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function periodLabel(granularity: TimelineGranularity, index: number): string {
  const n = index + 1;
  const prefix = { year: "Year", quarter: "Q", month: "M", week: "W" }[granularity];
  return granularity === "year" ? `${prefix} ${n}` : `${prefix}${n}`;
}

export function InputsPanel({
  inputs,
  onChange,
  mode = "detailed",
}: {
  inputs: CaseInputs;
  onChange: (next: CaseInputs) => void;
  mode?: CaseMode;
}) {
  const patch: Patch = (fn) => {
    const next = clone(inputs);
    fn(next);
    onChange(next);
  };

  const detailed = mode === "detailed";
  const rm = inputs.benefits.revenueModel;
  const tl = inputs.benefits.timeline;
  const years = Math.max(1, Math.ceil(inputs.horizonYears));
  const manualSchedule = resolveManualSchedule(tl.manual);
  const manualGranularity = manualSchedule.granularity;
  const manualBasis: ManualBasis = manualSchedule.basis;
  const manualValues = manualSchedule.values ?? [];
  const manualPeriods = periodCount(inputs.horizonYears, manualGranularity);

  /** Annual run-rate for a manual schedule basis. */
  const annualRunRate = (basis: ManualBasis) => {
    if (basis === "units") return rm.unit.unitsPerYear;
    const { revenueAnnual, cogsAnnual } = resolveRevenueModel(rm);
    return (
      inputs.benefits.costSavingsAnnual +
      inputs.benefits.timeSavingsAnnual +
      revenueAnnual -
      cogsAnnual -
      computeOverheadAnnual(inputs)
    );
  };

  /**
   * Seed a manual schedule so the periods sum to exactly the annual run-rate
   * times the horizon (remainder spread across the earliest periods).
   */
  const seedValues = (
    horizonYears: number,
    granularity: TimelineGranularity,
    basis: ManualBasis,
    annual = annualRunRate(basis),
  ) => distributeEvenly(Math.round(annual * horizonYears), periodCount(horizonYears, granularity));

  const setManual = (granularity: TimelineGranularity, basis: ManualBasis) =>
    patch((d) => {
      d.benefits.timeline.manual = {
        granularity,
        basis,
        values: seedValues(d.horizonYears, granularity, basis),
      };
    });

  const manualTotal = manualValues
    .slice(0, manualPeriods)
    .reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
  const manualTarget = Math.round(annualRunRate(manualBasis) * years);
  const manualDrift = manualTotal - manualTarget;
  const manualOffTarget =
    tl.type === "manual" && manualTarget !== 0 && Math.abs(manualDrift) >= 1;
  const hasNegativeUnits = manualBasis === "units" && manualValues.some((v) => v < 0);

  return (
    <div className="flex flex-col gap-4">
      <Card label="Investment">
        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="NRE"
            info="nre"
            prefix="$"
            value={inputs.investment.nre}
            onChange={(v) => patch((d) => void (d.investment.nre = v))}
          />
          <NumField
            label="Upfront Capex"
            info="upfront"
            prefix="$"
            value={inputs.investment.upfront}
            onChange={(v) => patch((d) => void (d.investment.upfront = v))}
          />
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Phased Capex
            </p>
            <Btn
              onClick={() => patch((d) => void d.investment.phased.push({ month: 6, amount: 0 }))}
            >
              + Add
            </Btn>
          </div>
          {inputs.investment.phased.length === 0 ? (
            <p className="font-mono text-[11px] text-muted-foreground">None scheduled</p>
          ) : (
            <div className="flex flex-col gap-2">
              {inputs.investment.phased.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <NumField
                    label="Month"
                    info="phasedMonth"
                    value={p.month}
                    onChange={(v) => patch((d) => void (d.investment.phased[i].month = v))}
                  />
                  <NumField
                    label="Amount"
                    info="phasedAmount"
                    prefix="$"
                    value={p.amount}
                    onChange={(v) => patch((d) => void (d.investment.phased[i].amount = v))}
                  />
                  <Btn
                    variant="danger"
                    onClick={() => patch((d) => void d.investment.phased.splice(i, 1))}
                  >
                    ✕
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card label="Benefits">
        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="Cost Savings / Yr"
            info="costSavingsAnnual"
            prefix="$"
            value={inputs.benefits.costSavingsAnnual}
            onChange={(v) => patch((d) => void (d.benefits.costSavingsAnnual = v))}
          />
          <NumField
            label="Time Savings / Yr"
            info="timeSavingsAnnual"
            prefix="$"
            value={inputs.benefits.timeSavingsAnnual}
            onChange={(v) => patch((d) => void (d.benefits.timeSavingsAnnual = v))}
          />
        </div>

        {detailed && (
          <>
            <p className="mb-2 mt-4 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Revenue Model
              <InfoTooltip field="revenueModel" />
            </p>
            <SegToggle<RevenueModelType>
              value={rm.type}
              onChange={(v) =>
                patch((d) => {
                  const wasNone = d.benefits.revenueModel.type === "none";
                  d.benefits.revenueModel.type = v;
                  // Turning on a revenue model for the first time defaults overhead
                  // to enabled — the user can still switch it off if they don't want it.
                  if (wasNone && v !== "none") d.benefits.overhead.enabled = true;
                })
              }
              options={[
                { value: "none", label: "None" },
                { value: "aggregate", label: "Aggregate" },
                { value: "unit", label: "Unit-Level" },
              ]}
            />

            {rm.type === "aggregate" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <NumField
                  label="Revenue Lift / Yr"
                  info="revenueLiftAnnual"
                  prefix="$"
                  value={rm.aggregate.revenueLiftAnnual}
                  onChange={(v) =>
                    patch((d) => void (d.benefits.revenueModel.aggregate.revenueLiftAnnual = v))
                  }
                />
                <NumField
                  label="COGS / Yr"
                  info="cogsAnnual"
                  prefix="$"
                  value={rm.aggregate.cogsAnnual}
                  onChange={(v) =>
                    patch((d) => void (d.benefits.revenueModel.aggregate.cogsAnnual = v))
                  }
                />
              </div>
            )}

            {rm.type === "unit" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <NumField
                  label="Price / Unit"
                  info="pricePerUnit"
                  prefix="$"
                  value={rm.unit.pricePerUnit}
                  onChange={(v) =>
                    patch((d) => void (d.benefits.revenueModel.unit.pricePerUnit = v))
                  }
                />
                <NumField
                  label="Variable Cost / Unit"
                  info="variableCostPerUnit"
                  prefix="$"
                  value={rm.unit.variableCostPerUnit}
                  onChange={(v) =>
                    patch((d) => void (d.benefits.revenueModel.unit.variableCostPerUnit = v))
                  }
                />
                <NumField
                  label="Fixed Costs / Yr"
                  info="fixedCostsAnnual"
                  prefix="$"
                  value={rm.unit.fixedCostsAnnual}
                  onChange={(v) =>
                    patch((d) => void (d.benefits.revenueModel.unit.fixedCostsAnnual = v))
                  }
                />
                <NumField
                  label="Units / Yr"
                  info="unitsPerYear"
                  value={rm.unit.unitsPerYear}
                  onChange={(v) =>
                    patch((d) => {
                      d.benefits.revenueModel.unit.unitsPerYear = v;
                      // Keep a units-based manual schedule in sync: spread the
                      // annual units evenly across every period.
                      if (manualBasis === "units") {
                        d.benefits.timeline.manual = {
                          granularity: manualGranularity,
                          basis: "units",
                          values: new Array(
                            periodCount(d.horizonYears, manualGranularity),
                          ).fill(v / PERIODS_PER_YEAR[manualGranularity]),
                        };
                      }
                    })
                  }
                />
              </div>
            )}
          </>
        )}
      </Card>

      {detailed && rm.type !== "none" && (
        <Card
          label="Overhead"
          info="overhead"
          action={
            <button
              type="button"
              onClick={() =>
                patch((d) => void (d.benefits.overhead.enabled = !d.benefits.overhead.enabled))
              }
              className={`border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest ${
                inputs.benefits.overhead.enabled
                  ? "border-primary bg-primary text-primary-foreground hover:opacity-85"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {inputs.benefits.overhead.enabled ? "Enabled" : "Disabled"}
            </button>
          }
        >
          {inputs.benefits.overhead.enabled ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Basis
                </p>
                <SegToggle<OverheadBasis>
                  value={inputs.benefits.overhead.basis}
                  onChange={(v) => patch((d) => void (d.benefits.overhead.basis = v))}
                  options={[
                    { value: "cogs", label: "COGS" },
                    { value: "revenue", label: "Revenue" },
                  ]}
                />
              </div>
              <NumField
                label="Overhead %"
                info="overheadPercent"
                suffix="%"
                value={inputs.benefits.overhead.percent}
                onChange={(v) => patch((d) => void (d.benefits.overhead.percent = v))}
              />
            </div>
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">
              Overhead is excluded from cash flow and margin math.
            </p>
          )}
        </Card>
      )}

      <Card label="Timeline" info="timeline">
        <SegToggle<TimelineType>
          value={tl.type}
          onChange={(v) => {
            if (v === "manual" && !manualSchedule.values?.some((x) => x !== 0)) {
              patch((d) => {
                d.benefits.timeline.type = v;
                d.benefits.timeline.manual = {
                  granularity: manualGranularity,
                  basis: manualBasis,
                  values: seedValues(d.horizonYears, manualGranularity, manualBasis),
                };
              });
              return;
            }
            patch((d) => void (d.benefits.timeline.type = v));
          }}
          options={[
            { value: "flat", label: "Flat" },
            { value: "manual", label: "Manual" },
            { value: "ramp", label: "Ramp" },
          ]}
        />
        {tl.type === "flat" && (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            Benefits apply at a constant monthly rate across the horizon.
          </p>
        )}
        {tl.type === "manual" && (
          <div className="mt-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Enter value per period
              </p>
              <div className="w-[280px]">
                <SegToggle<TimelineGranularity>
                  value={manualGranularity}
                  onChange={(v) => setManual(v, manualBasis)}
                  options={(["year", "quarter", "month", "week"] as const).map((g) => ({
                    value: g,
                    label: GRANULARITY_LABEL[g],
                  }))}
                />
              </div>
            </div>

            {detailed && rm.type === "unit" && (
              <div className="mb-3 w-[220px]">
                <SegToggle<ManualBasis>
                  value={manualBasis}
                  onChange={(v) => setManual(manualGranularity, v)}
                  options={[
                    { value: "amount", label: "Net $" },
                    { value: "units", label: "Units" },
                  ]}
                />
              </div>
            )}

            <div
              className={cn(
                "grid gap-3",
                manualGranularity === "week"
                  ? "grid-cols-3 sm:grid-cols-4"
                  : manualGranularity === "month"
                    ? "grid-cols-3"
                    : "grid-cols-2 sm:grid-cols-3",
                manualPeriods > 12 && "max-h-64 overflow-y-auto pr-1",
              )}
            >
              {Array.from({ length: manualPeriods }).map((_, i) => (
                <NumField
                  key={i}
                  label={periodLabel(manualGranularity, i)}
                  info="manualValue"

                  prefix={manualBasis === "amount" ? "$" : undefined}
                  suffix={manualBasis === "units" ? "u" : undefined}
                  value={manualValues[i] ?? 0}
                  onChange={(v) =>
                    patch((d) => {
                      const manual = d.benefits.timeline.manual;
                      const next = [...(manual.values ?? [])];
                      while (next.length <= i) next.push(0);
                      next[i] = v;
                      d.benefits.timeline.manual = {
                        granularity: manualGranularity,
                        basis: manualBasis,
                        values: next,
                      };
                    })
                  }
                />
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {manualBasis === "units"
                ? `Units sold in each ${GRANULARITY_LABEL[manualGranularity].toLowerCase()}, priced with the unit revenue model. Cost & time savings still apply on top.`
                : `Total net benefit booked in each ${GRANULARITY_LABEL[manualGranularity].toLowerCase()}. These values replace the annual run-rate benefits above.`}
            </p>
          </div>
        )}
        {tl.type === "ramp" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumField
              label="Year 1"
              info="rampYear1"
              suffix="%"
              value={tl.ramp.year1Percent}
              onChange={(v) => patch((d) => void (d.benefits.timeline.ramp.year1Percent = v))}
            />
            <NumField
              label="Growth / Yr"
              info="rampGrowth"
              suffix="%"
              value={tl.ramp.growthRatePercent}
              onChange={(v) => patch((d) => void (d.benefits.timeline.ramp.growthRatePercent = v))}
            />
          </div>
        )}
      </Card>

      <Card label="Horizon & Discount Rate">
        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="Horizon (Years)"
            info="horizonYears"
            value={inputs.horizonYears}
            onChange={(v) => patch((d) => void (d.horizonYears = Math.max(1, Math.round(v))))}
          />
          <NumField
            label="Discount Rate (Annual)"
            info="discountRate"
            suffix="%"
            step={0.5}
            value={inputs.discountRateAnnual}
            onChange={(v) => patch((d) => void (d.discountRateAnnual = v))}
          />
        </div>
      </Card>
    </div>
  );
}
