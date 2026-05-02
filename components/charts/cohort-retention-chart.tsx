"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatPercent } from "@/lib/format";
import type {
  CohortRetentionPoint,
  CohortRetentionSeries,
} from "@/lib/data/cohorts";

type CohortRetentionChartProps = {
  series: Array<CohortRetentionSeries>;
  data: Array<CohortRetentionPoint>;
};

type TooltipPayloadItem = {
  name: string;
  value: number | null;
  color: string;
  dataKey: string;
};

const SERIES_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const TooltipContent = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<TooltipPayloadItem>;
  label?: number;
}) => {
  if (!active || !payload || payload.length === 0 || label === undefined) {
    return null;
  }

  const visible = payload.filter((p) => {
    return p.value !== null && p.value !== undefined;
  });

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-medium text-muted-foreground">
        Month {label}
      </div>
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
              {formatPercent(item.value ?? 0)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const CohortRetentionChart = ({
  series,
  data,
}: CohortRetentionChartProps) => {
  if (series.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No cohort data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={data}
        margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="monthsSinceInstall"
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) => {
            return `M${v}`;
          }}
        />
        <YAxis
          tickFormatter={(v: number) => {
            return formatPercent(v, 0);
          }}
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 12 }}
          width={48}
          domain={[0, "auto"]}
        />
        <Tooltip
          content={(props) => {
            const payload = props.payload as
              | ReadonlyArray<TooltipPayloadItem>
              | undefined;

            return (
              <TooltipContent
                active={props.active}
                payload={payload ? Array.from(payload) : undefined}
                label={props.label as number | undefined}
              />
            );
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          iconType="line"
          iconSize={12}
        />
        {series.map((s, i) => {
          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={`${s.label} (${s.cohortSize})`}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
};
