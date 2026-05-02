"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber } from "@/lib/format";

type ChurnDistributionChartProps = {
  data: Array<{ bucket: string; count: number }>;
};

type Payload = {
  payload: { bucket: string; count: number };
};

const ChurnTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<Payload>;
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-medium text-muted-foreground">
        {point.bucket}
      </div>
      <div className="mt-1 flex items-center justify-between gap-4 tabular-nums">
        <span className="text-muted-foreground">Uninstalls</span>
        <span className="font-medium">{formatNumber({ value: point.count })}</span>
      </div>
    </div>
  );
};

export const ChurnDistributionChart = ({
  data,
}: ChurnDistributionChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 12 }}
          width={32}
        />
        <Tooltip
          cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
          content={(props) => {
            return (
              <ChurnTooltip
                active={props.active}
                payload={props.payload as ReadonlyArray<Payload> | undefined}
              />
            );
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => {
            const earlyChurn = ["<1d", "1–7d", "7–14d", "14–30d"];
            const isEarly = earlyChurn.includes(entry.bucket);

            return (
              <Cell
                key={entry.bucket}
                fill={isEarly ? "var(--color-chart-4)" : "var(--color-chart-1)"}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
