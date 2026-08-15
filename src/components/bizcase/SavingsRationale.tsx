import { NumField, SegToggle } from "./ui";
import { cn } from "@/lib/utils";
import {
  computeCostSavingsAnnual,
  computeTimeSavingsAnnual,
  defaultRationale,
  resolveRationale,
  type CaseInputs,
  type TimeUnit,
} from "@/lib/bizcase/types";

type Patch = (fn: (draft: CaseInputs) => void) => void;

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

function ToggleRow({
  title,
  enabled,
  onToggle,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {title}
      </span>
      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => onToggle(!enabled)}
        className={cn(
          "border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors",
          enabled
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card-inset text-muted-foreground hover:text-foreground",
        )}
      >
        Build from assumptions
      </button>
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <p className="mt-2 font-mono text-[11px] text-muted-foreground">
      {label} <span className="font-bold text-primary">= {fmt(value)}/yr</span>
    </p>
  );
}

/**
 * "Show your work" assumption builders for Cost Savings / Yr and Time Savings / Yr.
 * Available to every user — never gated by the license.
 */
export function SavingsRationaleSection({
  inputs,
  patch,
}: {
  inputs: CaseInputs;
  patch: Patch;
}) {
  const r = resolveRationale(inputs);

  /** Applies a mutation to the rationale and re-derives the annual figure. */
  const patchRationale = (fn: (draft: ReturnType<typeof defaultRationale>) => void) =>
    patch((d) => {
      const next = d.benefits.rationale ?? defaultRationale();
      fn(next);
      d.benefits.rationale = next;
      if (next.cost.enabled) d.benefits.costSavingsAnnual = computeCostSavingsAnnual(next.cost);
      if (next.time.enabled) d.benefits.timeSavingsAnnual = computeTimeSavingsAnnual(next.time);
    });

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-foreground">
        Savings Rationale
      </p>

      <div className="flex flex-col gap-3">
        <div className="border border-border bg-card-inset/30 p-3">
          <ToggleRow
            title="Cost Savings / Yr"
            enabled={r.cost.enabled}
            onToggle={(v) => patchRationale((d) => void (d.cost.enabled = v))}
          />
          {r.cost.enabled ? (
            <>
              <div className="mt-3 flex flex-col gap-3">
                <label className="block">
                  <span className="mb-1.5 flex min-h-[1.1rem] items-end font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Driver
                  </span>
                  <input
                    type="text"
                    aria-label="Cost savings driver label"
                    placeholder="e.g. Fewer scan re-tries"
                    className="field-inset w-full px-2.5 text-[13px]"
                    value={r.cost.label}
                    onChange={(e) =>
                      patchRationale((d) => void (d.cost.label = e.target.value.slice(0, 60)))
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-xl">
                  <NumField
                    label="Quantity / Month"
                    value={r.cost.quantityPerMonth}
                    onChange={(v) => patchRationale((d) => void (d.cost.quantityPerMonth = v))}
                  />
                  <NumField
                    label="Value / Unit"
                    prefix="$"
                    value={r.cost.valuePerUnit}
                    onChange={(v) => patchRationale((d) => void (d.cost.valuePerUnit = v))}
                  />
                </div>
              </div>
              <Total
                label={`${r.cost.quantityPerMonth.toLocaleString()}/mo × $${r.cost.valuePerUnit.toLocaleString()} × 12`}
                value={computeCostSavingsAnnual(r.cost)}
              />
            </>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              Typing a flat number above. Switch on to build it from a quantity and unit value.
            </p>
          )}
        </div>

        <div className="border border-border bg-card-inset/30 p-3">
          <ToggleRow
            title="Time Savings / Yr"
            enabled={r.time.enabled}
            onToggle={(v) => patchRationale((d) => void (d.time.enabled = v))}
          />
          {r.time.enabled ? (
            <>
              <div className="mt-3 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3 max-w-xl">
                  <NumField
                    label="Time Saved / Task"
                    value={r.time.perTask}
                    onChange={(v) => patchRationale((d) => void (d.time.perTask = v))}
                  />
                  <div>
                    <span className="mb-1.5 flex min-h-[2.25rem] items-end font-mono text-[10px] uppercase leading-[1.1rem] tracking-widest text-muted-foreground">
                      Unit
                    </span>
                    <SegToggle<TimeUnit>
                      value={r.time.unit}
                      onChange={(v) => patchRationale((d) => void (d.time.unit = v))}
                      options={[
                        { value: "seconds", label: "Sec" },
                        { value: "minutes", label: "Min" },
                      ]}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 max-w-xl">
                  <NumField
                    label="Tasks / Month"
                    value={r.time.tasksPerMonth}
                    onChange={(v) => patchRationale((d) => void (d.time.tasksPerMonth = v))}
                  />
                  <NumField
                    label="Labor Rate / Hr"
                    prefix="$"
                    value={r.time.hourlyRate}
                    onChange={(v) => patchRationale((d) => void (d.time.hourlyRate = v))}
                  />
                </div>
              </div>
              <Total
                label={`${r.time.perTask.toLocaleString()} ${r.time.unit === "minutes" ? "min" : "sec"} × ${r.time.tasksPerMonth.toLocaleString()}/mo × $${r.time.hourlyRate.toLocaleString()}/hr`}
                value={computeTimeSavingsAnnual(r.time)}
              />
            </>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              Typing a flat number above. Switch on to build it from task time, volume and labor
              rate.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
