import { useEffect, useState, type ReactNode } from "react";
import { Modal, Btn, NumField, SegToggle } from "./ui";
import { SettingsCtx } from "./settings-context";
import {
  loadSettings,
  saveSettings,
  applySettingsToDocument,
  DEFAULT_SETTINGS,
  TEXT_SIZE_LABEL,
  type AppSettings,
  type Theme,
  type TextSize,
} from "@/lib/bizcase/settings";

/** Provides the global settings modal + state. Render once near the app root. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    applySettingsToDocument(loaded);
  }, []);

  const update = (next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
    applySettingsToDocument(next);
  };

  return (
    <SettingsCtx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      {open && (
        <Modal title="Settings" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-6">
            <section>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Appearance
              </p>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Theme
                  </p>
                  <SegToggle<Theme>
                    value={settings.theme}
                    onChange={(v) => update({ ...settings, theme: v })}
                    options={[
                      { value: "dark", label: "Dark" },
                      { value: "light", label: "Light" },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Text Size
                  </p>
                  <SegToggle<TextSize>
                    value={settings.textSize}
                    onChange={(v) => update({ ...settings, textSize: v })}
                    options={(["small", "default", "large"] as const).map((s) => ({
                      value: s,
                      label: TEXT_SIZE_LABEL[s],
                    }))}
                  />
                </div>
              </div>
            </section>

            <section>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Scenario Percentages
              </p>
              <p className="mb-3 font-mono text-[11px] text-muted-foreground">
                Controls how far the Worst / Best toggle in the Case Editor shifts revenue and cost
                from your entered numbers.
              </p>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-decline">
                    Worst Case
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <NumField
                      label="Revenue"
                      suffix="%"
                      step={1}
                      value={settings.scenario.worst.revenue}
                      onChange={(v) =>
                        update({
                          ...settings,
                          scenario: {
                            ...settings.scenario,
                            worst: { ...settings.scenario.worst, revenue: v },
                          },
                        })
                      }
                    />
                    <NumField
                      label="Cost"
                      suffix="%"
                      step={1}
                      value={settings.scenario.worst.cost}
                      onChange={(v) =>
                        update({
                          ...settings,
                          scenario: {
                            ...settings.scenario,
                            worst: { ...settings.scenario.worst, cost: v },
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
                    Best Case
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <NumField
                      label="Revenue"
                      suffix="%"
                      step={1}
                      value={settings.scenario.best.revenue}
                      onChange={(v) =>
                        update({
                          ...settings,
                          scenario: {
                            ...settings.scenario,
                            best: { ...settings.scenario.best, revenue: v },
                          },
                        })
                      }
                    />
                    <NumField
                      label="Cost"
                      suffix="%"
                      step={1}
                      value={settings.scenario.best.cost}
                      onChange={(v) =>
                        update({
                          ...settings,
                          scenario: {
                            ...settings.scenario,
                            best: { ...settings.scenario.best, cost: v },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Btn onClick={() => update({ ...settings, scenario: DEFAULT_SETTINGS.scenario })}>
                  Reset to Defaults
                </Btn>
              </div>
            </section>
          </div>
        </Modal>
      )}
    </SettingsCtx.Provider>
  );
}
