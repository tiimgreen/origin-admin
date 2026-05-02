"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/format";
import { formatMonthLabel } from "@/lib/data/dates";

type MrrStackedBarProps = {
  data: Array<{
    monthKey: string;
    newMrr: number;
    expansion: number;
    contraction: number;
    churn: number;
    netMrr: number;
  }>;
};

type DisplayPoint = {
  monthKey: string;
  newMrr: number;
  expansion: number;
  contractionNeg: number;
  churnNeg: number;
  netMrr: number;
};

type TooltipPayloadItem = {
  name: string;
  value: number;
  color: string;
  dataKey: string;
  payload: DisplayPoint;
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

  const point = payload[0].payload;

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-medium text-muted-foreground">
        {formatMonthLabel(label)}
      </div>
      <div className="mt-2 space-y-1 tabular-nums">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--color-chart-2)" }}
          />
          <span className="text-muted-foreground">New</span>
          <span className="ml-auto font-medium text-emerald-600 dark:text-emerald-400">
            +{formatCurrency({ amount: point.newMrr, compact: true })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--color-chart-1)" }}
          />
          <span className="text-muted-foreground">Expansion</span>
          <span className="ml-auto font-medium text-emerald-600 dark:text-emerald-400">
            +{formatCurrency({ amount: point.expansion, compact: true })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--color-chart-3)" }}
          />
          <span className="text-muted-foreground">Contraction</span>
          <span className="ml-auto font-medium text-rose-600 dark:text-rose-400">
            {formatCurrency({ amount: point.contractionNeg, compact: true })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--color-chart-4)" }}
          />
          <span className="text-muted-foreground">Churn</span>
          <span className="ml-auto font-medium text-rose-600 dark:text-rose-400">
            {formatCurrency({ amount: point.churnNeg, compact: true })}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 border-t pt-1">
          <span className="font-medium">Net</span>
          <span
            className={`ml-auto font-semibold ${point.netMrr >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
          >
            {point.netMrr >= 0 ? "+" : ""}
            {formatCurrency({ amount: point.netMrr, compact: true })}
          </span>
        </div>
      </div>
    </div>
  );
};

export const MrrStackedBar = ({ data }: MrrStackedBarProps) => {
  const display: Array<DisplayPoint> = data.map((d) => {
    return {
      monthKey: d.monthKey,
      newMrr: d.newMrr,
      expansion: d.expansion,
      contractionNeg: -d.contraction,
      churnNeg: -d.churn,
      netMrr: d.netMrr,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={display}
        margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
        stackOffset="sign"
      >
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
        <ReferenceLine y={0} stroke="var(--color-border)" />
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
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          iconType="square"
          iconSize={10}
        />
        <Bar
          dataKey="newMrr"
          name="New"
          stackId="a"
          fill="var(--color-chart-2)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="expansion"
          name="Expansion"
          stackId="a"
          fill="var(--color-chart-1)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="contractionNeg"
          name="Contraction"
          stackId="a"
          fill="var(--color-chart-3)"
          radius={[0, 0, 4, 4]}
        />
        <Bar
          dataKey="churnNeg"
          name="Churn"
          stackId="a"
          fill="var(--color-chart-4)"
          radius={[0, 0, 4, 4]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};
