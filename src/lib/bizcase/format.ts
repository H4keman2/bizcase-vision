export const fmtCurrency = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !isFinite(v)
    ? "—"
    : `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })}`;

export const fmtCompact = (v: number | null | undefined) => {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)
    return `${sign}$${(abs / 1_000).toLocaleString("en-US", { maximumFractionDigits: 0 })}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

export const fmtPercent = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !isFinite(v) ? "—" : `${v.toFixed(digits)}%`;

/** IRR-specific percent formatter — shows '>100,000%' instead of a literal
 *  huge number once the value hits calc.ts's IRR_DISPLAY_CAP_PERCENT. */
export const fmtIrr = (v: number | null | undefined, capMagnitude = 100_000) => {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  if (Math.abs(v) >= capMagnitude) {
    const sign = v > 0 ? ">" : "<-";
    return `${sign}${Math.round(capMagnitude).toLocaleString("en-US")}%`;
  }
  return fmtPercent(v);
};

export const fmtMonths = (v: number | null | undefined) =>
  v === null || v === undefined || !isFinite(v) ? "NEVER" : `${v.toFixed(1)} MO`;

export const fmtNumber = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !isFinite(v)
    ? "—"
    : v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
