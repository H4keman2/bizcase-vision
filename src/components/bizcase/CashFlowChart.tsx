import {
  LineChart,
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

const AXIS = "#8A8A8A";
const GRID = "#2A2A2A";

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
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
            contentStyle={{
              backgroundColor: "#141414",
              border: "1px solid #2A2A2A",
              borderRadius: 0,
              fontFamily: "monospace",
              fontSize: 12,
            }}
            labelFormatter={(m) => `Month ${m}`}
            formatter={(v: number, n) => [fmtCompact(v), n === "a" ? labelA : labelB]}
          />
          <ReferenceLine y={0} stroke={AXIS} strokeDasharray="3 3" />
          {seriesB ? <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 10 }} /> : null}
          {showA && (
            <Line
              type="monotone"
              dataKey="a"
              name={labelA}
              stroke={seriesB ? "#8A8A8A" : "#C7F92B"}
              strokeWidth={2}
              dot={false}
            />
          )}
          {seriesB && (
            <Line type="monotone" dataKey="b" name={labelB} stroke="#C7F92B" strokeWidth={2} dot={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
