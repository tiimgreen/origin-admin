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

export type MaxMrrChartPoint = {
  periodKey: string;
  mrr: number;
  maxMrr: number | null;
};

type MaxMrrChartProps = {
  data: Array<MaxMrrChartPoint>;
};

type TooltipPayloadItem = {
  name: string;
  value: number | null;
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
              {item.value !== null ? formatCurrency({ amount: item.value }) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const MaxMrrChart = ({ data }: MaxMrrChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
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
        <Legend
          iconType="plainline"
          iconSize={16}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Line
          type="linear"
          dataKey="mrr"
          name="MRR"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="linear"
          dataKey="maxMrr"
          name="Max MRR"
          stroke="var(--color-chart-2)"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
