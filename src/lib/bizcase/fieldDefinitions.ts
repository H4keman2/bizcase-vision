/**
 * Plain-language definitions for every input and output field in BizCase Builder.
 * Edit copy here — the InfoTooltip components across Build, History and Compare
 * all read from this single object.
 */
export const fieldDefinitions: Record<string, string> = {
  // ---- Investment ----
  nre: "Non-Recurring Engineering. One-time design, development or setup spend that happens before the benefits start.",
  upfront:
    "Upfront Capex. Capital spent at the start of the project, such as equipment, licenses or installation.",
  phasedCapex: "Additional capital spend scheduled for specific months instead of all at day one.",
  phasedMonth: "The month number, counting from project start, when this capital is spent.",
  phasedAmount: "The amount of capital spent in that month.",

  // ---- Benefits ----
  costSavingsAnnual:
    "Hard cost reductions per year, such as lower material, vendor or maintenance spend.",
  timeSavingsAnnual:
    "The yearly dollar value of hours saved, calculated as hours freed up times a loaded labor rate.",
  revenueModel:
    "How new revenue is modeled. None means savings only, Aggregate uses yearly totals, Unit-Level builds revenue up from price and volume.",
  revenueLiftAnnual: "Additional revenue per year that this investment is expected to generate.",
  cogsAnnual: "Cost of Goods Sold per year. The direct cost of delivering that added revenue.",
  pricePerUnit: "The average selling price of one unit.",
  variableCostPerUnit:
    "The cost that goes up with each unit sold, such as materials, shipping or transaction fees.",
  fixedCostsAnnual:
    "Yearly costs that stay the same regardless of volume, such as salaries, tooling or subscriptions.",
  unitsPerYear: "How many units you expect to sell each year at full run rate.",

  // ---- Overhead ----
  overhead:
    "Indirect costs like admin, facilities or support. Turn this on to subtract them from the case.",
  overheadBasis:
    "Whether overhead is calculated as a percentage of COGS or as a percentage of revenue.",
  overheadPercent:
    "Indirect costs like admin, facilities, or support, applied as a percentage of either COGS or revenue depending on your selection.",

  // ---- Timeline ----
  timeline:
    "How benefits phase in over time. Flat applies them evenly, Manual sets a multiplier per year, quarter, month or week, Ramp grows them from a starting percentage.",
  manualValue:
    "The actual value for that period — either the net benefit in dollars, or units sold if you picked the Units basis. No multipliers: type what you expect, e.g. 20,000 units per quarter.",
  rampYear1:
    "The share of full run-rate benefits realized in year one while the solution is still ramping up.",
  rampGrowth: "How much the realized benefit grows each year after year one, as a percentage.",

  // ---- Horizon ----
  horizonYears:
    "How many years the case is evaluated over. Cash flows beyond this point are ignored.",
  discountRate:
    "The annual rate used to discount future cash flows to today's dollars. It usually reflects your cost of capital or hurdle rate.",

  // ---- Outputs ----
  npv: "Net Present Value. The total value of future cash flows, discounted back to today's dollars. A positive NPV means the investment is expected to add value.",
  irr: "Internal Rate of Return. The discount rate at which NPV equals zero. Compare this to your required rate of return to judge if the investment clears the bar.",
  payback: "How long it takes for cumulative cash flows to cover the initial investment.",
  roi: "Return on Investment: total net cash return divided by total investment across the horizon. Undiscounted — unlike NPV and IRR, it ignores the time value of money.",
  scenario:
    "Sensitivity view. Worst Case applies -15% to benefits/revenue and +15% to costs; Best Case applies +15% benefits and -5% costs. Your saved inputs never change.",
  totalInvestment: "All money going out over the horizon: NRE, upfront capex and any phased spend.",
  totalRevenue: "All revenue generated over the horizon before costs are subtracted.",
  grossMargin:
    "Revenue minus cost of goods sold, expressed as a percentage of revenue. Shows how profitable the added revenue is before overhead.",
  contributionMargin:
    "Revenue minus variable costs, expressed as a percentage. Shows how much each sale contributes to covering fixed costs and profit.",
  contributionPerUnit:
    "The dollars each unit sold contributes after its variable costs, available to cover fixed costs and profit.",
  breakevenUnits:
    "The number of units you need to sell per year before the case starts making money.",
  overheadAnnual: "The dollar amount of indirect cost charged to this case each year.",

  // ---- App-level ----
  caseMode:
    "Simple shows only savings, timeline and horizon. Detailed adds revenue modeling, overhead and margin analysis.",
  cumulativeCashFlow:
    "Running total of money in minus money out, month by month. The point it crosses zero is your payback.",
  versionLabel: "A name for this saved snapshot of the case, so you can find and compare it later.",
  versionHistory: "Every saved snapshot of this case. Select two to compare them side by side.",
  compareDelta:
    "The difference between Case B and Case A for that metric. Green means Case B is better.",
  compareSelect: "Pick which saved version or the current unsaved draft to place on this side.",
};

export type FieldKey = keyof typeof fieldDefinitions;
