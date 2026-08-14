export type RevenueModelType = "none" | "aggregate" | "unit";
export type TimelineType = "flat" | "manual" | "ramp";
export type TimelineGranularity = "year" | "quarter" | "month" | "week";
export type OverheadBasis = "cogs" | "revenue";
export type CaseMode = "simple" | "detailed";
export type ManualBasis = "amount" | "units";
export type Region = "NA" | "LA" | "APAC" | "EMEA";

export const REGIONS: Region[] = ["NA", "LA", "APAC", "EMEA"];

export const REGION_LABEL: Record<Region, string> = {
  NA: "North America",
  LA: "Latin America",
  APAC: "APAC",
  EMEA: "EMEA",
};

/** All-zero regional units map, used as a default/reset value. */
export function zeroRegionalUnits(): Record<Region, number> {
  return { NA: 0, LA: 0, APAC: 0, EMEA: 0 };
}

export const PERIODS_PER_YEAR: Record<TimelineGranularity, number> = {
  year: 1,
  quarter: 4,
  month: 12,
  week: 52,
};

export const GRANULARITY_LABEL: Record<TimelineGranularity, string> = {
  year: "Year",
  quarter: "Quarter",
  month: "Month",
  week: "Week",
};

export interface PhasedCapex {
  month: number;
  amount: number;
}

export type TimeUnit = "seconds" | "minutes";

/** Assumption inputs behind Time Savings / Yr. */
export interface TimeSavingsRationale {
  enabled: boolean;
  /** Time saved per transaction/task, expressed in `unit`. */
  perTask: number;
  unit: TimeUnit;
  tasksPerMonth: number;
  /** Fully-loaded labor cost per hour. */
  hourlyRate: number;
}

/** Assumption inputs behind Cost Savings / Yr. */
export interface CostSavingsRationale {
  enabled: boolean;
  /** Short driver label, e.g. "Fewer scan re-tries". */
  label: string;
  quantityPerMonth: number;
  valuePerUnit: number;
}

export interface SavingsRationale {
  time: TimeSavingsRationale;
  cost: CostSavingsRationale;
}

export function defaultRationale(): SavingsRationale {
  return {
    time: { enabled: false, perTask: 30, unit: "seconds", tasksPerMonth: 1000, hourlyRate: 32 },
    cost: { enabled: false, label: "", quantityPerMonth: 0, valuePerUnit: 0 },
  };
}

/** Normalises a possibly-missing rationale from older saved cases. */
export function resolveRationale(inputs: CaseInputs): SavingsRationale {
  const d = defaultRationale();
  const r = inputs.benefits.rationale;
  if (!r) return d;
  return { time: { ...d.time, ...r.time }, cost: { ...d.cost, ...r.cost } };
}

/** Annual dollar value produced by the time-savings assumptions. */
export function computeTimeSavingsAnnual(t: TimeSavingsRationale): number {
  const hoursPerTask = (t.perTask || 0) / (t.unit === "minutes" ? 60 : 3600);
  return Math.round(hoursPerTask * (t.tasksPerMonth || 0) * 12 * (t.hourlyRate || 0));
}

/** Annual dollar value produced by the cost-savings assumptions. */
export function computeCostSavingsAnnual(c: CostSavingsRationale): number {
  return Math.round((c.quantityPerMonth || 0) * (c.valuePerUnit || 0) * 12);
}

/** e.g. "based on 30 sec/transaction x 1,000 transactions/month x $32/hr labor rate" */
export function describeTimeRationale(t: TimeSavingsRationale): string | null {
  if (!t.enabled) return null;
  const unit = t.unit === "minutes" ? "min" : "sec";
  return `based on ${t.perTask.toLocaleString()} ${unit}/transaction x ${t.tasksPerMonth.toLocaleString()} transactions/month x $${t.hourlyRate.toLocaleString()}/hr labor rate`;
}

/** e.g. "Fewer scan re-tries: 500/month x $4.00 each" */
export function describeCostRationale(c: CostSavingsRationale): string | null {
  if (!c.enabled) return null;
  const label = c.label.trim() || "Cost driver";
  return `${label}: ${c.quantityPerMonth.toLocaleString()}/month x $${c.valuePerUnit.toLocaleString()} each`;
}

