import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Screen, Card, Btn } from "@/components/bizcase/ui";
import { paybackMonths } from "@/lib/bizcase/calc";
import { fmtCurrency } from "@/lib/bizcase/format";

const TITLE = "Payback Period Calculator — How Fast Does an Investment Pay Back?";
const DESCRIPTION =
  "Free payback period calculator: enter an upfront investment and yearly cash flows to see how many months until the investment pays for itself.";
const URL = "https://bizcasebuilder.dev/payback-period-calculator";

export const Route = createFileRoute("/payback-period-calculator")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://bizcasebuilder.dev/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://bizcasebuilder.dev/og-image.png" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What is payback period?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Payback period is the time it takes for an investment's cumulative cash flow to turn positive, meaning the project has recovered its upfront cost. It is usually expressed in months or years. Shorter paybacks mean capital is recovered sooner and is available for other uses.",
              },
            },
            {
              "@type": "Question",
              name: "What's a good payback period?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Many companies look for payback inside 12 to 24 months for operational efficiency projects, and accept longer periods for infrastructure or platform investments. The right threshold depends on your industry, how quickly technology changes, and how tight your cash position is. Check whether your finance team publishes a target before setting your own.",
              },
            },
            {
              "@type": "Question",
              name: "What are the limits of payback period as a metric?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Payback ignores the time value of money and everything that happens after the break-even point, so a project that pays back fast then stops can look better than one that compounds for years. It also says nothing about total value created. Use it alongside NPV and IRR rather than as the deciding number.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: PaybackCalculatorPage,
});

const DEFAULT_FLOWS = ["40000", "55000", "65000", "70000", "70000"];

function parseNum(v: string): number {
  const n = Number(v.replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function PaybackCalculatorPage() {
  const [investment, setInvestment] = useState("150000");
  const [flows, setFlows] = useState<string[]>(DEFAULT_FLOWS);

  const result = useMemo(() => {
    const yearly = flows.map(parseNum);
    const monthly: number[] = [-Math.abs(parseNum(investment))];
    for (const y of yearly) for (let m = 0; m < 12; m++) monthly.push(y / 12);
    return {
      payback: paybackMonths(monthly),
      total: yearly.reduce((a, b) => a + b, 0) - Math.abs(parseNum(investment)),
    };
  }, [investment, flows]);

  const setFlow = (i: number, v: string) =>
    setFlows((prev) => prev.map((f, j) => (j === i ? v : f)));

  return (
    <Screen>
      <header className="mb-8">
        <p className="label-eyebrow">Free tool</p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight md:text-4xl">
          Payback Period Calculator
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Enter your upfront investment and the cash flow you expect each year. The calculator
          returns how long it takes for the investment to pay for itself.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card label="Assumptions">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="label-eyebrow">Upfront investment</span>
              <input
                className="field-inset font-mono"
                inputMode="decimal"
                value={investment}
                onChange={(e) => setInvestment(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {flows.map((f, i) => (
                <label key={i} className="flex flex-col gap-1.5">
                  <span className="label-eyebrow">Year {i + 1} cash flow</span>
                  <input
                    className="field-inset font-mono"
                    inputMode="decimal"
                    value={f}
                    onChange={(e) => setFlow(i, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => setFlows((p) => [...p, "0"])}>+ Add Year</Btn>
              {flows.length > 1 && (
                <Btn onClick={() => setFlows((p) => p.slice(0, -1))}>Remove Year</Btn>
              )}
            </div>
          </div>
        </Card>

        <Card label="Results">
          <dl className="flex flex-col divide-y divide-border">
            <div className="flex items-baseline justify-between py-3">
              <dt className="label-eyebrow">Payback</dt>
              <dd className="font-mono text-2xl font-bold text-primary">
                {result.payback === null
                  ? "—"
                  : `${result.payback.toFixed(1)} months (${(result.payback / 12).toFixed(1)} years)`}
              </dd>
            </div>
            <div className="flex items-baseline justify-between py-3">
              <dt className="label-eyebrow">Net cash (undiscounted)</dt>
              <dd className="font-mono text-xl font-bold text-foreground">
                {fmtCurrency(result.total)}
              </dd>
            </div>
          </dl>
          {result.payback === null && (
            <p className="mt-4 text-sm font-medium text-decline">
              Investment does not pay back within the given cash flows.
            </p>
          )}
        </Card>
      </div>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl font-bold uppercase tracking-tight">What payback period means</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Payback period measures how long an investment takes to recover its own cost from the cash
          it generates. It is the most intuitive investment metric because it answers a plain
          question — when do we get our money back? This calculator spreads each year's cash flow
          evenly across its twelve months and reports the month cumulative cash flow crosses zero,
          the same convention used inside BizCase Builder.
        </p>

        <h2 className="mt-8 text-xl font-bold uppercase tracking-tight">How to read the result</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Short payback</strong> — capital is recovered
            quickly and risk exposure is lower, which usually makes approval easier.
          </li>
          <li>
            <strong className="text-foreground">Long payback</strong> — acceptable for platform or
            infrastructure work, but check that the cash flows are still credible that far out.
          </li>
          <li>
            <strong className="text-foreground">No payback</strong> — cumulative cash flow never
            turns positive over the years you entered. Extend the horizon or revisit the benefits.
          </li>
          <li>
            <strong className="text-foreground">Pair it with NPV</strong> — payback ignores the time
            value of money and everything after break-even, so it should never decide a case alone.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-bold uppercase tracking-tight">Frequently Asked Questions</h2>
        <dl className="mt-4 border border-border bg-card">
          <div className="border-b border-border p-4">
            <dt className="text-sm font-bold uppercase tracking-tight text-foreground">
              What is payback period?
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Payback period is the time it takes for an investment's cumulative cash flow to turn positive, meaning the project has recovered its upfront cost. It is usually expressed in months or years. Shorter paybacks mean capital is recovered sooner and is available for other uses.
            </dd>
          </div>
          <div className="border-b border-border p-4">
            <dt className="text-sm font-bold uppercase tracking-tight text-foreground">
              What's a good payback period?
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Many companies look for payback inside 12 to 24 months for operational efficiency projects, and accept longer periods for infrastructure or platform investments. The right threshold depends on your industry, how quickly technology changes, and how tight your cash position is. Check whether your finance team publishes a target before setting your own.
            </dd>
          </div>
          <div className="p-4">
            <dt className="text-sm font-bold uppercase tracking-tight text-foreground">
              What are the limits of payback period as a metric?
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Payback ignores the time value of money and everything that happens after the break-even point, so a project that pays back fast then stops can look better than one that compounds for years. It also says nothing about total value created. Use it alongside NPV and IRR rather than as the deciding number.
            </dd>
          </div>
        </dl>

        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Related calculators</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Link to="/irr-calculator" className="text-sm font-medium text-primary hover:underline">
              IRR Calculator
            </Link>
            <Link to="/npv-calculator" className="text-sm font-medium text-primary hover:underline">
              NPV Calculator
            </Link>
            <Link
              to="/"
              className="inline-block bg-primary px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90"
            >
              Model a full business case in BizCase Builder →
            </Link>
          </div>
        </div>
      </section>
    </Screen>
  );
}
