import { useEffect, useRef, useState } from "react";
import { fieldDefinitions } from "@/lib/bizcase/fieldDefinitions";
import { cn } from "@/lib/utils";

/**
 * 16px "?" button that reveals a plain-language definition for a field.
 * Opens on hover, toggles on click, dismisses on outside click or Escape.
 */
export function InfoTooltip({ field, className }: { field: string; className?: string }) {
  const text = fieldDefinitions[field];
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  if (!text) return null;

  return (
    <span
      ref={ref}
      className={cn("relative inline-flex align-middle", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => !pinned && setOpen(false)}
    >
      <button
        type="button"
        aria-label={`What is ${field}?`}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((p) => {
            setOpen(!p);
            return !p;
          });
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-primary font-mono text-[9px] font-bold leading-none text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        ?
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 border border-border bg-card px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
        >
          {text}
          <span className="absolute left-1/2 top-full -ml-[5px] h-0 w-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-border" />
          <span className="absolute left-1/2 top-full -ml-[4px] -mt-px h-0 w-0 border-x-[4px] border-t-[4px] border-x-transparent border-t-card" />
        </span>
      )}
    </span>
  );
}
