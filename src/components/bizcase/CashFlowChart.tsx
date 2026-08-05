import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { fmtCompact } from "@/lib/bizcase/format";

const AXIS = "var(--color-muted-foreground)";
const GRID = "var(--color-border)";
const PRIMARY = "var(--color-primary)";
const DECLINE = "var(--color-decline)";
const SURFACE = "var(--color-card)";

export function CashFlowChart({
  data,
  seriesB,
  labelA = "Case A",
  labelB = "Case B",
  showA = true,
}: {
  data: { month: number; a: number; b?: number }[];
  seriesB?: boolean;
  labelA?: string;
  labelB?: string;
  showA?: boolean;
}) {
  // Where the zero line sits within the series' vertical range, used to
  // split the fill into a positive (above-zero) and negative (below-zero)
  // band — a cumulative cash-flow curve almost always crosses zero once.
  const values = data.map((d) => d.a).filter((v) => Number.isFinite(v));
  const max = values.length ? Math.max(...values, 0) : 1;
  const min = values.length ? Math.min(...values, 0) : -1;
  const range = max - min || 1;
  const zeroOffset = Math.min(1, Math.max(0, max / range));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="cashFlowSplit" x1="0" y1="0" x2="0" y2="1">
              <stop offset={zeroOffset} stopColor={PRIMARY} stopOpacity={0.28} />
              <stop offset={zeroOffset} stopColor={DECLINE} stopOpacity={0.22} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: AXIS, fontSize: 10, fontFamily: "monospace" }}
            tickFormatter={(m: number) => `M${m}`}
            stroke={GRID}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: AXIS, fontSize: 10, fontFamily: "monospace" }}
            tickFormatter={(v: number) => fmtCompact(v)}
            stroke={GRID}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: PRIMARY, strokeWidth: 1, strokeDasharray: "3 3" }}
            contentStyle={{
              backgroundColor: SURFACE,
              border: `1px solid ${GRID}`,
              borderRadius: 0,
              fontFamily: "monospace",
              fontSize: 12,
              color: "var(--color-card-foreground)",
            }}
            labelStyle={{ color: "var(--color-card-foreground)" }}
            itemStyle={{ color: "var(--color-card-foreground)" }}
            labelFormatter={(m) => `Month ${m}`}
            formatter={(v, n) => [fmtCompact(Number(v)), n === "a" ? labelA : labelB]}
          />
          <ReferenceLine y={0} stroke={AXIS} strokeDasharray="3 3" />
          {seriesB ? <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 10 }} /> : null}
          {showA && !seriesB && (
            <Area
              type="monotone"
              dataKey="a"
              name={labelA}
              stroke={PRIMARY}
              strokeWidth={2}
              fill="url(#cashFlowSplit)"
              dot={false}
              activeDot={{ r: 4, fill: PRIMARY, stroke: SURFACE, strokeWidth: 2 }}
            />
          )}
          {showA && seriesB && (
            <Line
              type="monotone"
              dataKey="a"
              name={labelA}
              stroke={AXIS}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: AXIS, stroke: SURFACE, strokeWidth: 2 }}
            />
          )}
          {seriesB && (
            <Line
              type="monotone"
              dataKey="b"
              name={labelB}
              stroke={PRIMARY}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: PRIMARY, stroke: SURFACE, strokeWidth: 2 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
