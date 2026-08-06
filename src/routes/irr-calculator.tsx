import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Screen, Card, Btn } from "@/components/bizcase/ui";
import { irr, npv, paybackMonths } from "@/lib/bizcase/calc";
import { fmtCurrency, fmtPercent } from "@/lib/bizcase/format";

const TITLE = "IRR Calculator — Internal Rate of Return, NPV & Payback";
const DESCRIPTION =
  "Free IRR calculator: enter an upfront investment and yearly cash flows to get internal rate of return, NPV and payback period instantly.";
const URL = "https://bizcasebuilder.dev/irr-calculator";

export const Route = createFileRoute("/irr-calculator")({
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
              name: "What is IRR (internal rate of return)?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "IRR is the discount rate at which the net present value of an investment's cash flows equals zero. It expresses an investment's return as a single annualised percentage.",
              },
            },
            {
              "@type": "Question",
              name: "What is a good IRR?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "An IRR is good when it exceeds your hurdle rate or weighted average cost of capital. Many companies use a hurdle rate between 8% and 15%, so an IRR above that range is typically approved.",
              },
            },
            {
              "@type": "Question",
              name: "How is IRR different from NPV?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "NPV reports value created in currency at a chosen discount rate, while IRR reports the rate itself. Use NPV to compare absolute value and IRR to compare efficiency across projects of different sizes.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: IrrCalculatorPage,
});

const DEFAULT_FLOWS = ["40000", "55000", "65000", "70000", "70000"];

function parseNum(v: string): number {
  const n = Number(v.replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function IrrCalculatorPage() {
  const [investment, setInvestment] = useState("150000");
  const [discount, setDiscount] = useState("10");
  const [flows, setFlows] = useState<string[]>(DEFAULT_FLOWS);

  const result = useMemo(() => {
    const yearly = flows.map(parseNum);
    // Monthly series so the shared engine's monthly NPV/payback math applies.
    const monthly: number[] = [-Math.abs(parseNum(investment))];
    for (const y of yearly) for (let m = 0; m < 12; m++) monthly.push(y / 12);
    const monthlyRate = parseNum(discount) / 100 / 12;
    const monthlyIrr = irr(monthly);
    return {
      irr: monthlyIrr === null ? null : (1 + monthlyIrr) ** 12 - 1,
      npv: npv(monthly, monthlyRate),
      payback: paybackMonths(monthly),
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
          IRR Calculator
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Enter your upfront investment and the cash flow you expect each year. The calculator
          returns internal rate of return, net present value and payback period as you type.
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
              <dt className="label-eyebrow">IRR</dt>
              <dd className="font-mono text-2xl font-bold text-primary">
                {result.irr === null ? "n/a" : fmtPercent(result.irr * 100)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between py-3">
              <dt className="label-eyebrow">NPV</dt>
              <dd
                className={`font-mono text-xl font-bold ${result.npv >= 0 ? "text-foreground" : "text-decline"}`}
              >
                {fmtCurrency(result.npv)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between py-3">
              <dt className="label-eyebrow">Payback</dt>
              <dd className="font-mono text-xl font-bold text-foreground">
                {result.payback === null ? "Never" : `${result.payback.toFixed(1)} mo`}
              </dd>
            </div>
            <div className="flex items-baseline justify-between py-3">
              <dt className="label-eyebrow">Net cash (undiscounted)</dt>
              <dd className="font-mono text-xl font-bold text-foreground">
                {fmtCurrency(result.total)}
              </dd>
            </div>
          </dl>
          <div className="mt-5">
            <Link
              to="/"
              className="inline-block bg-primary px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90"
            >
              Build a full business case
            </Link>
          </div>
        </Card>
      </div>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl font-bold uppercase tracking-tight">
          What internal rate of return means
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Internal rate of return is the discount rate that makes the net present value of a series
          of cash flows equal zero. It converts an uneven stream of costs and benefits into one
          annualised percentage, which makes it easy to compare projects of different shapes and
          durations. This calculator solves for IRR numerically, spreading each year's cash flow
          evenly across its twelve months, the same convention used inside BizCase Builder.
        </p>

        <h2 className="mt-8 text-xl font-bold uppercase tracking-tight">How to read the results</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">IRR above your hurdle rate</strong> — the project
            earns more than your cost of capital, so it creates value.
          </li>
          <li>
            <strong className="text-foreground">Positive NPV</strong> — the discounted benefits
            exceed the investment in today's money. NPV is the more reliable tie-breaker when two
            projects differ greatly in size.
          </li>
          <li>
            <strong className="text-foreground">Payback period</strong> — how long until cumulative
            cash flow turns positive. It ignores the time value of money, so use it alongside NPV
            rather than on its own.
          </li>
          <li>
            <strong className="text-foreground">No IRR shown</strong> — a stream that never turns
            positive, or one with several sign changes, may have no single valid IRR. Judge those
            cases on NPV.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-bold uppercase tracking-tight">IRR vs NPV vs ROI</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          ROI is a simple ratio of net gain to cost and ignores timing entirely. NPV respects timing
          but reports a currency amount that depends on the discount rate you pick. IRR respects
          timing and is rate-independent, which is why investment committees usually ask for all
          three. BizCase Builder models them together, with best and worst case scenarios, phased
          capital spend and side-by-side version comparison.
        </p>
      </section>
    </Screen>
  );
}
