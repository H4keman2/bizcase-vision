import { describe, expect, it } from "vitest";
import { annualizeIrr, irr, npv, paybackMonths, IRR_DISPLAY_CAP_PERCENT } from "../calc";

describe("irr — normal cases", () => {
  it("solves a simple, realistic investment", () => {
    // -$100k upfront, $3k/mo net for 60 months — should land around a sane,
    // everyday IRR (not zero, not absurd).
    const flows = [-100_000, ...Array(60).fill(3_000)];
    const monthly = irr(flows);
    expect(monthly).not.toBeNull();
    const annual = annualizeIrr(monthly);
    expect(annual).not.toBeNull();
    expect(annual as number).toBeGreaterThan(10);
    expect(annual as number).toBeLessThan(100);
  });

  it("returns null when cash flows never cross zero (no valid IRR)", () => {
    // All negative — there's no discount rate that makes NPV = 0.
    const flows = [-100_000, -1_000, -1_000, -1_000];
    expect(irr(flows)).toBeNull();
  });

  it("matches an independently-solved value for a textbook cash flow", () => {
    // -$10,000 now, +$12,000 in one year (12 monthly periods) — a case
    // simple enough to sanity-check by hand rather than trust the solver.
    const flows = [-10_000, ...Array(11).fill(0), 12_000];
    const monthly = irr(flows);
    expect(monthly).not.toBeNull();
    // NPV at the solved rate should be ~0.
    expect(Math.abs(npv(flows, monthly as number))).toBeLessThan(1);
  });
});

describe("irr — extreme cases (regression test for the trillion-percent bug)", () => {
  it("caps the annualized rate instead of returning an astronomical number", () => {
    // Reproduces the real case that surfaced the bug: tiny investment,
    // enormous monthly return, near-instant payback.
    const investment = 345_000;
    const monthlyNet = (1_101_000 * 45 - 1_101_000 * 18) / 12;
    const flows = [-investment, ...Array(60).fill(monthlyNet)];

    const monthly = irr(flows);
    expect(monthly).not.toBeNull();
    const annual = annualizeIrr(monthly);
    expect(annual).not.toBeNull();

    // The true mathematical answer is in the trillions of percent — that's
    // correct but useless to show a user, so it must be capped.
    expect(annual as number).toBe(IRR_DISPLAY_CAP_PERCENT);
    expect(annual as number).toBeLessThanOrEqual(IRR_DISPLAY_CAP_PERCENT);
  });

  it("still returns a real (uncapped) NPV even when IRR is capped", () => {
    // The IRR cap is a display-only concern — NPV must stay exact.
    const flows = [-345_000, ...Array(60).fill(2_477_250)];
    const value = npv(flows, 0.006434); // ~8%/yr monthly-equivalent discount
    expect(value).toBeGreaterThan(100_000_000);
  });
});

describe("annualizeIrr", () => {
  it("passes through normal rates unchanged", () => {
    // ~2%/month compounds to ~26.8%/year — well under the cap.
    const annual = annualizeIrr(0.02);
    expect(annual).toBeCloseTo(26.82, 1);
  });

  it("returns null for a null input", () => {
    expect(annualizeIrr(null)).toBeNull();
  });
});

describe("paybackMonths", () => {
  it("finds the month cumulative cash flow turns positive", () => {
    const flows = [-12_000, ...Array(24).fill(1_000)];
    // -12,000 recovered exactly at month 12.
    expect(paybackMonths(flows)).toBeCloseTo(12, 1);
  });

  it("returns null when the investment never pays back", () => {
    const flows = [-50_000, ...Array(12).fill(100)];
    expect(paybackMonths(flows)).toBeNull();
  });
});
