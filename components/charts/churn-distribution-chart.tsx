"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber } from "@/lib/format";
import type {
  ChurnDistributionPoint,
  ChurnDistributionSeries,
} from "@/lib/data/icp";

type ChurnDistributionChartProps = {
  data: Array<ChurnDistributionPoint>;
  series: Array<ChurnDistributionSeries>;
};

type Payload = {
  name: string;
  value: number;
  color: string;
  dataKey: string;
  payload: ChurnDistributionPoint;
};

const SERIES_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const EARLY_CHURN = new Set(["<1d", "1–7d", "7–14d", "14–30d"]);

const ChurnTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<Payload>;
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0 || !label) {
    return null;
  }
  const visible = Array.from(payload).filter((p) => p.value > 0);
  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {visible.map((item) => {
        return (
          <div
            key={item.dataKey}
            className="mt-1 flex items-center gap-2 tabular-nums"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="ml-auto font-medium">
              {formatNumber({ value: item.value })}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const ChurnDistributionChart = ({
  data,
  series,
}: ChurnDistributionChartProps) => {
  const isSingleSeries = series.length === 1 && series[0].key === "all";

  return (
    <ResponsiveContainer width="100%" height={260}>
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
                label={props.label as string | undefined}
              />
            );
          }}
        />
        {!isSingleSeries ? (
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="square"
            iconSize={10}
          />
        ) : null}
        {isSingleSeries ? (
          <Bar dataKey="all" name="Uninstalls" radius={[4, 4, 0, 0]}>
            {data.map((entry) => {
              const isEarly = EARLY_CHURN.has(entry.bucket);
              return (
                <Cell
                  key={entry.bucket}
                  fill={isEarly ? "var(--color-chart-4)" : "var(--color-chart-1)"}
                />
              );
            })}
          </Bar>
        ) : (
          series.map((s, i) => {
            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={`${s.label} (${s.total})`}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            );
          })
        )}
      </BarChart>
    </ResponsiveContainer>
  );
};
