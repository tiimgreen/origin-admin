"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber, formatPercent } from "@/lib/format";

type CategoryBarChartProps = {
  data: Array<{ label: string; count: number }>;
  colorVar?: string;
  total?: number;
  limit?: number;
};

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

type Payload = {
  value: number;
  payload: { label: string; count: number };
};

const CategoryTooltip = ({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: ReadonlyArray<Payload>;
  total: number;
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0].payload;

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-medium text-muted-foreground">{point.label}</div>
      <div className="mt-1 flex items-center justify-between gap-4 tabular-nums">
        <span className="text-muted-foreground">Shops</span>
        <span className="font-medium">
          {formatNumber({ value: point.count })}
          {total > 0 ? (
            <span className="ml-2 text-xs text-muted-foreground">
              ({formatPercent(point.count / total)})
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
};

export const CategoryBarChart = ({
  data,
  colorVar,
  total,
  limit = 10,
}: CategoryBarChartProps) => {
  const computedTotal = total ?? data.reduce((sum, d) => sum + d.count, 0);
  const truncated = data.slice(0, limit);

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, truncated.length * 28 + 24)}>
      <BarChart
        layout="vertical"
        data={truncated}
        margin={{ top: 4, right: 16, left: 12, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          dataKey="label"
          type="category"
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 12 }}
          width={110}
        />
        <Tooltip
          cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
          content={(props) => {
            return (
              <CategoryTooltip
                active={props.active}
                payload={props.payload as ReadonlyArray<Payload> | undefined}
                total={computedTotal}
              />
            );
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {truncated.map((entry, index) => {
            return (
              <Cell
                key={entry.label}
                fill={
                  colorVar ?? COLORS[index % COLORS.length]
                }
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