export interface CaseInputs {

  investment: {
    nre: number;
    upfront: number;
    phased: PhasedCapex[];
  };
  benefits: {
    costSavingsAnnual: number;
    timeSavingsAnnual: number;
    /** Optional "show your work" assumptions behind the two savings figures. */
    rationale?: SavingsRationale;

    revenueModel: {
      type: RevenueModelType;
      aggregate: { revenueLiftAnnual: number; cogsAnnual: number };
      unit: {
        pricePerUnit: number;
        variableCostPerUnit: number;
        fixedCostsAnnual: number;
        unitsPerYear: number;
        /** Optional regional split of unitsPerYear. When enabled, the regional
         *  values are summed to determine the effective annual unit volume —
         *  unitsPerYear above is ignored but kept in sync for backward compat. */
        regional?: {
          enabled: boolean;
          unitsPerYear: Record<Region, number>;
        };
      };
    };
    overhead: { enabled: boolean; basis: OverheadBasis; percent: number };
    timeline: {
      type: TimelineType;
      manual: {
        granularity: TimelineGranularity;
        /** "amount" = net benefit $ per period, "units" = units sold per period */
        basis?: ManualBasis;
        /** Actual per-period values the user typed. */
        values?: number[];
        /** @deprecated multiplier-era saves; read as a fallback, never written */
        multipliers?: number[];
        /** @deprecated pre-granularity saves; read as a fallback, never written */
        yearlyMultipliers?: number[];
      };
      ramp: { year1Percent: number; growthRatePercent: number };
    };
  };
  horizonYears: number;
  discountRateAnnual: number;
}

/** Number of editable periods a manual timeline needs for a given horizon + granularity. */
export function periodCount(horizonYears: number, granularity: TimelineGranularity): number {
  return Math.max(1, Math.ceil(horizonYears * PERIODS_PER_YEAR[granularity]));
}

export interface ManualSchedule {
  granularity: TimelineGranularity;
  basis: ManualBasis;
  /** Explicit per-period values, or null when only legacy multipliers exist. */
  values: number[] | null;
  /** Legacy multiplier array, present only for pre-update saves. */
  legacyMultipliers: number[] | null;
}

/** Resolves a manual timeline, covering legacy multiplier-based saves. */
export function resolveManualSchedule(
  manual: CaseInputs["benefits"]["timeline"]["manual"],
): ManualSchedule {
  const granularity = manual?.granularity ?? "year";
  if (manual?.values?.length) {
    return {
      granularity,
      basis: manual.basis ?? "amount",
      values: manual.values,
      legacyMultipliers: null,
    };
  }
  const legacy = manual?.multipliers?.length
    ? manual.multipliers
    : (manual?.yearlyMultipliers ?? null);
  return {
    granularity: manual?.multipliers?.length ? granularity : "year",
    basis: "amount",
    values: null,
    legacyMultipliers: legacy?.length ? legacy : [1],
  };
}

/** Human-readable summary of a manual timeline, for exports and prompts. */
export function describeManualTimeline(
  manual: CaseInputs["benefits"]["timeline"]["manual"],
): string {
  const sched = resolveManualSchedule(manual);
  const unit = GRANULARITY_LABEL[sched.granularity];
  if (sched.values) {
    const suffix = sched.basis === "units" ? " units" : "";
    return `Manual by ${unit} (${sched.values.join(", ")}${suffix} per ${unit.toLowerCase()})`;
  }
  return `Manual by ${unit} (x${(sched.legacyMultipliers ?? []).join(", x")})`;
}

/** One-line manual timeline summary that never enumerates every period value —
 *  safe to drop into a fixed-width table cell without overflowing it. */
