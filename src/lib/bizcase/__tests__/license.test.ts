import { describe, expect, it } from "vitest";
import {
  FREE_CASE_LIMIT,
  FREE_EXEC_SUMMARY_LIMIT,
  LICENSE_PRICE,
  LicenseLimitError,
  canGenerateExecSummary,
  getExecSummaryCount,
  getLicenseKey,
  isLicenseRelatedStorageKey,
  isLicensed,
  maskLicenseKey,
} from "../license";

// These tests run in a plain Node environment (no `window`/`localStorage`),
// which doubles as a regression check that every license/free-tier helper
// degrades safely during SSR instead of throwing.

describe("license — SSR-safe defaults", () => {
  it("reports unlicensed with no window", () => {
    expect(isLicensed()).toBe(false);
  });

  it("returns no stored key with no window", () => {
    expect(getLicenseKey()).toBeNull();
  });

  it("reports zero exec summaries used with no window", () => {
    expect(getExecSummaryCount("case-1")).toBe(0);
  });

  it("still allows the free exec summary allotment with no window", () => {
    // isLicensed() is false and the count is 0, so the free allotment applies.
    expect(canGenerateExecSummary("case-1")).toBe(true);
  });
});

describe("LicenseLimitError", () => {
  it("names the free case limit and the unlock price in its message", () => {
    const err = new LicenseLimitError();
    expect(err.name).toBe("LicenseLimitError");
    expect(err.message).toContain(String(FREE_CASE_LIMIT));
    expect(err.message).toContain(LICENSE_PRICE);
  });
});

describe("maskLicenseKey", () => {
  it("keeps only the last four characters visible", () => {
    expect(maskLicenseKey("AAAA-BBBB-CCCC-3F9A")).toBe("••••-3F9A");
  });

  it("trims surrounding whitespace before masking", () => {
    expect(maskLicenseKey("  AAAA-1234  ")).toBe("••••-1234");
  });

  it("returns short keys unmasked rather than an empty bullet string", () => {
    expect(maskLicenseKey("abc")).toBe("abc");
  });
});

describe("isLicenseRelatedStorageKey", () => {
  it("treats a null key (storage cleared) as always relevant", () => {
    expect(isLicenseRelatedStorageKey(null)).toBe(true);
  });

  it("matches every known license key alias", () => {
    for (const key of ["bizcase:license", "bizcase-license", "bizcaseLicense", "license"]) {
      expect(isLicenseRelatedStorageKey(key)).toBe(true);
    }
  });

  it("matches exec-summary counters by prefix, including legacy prefixes", () => {
    expect(isLicenseRelatedStorageKey("execSummaryCount:case-1")).toBe(true);
    expect(isLicenseRelatedStorageKey("bizcase:execSummaryCount:case-1")).toBe(true);
    expect(isLicenseRelatedStorageKey("execSummaryCount-case-1")).toBe(true);
  });

  it("ignores unrelated storage keys", () => {
    expect(isLicenseRelatedStorageKey("bizcase:onboarding-seen")).toBe(false);
    expect(isLicenseRelatedStorageKey("some-other-app-setting")).toBe(false);
  });
});
