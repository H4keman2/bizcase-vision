import {
  PERIODS_PER_YEAR,
  resolveManualSchedule,
  type CaseInputs,
  type CaseOutputs,
  type Margins,
} from "./types";

/** Value the user entered for whichever manual period contains this month. */
function manualPeriodValueForMonth(
  values: number[],
  periodsPerYear: number,
  monthIndex1Based: number,
): number {
  const p = Math.floor(((monthIndex1Based - 1) / 12) * periodsPerYear + 1e-9);
  if (values.length === 0) return 0;
  return values[p] ?? values[values.length - 1] ?? 0;
}

/**
 * Legacy multiplier lookup, kept only so cases saved before manual timelines
 * became value-based still calculate the same way.
 */
function legacyMultiplierForMonth(
  multipliers: number[],
  periodsPerYear: number,
  monthIndex1Based: number,
): number {
  const p = Math.floor(((monthIndex1Based - 1) / 12) * periodsPerYear + 1e-9);
  return multipliers[p] ?? multipliers[multipliers.length - 1] ?? 1;
}

/** Timeline multiplier applying to cash-flow month `monthIndex1Based` (1 = first month). */
export function timelineMultiplierForMonth(
  timeline: CaseInputs["benefits"]["timeline"],
  monthIndex1Based: number,
): number {
  if (!timeline || timeline.type === "flat") return 1;

  if (timeline.type === "manual") {
    const sched = resolveManualSchedule(timeline.manual);
    if (sched.legacyMultipliers) {
      return legacyMultiplierForMonth(
        sched.legacyMultipliers,
        PERIODS_PER_YEAR[sched.granularity],
        monthIndex1Based,
      );
    }
    return 1;
  }

  // Ramp compounds annually — one multiplier per full year, applied flat within it.
  const yearIdx = Math.floor((monthIndex1Based - 1) / 12 + 1e-9);
  const { year1Percent, growthRatePercent } = timeline.ramp;
  let mult = year1Percent / 100;
  for (let y = 1; y <= yearIdx; y++) mult *= 1 + growthRatePercent / 100;
  return mult;
}

/** Net benefit and revenue booked in a given cash-flow month. */
export function monthlyBenefit(
  inputs: CaseInputs,
  monthIndex1Based: number,
): { net: number; revenue: number } {
  const { revenueAnnual, cogsAnnual } = resolveRevenueModel(inputs.benefits.revenueModel);
  const overheadAnnual = computeOverheadAnnual(inputs);
  const savingsAnnual =
    (inputs.benefits.costSavingsAnnual || 0) + (inputs.benefits.timeSavingsAnnual || 0);
  const netRevenueAnnual = revenueAnnual - cogsAnnual - overheadAnnual;
  const baseAnnual = savingsAnnual + netRevenueAnnual;

  const timeline = inputs.benefits.timeline;
  if (timeline?.type === "manual") {
    const sched = resolveManualSchedule(timeline.manual);
    if (sched.values) {
      const ppy = PERIODS_PER_YEAR[sched.granularity];
      const monthsPerPeriod = 12 / ppy;
      const value = manualPeriodValueForMonth(sched.values, ppy, monthIndex1Based);

      if (sched.basis === "units") {
        const unitsPerMonth = value / monthsPerPeriod;
        const rm = inputs.benefits.revenueModel.unit;
        const overhead = inputs.benefits.overhead;
        const overheadPerUnit =
          overhead.enabled && inputs.benefits.revenueModel.type === "unit"
            ? ((overhead.basis === "cogs" ? rm.variableCostPerUnit : rm.pricePerUnit) *
                overhead.percent) /
              100
            : 0;
        const revenue = unitsPerMonth * (rm.pricePerUnit || 0);
        const net =
          unitsPerMonth * ((rm.pricePerUnit || 0) - (rm.variableCostPerUnit || 0) - overheadPerUnit) +
          savingsAnnual / 12;
        return { net, revenue };
      }

      // Amount basis: the typed value IS the period's total net benefit.
      const net = value / monthsPerPeriod;
      const revenueShare = baseAnnual !== 0 ? (revenueAnnual / baseAnnual) * net : 0;
      return { net, revenue: revenueShare };
    }
  }

  const mult = timelineMultiplierForMonth(timeline, monthIndex1Based);
  return { net: (baseAnnual * mult) / 12, revenue: (revenueAnnual * mult) / 12 };
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

  for (let m = 1; m <= horizonMonths; m++) {
    series[m] += monthlyBenefit(inputs, m).net;
  }
  return series;
}


export function npv(cashFlows: number[], monthlyRate: number): number {
  return cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + monthlyRate, t), 0);
}

function npvDerivative(cashFlows: number[], rate: number): number {
  return cashFlows.reduce(
    (sum, cf, t) => (t === 0 ? sum : sum - (t * cf) / Math.pow(1 + rate, t + 1)),
    0,
  );
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

  const horizonMonths = Math.max(1, Math.round(inputs.horizonYears * 12));
  let totalRevenue = 0;
  for (let m = 1; m <= horizonMonths; m++) {
    totalRevenue += monthlyBenefit(inputs, m).revenue;
  }

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

/**
 * Aggregate cumulative cash flow across many cases into one portfolio series.
 * Cases with different horizons are padded forward with their final cumulative
 * value so the totals stay monotonic rather than dropping off a cliff.
 */
export function aggregateCashFlowSeries(
  seriesList: { month: number; cumulative: number }[][],
): { month: number; a: number }[] {
  const valid = seriesList.filter((s) => s && s.length > 0);
  if (valid.length === 0) return [];
  const maxMonth = Math.max(...valid.map((s) => s[s.length - 1].month));
  const out: { month: number; a: number }[] = [];
  for (let m = 0; m <= maxMonth; m++) {
    let total = 0;
    for (const s of valid) {
      const last = s[s.length - 1];
      const point = m < s.length ? s[m] : last;
      total += point?.cumulative ?? 0;
    }
    out.push({ month: m, a: total });
  }
  return out;
}

/**
 * Split a whole-unit total across `count` periods so the parts are as even as
 * possible and sum back to exactly `total` (remainder spread one unit at a
 * time across the earliest periods). Non-integer totals keep a fractional
 * remainder on the final period so the sum still matches exactly.
 */
export function distributeEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const out = new Array(count).fill(base);
  let remainder = total - base * count;
  for (let i = 0; i < count && remainder >= 1; i++) {
    out[i] += 1;
    remainder -= 1;
  }
  if (remainder > 0) out[count - 1] += remainder;
  return out;
}
