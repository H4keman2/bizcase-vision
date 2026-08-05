import { Card, NumField, SegToggle, Btn } from "./ui";
import { InfoTooltip } from "./InfoTooltip";
import type {
  CaseInputs,
  CaseMode,
  RevenueModelType,
  TimelineType,
  OverheadBasis,
} from "@/lib/bizcase/types";

type Patch = (fn: (draft: CaseInputs) => void) => void;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
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
              onChange={(v) => patch((d) => void (d.benefits.revenueModel.type = v))}
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
                    patch((d) => void (d.benefits.revenueModel.unit.unitsPerYear = v))
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
          onChange={(v) => patch((d) => void (d.benefits.timeline.type = v))}
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
          <div className="mt-3 grid grid-cols-3 gap-3">
            {Array.from({ length: years }).map((_, i) => (
              <NumField
                key={i}
                label={`Year ${i + 1} ×`}
                info="manualMultiplier"
                step={0.1}
                value={tl.manual.yearlyMultipliers[i] ?? 1}
                onChange={(v) =>
                  patch((d) => {
                    const arr = d.benefits.timeline.manual.yearlyMultipliers;
                    while (arr.length < years) arr.push(1);
                    arr[i] = v;
                  })
                }
              />
            ))}
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
