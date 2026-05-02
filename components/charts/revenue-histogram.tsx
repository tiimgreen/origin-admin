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

import { formatNumber, formatPercent } from "@/lib/format";

type RevenueHistogramProps = {
  data: Array<{
    bucket: string;
    shops: number;
    shopsWithAds: number;
  }>;
};

type Payload = {
  name: string;
  value: number;
  color: string;
  payload: { bucket: string; shops: number; shopsWithAds: number };
};

const HistogramTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<Payload>;
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0].payload;
  const adRate = point.shops > 0 ? point.shopsWithAds / point.shops : 0;

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 space-y-0.5 tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Shops</span>
          <span className="font-medium">{formatNumber({ value: point.shops })}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">With ad account</span>
          <span className="font-medium">
            {formatNumber({ value: point.shopsWithAds })} ({formatPercent(adRate)})
          </span>
        </div>
      </div>
    </div>
  );
};

export const RevenueHistogram = ({ data }: RevenueHistogramProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 11 }}
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
            return (
              <HistogramTooltip
                active={props.active}
                payload={props.payload as ReadonlyArray<Payload> | undefined}
                label={props.label as string | undefined}
              />
            );
          }}
        />
        <Bar
          dataKey="shops"
          name="All shops"
          fill="var(--color-chart-1)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="shopsWithAds"
          name="With ad account"
          fill="var(--color-chart-2)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};
