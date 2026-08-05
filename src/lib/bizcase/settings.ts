import { DEFAULT_SCENARIO_ADJUSTMENTS, type ScenarioAdjustments } from "./types";

export type Theme = "dark" | "light";
export type TextSize = "small" | "default" | "large";

export interface AppSettings {
  theme: Theme;
  textSize: TextSize;
  scenario: ScenarioAdjustments;
}

export const TEXT_SIZE_SCALE: Record<TextSize, number> = {
  small: 90,
  default: 100,
  large: 112,
};

export const TEXT_SIZE_LABEL: Record<TextSize, string> = {
  small: "Small",
  default: "Default",
  large: "Large",
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  textSize: "default",
  scenario: DEFAULT_SCENARIO_ADJUSTMENTS,
};

const KEY = "bizcase:settings";

function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings> | null;
    return {
      theme: parsed?.theme === "light" ? "light" : "dark",
      textSize:
        parsed?.textSize && parsed.textSize in TEXT_SIZE_SCALE ? parsed.textSize : "default",
      scenario: {
        worst: {
          revenue: numOr(
            parsed?.scenario?.worst?.revenue,
            DEFAULT_SCENARIO_ADJUSTMENTS.worst.revenue,
          ),
          cost: numOr(parsed?.scenario?.worst?.cost, DEFAULT_SCENARIO_ADJUSTMENTS.worst.cost),
        },
        best: {
          revenue: numOr(
            parsed?.scenario?.best?.revenue,
            DEFAULT_SCENARIO_ADJUSTMENTS.best.revenue,
          ),
          cost: numOr(parsed?.scenario?.best?.cost, DEFAULT_SCENARIO_ADJUSTMENTS.best.cost),
        },
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

/** Applies theme + text size to the document. Scenario % needs no DOM changes — it's read at calc time. */
export function applySettingsToDocument(s: AppSettings) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", s.theme === "light");
  document.documentElement.style.fontSize = `${TEXT_SIZE_SCALE[s.textSize]}%`;
}
