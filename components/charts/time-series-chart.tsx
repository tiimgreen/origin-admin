"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TimeSeriesPoint } from "@/lib/data/monitoring";
import type { MonitoringBucket } from "@/lib/data/monitoring-ranges";
import { formatNumber } from "@/lib/format";

type TimeSeriesChartProps = {
  data: Array<TimeSeriesPoint>;
  bucket: MonitoringBucket;
  unit: string;
  height?: number;
};

// Times are shown in UTC so server and client renders match.
const formatTick = ({ ts, multiDay }: { ts: string; multiDay: boolean }) => {
  const date = new Date(ts);
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  if (!multiDay) {
    return time;
  }

  const day = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return `${day} ${time}`;
};

type TooltipPayloadItem = {
  value: number;
};

const TooltipContent = ({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<TooltipPayloadItem>;
  label?: string;
  unit: string;
}) => {
  if (!active || !payload || payload.length === 0 || !label) {
    return null;
  }

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-medium text-muted-foreground">
        {formatTick({ ts: label, multiDay: true })} UTC
      </div>
      <div className="mt-1 tabular-nums">
        <span className="font-medium">{formatNumber({ value: payload[0].value })}</span>{" "}
        <span className="text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
};

export const TimeSeriesChart = ({
  data,
  bucket,
  unit,
  height = 240,
}: TimeSeriesChartProps) => {
  const multiDay = bucket === "hour" && data.length > 24;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="ts"
          tickFormatter={(v) => {
            return formatTick({ ts: v, multiDay });
          }}
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 11 }}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tickFormatter={(v) => {
            return formatNumber({ value: v, compact: true });
          }}
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 11 }}
          width={48}
        />
        <Tooltip
          cursor={{ fill: "var(--color-muted)" }}
          content={(props) => {
            const payload = props.payload as
              | ReadonlyArray<TooltipPayloadItem>
              | undefined;

            return (
              <TooltipContent
                active={props.active}
                payload={payload ? Array.from(payload) : undefined}
                label={props.label as string | undefined}
                unit={unit}
              />
            );
          }}
        />
        <Bar
          dataKey="value"
          name={unit}
          fill="var(--color-chart-1)"
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};
