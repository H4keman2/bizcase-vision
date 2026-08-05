import { createContext, useContext } from "react";

/**
 * Shared context that lets any in-flow header render a Settings gear trigger
 * while the actual modal/state lives once in the app root. Keeping the gear in
 * the header's normal document flow (instead of a `fixed` overlay) guarantees
 * it can never overlap the title or header buttons at any screen size.
 */
export const SettingsCtx = createContext<{ open: () => void }>({ open: () => {} });
export const useSettings = () => useContext(SettingsCtx);

/** Inline settings gear trigger — render as the rightmost item in a header. */
export function SettingsGear({ className = "" }: { className?: string }) {
  const { open } = useSettings();
  return (
    <button
      type="button"
      aria-label="Settings"
      onClick={open}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card font-mono text-base text-muted-foreground transition-colors hover:border-primary hover:text-primary ${className}`}
    >
      ⚙
    </button>
  );
}
