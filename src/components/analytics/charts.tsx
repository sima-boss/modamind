"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

// Series colors follow the app theme: --primary for the main series and
// the brand violet (same value the dark theme uses for primary) for the second.
const PRIMARY = "hsl(var(--primary))";
const ACCENT = "hsl(263 70% 60%)";
const MUTED = "hsl(var(--muted-foreground))";
const GRID = "hsl(var(--border))";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--card-foreground))",
};

const axisProps = {
  tick: { fontSize: 11, fill: MUTED },
  tickLine: false,
  axisLine: false,
} as const;

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function UsageTrendChart({
  data,
  allowRangeToggle,
}: {
  data: { day: string; outfits: number; captions: number }[];
  /** Full view gets a 30/60-day toggle (data holds 60 days). */
  allowRangeToggle: boolean;
}) {
  const [range, setRange] = useState<30 | 60>(30);
  const visible = data.slice(-range);

  return (
    <div>
      {allowRangeToggle && (
        <div className="mb-3 inline-flex rounded-lg border p-0.5 text-xs">
          {([30, 60] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r} days
            </button>
          ))}
        </div>
      )}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={visible} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={shortDate}
              minTickGap={24}
              {...axisProps}
            />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(l) => shortDate(String(l))}
            />
            {/* itemSorter={null}: keep declared order (default sorts A–Z). */}
            <Legend
              iconType="circle"
              itemSorter={null}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="outfits"
              name="Outfit generations"
              stroke={PRIMARY}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="captions"
              name="AI captions"
              stroke={ACCENT}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function UsageSplitChart({
  outfits,
  captions,
}: {
  outfits: number;
  captions: number;
}) {
  const data = [
    { name: "Outfit generations", value: outfits, color: PRIMARY },
    { name: "AI captions", value: captions, color: ACCENT },
  ];
  const total = outfits + captions;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, n) => [
              `${Number(v).toLocaleString()} (${
                total ? Math.round((Number(v) / total) * 100) : 0
              }%)`,
              n,
            ]}
          />
          <Legend
            iconType="circle"
            itemSorter={null}
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bar chart for label → count breakdowns (themes, categories,
 * caption language/format). Height grows with the number of rows. */
export function BreakdownBarChart({
  data,
  color = PRIMARY,
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  const height = Math.max(160, data.length * 34 + 24);
  // Size the label column to the longest label (~7px/char at 11px, plus
  // tick padding) so labels stay on one line; capped so bars keep room.
  const labelWidth = Math.min(
    240,
    Math.max(80, Math.max(0, ...data.map((d) => d.label.length)) * 7 + 28)
  );

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...axisProps} />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
            interval={0}
            {...axisProps}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
          <Bar dataKey="value" name="Count" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
