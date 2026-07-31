import { jsPDF } from "jspdf";
import { fmtCompact, fmtCurrency, fmtMonths, fmtNumber, fmtPercent } from "./format";
import type { CaseInputs, CaseMode, CaseOutputs } from "./types";

const BLACK = "#0A0A0A";
const GREEN = "#C7F92B";
const GREY = "#8A8A8A";
const LINE = "#D8D8D8";
const TEXT = "#141414";

export interface PdfCase {
  name: string;
  versionLabel: string;
  inputs: CaseInputs;
  outputs: CaseOutputs;
  mode: CaseMode;
  summary?: string | null;
}

/** Renders a cumulative cash-flow chart to a PNG data URL (no DOM capture needed). */
function chartImage(
  series: { label: string; color: string; points: number[] }[],
  width = 1200,
  height = 420,
): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const pad = { l: 110, r: 24, t: 24, b: 46 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  const all = series.flatMap((s) => s.points).filter((v) => Number.isFinite(v));
  const maxMonth = Math.max(1, ...series.map((s) => s.points.length - 1));
  let min = Math.min(0, ...all);
  let max = Math.max(0, ...all);
  if (min === max) max = min + 1;
  const padY = (max - min) * 0.08;
  min -= padY;
  max += padY;

  const x = (m: number) => pad.l + (m / maxMonth) * w;
  const y = (v: number) => pad.t + h - ((v - min) / (max - min)) * h;

  // grid + y labels
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.fillStyle = GREY;
  ctx.font = "18px monospace";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4;
    const yy = Math.round(y(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(pad.l, yy);
    ctx.lineTo(pad.l + w, yy);
    ctx.stroke();
    ctx.fillText(fmtCompact(v), pad.l - 10, yy + 6);
  }

  // zero line
  if (min < 0 && max > 0) {
    ctx.strokeStyle = "#999999";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(pad.l, y(0));
    ctx.lineTo(pad.l + w, y(0));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // x labels
  ctx.textAlign = "center";
  ctx.fillStyle = GREY;
  for (let i = 0; i <= 6; i++) {
    const m = Math.round((maxMonth * i) / 6);
    ctx.fillText(`M${m}`, x(m), height - 16);
  }

  // series
  series.forEach((s) => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    s.points.forEach((v, m) => {
      if (!Number.isFinite(v)) return;
      const px = x(m);
      const py = y(v);
      if (m === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  });

  // legend
  if (series.length > 1) {
    let lx = pad.l;
    ctx.textAlign = "left";
    ctx.font = "18px monospace";
    series.forEach((s) => {
      ctx.fillStyle = s.color;
      ctx.fillRect(lx, pad.t - 14, 22, 6);
      ctx.fillStyle = TEXT;
      const label = s.label.slice(0, 26);
      ctx.fillText(label, lx + 30, pad.t - 6);
      lx += 30 + ctx.measureText(label).width + 34;
    });
  }

  return canvas.toDataURL("image/png");
}

function header(doc: jsPDF, title: string, subtitle: string) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(BLACK);
  doc.rect(0, 0, W, 78, "F");
  doc.setFillColor(GREEN);
  doc.rect(40, 26, 8, 26, "F");

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("BIZCASE BUILDER", 58, 40);
  doc.setTextColor(GREEN);
  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  doc.text("ZEBRA TECHNOLOGIES", 58, 54);

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title.toUpperCase().slice(0, 46), W - 40, 40, { align: "right" });
  doc.setFont("courier", "normal");
  doc.setTextColor(GREY);
  doc.setFontSize(8);
  doc.text(subtitle, W - 40, 54, { align: "right" });
}

function sectionLabel(doc: jsPDF, text: string, y: number) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(GREEN);
  doc.rect(40, y - 9, 5, 12, "F");
  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  doc.setTextColor(TEXT);
  doc.text(text.toUpperCase(), 52, y);
  doc.setDrawColor(LINE);
  doc.line(40, y + 8, W - 40, y + 8);
  return y + 26;
}

function rows(doc: jsPDF, items: [string, string][], y: number, cols = 2) {
  const W = doc.internal.pageSize.getWidth();
  const colW = (W - 80) / cols;
  items.forEach((it, i) => {
    const cx = 40 + (i % cols) * colW;
    const cy = y + Math.floor(i / cols) * 20;
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(GREY);
    doc.text(it[0].toUpperCase(), cx, cy);
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.setTextColor(TEXT);
    doc.text(it[1], cx + colW - 12, cy, { align: "right" });
    doc.setDrawColor("#EEEEEE");
    doc.line(cx, cy + 6, cx + colW - 12, cy + 6);
  });
  return y + Math.ceil(items.length / cols) * 20 + 12;
}

function inputRows(c: PdfCase): [string, string][] {
  const { inputs: i, mode } = c;
  const rm = i.benefits.revenueModel;
  const tl = i.benefits.timeline;
  const out: [string, string][] = [
    ["NRE", fmtCurrency(i.investment.nre)],
    ["Upfront Capex", fmtCurrency(i.investment.upfront)],
    ["Cost Savings / Yr", fmtCurrency(i.benefits.costSavingsAnnual)],
    ["Time Savings / Yr", fmtCurrency(i.benefits.timeSavingsAnnual)],
    ["Horizon", `${i.horizonYears} YR`],
    ["Discount Rate", fmtPercent(i.discountRateAnnual)],
  ];
  i.investment.phased.forEach((p) =>
    out.push([`Phased Capex · M${p.month}`, fmtCurrency(p.amount)]),
  );
  out.push([
    "Timeline",
    tl.type === "ramp"
      ? `Ramp ${tl.ramp.year1Percent}% +${tl.ramp.growthRatePercent}%/yr`
      : tl.type === "manual"
        ? `Manual (${tl.manual.yearlyMultipliers.slice(0, Math.ceil(i.horizonYears)).join(", ")})`
        : "Flat",
  ]);
  if (mode === "detailed") {
    out.push(["Revenue Model", rm.type === "unit" ? "Unit-Level" : rm.type === "aggregate" ? "Aggregate" : "None"]);
    if (rm.type === "aggregate") {
      out.push(["Revenue Lift / Yr", fmtCurrency(rm.aggregate.revenueLiftAnnual)]);
      out.push(["COGS / Yr", fmtCurrency(rm.aggregate.cogsAnnual)]);
    }
    if (rm.type === "unit") {
      out.push(["Price / Unit", fmtCurrency(rm.unit.pricePerUnit, 2)]);
      out.push(["Variable Cost / Unit", fmtCurrency(rm.unit.variableCostPerUnit, 2)]);
      out.push(["Fixed Costs / Yr", fmtCurrency(rm.unit.fixedCostsAnnual)]);
      out.push(["Units / Yr", fmtNumber(rm.unit.unitsPerYear)]);
    }
    if (i.benefits.overhead.enabled) {
      out.push([
        `Overhead (${i.benefits.overhead.basis === "cogs" ? "COGS" : "Revenue"})`,
        fmtPercent(i.benefits.overhead.percent),
      ]);
    }
  }
  return out;
}

function outputRows(c: PdfCase): [string, string][] {
  const o = c.outputs;
  const out: [string, string][] = [
    ["NPV", fmtCompact(o.npv)],
    ["IRR", fmtPercent(o.irr)],
    ["Payback", fmtMonths(o.paybackMonths)],
    ["ROI", fmtPercent(o.roi, 0)],
    ["Total Investment", fmtCompact(o.totalInvestment)],
  ];
  if (c.mode === "detailed") {
    out.push(["Total Revenue", fmtCompact(o.totalRevenue)]);
    const m = o.margins;
    if (m) {
      if (m.grossMarginPercent !== null) out.push(["Gross Margin", fmtPercent(m.grossMarginPercent)]);
      if (m.contributionMarginPerUnit !== null)
        out.push(["Contribution / Unit", fmtCurrency(m.contributionMarginPerUnit, 2)]);
      if (m.contributionMarginPercent !== null)
        out.push(["Contribution %", fmtPercent(m.contributionMarginPercent)]);
      if (m.breakevenUnitsPerYear !== null)
        out.push(["Breakeven Units / Yr", fmtNumber(m.breakevenUnitsPerYear)]);
      if (c.inputs.benefits.overhead.enabled)
        out.push(["Overhead / Yr", fmtCurrency(m.overheadAnnual)]);
    }
  }
  return out;
}

function slug(s: string) {
  return (s.trim() || "Case").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function footer(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(LINE);
  doc.line(40, H - 42, W - 40, H - 42);
  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(GREY);
  doc.text(`GENERATED ${today()} · BIZCASE BUILDER`, 40, H - 28);
}

/** Single-case export. */
export function exportCasePdf(c: PdfCase) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  header(doc, c.name, `${c.versionLabel} · ${c.mode.toUpperCase()} MODE`);

  let y = 116;
  y = sectionLabel(doc, "Key Outputs", y);
  y = rows(doc, outputRows(c), y, 2);

  y = sectionLabel(doc, "Assumptions", y);
  y = rows(doc, inputRows(c), y, 2);

  const img = chartImage([
    { label: "Cumulative Cash Flow", color: "#6E8F00", points: c.outputs.cashFlowSeries.map((p) => p.cumulative) },
  ]);
  y = sectionLabel(doc, "Cumulative Cash Flow", y);
  if (img) {
    const iw = W - 80;
    const ih = iw * (420 / 1200);
    doc.addImage(img, "PNG", 40, y - 8, iw, ih);
    y += ih + 18;
  }

  if (c.summary) {
    if (y > doc.internal.pageSize.getHeight() - 190) {
      footer(doc);
      doc.addPage();
      y = 60;
    }
    y = sectionLabel(doc, "Executive Summary", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(TEXT);
    const lines = doc.splitTextToSize(c.summary, W - 80) as string[];
    doc.text(lines, 40, y);
  }

  footer(doc);
  doc.save(`BizCase_${slug(c.name)}_${slug(c.versionLabel)}_${today()}.pdf`);
}

/** Side-by-side comparison export. */
export function exportComparisonPdf(opts: {
  name: string;
  a: PdfCase;
  b: PdfCase;
  summary?: string | null;
}) {
  const { a, b } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  header(doc, opts.name, `COMPARISON · ${a.versionLabel} VS ${b.versionLabel}`);

  let y = 116;
  const npvDelta = b.outputs.npv - a.outputs.npv;
  doc.setFillColor(GREEN);
  doc.rect(40, y - 14, W - 80, 30, "F");
  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.setTextColor(BLACK);
  const verdict =
    Math.abs(npvDelta) < 1
      ? "BOTH OPTIONS ARE EFFECTIVELY EVEN"
      : npvDelta > 0
        ? "CASE B IS THE STRONGER BET"
        : "CASE A IS THE STRONGER BET";
  doc.text(
    `${verdict} · ${npvDelta >= 0 ? "+" : "-"}${fmtCompact(Math.abs(npvDelta))} NPV`,
    52,
    y + 6,
  );
  y += 46;

  y = sectionLabel(doc, "Metrics Ledger", y);
  const ra = outputRows(a);
  const rb = new Map(outputRows(b));
  const colX = [40, W / 2 - 20, W - 200, W - 40];
  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  doc.setTextColor(GREY);
  doc.text("METRIC", colX[0], y);
  doc.text(`A · ${a.versionLabel}`.toUpperCase().slice(0, 22), colX[1], y, { align: "right" });
  doc.text(`B · ${b.versionLabel}`.toUpperCase().slice(0, 22), colX[2], y, { align: "right" });
  doc.text("DELTA", colX[3], y, { align: "right" });
  y += 8;

  ra.forEach(([label, va]) => {
    const vb = rb.get(label) ?? "—";
    y += 18;
    doc.setDrawColor(LINE);
    doc.line(40, y - 12, W - 40, y - 12);
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(GREY);
    doc.text(label.toUpperCase(), colX[0], y);
    doc.setFontSize(9.5);
    doc.setTextColor(TEXT);
    doc.text(va, colX[1], y, { align: "right" });
    doc.setFont("courier", "bold");
    doc.text(vb, colX[2], y, { align: "right" });
    doc.setTextColor(GREY);
    doc.text(va === vb ? "EVEN" : "—", colX[3], y, { align: "right" });
  });
  y += 30;

  const maxLen = Math.max(a.outputs.cashFlowSeries.length, b.outputs.cashFlowSeries.length);
  const pad = (c: PdfCase) =>
    Array.from({ length: maxLen }).map((_, m) => c.outputs.cashFlowSeries[m]?.cumulative ?? NaN);
  const img = chartImage([
    { label: `A · ${a.versionLabel}`, color: "#8A8A8A", points: pad(a) },
    { label: `B · ${b.versionLabel}`, color: "#6E8F00", points: pad(b) },
  ]);
  y = sectionLabel(doc, "Cumulative Cash Flow", y);
  if (img) {
    const iw = W - 80;
    const ih = iw * (420 / 1200);
    doc.addImage(img, "PNG", 40, y - 8, iw, ih);
    y += ih + 18;
  }

  y = sectionLabel(doc, "Assumptions · Case B", y);
  rows(doc, inputRows(b), y, 2);

  footer(doc);
  doc.save(`BizCase_${slug(opts.name)}_Comparison_${today()}.pdf`);
}
