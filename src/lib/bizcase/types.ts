export type RevenueModelType = "none" | "aggregate" | "unit";
export type TimelineType = "flat" | "manual" | "ramp";
export type OverheadBasis = "cogs" | "revenue";
export type CaseMode = "simple" | "detailed";


export interface PhasedCapex {
  month: number;
  amount: number;
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
    revenueModel: {
      type: RevenueModelType;
      aggregate: { revenueLiftAnnual: number; cogsAnnual: number };
      unit: {
        pricePerUnit: number;
        variableCostPerUnit: number;
        fixedCostsAnnual: number;
        unitsPerYear: number;
      };
    };
    overhead: { enabled: boolean; basis: OverheadBasis; percent: number };
    timeline: {
      type: TimelineType;
      manual: { yearlyMultipliers: number[] };
      ramp: { year1Percent: number; growthRatePercent: number };
    };
  };
  horizonYears: number;
  discountRateAnnual: number;
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
  cashFlowSeries: { month: number; cumulative: number }[];
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


/** All investment, benefit and timeline values reset to zero. */
export function zeroInputs(): CaseInputs {
  return {
    investment: { nre: 0, upfront: 0, phased: [] },
    benefits: {
      costSavingsAnnual: 0,
      timeSavingsAnnual: 0,
      revenueModel: {
        type: "none",
        aggregate: { revenueLiftAnnual: 0, cogsAnnual: 0 },
        unit: {
          pricePerUnit: 0,
          variableCostPerUnit: 0,
          fixedCostsAnnual: 0,
          unitsPerYear: 0,
        },
      },
      overhead: { enabled: false, basis: "cogs", percent: 0 },
      timeline: {
        type: "flat",
        manual: { yearlyMultipliers: [0, 0, 0] },
        ramp: { year1Percent: 0, growthRatePercent: 0 },
      },
    },
    horizonYears: 3,
    discountRateAnnual: 0,
  };
}

export function defaultInputs(): CaseInputs {
  return {
    investment: { nre: 85000, upfront: 260000, phased: [] },
    benefits: {
      costSavingsAnnual: 180000,
      timeSavingsAnnual: 30000,
      revenueModel: {
        type: "none",
        aggregate: { revenueLiftAnnual: 90000, cogsAnnual: 36000 },
        unit: {
          pricePerUnit: 45,
          variableCostPerUnit: 18,
          fixedCostsAnnual: 60000,
          unitsPerYear: 2000,
        },
      },
      overhead: { enabled: false, basis: "cogs", percent: 15 },
      timeline: {
        type: "flat",
        manual: { yearlyMultipliers: [1, 1, 1] },
        ramp: { year1Percent: 60, growthRatePercent: 10 },
      },
    },
    horizonYears: 3,
    discountRateAnnual: 8,
  };
}
