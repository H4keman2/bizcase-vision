import type { CaseInputs, CaseOutputs, Margins } from "./types";

export function resolveTimelineMultipliers(
  timeline: CaseInputs["benefits"]["timeline"],
  totalYears: number,
): number[] {
  if (!timeline || timeline.type === "flat") return new Array(totalYears).fill(1);

  if (timeline.type === "manual") {
    const arr = timeline.manual.yearlyMultipliers ?? [];
    return new Array(totalYears)
      .fill(0)
      .map((_, i) => (i < arr.length ? arr[i] : (arr[arr.length - 1] ?? 1)));
  }

  const { year1Percent, growthRatePercent } = timeline.ramp;
  const mults = [year1Percent / 100];
  for (let y = 1; y < totalYears; y++) {
    mults.push(mults[y - 1] * (1 + growthRatePercent / 100));
  }
  return mults;
}

export function resolveRevenueModel(rm: CaseInputs["benefits"]["revenueModel"]) {
  if (rm.type === "unit") {
    const { pricePerUnit, variableCostPerUnit, unitsPerYear } = rm.unit;
    return {
      revenueAnnual: pricePerUnit * unitsPerYear,
      cogsAnnual: variableCostPerUnit * unitsPerYear,
    };
  }
  if (rm.type === "aggregate") {
    return {
      revenueAnnual: rm.aggregate.revenueLiftAnnual,
      cogsAnnual: rm.aggregate.cogsAnnual,
    };
  }
  return { revenueAnnual: 0, cogsAnnual: 0 };
}

export function computeOverheadAnnual(inputs: CaseInputs): number {
  const { overhead, revenueModel } = inputs.benefits;
  if (!overhead.enabled || revenueModel.type === "none") return 0;
  const { revenueAnnual, cogsAnnual } = resolveRevenueModel(revenueModel);
  const basisValue = overhead.basis === "cogs" ? cogsAnnual : revenueAnnual;
  return (overhead.percent / 100) * basisValue;
}

export function buildCashFlowSeries(inputs: CaseInputs): number[] {
  const horizonMonths = Math.max(1, Math.round(inputs.horizonYears * 12));
  const series = new Array(horizonMonths + 1).fill(0);
  series[0] -= (inputs.investment.nre || 0) + (inputs.investment.upfront || 0);

  (inputs.investment.phased || []).forEach(({ month, amount }) => {
    if (month >= 0 && month <= horizonMonths) series[month] -= amount || 0;
  });

  const { revenueAnnual, cogsAnnual } = resolveRevenueModel(inputs.benefits.revenueModel);
  const overheadAnnual = computeOverheadAnnual(inputs);
  const netRevenue = revenueAnnual - cogsAnnual - overheadAnnual;
  const baseAnnual =
    (inputs.benefits.costSavingsAnnual || 0) + netRevenue + (inputs.benefits.timeSavingsAnnual || 0);

  const years = Math.ceil(inputs.horizonYears);
  const mults = resolveTimelineMultipliers(inputs.benefits.timeline, years);
  for (let m = 1; m <= horizonMonths; m++) {
    const yearIdx = Math.floor((m - 1) / 12);
    series[m] += (baseAnnual * (mults[yearIdx] ?? 1)) / 12;
  }
  return series;
}

export function npv(cashFlows: number[], monthlyRate: number): number {
  return cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + monthlyRate, t), 0);
}

function npvDerivative(cashFlows: number[], rate: number): number {
  return cashFlows.reduce((sum, cf, t) => (t === 0 ? sum : sum - (t * cf) / Math.pow(1 + rate, t + 1)), 0);
}

export function irr(cashFlows: number[]): number | null {
  // Newton-Raphson
  let rate = 0.01;
  for (let i = 0; i < 60; i++) {
    const f = npv(cashFlows, rate);
    if (Math.abs(f) < 1e-6) return rate;
    const d = npvDerivative(cashFlows, rate);
    if (!isFinite(d) || Math.abs(d) < 1e-12) break;
    const next = rate - f / d;
    if (!isFinite(next) || next <= -0.999) break;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }
  // Bisection fallback
  let low = -0.99;
  let high = 5;
  let fLow = npv(cashFlows, low);
  let fHigh = npv(cashFlows, high);
  if (fLow * fHigh > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const fMid = npv(cashFlows, mid);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }
  return (low + high) / 2;
}

export function paybackMonths(cashFlows: number[]): number | null {
  let cum = 0;
  for (let m = 0; m < cashFlows.length; m++) {
    const prev = cum;
    cum += cashFlows[m];
    if (prev < 0 && cum >= 0) {
      const frac = cashFlows[m] === 0 ? 0 : -prev / cashFlows[m];
      return m - 1 + frac;
    }
  }
  return null;
}

export function computeMargins(inputs: CaseInputs): Margins | null {
  const rm = inputs.benefits.revenueModel;
  if (rm.type === "none") return null;
  const { revenueAnnual, cogsAnnual } = resolveRevenueModel(rm);
  const overheadAnnual = computeOverheadAnnual(inputs);

  if (rm.type === "aggregate") {
    return {
      grossMarginPercent:
        revenueAnnual > 0
          ? ((revenueAnnual - cogsAnnual - overheadAnnual) / revenueAnnual) * 100
          : null,
      contributionMarginPerUnit: null,
      contributionMarginPercent: null,
      breakevenUnitsPerYear: null,
      overheadAnnual,
    };
  }

  const { pricePerUnit, variableCostPerUnit, fixedCostsAnnual, unitsPerYear } = rm.unit;
  const perUnitOverhead = unitsPerYear > 0 ? overheadAnnual / unitsPerYear : 0;
  const cm = pricePerUnit - variableCostPerUnit - perUnitOverhead;
  return {
    grossMarginPercent: null,
    contributionMarginPerUnit: cm,
    contributionMarginPercent: pricePerUnit > 0 ? (cm / pricePerUnit) * 100 : null,
    breakevenUnitsPerYear: cm > 0 ? fixedCostsAnnual / cm : null,
    overheadAnnual,
  };
}

export function calculate(inputs: CaseInputs): CaseOutputs {
  const flows = buildCashFlowSeries(inputs);
  const monthlyRate = Math.pow(1 + inputs.discountRateAnnual / 100, 1 / 12) - 1;
  const monthlyIrr = irr(flows);
  const annualIrr = monthlyIrr === null ? null : (Math.pow(1 + monthlyIrr, 12) - 1) * 100;

  const totalInvestment =
    (inputs.investment.nre || 0) +
    (inputs.investment.upfront || 0) +
    (inputs.investment.phased || []).reduce((s, p) => s + (p.amount || 0), 0);

  const netTotal = flows.reduce((s, cf) => s + cf, 0);
  const roi = totalInvestment > 0 ? (netTotal / totalInvestment) * 100 : 0;

  const { revenueAnnual } = resolveRevenueModel(inputs.benefits.revenueModel);
  const years = Math.ceil(inputs.horizonYears);
  const mults = resolveTimelineMultipliers(inputs.benefits.timeline, years);
  const totalRevenue = mults.reduce((s, m) => s + revenueAnnual * m, 0);

  let cum = 0;
  const cashFlowSeries = flows.map((cf, month) => {
    cum += cf;
    return { month, cumulative: cum };
  });

  return {
    npv: npv(flows, monthlyRate),
    irr: annualIrr,
    paybackMonths: paybackMonths(flows),
    roi,
    totalInvestment,
    totalRevenue,
    cashFlowSeries,
    margins: computeMargins(inputs),
  };
}
