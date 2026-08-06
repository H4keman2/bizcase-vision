import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { REGIONS, REGION_LABEL, type Region } from "@/lib/bizcase/types";

const AXIS = "var(--color-muted-foreground)";
const GRID = "var(--color-border)";
const PRIMARY = "var(--color-primary)";
const SURFACE = "var(--color-card)";

/** One color per region, in the fixed NA/LA/APAC/EMEA order the rest of the app uses. */
const REGION_COLORS: Record<Region, string> = {
  NA: "var(--color-primary)",
  LA: "#6E8F00",
  APAC: "#8A8A8A",
  EMEA: "#4F7A00",
};

/** Monthly Units-Over-Time or Revenue-Over-Time chart. Renders a single area
 *  series normally, or a stacked bar per region when a regional split is enabled. */
export function SeriesChart({
  data,
  regional,
  valueFormatter,
  seriesLabel,
}: {
  data: { month: number; value: number; byRegion?: Record<Region, number> }[];
  regional: boolean;
  valueFormatter: (v: number) => string;
  seriesLabel: string;
}) {
  const chartData = data.map((d) => ({
    month: d.month,
    value: d.value,
    ...(regional && d.byRegion ? d.byRegion : {}),
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
            tickFormatter={(v: number) => valueFormatter(v)}
            stroke={GRID}
            width={56}
          />
          <Tooltip
            cursor={{ fill: GRID, opacity: 0.3 }}
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
            formatter={(v, n) => [
              valueFormatter(Number(v)),
              n === "value" ? seriesLabel : REGION_LABEL[n as Region],
            ]}
          />
          {regional && <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 10 }} />}
          {regional ? (
            REGIONS.map((region) => (
              <Bar
                key={region}
                dataKey={region}
                name={REGION_LABEL[region]}
                stackId="region"
                fill={REGION_COLORS[region]}
              />
            ))
          ) : (
            <Area
              type="monotone"
              dataKey="value"
              name={seriesLabel}
              stroke={PRIMARY}
              strokeWidth={2}
              fill={PRIMARY}
              fillOpacity={0.22}
              dot={false}
              activeDot={{ r: 4, fill: PRIMARY, stroke: SURFACE, strokeWidth: 2 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
