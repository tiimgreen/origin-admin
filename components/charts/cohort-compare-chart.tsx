"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber, formatPercent } from "@/lib/format";
import type { CohortBucket } from "@/lib/data/stickiness";

type CohortCompareChartProps = {
  data: Array<CohortBucket>;
};

const STICKY_COLOR = "var(--color-chart-2)";
const CHURNED_COLOR = "var(--color-chart-4)";

type TooltipPayload = {
  payload: CohortBucket;
};

const CompareTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayload>;
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0].payload;

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-medium text-foreground">{point.label}</div>
      <div className="mt-2 space-y-1 tabular-nums">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: STICKY_COLOR }}
            />
            Sticky
          </span>
          <span className="font-medium">
            {formatPercent(point.stickyPct)}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({formatNumber({ value: point.stickyCount })})
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: CHURNED_COLOR }}
            />
            Churned
          </span>
          <span className="font-medium">
            {formatPercent(point.churnedPct)}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({formatNumber({ value: point.churnedCount })})
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export const CohortCompareChart = ({ data }: CohortCompareChartProps) => {
  if (data.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        No data for this dimension.
      </div>
    );
  }

  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(200, data.length * 44 + 24)}
    >
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 16, left: 12, bottom: 4 }}
        barCategoryGap="20%"
      >
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 11 }}
          tickFormatter={(value: number) => formatPercent(value, 0)}
        />
        <YAxis
          dataKey="label"
          type="category"
          tickLine={false}
          axisLine={false}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 12 }}
          width={120}
        />
        <Tooltip
          cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
          content={(props) => {
            return (
              <CompareTooltip
                active={props.active}
                payload={
                  props.payload as ReadonlyArray<TooltipPayload> | undefined
                }
              />
            );
          }}
        />
        <Bar
          dataKey="stickyPct"
          name="Sticky"
          fill={STICKY_COLOR}
          radius={[0, 3, 3, 0]}
        />
        <Bar
          dataKey="churnedPct"
          name="Churned"
          fill={CHURNED_COLOR}
          radius={[0, 3, 3, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};
