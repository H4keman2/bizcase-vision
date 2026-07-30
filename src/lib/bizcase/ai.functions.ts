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
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 1000 }),
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
});

export const generateExecSummary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SummaryInput.parse(d))
  .handler(async ({ data }) => {
    const prompt = `You are helping a product manager translate a business case into a short executive summary for non-financial stakeholders.

Case name: ${data.name}
Horizon: ${data.horizonYears} years
Total investment: $${Math.round(data.totalInvestment).toLocaleString()} (including $${Math.round(data.nre).toLocaleString()} NRE)
Total revenue over horizon: $${Math.round(data.totalRevenue).toLocaleString()}
NPV: $${Math.round(data.npv).toLocaleString()} at an ${data.discountRateAnnual}% annual discount rate
IRR: ${data.irr === null ? "not solvable" : `${data.irr.toFixed(1)}%`}
Payback period: ${data.paybackMonths === null ? "not reached within the horizon" : `${data.paybackMonths.toFixed(1)} months`}
ROI: ${data.roi.toFixed(0)}%
${data.revenueContext}
${data.timelineContext}

Write a 3 to 4 sentence plain-English executive summary. Lead with the bottom-line recommendation. No jargon, no bullet points, no em dashes, no headings. Plain prose only.

Output ONLY the finished summary text itself. Do not include a header, a title, numbered steps, multiple draft options, markdown formatting like asterisks, or any commentary about your approach. Do not say things like "Draft 1" or "Here is a summary." The very first character of your response must be the first word of the summary.`;

    const text = await callGateway([{ role: "user", content: prompt }]);
    return { summary: cleanSummaryText(text) };
  });

/** Defensive cleanup if the model still wraps the summary in headers, draft labels or markdown. */
function cleanSummaryText(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (/^(\*\*|#|\d+\.\s*\*\*|draft\s*\d+:?)/i.test(t)) return false;
      if (/^\*\s*\*draft/i.test(t)) return false;
      return true;
    })
    .join(" ")
    .replace(/\*\*/g, "")
    .replace(/^\*+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
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
- overheadPercent (Overhead %, percent)
- overheadBasis (Overhead Basis, either "cogs" or "revenue")
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
