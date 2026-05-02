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

import { formatMonthLabel } from "@/lib/data/dates";
import { formatNumber } from "@/lib/format";

type InstallBarChartProps = {
  data: Array<{
    monthKey: string;
    installs: number;
    uninstalls: number;
  }>;
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
              {formatNumber({ value: item.value })}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const InstallBarChart = ({ data }: InstallBarChartProps) => {
  const display = data.map((d) => {
    return { ...d, uninstallsNeg: -d.uninstalls };
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={display}
        margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
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
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 12 }}
          width={32}
        />
        <Tooltip
          cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
          content={(props) => {
            const raw = props.payload as
              | ReadonlyArray<TooltipPayloadItem>
              | undefined;
            const remapped = raw
              ? Array.from(raw).map((p) => {
                  return { ...p, value: Math.abs(p.value) };
                })
              : undefined;
            return (
              <TooltipContent
                active={props.active}
                payload={remapped}
                label={props.label as string | undefined}
              />
            );
          }}
        />
        <Bar
          dataKey="installs"
          name="Installs"
          fill="var(--color-chart-2)"
          radius={[4, 4, 0, 0]}
          stackId="a"
        />
        <Bar
          dataKey="uninstallsNeg"
          name="Uninstalls"
          fill="var(--color-chart-4)"
          radius={[0, 0, 4, 4]}
          stackId="a"
        />
      </BarChart>
    </ResponsiveContainer>
  );
};
