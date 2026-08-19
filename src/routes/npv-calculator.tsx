import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Screen, Card, Btn } from "@/components/bizcase/ui";
import { npv } from "@/lib/bizcase/calc";
import { fmtCurrency } from "@/lib/bizcase/format";

const TITLE = "NPV Calculator — Net Present Value of Cash Flows";
const DESCRIPTION =
  "Free NPV calculator: enter an upfront investment, discount rate, and yearly cash flows to get net present value instantly.";
const URL = "https://bizcasebuilder.dev/npv-calculator";

export const Route = createFileRoute("/npv-calculator")({
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
              name: "What is NPV (net present value)?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Net present value is the sum of an investment's future cash flows discounted back into today's money, minus the upfront cost. It answers a single question: after accounting for the time value of money, does this project add or subtract value? A positive NPV means the discounted benefits exceed what you paid to get them.",
              },
            },
            {
              "@type": "Question",
              name: "What discount rate should I use?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Most companies use their weighted average cost of capital, commonly somewhere between 8% and 15%, as the discount rate. If your finance team publishes a hurdle rate, use that instead so your case is comparable to other projects. Riskier or longer projects justify a higher rate because future cash is less certain.",
              },
            },
            {
              "@type": "Question",
              name: "What does a negative NPV mean?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "A negative NPV means the project's discounted cash flows do not cover the investment at the rate you chose, so capital would earn more elsewhere. It is not automatically a rejection: try a lower discount rate, a longer horizon, or revisit whether all benefits are captured. If the number stays negative under realistic assumptions, the investment destroys value.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: NpvCalculatorPage,
});

const DEFAULT_FLOWS = ["40000", "55000", "65000", "70000", "70000"];

function parseNum(v: string): number {
  const n = Number(v.replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function NpvCalculatorPage() {
  const [investment, setInvestment] = useState("150000");
  const [discount, setDiscount] = useState("10");
  const [flows, setFlows] = useState<string[]>(DEFAULT_FLOWS);

  const result = useMemo(() => {
    const yearly = flows.map(parseNum);
    const monthly: number[] = [-Math.abs(parseNum(investment))];
    for (const y of yearly) for (let m = 0; m < 12; m++) monthly.push(y / 12);
    const monthlyRate = parseNum(discount) / 100 / 12;
    return {
      npv: npv(monthly, monthlyRate),
      total: yearly.reduce((a, b) => a + b, 0) - Math.abs(parseNum(investment)),
    };
  }, [investment, discount, flows]);

  const setFlow = (i: number, v: string) =>
    setFlows((prev) => prev.map((f, j) => (j === i ? v : f)));

  return (
    <Screen>
      <header className="mb-8">
        <p className="label-eyebrow">Free tool</p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight md:text-4xl">
          NPV Calculator
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Enter your upfront investment, a discount rate and the cash flow you expect each year. The
          calculator returns net present value as you type.
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
            <label className="flex flex-col gap-1.5">
              <span className="label-eyebrow">Discount rate (% / yr)</span>
              <input
                className="field-inset font-mono"
                inputMode="decimal"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
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
              <dt className="label-eyebrow">NPV</dt>
              <dd
                className={`font-mono text-2xl font-bold ${result.npv > 0 ? "text-primary" : "text-decline"}`}
              >
                {fmtCurrency(result.npv)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between py-3">
              <dt className="label-eyebrow">Net cash (undiscounted)</dt>
              <dd className="font-mono text-xl font-bold text-foreground">
                {fmtCurrency(result.total)}
              </dd>
            </div>
          </dl>
          <p
            className={`mt-4 text-sm font-medium ${result.npv > 0 ? "text-primary" : "text-decline"}`}
          >
            {result.npv > 0
              ? "Positive NPV — this investment is expected to create value"
              : "Negative NPV — this investment is expected to destroy value at this discount rate"}
          </p>
        </Card>
      </div>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl font-bold uppercase tracking-tight">
          What net present value means
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Net present value discounts every future cash flow back to today using a rate that
          reflects your cost of capital, then subtracts the upfront investment. Money arriving in
          year five is worth less than the same amount today, and NPV is the standard way to make
          that trade-off explicit. This calculator spreads each year's cash flow evenly across its
          twelve months, the same convention used inside BizCase Builder.
        </p>

        <h2 className="mt-8 text-xl font-bold uppercase tracking-tight">How to read the result</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Positive NPV</strong> — the discounted benefits
            exceed the investment, so the project creates value at your chosen rate.
          </li>
          <li>
            <strong className="text-foreground">Negative NPV</strong> — capital would be better
            deployed elsewhere unless the assumptions are too conservative.
          </li>
          <li>
            <strong className="text-foreground">NPV near zero</strong> — the project roughly earns
            its cost of capital. Decide it on strategic grounds, not on the number alone.
          </li>
          <li>
            <strong className="text-foreground">The discount rate dominates</strong> — small changes
            in the rate move NPV significantly on long-horizon cases, so test a range.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-bold uppercase tracking-tight">Frequently Asked Questions</h2>
        <dl className="mt-4 border border-border bg-card">
          <div className="border-b border-border p-4">
            <dt className="text-sm font-bold uppercase tracking-tight text-foreground">
              What is NPV (net present value)?
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Net present value is the sum of an investment's future cash flows discounted back into today's money, minus the upfront cost. It answers a single question: after accounting for the time value of money, does this project add or subtract value? A positive NPV means the discounted benefits exceed what you paid to get them.
            </dd>
          </div>
          <div className="border-b border-border p-4">
            <dt className="text-sm font-bold uppercase tracking-tight text-foreground">
              What discount rate should I use?
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Most companies use their weighted average cost of capital, commonly somewhere between 8% and 15%, as the discount rate. If your finance team publishes a hurdle rate, use that instead so your case is comparable to other projects. Riskier or longer projects justify a higher rate because future cash is less certain.
            </dd>
          </div>
          <div className="p-4">
            <dt className="text-sm font-bold uppercase tracking-tight text-foreground">
              What does a negative NPV mean?
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A negative NPV means the project's discounted cash flows do not cover the investment at the rate you chose, so capital would earn more elsewhere. It is not automatically a rejection: try a lower discount rate, a longer horizon, or revisit whether all benefits are captured. If the number stays negative under realistic assumptions, the investment destroys value.
            </dd>
          </div>
        </dl>

        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Related calculators</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Link to="/irr-calculator" className="text-sm font-medium text-primary hover:underline">
              IRR Calculator
            </Link>
            <Link to="/payback-period-calculator" className="text-sm font-medium text-primary hover:underline">
              Payback Period Calculator
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
