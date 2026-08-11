import { useEffect, useState } from "react";
import { ArrowRight, Layers, FileDown, FlaskConical, SlidersHorizontal } from "lucide-react";
import { Btn } from "./ui";
import { cn } from "@/lib/utils";

const SEEN_KEY = "onboarding:seen";

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOnboardingSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // localStorage unavailable — nothing to persist, modal just reappears next visit
  }
}

type Step = {
  icon: typeof Layers;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: SlidersHorizontal,
    title: "Build your inputs",
    body: "Start a new case and enter your investment, benefits, and cost assumptions. NPV, IRR, ROI, and payback update live as you type.",
  },
  {
    icon: FlaskConical,
    title: "Stress-test with scenarios",
    body: "Switch between Expected, Best, and Worst case to see how sensitive your return is to the assumptions moving against you.",
  },
  {
    icon: Layers,
    title: "Save versions, compare cases",
    body: "Every case keeps its version history, and you can save multiple cases side by side to compare different paths forward.",
  },
  {
    icon: FileDown,
    title: "Export when you're ready",
    body: "Download a full Excel workbook or a summary report to share your case with stakeholders.",
  },
];

export function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const lastStep = step === STEPS.length - 1;
  const { icon: Icon, title, body } = STEPS[step];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/85 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="surface-card w-full max-w-md animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="label-eyebrow">
            Getting Started · {step + 1}/{STEPS.length}
          </p>
          <button
            onClick={onClose}
            aria-label="Skip tutorial"
            className="border border-transparent px-2 py-1 font-mono text-xs text-muted-foreground hover:border-border hover:text-foreground"
          >
            SKIP
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center border border-border bg-card-inset">
            <Icon className="h-5 w-5 text-primary" strokeWidth={2} />
          </div>
          <h2 className="mb-2 text-lg font-bold tracking-tight">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === step ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && <Btn onClick={() => setStep((s) => s - 1)}>Back</Btn>}
            <Btn variant="primary" onClick={() => (lastStep ? onClose() : setStep((s) => s + 1))}>
              {lastStep ? (
                "Let's go"
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  Next <ArrowRight className="h-3 w-3" />
                </span>
              )}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
