"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/data/dates";

export type MrrChangesPoint = {
  periodKey: string;
  newMrr: number;
  expansionMrr: number;
  churnedMrr: number;
  netChangeMrr: number;
};

type MrrChangesChartProps = {
  data: Array<MrrChangesPoint>;
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

export const MrrChangesChart = ({ data }: MrrChangesChartProps) => {
  const rows = data.map((point) => {
    return {
      periodKey: point.periodKey,
      newMrr: point.newMrr,
      expansionMrr: point.expansionMrr,
      churnedMrr: -point.churnedMrr,
      netChangeMrr: point.netChangeMrr,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart
        data={rows}
        stackOffset="sign"
        margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
      >
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
          cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
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
        <ReferenceLine y={0} stroke="var(--color-muted-foreground)" strokeWidth={1} />
        <Bar
          dataKey="newMrr"
          name="New"
          stackId="change"
          fill="var(--color-chart-2)"
          stroke="var(--color-card)"
          strokeWidth={1}
        />
        <Bar
          dataKey="expansionMrr"
          name="Expansion"
          stackId="change"
          fill="var(--color-chart-1)"
          stroke="var(--color-card)"
          strokeWidth={1}
          radius={[3, 3, 0, 0]}
        />
        <Bar
          dataKey="churnedMrr"
          name="Churn"
          stackId="change"
          fill="var(--color-chart-4)"
          stroke="var(--color-card)"
          strokeWidth={1}
          radius={[0, 0, 3, 3]}
        />
        <Line
          type="monotone"
          dataKey="netChangeMrr"
          name="Net change"
          stroke="var(--color-chart-3)"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
