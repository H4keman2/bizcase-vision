import { useEffect, useRef, useState } from "react";
import { ArrowRight, Layers, FileDown, FlaskConical, SlidersHorizontal } from "lucide-react";
import { Btn } from "./ui";
import { cn } from "@/lib/utils";
import onboardingStep1Asset from "@/assets/onboarding-step-1.png.asset.json";
import onboardingStep2Asset from "@/assets/onboarding-step-2.jpg.asset.json";

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
  image: string;
  alt: string;
};

/**
 * Tutorial card images. Step 1 is served from the Lovable CDN asset pointer;
 * steps 2-4 still drop into public/onboarding/ (roughly 640x360, they render
 * ~288px wide inside the card). If a file is missing the image slot hides
 * itself automatically.
 */
const STEPS: Step[] = [
  {
    icon: SlidersHorizontal,
    title: "Start with your assumptions",
    body: "Pop in your investment, benefits, and costs. NPV, IRR, ROI, and payback recalculate the moment you type — no recalculating spreadsheets by hand.",
    image: onboardingStep1Asset.url,
    alt: "Benefits card showing the Savings Rationale builder with Cost Savings and Time Savings assumptions",
  },
  {
    icon: FlaskConical,
    title: "See what happens if you're wrong",
    body: "Flip between Expected, Best, and Worst case. It's the fastest way to find out which assumption your whole business case is really resting on.",
    image: onboardingStep2Asset.url,
    alt: "Sensitivity view tooltip explaining that Worst Case applies -15% to benefits/revenue and +15% to costs while Best Case applies +15% benefits and -5% costs",
  },
  {
    icon: Layers,
    title: "Save versions and compare",
    body: "Every case keeps its own version history. Save a few options side by side and see which path actually pays back faster.",
    image: "/onboarding/step-3.png",
    alt: "Side-by-side comparison view of two saved cases",
  },
  {
    icon: FileDown,
    title: "Share it when you're happy",
    body: "One click gives you a full Excel workbook or a clean summary report — ready to drop in front of stakeholders.",
    image: "/onboarding/step-4.png",
    alt: "Export buttons for the Excel workbook and summary report",
  },
];

function StepImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const img = new Image();
    img.src = src;
    img.onload = () => setLoaded(true);
    img.onerror = () => setLoaded(false);
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return (
    <div className="mb-3 aspect-video w-full overflow-hidden border border-border bg-card-inset">
      {loaded && (
        <img
          src={src}
          alt={alt}
          className="h-full w-full animate-in fade-in object-cover duration-200"
        />
      )}
    </div>
  );
}

/**
 * Corner-anchored onboarding guide. Deliberately not a modal: it never dims the
 * page, never traps focus, and the app stays fully interactive behind it.
 */
export function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const lastStep = step === STEPS.length - 1;
  const { icon: Icon, title, body, image, alt } = STEPS[step];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Clicking anywhere outside the card dismisses it (the app stays interactive,
  // so the click itself still reaches whatever was pressed).
  useEffect(() => {
    let armed = false;
    const arm = window.setTimeout(() => (armed = true), 0);
    const onDown = (e: PointerEvent) => {
      if (!armed) return;
      if (!cardRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.clearTimeout(arm);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={cardRef}
      role="complementary"
      aria-label="Getting started guide"
      className="fixed right-3 top-3 z-50 w-[min(20rem,calc(100vw-1.5rem))] animate-in fade-in slide-in-from-right-4 slide-in-from-top-2 duration-200 sm:right-4 sm:top-4"
    >
      <div className="surface-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="label-eyebrow">
            Getting Started · {step + 1}/{STEPS.length}
          </p>
          <button
            onClick={onClose}
            aria-label="Skip tutorial"
            className="border border-transparent px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-border hover:text-foreground"
          >
            SKIP
          </button>
        </div>

        <div className="p-4">
          <StepImage src={image} alt={alt} />
          <div key={step} className="min-h-[64px] animate-in fade-in duration-200">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-card-inset">
                <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
              </span>
              <h2 className="text-sm font-bold tracking-tight">{title}</h2>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-3 py-3">
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
            <Btn
              onClick={() => setStep((s) => s - 1)}
              tabIndex={step === 0 ? -1 : 0}
              aria-hidden={step === 0}
              className={cn(step === 0 && "pointer-events-none opacity-0")}
            >
              Back
            </Btn>
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
