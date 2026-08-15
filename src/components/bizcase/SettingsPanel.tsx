import { useEffect, useState, type ReactNode } from "react";
import { Modal, Btn, NumField, SegToggle } from "./ui";
import { SettingsCtx } from "./settings-context";
import { toast } from "sonner";
import { LicenseModal } from "./LicenseModals";
import { OnboardingModal, hasSeenOnboarding, markOnboardingSeen } from "./OnboardingModal";
import {
  GUMROAD_URL,
  LICENSE_PRICE,
  FREE_CASE_LIMIT,
  clearLicenseKey,
  getLicenseKey,
  maskLicenseKey,
  isLicensed,
  onLicenseChange,
} from "@/lib/bizcase/license";
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
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [licensed, setLicensed] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // First-time visitors: auto-show the corner guide after a short delay so it
  // doesn't flash in mid page-load. Returning users open it from Settings > Help.
  useEffect(() => {
    if (hasSeenOnboarding()) return;
    const t = window.setTimeout(() => setOnboardingOpen(true), 700);
    return () => window.clearTimeout(t);
  }, []);

  const closeOnboarding = () => {
    markOnboardingSeen();
    setOnboardingOpen(false);
  };

  useEffect(() => {
    setLicensed(isLicensed());
    return onLicenseChange(() => setLicensed(isLicensed()));
  }, []);

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
        <Modal title="Settings" onClose={() => setOpen(false)} wide>
          <div className="flex flex-col gap-6">
            <section>
              <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                License
              </p>
              {licensed ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="border border-primary px-2 py-1 font-mono text-xs font-bold uppercase tracking-widest text-primary">
                      Full version unlocked
                    </span>
                    <span className="font-mono text-sm text-muted-foreground">
                      Key {maskLicenseKey(getLicenseKey() ?? "")}
                    </span>
                  </div>
                  {confirmSignOut ? (
                    <div className="border border-warning bg-warning/10 p-3">
                      <p className="text-base text-foreground">
                        Sign out of the full version on this device? Your cases stay saved, but you
                        will need the key again to import, export without a watermark, or add more
                        than {FREE_CASE_LIMIT} cases.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Btn
                          variant="primary"
                          onClick={() => {
                            clearLicenseKey();
                            setConfirmSignOut(false);
                            toast.success("Signed out. This device is back on the free version.");
                          }}
                        >
                          Sign Out
                        </Btn>
                        <Btn onClick={() => setConfirmSignOut(false)}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Btn onClick={() => setConfirmSignOut(true)}>Sign Out</Btn>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="font-mono text-sm text-muted-foreground">
                    Free version: {FREE_CASE_LIMIT} cases, no Excel import, no best/worst case, no
                    import template, watermarked exports. One-time {LICENSE_PRICE} unlock.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Btn variant="primary" onClick={() => setLicenseOpen(true)}>
                      Enter License Key
                    </Btn>
                    <a
                      href={GUMROAD_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sm uppercase tracking-widest text-muted-foreground underline hover:text-primary"
                    >
                      Buy a key
                    </a>
                  </div>
                </div>
              )}
            </section>

            <section>
              <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Appearance
              </p>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
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
                  <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
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
              <p className="mb-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Scenario Percentages
              </p>
              <p className="mb-3 font-mono text-sm text-muted-foreground">
                Controls how far the Worst / Best toggle in the Case Editor shifts revenue and cost
                from your entered numbers.
              </p>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-decline">
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
                  <p className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-primary">
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

            <section>
              <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Help
              </p>
              <Btn
                onClick={() => {
                  setOpen(false);
                  setOnboardingOpen(true);
                }}
              >
                Show Tutorial
              </Btn>
            </section>
          </div>
        </Modal>
      )}
      {licenseOpen && <LicenseModal onClose={() => setLicenseOpen(false)} />}
      {onboardingOpen && <OnboardingModal onClose={closeOnboarding} />}
    </SettingsCtx.Provider>
  );
}