export function describeManualTimelineShort(
  manual: CaseInputs["benefits"]["timeline"]["manual"],
): string {
  const sched = resolveManualSchedule(manual);
  const unit = GRANULARITY_LABEL[sched.granularity];
  const count = sched.values?.length ?? sched.legacyMultipliers?.length ?? 0;
  const suffix = sched.basis === "units" ? " · units" : "";
  return `Manual by ${unit} · ${count} ${unit.toLowerCase()}${count === 1 ? "" : "s"}${suffix}`;
}

export interface ManualTimelinePeriod {
  label: string;
  value: number;
  isMultiplier: boolean;
}

/** Per-period breakdown of a manual timeline (one entry per year/quarter/month/week),
 *  for exports that want each value in its own row or column. */
export function manualTimelinePeriods(
  manual: CaseInputs["benefits"]["timeline"]["manual"],
): ManualTimelinePeriod[] {
  const sched = resolveManualSchedule(manual);
  const unit = GRANULARITY_LABEL[sched.granularity];
  if (sched.values) {
    return sched.values.map((v, i) => ({
      label: `${unit} ${i + 1}`,
      value: v,
      isMultiplier: false,
    }));
  }
  return (sched.legacyMultipliers ?? []).map((v, i) => ({
    label: `${unit} ${i + 1} (×)`,
    value: v,
    isMultiplier: true,
  }));
}

/** Total annual units, accounting for a regional breakdown when one is enabled. */
export function effectiveUnitsPerYear(
  unit: CaseInputs["benefits"]["revenueModel"]["unit"],
): number {
  if (unit.regional?.enabled) {
    return REGIONS.reduce((sum, r) => sum + (unit.regional!.unitsPerYear[r] || 0), 0);
  }
  return unit.unitsPerYear || 0;
}

/** Each region's share (0–1) of total annual units. All zero when regional is off or empty. */
export function regionalShares(
  unit: CaseInputs["benefits"]["revenueModel"]["unit"],
): Record<Region, number> {
  const total = effectiveUnitsPerYear(unit);
  const out = zeroRegionalUnits();
  if (unit.regional?.enabled && total > 0) {
    for (const r of REGIONS) out[r] = (unit.regional.unitsPerYear[r] || 0) / total;
  }
  return out;
}

export interface Margins {
  grossMarginPercent: number | null;
  contributionMarginPerUnit: number | null;
  contributionMarginPercent: number | null;
  breakevenUnitsPerYear: number | null;
  overheadAnnual: number;
}

export interface CaseOutputs {
  npv: number;
  irr: number | null;
  paybackMonths: number | null;
  roi: number;
  totalInvestment: number;
  totalRevenue: number;
  cashFlowSeries: {
    month: number;
    /** Net cash flow booked in this month. */
    net: number;
    revenue: number;
    /** Revenue minus net cash flow (costs + investment outflows). */
    cost: number;
    /** Net cash flow discounted back to month 0. */
    discounted: number;
    cumulative: number;
  }[];
  /** Units sold per month. Zero throughout unless the revenue model is Unit-Level. */
  unitsSeries: { month: number; units: number; byRegion: Record<Region, number> }[];
  /** Revenue per month, broken out by region when a regional split is enabled. */
  revenueSeries: { month: number; revenue: number; byRegion: Record<Region, number> }[];
  /** True when the case has a regional unit breakdown enabled (drives regional chart series). */
  regionalEnabled: boolean;
  margins: Margins | null;
}

export interface CaseDraft {
  inputs: CaseInputs;
  outputs: CaseOutputs;
}

export interface CaseVersion extends CaseDraft {
  versionLabel: string;
  savedAt: string;
  versionNumber: number;
}

export interface CaseRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  latestVersion: number;
  mode?: CaseMode;
  draft: CaseDraft;
}

/** Simple mode ignores revenue-model & overhead data without deleting it. */
export function effectiveInputs(inputs: CaseInputs, mode: CaseMode): CaseInputs {
  if (mode !== "simple") return inputs;
  return {
    ...inputs,
    benefits: {
      ...inputs.benefits,
      revenueModel: { ...inputs.benefits.revenueModel, type: "none" },
      overhead: { ...inputs.benefits.overhead, enabled: false },
    },
  };
}

export type Scenario = "worst" | "expected" | "best";

