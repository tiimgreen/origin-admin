"use client";

import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/format";
import type { IcpDimension } from "@/lib/data/icp";

type DimensionCardProps = {
  dimension: IcpDimension;
};

type ChartRow = {
  label: string;
  idealPct: number;
  notIdealPct: number;
  delta: number;
  idealCount: number;
  notIdealCount: number;
};

const ROW_HEIGHT = 52;

const formatDeltaPP = (value: number) => {
  const pp = Math.round(value * 1000) / 10;
  if (pp === 0) {
    return "0pp";
  }
  return `${pp > 0 ? "+" : ""}${pp.toFixed(1)}pp`;
};

const deltaColor = (delta: number) => {
  if (delta > 0.005) {
    return "var(--color-chart-2)";
  }
  if (delta < -0.005) {
    return "var(--color-chart-4)";
  }
  return "var(--color-muted-foreground)";
};

const DeltaLabel = (props: {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  value?: string | number;
}) => {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const height = Number(props.height ?? 0);
  const delta = Number(props.value ?? 0);

  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      dominantBaseline="central"
      fontSize={11}
      fill={deltaColor(delta)}
      className="tabular-nums"
    >
      {formatDeltaPP(delta)}
    </text>
  );
};

type TooltipRow = {
  payload: ChartRow;
};

const TooltipContent = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<TooltipRow>;
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const row = payload[0].payload;

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-medium text-muted-foreground">
        {row.label}
      </div>
      <div className="mt-1 flex items-center gap-2 tabular-nums">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--color-chart-1)" }}
        />
        <span className="text-muted-foreground">Ideal</span>
        <span className="ml-auto font-medium">
          {formatPercent(row.idealPct / 100)}
          <span className="ml-1 font-normal text-muted-foreground">
            ({row.idealCount})
          </span>
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 tabular-nums">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--color-chart-3)" }}
        />
        <span className="text-muted-foreground">Not ideal</span>
        <span className="ml-auto font-medium">
          {formatPercent(row.notIdealPct / 100)}
          <span className="ml-1 font-normal text-muted-foreground">
            ({row.notIdealCount})
          </span>
        </span>
      </div>
    </div>
  );
};

export const DimensionCard = ({ dimension }: DimensionCardProps) => {
  const chartData: Array<ChartRow> = dimension.buckets.map((bucket) => {
    return {
      label: bucket.label,
      idealPct: bucket.idealPct * 100,
      notIdealPct: bucket.notIdealPct * 100,
      delta: bucket.delta,
      idealCount: bucket.idealCount,
      notIdealCount: bucket.notIdealCount,
    };
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base font-semibold text-foreground">
            {dimension.label}
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--color-chart-1)" }}
              />
              Ideal
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--color-chart-3)" }}
              />
              Not ideal
            </span>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {dimension.note}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer
          width="100%"
          height={chartData.length * ROW_HEIGHT + 24}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 56, left: 0, bottom: 0 }}
            barCategoryGap="25%"
          >
            <XAxis type="number" domain={[0, "dataMax"]} hide />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tickLine={false}
              axisLine={false}
              stroke="var(--color-muted-foreground)"
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
              content={(props) => {
                const payload = props.payload as
                  | ReadonlyArray<TooltipRow>
                  | undefined;

                return (
                  <TooltipContent
                    active={props.active}
                    payload={payload ? Array.from(payload) : undefined}
                  />
                );
              }}
            />
            <Bar
              dataKey="idealPct"
              name="Ideal"
              fill="var(--color-chart-1)"
              radius={[0, 3, 3, 0]}
            >
              <LabelList
                dataKey="delta"
                position="right"
                content={(props) => {
                  return (
                    <DeltaLabel
                      x={props.x}
                      y={props.y}
                      width={props.width}
                      height={props.height}
                      value={props.value as number | undefined}
                    />
                  );
                }}
              />
            </Bar>
            <Bar
              dataKey="notIdealPct"
              name="Not ideal"
              fill="var(--color-chart-3)"
              fillOpacity={0.55}
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
