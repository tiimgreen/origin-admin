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

import { formatCurrency } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/data/dates";

export type TopPlansPoint = {
  periodKey: string;
  plans: Record<string, number>;
};

type TopPlansChartProps = {
  data: Array<TopPlansPoint>;
  planNames: Array<string>;
};

const PLAN_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

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
        {formatPeriodLabel(label)}
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
            <span className="ml-auto pl-4 font-medium">
              {formatCurrency({ amount: item.value })}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const TopPlansChart = ({ data, planNames }: TopPlansChartProps) => {
  const rows = data.map((point) => {
    const row: Record<string, string | number> = { periodKey: point.periodKey };
    for (const planName of planNames) {
      row[planName] = point.plans[planName] ?? 0;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
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
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {planNames.map((planName, index) => {
          return (
            <Line
              key={planName}
              type="monotone"
              dataKey={planName}
              name={planName}
              stroke={PLAN_COLORS[index % PLAN_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
};