export interface ScenarioAdjustments {
  worst: { revenue: number; cost: number };
  best: { revenue: number; cost: number };
}

export const DEFAULT_SCENARIO_ADJUSTMENTS: ScenarioAdjustments = {
  worst: { revenue: -15, cost: 15 },
  best: { revenue: 15, cost: -5 },
};

export const scenarioLabel: Record<Scenario, string> = {
  worst: "Worst Case",
  expected: "Expected",
  best: "Best Case",
};

/** Scales revenue/benefit and cost inputs for sensitivity analysis. Never mutates saved data. */
export function applyScenario(
  inputs: CaseInputs,
  scenario: Scenario,
  adjustments: ScenarioAdjustments = DEFAULT_SCENARIO_ADJUSTMENTS,
): CaseInputs {
  if (scenario === "expected") return inputs;
  const { revenue, cost } = adjustments[scenario];
  const r = 1 + revenue / 100;
  const c = 1 + cost / 100;
  const rm = inputs.benefits.revenueModel;
  return {
    ...inputs,
    investment: {
      nre: inputs.investment.nre * c,
      upfront: inputs.investment.upfront * c,
      phased: inputs.investment.phased.map((p) => ({ ...p, amount: p.amount * c })),
    },
    benefits: {
      ...inputs.benefits,
      costSavingsAnnual: inputs.benefits.costSavingsAnnual * r,
      timeSavingsAnnual: inputs.benefits.timeSavingsAnnual * r,
      revenueModel: {
        ...rm,
        aggregate: {
          revenueLiftAnnual: rm.aggregate.revenueLiftAnnual * r,
          cogsAnnual: rm.aggregate.cogsAnnual * c,
        },
        unit: {
          ...rm.unit,
          pricePerUnit: rm.unit.pricePerUnit * r,
          variableCostPerUnit: rm.unit.variableCostPerUnit * c,
          fixedCostsAnnual: rm.unit.fixedCostsAnnual * c,
        },
      },
    },
  };
}

/** All investment, benefit and timeline values reset to zero. */
export function zeroInputs(): CaseInputs {
  return {
    investment: { nre: 0, upfront: 0, phased: [] },
    benefits: {
      costSavingsAnnual: 0,
      rationale: defaultRationale(),
      timeSavingsAnnual: 0,
      revenueModel: {
        type: "none",
        aggregate: { revenueLiftAnnual: 0, cogsAnnual: 0 },
        unit: {
          pricePerUnit: 0,
          variableCostPerUnit: 0,
          fixedCostsAnnual: 0,
          unitsPerYear: 0,
          regional: { enabled: false, unitsPerYear: zeroRegionalUnits() },
        },
      },
      overhead: { enabled: false, basis: "cogs", percent: 0 },
      timeline: {
        type: "flat",
        manual: { granularity: "year", basis: "amount", values: [0, 0, 0, 0, 0] },
        ramp: { year1Percent: 0, growthRatePercent: 0 },
      },
    },
    horizonYears: 5,
    discountRateAnnual: 0,
  };
}

export function defaultInputs(): CaseInputs {
  return {
    investment: { nre: 85000, upfront: 260000, phased: [] },
    benefits: {
      costSavingsAnnual: 180000,
      rationale: defaultRationale(),
      timeSavingsAnnual: 30000,
      revenueModel: {
        type: "none",
        aggregate: { revenueLiftAnnual: 90000, cogsAnnual: 36000 },
        unit: {
          pricePerUnit: 45,
          variableCostPerUnit: 18,
          fixedCostsAnnual: 60000,
          unitsPerYear: 2000,
          regional: { enabled: false, unitsPerYear: zeroRegionalUnits() },
        },
      },
      overhead: { enabled: false, basis: "cogs", percent: 15 },
      timeline: {
        type: "flat",
        manual: { granularity: "year", basis: "amount", values: [0, 0, 0, 0, 0] },
        ramp: { year1Percent: 60, growthRatePercent: 10 },
      },
    },
    horizonYears: 5,
    discountRateAnnual: 8,
  };
}
