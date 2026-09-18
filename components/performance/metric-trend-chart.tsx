"use client";

import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/data/dates";

export type MetricTrendPoint = {
  periodKey: string;
  value: number | null;
};

type ValueFormat = "currency" | "percent" | "number";

type MetricTrendChartProps = {
  data: Array<MetricTrendPoint>;
  name: string;
  valueFormat: ValueFormat;
  showTrend?: boolean;
};

const formatValue = (value: number, valueFormat: ValueFormat) => {
  if (valueFormat === "currency") {
    return formatCurrency({ amount: value });
  }
  if (valueFormat === "percent") {
    return formatPercent(value);
  }
  return formatNumber({ value });
};

const formatTick = (value: number, valueFormat: ValueFormat) => {
  if (valueFormat === "currency") {
    return formatCurrency({ amount: value, compact: true });
  }
  if (valueFormat === "percent") {
    return formatPercent(value);
  }
  return formatNumber({ value, compact: true });
};

// Least-squares fit over the non-null points, evaluated at every index.
const linearTrend = (values: Array<number | null>): Array<number | null> => {
  const points: Array<[number, number]> = [];
  values.forEach((value, index) => {
    if (value !== null) {
      points.push([index, value]);
    }
  });

  if (points.length < 2) {
    return values.map(() => null);
  }

  const n = points.length;
  const sumX = points.reduce((sum, [x]) => sum + x, 0);
  const sumY = points.reduce((sum, [, y]) => sum + y, 0);
  const sumXY = points.reduce((sum, [x, y]) => sum + x * y, 0);
  const sumXX = points.reduce((sum, [x]) => sum + x * x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return values.map(() => null);
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return values.map((_, index) => intercept + slope * index);
};

type TooltipPayloadItem = {
  name: string;
  value: number;
  color: string;
  dataKey: string;
};

const TooltipContent = ({
  active,
  payload,
  label,
  valueFormat,
}: {
  active?: boolean;
  payload?: Array<TooltipPayloadItem>;
  label?: string;
  valueFormat: ValueFormat;
}) => {
  if (!active || !payload || payload.length === 0 || !label) {
    return null;
  }

  const items = payload.filter((item) => item.dataKey !== "trend");

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-medium text-muted-foreground">
        {formatPeriodLabel(label)}
      </div>
      {items.map((item) => {
        return (
          <div
            key={item.name}
            className="mt-1 flex items-center gap-2 tabular-nums"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="ml-auto pl-4 font-medium">
              {formatValue(item.value, valueFormat)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const MetricTrendChart = ({
  data,
  name,
  valueFormat,
  showTrend = true,
}: MetricTrendChartProps) => {
  const gradientId = useId();

  const trend = linearTrend(data.map((point) => point.value));
  const rows = data.map((point, index) => {
    return {
      periodKey: point.periodKey,
      value: point.value,
      trend: trend[index],
    };
  });

  const hasNegative = data.some((point) => point.value !== null && point.value < 0);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="periodKey"
          tickFormatter={(v) => {
            return formatPeriodLabel(v).replace(/,? \d{4}$/, "");
          }}
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 12 }}
        />
        <YAxis
          tickFormatter={(v: number) => {
            return formatTick(v, valueFormat);
          }}
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 12 }}
          width={64}
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
                label={props.label as string | undefined}
                valueFormat={valueFormat}
              />
            );
          }}
        />
        {hasNegative ? (
          <ReferenceLine y={0} stroke="var(--color-muted-foreground)" strokeWidth={1} />
        ) : null}
        <Area
          type="monotone"
          dataKey="value"
          name={name}
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          connectNulls
        />
        {showTrend ? (
          <Line
            type="linear"
            dataKey="trend"
            name="Trend"
            stroke="var(--color-muted-foreground)"
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
            activeDot={false}
            connectNulls
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
};
