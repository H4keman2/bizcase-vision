import { describe, expect, it } from "vitest";
import { validateImport, type Extracted, type FieldKey } from "../import";

/** Builds an Extracted map from plain string values. */
function extracted(values: Partial<Record<FieldKey | string, string>>): Extracted {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, { value: v ?? "", confidence: null }]),
  ) as Extracted;
}

const messages = (v: Extracted) => validateImport(v).map((i) => i.message);
const fields = (v: Extracted) => validateImport(v).map((i) => i.field);

describe("validateImport — timeline mode", () => {
  it("accepts a blank mode", () => {
    expect(validateImport(extracted({}))).toEqual([]);
    expect(validateImport(extracted({ timelineMode: "   " }))).toEqual([]);
  });

  it.each(["flat", "manual", "Flat", " MANUAL ", "Ramp"])(
    "recognizes %s regardless of case and padding",
    (mode) => {
      const issues = validateImport(
        extracted({ timelineMode: mode, rampYear1Percent: "40", rampGrowthRatePercent: "25" }),
      );
      expect(issues.filter((i) => i.field === "timelineMode")).toEqual([]);
    },
  );

  it("flags an unrecognized mode", () => {
    const issues = validateImport(extracted({ timelineMode: "linear" }));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe("timelineMode");
    expect(issues[0]?.message).toContain("linear");
    expect(issues[0]?.message).toContain("flat, manual, or ramp");
  });

  it("does not run ramp checks for a non-ramp mode", () => {
    expect(validateImport(extracted({ timelineMode: "flat" }))).toEqual([]);
    expect(validateImport(extracted({ timelineMode: "manual" }))).toEqual([]);
  });
});

describe("validateImport — ramp parameters", () => {
  const ramp = (over: Record<string, string> = {}) =>
    extracted({
      timelineMode: "ramp",
      rampYear1Percent: "40",
      rampGrowthRatePercent: "25",
      ...over,
    });

  it("passes with valid ramp parameters", () => {
    expect(validateImport(ramp())).toEqual([]);
  });

  it("requires both ramp fields when missing or blank", () => {
    expect(fields(extracted({ timelineMode: "ramp" }))).toEqual([
      "rampYear1Percent",
      "rampGrowthRatePercent",
    ]);
    expect(messages(ramp({ rampYear1Percent: "  " }))).toEqual([
      'Ramp Year 1 % is required when Timeline Mode is "ramp".',
    ]);
    expect(messages(ramp({ rampGrowthRatePercent: "" }))).toEqual([
      'Ramp Growth Rate %/Yr is required when Timeline Mode is "ramp".',
    ]);
  });

  it("rejects non-numeric values", () => {
    expect(messages(ramp({ rampYear1Percent: "forty" }))).toEqual([
      "Ramp Year 1 % must be a number.",
    ]);
    expect(messages(ramp({ rampGrowthRatePercent: "n/a" }))).toEqual([
      "Ramp Growth Rate %/Yr must be a number.",
    ]);
  });

  it("rejects out-of-range values", () => {
    expect(messages(ramp({ rampYear1Percent: "-1" }))).toEqual([
      "Ramp Year 1 % must be between 0 and 100.",
    ]);
    expect(messages(ramp({ rampYear1Percent: "101" }))).toEqual([
      "Ramp Year 1 % must be between 0 and 100.",
    ]);
    expect(messages(ramp({ rampGrowthRatePercent: "-101" }))).toEqual([
      "Ramp Growth Rate %/Yr must be between -100 and 1000.",
    ]);
    expect(messages(ramp({ rampGrowthRatePercent: "1001" }))).toEqual([
      "Ramp Growth Rate %/Yr must be between -100 and 1000.",
    ]);
  });

  it("accepts inclusive range boundaries", () => {
    expect(validateImport(ramp({ rampYear1Percent: "0", rampGrowthRatePercent: "-100" }))).toEqual(
      [],
    );
    expect(
      validateImport(ramp({ rampYear1Percent: "100", rampGrowthRatePercent: "1000" })),
    ).toEqual([]);
  });

  it("reports both ramp fields at once", () => {
    expect(
      fields(ramp({ rampYear1Percent: "abc", rampGrowthRatePercent: "5000" })),
    ).toEqual(["rampYear1Percent", "rampGrowthRatePercent"]);
  });
});
