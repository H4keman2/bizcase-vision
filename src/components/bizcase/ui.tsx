import { useEffect, useState, type ReactNode } from "react";
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
}: {
  eyebrow: string;
  title?: string;
  titleSlot?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0">
        <p className="label-eyebrow mb-2">{eyebrow}</p>
        {titleSlot ?? (
          <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        )}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function Card({
  label,
  children,
  className,
  action,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("surface-card p-4 md:p-5", className)}>
      {(label || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {label ? <p className="label-eyebrow">{label}</p> : <span />}
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
        "px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "bg-primary text-primary-foreground hover:opacity-85",
        variant === "ghost" && "border border-border text-foreground hover:border-primary",
        variant === "danger" && "border border-decline text-decline hover:bg-decline/10",
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  prefix?: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
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
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex border border-border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "bg-card-inset text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div className="border border-border bg-card-inset px-3 py-3">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "data-mono text-lg font-bold",
          tone === "positive" && "text-primary",
          tone === "negative" && "text-decline",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/85 p-4 py-10">
      <div className={cn("surface-card w-full", wide ? "max-w-3xl" : "max-w-md")}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="label-eyebrow">{title}</p>
          <button
            onClick={onClose}
            className="font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            ESC
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
