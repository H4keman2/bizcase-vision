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
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

export const fmtPercent = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !isFinite(v) ? "—" : `${v.toFixed(digits)}%`;

export const fmtMonths = (v: number | null | undefined) =>
  v === null || v === undefined || !isFinite(v) ? "NEVER" : `${v.toFixed(1)} MO`;

export const fmtNumber = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !isFinite(v)
    ? "—"
    : v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
