import { useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";
import { SettingsGear } from "./settings-context";
import { cn } from "@/lib/utils";

const stripGrouping = (s: string) => s.replace(/,/g, "");

/** Formats a raw typed string with thousands separators, stripping leading zeros. */
function withCommas(raw: string): string {
  if (raw === "") return "";
  const neg = raw.trim().startsWith("-");
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  const intRaw = parts[0].replace(/^0+(?=\d)/, "");
  const grouped = intRaw === "" ? "" : Number(intRaw).toLocaleString("en-US");
  const decRaw = parts.length > 1 ? parts.slice(1).join("") : null;
  return `${neg ? "-" : ""}${grouped}${decRaw !== null ? `.${decRaw}` : ""}`;
}

const formatValue = (v: number) =>
  Number.isFinite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: 10 }) : "";

/**
 * Number input that shows comma-grouped values while typing, keeps the raw
 * numeric value in state, and lets the field sit empty (or mid-typed, e.g.
 * "-", "1.") instead of snapping back to 0 on every keystroke.
 */
export function NumInput({
  value,
  onChange,
  step,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft((d) => (d !== null && Number(stripGrouping(d)) === value ? d : null));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      step={step}
      className={className}
      value={draft ?? formatValue(value)}
      onChange={(e) => {
        const formatted = withCommas(e.target.value);
        setDraft(formatted);
        const bare = stripGrouping(formatted);
        if (bare === "" || bare === "-" || bare.endsWith(".")) return;
        const n = Number(bare);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => {
        const bare = draft === null ? null : stripGrouping(draft);
        if (bare !== null && (bare === "" || !Number.isFinite(Number(bare)))) onChange(0);
        setDraft(null);
      }}
    />
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-7 text-foreground md:px-10 md:py-10">
      <div className="mx-auto max-w-6xl">{children}</div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  action,
  titleSlot,
  titleAction,
}: {
  eyebrow: string;
  title?: string;
  titleSlot?: ReactNode;
  action?: ReactNode;
  titleAction?: ReactNode;
}) {
  return (
    <div className="mb-8 border-b border-border pb-5">
      {/* Top strip: eyebrow on the left, settings gear (+ optional action) on the right.
          The gear lives in normal flow here so it can never overlap the title or
          action buttons at any screen size. */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <p className="label-eyebrow">{eyebrow}</p>
        <div className="flex shrink-0 items-center gap-2">
          {titleAction}
          <SettingsGear />
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
            {titleSlot ?? title}
          </h1>
        </div>
        {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function Card({
  label,
  children,
  className,
  action,
  info,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  info?: string;
}) {
  return (
    <section className={cn("surface-card p-4 md:p-5", className)}>
      {(label || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {label ? (
            <h2 className="label-eyebrow flex items-center gap-1.5">
              {label}
              {info ? <InfoTooltip field={info} /> : null}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Btn({
  variant = "ghost",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      {...props}
      className={cn(
        "px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        variant === "primary" &&
          "bg-primary text-primary-foreground hover:scale-[1.03] hover:opacity-90 active:opacity-80",
        variant === "ghost" &&
          "border border-border text-foreground hover:border-primary hover:bg-card-inset",
        variant === "danger" &&
          "border border-decline text-decline hover:bg-decline/10 active:bg-decline/15",
        className,
      )}
    />
  );
}

export function NumField({
  label,
  value,
  onChange,
  suffix,
  prefix,
  step,
  info,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  prefix?: string;
  step?: number;
  info?: string;
}) {
  return (
    <label className="block">
      {/* Fixed min-height so a label wrapping to two lines keeps its input box
          aligned with single-line neighbours in the same grid row. */}
      <span className="mb-1.5 flex min-h-[2.25rem] items-end gap-1.5 font-mono text-[10px] uppercase leading-[1.1rem] tracking-widest text-muted-foreground">
        {label}
        {info ? <InfoTooltip field={info} /> : null}
      </span>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[13px] text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <NumInput
          step={step}
          className={cn("field-inset", prefix && "pl-6", suffix && "pr-8")}
          value={value}
          onChange={onChange}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

export function SegToggle<T extends string>({
  options,
  value,
  onChange,
  onLockedClick,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  /** Called instead of onChange when a disabled option is clicked (e.g. to show an upgrade prompt). */
  onLockedClick?: (v: T) => void;
}) {
  return (
    <div className="flex border border-border">
      {options.map((o) => {
        const button = (
          <button
            key={o.value}
            type="button"
            aria-disabled={o.disabled}
            onClick={() => (o.disabled ? onLockedClick?.(o.value) : onChange(o.value))}
            className={cn(
              "w-full px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors",
              o.disabled
                ? "cursor-not-allowed bg-card-inset/30 text-muted-foreground/30"
                : value === o.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card-inset text-muted-foreground hover:bg-border/60 hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
        return o.disabled ? (
          <LockedHover key={o.value} className="flex-1">
            {button}
          </LockedHover>
        ) : (
          button
        );
      })}
    </div>
  );
}

export function LockedHover({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <span className="whitespace-nowrap border border-primary bg-background px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
          Unlock with Full Access
        </span>
      </span>
    </span>
  );
}


/** Blurred preview of a paid feature with a centered unlock affordance.
 *  Matches the LockedHover styling (border-primary, bg-background, mono caps). */
export function LockedOverlay({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none opacity-40 blur-[3px]">
        {children}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 z-10 flex items-center justify-center bg-background/40"
      >
        <span className="inline-flex items-center gap-2 border border-primary bg-background px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
          <Lock className="h-3 w-3" />
          {label}
        </span>
      </button>
    </div>
  );
}

export function Metric({
  label,
  value,
  tone = "default",
  info,
  size = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
  info?: string;
  size?: "default" | "hero";
}) {
  return (
    <div
      className={cn(
        "border border-border bg-card-inset",
        size === "hero" ? "px-4 py-4" : "px-3 py-3",
      )}
    >
      <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
        {info ? <InfoTooltip field={info} /> : null}
      </p>
      <p
        className={cn(
          "data-mono font-bold",
          size === "hero" ? "text-3xl" : "text-lg",
          tone === "positive" && "text-primary",
          tone === "negative" && "text-decline",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function LoadingLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-[3px] w-20 overflow-hidden bg-card-inset">
        <div className="absolute inset-y-0 w-1/3 animate-scan bg-primary" />
      </div>
      <p className="font-mono text-xs uppercase tracking-widest text-primary">{label}</p>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
  info,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  info?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/85 p-4 py-10 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={cn(
          "surface-card w-full animate-in fade-in zoom-in-95 duration-150",
          wide ? "max-w-3xl" : "max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="label-eyebrow flex items-center gap-1.5">
            {title}
            {info ? <InfoTooltip field={info} /> : null}
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="border border-transparent px-2 py-1 font-mono text-xs text-muted-foreground hover:border-border hover:text-foreground"
          >
            ESC
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
