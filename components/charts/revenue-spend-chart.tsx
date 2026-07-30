"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/format";
import { formatMonthLabel } from "@/lib/data/dates";
import type { MonthlyFinancialsPoint } from "@/lib/data/shop-profile";

type RevenueSpendChartProps = {
  data: Array<MonthlyFinancialsPoint>;
};

type TooltipPayloadItem = {
  name: string;
  value: number;
  color: string;
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
        {formatMonthLabel(label)}
      </div>
      {payload.map((item) => {
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
            <span className="ml-auto font-medium">
              {formatCurrency({ amount: item.value, compact: true })}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const RevenueSpendChart = ({ data }: RevenueSpendChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-chart-1)"
              stopOpacity={0.4}
            />
            <stop
              offset="100%"
              stopColor="var(--color-chart-1)"
              stopOpacity={0.02}
            />
          </linearGradient>
          <linearGradient id="adSpend" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-chart-2)"
              stopOpacity={0.35}
            />
            <stop
              offset="100%"
              stopColor="var(--color-chart-2)"
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="monthKey"
          tickFormatter={(v) => {
            return formatMonthLabel(v).replace(/ \d{4}/, "");
          }}
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 12 }}
        />
        <YAxis
          tickFormatter={(v: number) => {
            return formatCurrency({ amount: v, compact: true });
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
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill="url(#revenue)"
        />
        <Area
          type="monotone"
          dataKey="adSpend"
          name="Ad spend"
          stroke="var(--color-chart-2)"
          strokeWidth={2}
          fill="url(#adSpend)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
