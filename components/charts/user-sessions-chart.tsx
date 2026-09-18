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

import { formatDayLabel } from "@/lib/data/dates";
import type { DailySessionsPoint } from "@/lib/data/shop-users";

type UserSessionsChartProps = {
  data: Array<DailySessionsPoint>;
};

type TooltipPayloadItem = {
  value: number;
};

const TooltipContent = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<TooltipPayloadItem>;
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0 || !label) {
    return null;
  }

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-medium text-muted-foreground">
        {formatDayLabel(label)}
      </div>
      <div className="mt-1 tabular-nums">
        <span className="font-medium">{payload[0].value}</span>{" "}
        <span className="text-muted-foreground">
          {payload[0].value === 1 ? "session" : "sessions"}
        </span>
      </div>
    </div>
  );
};

export const UserSessionsChart = ({ data }: UserSessionsChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="day"
          tickFormatter={(v) => {
            return formatDayLabel(v).replace(/, \d{4}/, "");
          }}
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 11 }}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 11 }}
          width={32}
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
              />
            );
          }}
        />
        <Bar
          dataKey="sessions"
          name="Sessions"
          fill="var(--color-chart-1)"
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};
