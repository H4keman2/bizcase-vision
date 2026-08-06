import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

async function callGateway(messages: { role: string; content: string }[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured for this project.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 4000 }),
  });

  if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

const SummaryInput = z.object({
  name: z.string(),
  horizonYears: z.number(),
  discountRateAnnual: z.number(),
  nre: z.number(),
  totalInvestment: z.number(),
  totalRevenue: z.number(),
  npv: z.number(),
  irr: z.number().nullable(),
  paybackMonths: z.number().nullable(),
  roi: z.number(),
  revenueContext: z.string(),
  timelineContext: z.string(),
  npvWorst: z.number().nullable().optional(),
  npvBest: z.number().nullable().optional(),
  marginContext: z.string().optional(),
  phasedCapexContext: z.string().optional(),
  regionalContext: z.string().optional(),
});

export interface ExecSummary {
  verdict: string;
  drivers: string[];
  risks: string[];
  nextStep: string;
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export const generateExecSummary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SummaryInput.parse(d))
  .handler(async ({ data }): Promise<ExecSummary> => {
    const range =
      data.npvWorst === null ||
      data.npvWorst === undefined ||
      data.npvBest === null ||
      data.npvBest === undefined
        ? "Scenario range: not available."
        : `Scenario range: worst-case NPV ${money(data.npvWorst)}, best-case NPV ${money(data.npvBest)}.`;

    const prompt = `You are helping a product manager translate a business case into a structured executive summary for non-financial stakeholders.

Case name: ${data.name}
Horizon: ${data.horizonYears} years
Total investment: ${money(data.totalInvestment)} (including ${money(data.nre)} NRE)
Total revenue over horizon: ${money(data.totalRevenue)}
NPV: ${money(data.npv)} at an ${data.discountRateAnnual}% annual discount rate
IRR: ${data.irr === null ? "not solvable" : `${data.irr.toFixed(1)}%`}
Payback period: ${data.paybackMonths === null ? "not reached within the horizon" : `${data.paybackMonths.toFixed(1)} months`}
ROI: ${data.roi.toFixed(0)}%
${range}
${data.marginContext ?? ""}
${data.phasedCapexContext ?? ""}
${data.regionalContext ?? ""}
${data.revenueContext}
${data.timelineContext}

Ground every risk in the real numbers above: reference the worst-case NPV, the payback timing, margin or breakeven figures, regional mix, and phased capex timing where they exist. Do not write generic hedging that could apply to any project.

Keep each entry to one short plain-English sentence. No jargon, no markdown, no em dashes, no bullet characters.

Respond ONLY with a JSON object, no markdown fences, no preamble. Shape:
{"verdict": "one punchy sentence with the bottom-line recommendation", "drivers": ["driver 1", "driver 2", "driver 3"], "risks": ["risk 1", "risk 2"], "nextStep": "one sentence recommended next action"}`;

    const text = await callGateway([{ role: "user", content: prompt }]);
    const cleaned = extractJson(text);
    try {
      const parsed = JSON.parse(cleaned) as Partial<ExecSummary>;
      return {
        verdict: String(parsed.verdict ?? "").trim(),
        drivers: Array.isArray(parsed.drivers) ? parsed.drivers.map((d) => String(d)) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.map((r) => String(r)) : [],
        nextStep: String(parsed.nextStep ?? "").trim(),
      };
    } catch {
      throw new Error("Could not read the AI response. Try again.");
    }
  });

/** Strips code fences and any preamble so a JSON body can be parsed. */
function extractJson(raw: string): string {
  const t = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return start !== -1 && end > start ? t.slice(start, end + 1) : t;
}

const ExtractInput = z.object({ sheetText: z.string().min(1).max(20000) });

export const extractCaseFromSheet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ExtractInput.parse(d))
  .handler(async ({ data }) => {
    const prompt = `You are extracting business case inputs from a spreadsheet export. Below is the raw content of an uploaded Excel file, row by row.

Map any values you can confidently identify to these fields:
- nre (NRE, currency)
- upfront (Upfront Capex, currency)
- costSavingsAnnual (Cost Savings / Yr, currency)
- timeSavingsAnnual (Time Savings / Yr, currency)
- revenueLiftAnnual (Revenue Lift / Yr, currency)
- cogsAnnual (COGS / Yr, currency)
- pricePerUnit (Price / Unit, currency)
- variableCostPerUnit (Variable Cost / Unit, currency)
- fixedCostsAnnual (Fixed Costs / Yr, currency)
- unitsPerYear (Units / Yr, number)
- regionalUnitsNA (Units / Yr — NA, number — only fill if the sheet breaks units down by region)
- regionalUnitsLA (Units / Yr — LA, number — only fill if the sheet breaks units down by region)
- regionalUnitsAPAC (Units / Yr — APAC, number — only fill if the sheet breaks units down by region)
- regionalUnitsEMEA (Units / Yr — EMEA, number — only fill if the sheet breaks units down by region)
- overheadPercent (Overhead %, percent)
- overheadBasis (Overhead Basis, either "cogs" or "revenue")
- phasedMonth1 / phasedAmount1, phasedMonth2 / phasedAmount2, phasedMonth3 / phasedAmount3, phasedMonth4 / phasedAmount4 (Phased Capex rows: month number and currency amount; only fill pairs that are present)
- timelineMode (Timeline Mode, one of "flat", "manual", or "ramp")
- rampYear1Percent (Ramp Year 1 %, percent — only when timeline mode is ramp)
- rampGrowthRatePercent (Ramp Growth Rate %/Yr, percent — only when timeline mode is ramp)
- horizonYears (Horizon in years, number)
- discountRateAnnual (Annual discount rate, percent)

Rules: do not force values into unit-level fields when the sheet is aggregate, or vice versa. Do not infer overhead unless it is explicitly present in the sheet. Use null for anything you cannot identify.

Spreadsheet content:
${data.sheetText}

Respond ONLY with a JSON object, no markdown fences, no preamble. Shape:
{"fields": {"<fieldKey>": {"value": number or string or null, "confidence": "high" | "medium" | "low" | null}}}`;

    const text = await callGateway([{ role: "user", content: prompt }]);
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    try {
      return JSON.parse(cleaned) as {
        fields: Record<string, { value: number | string | null; confidence: string | null }>;
      };
    } catch {
      throw new Error("Could not read the AI response. Try again.");
    }
  });
