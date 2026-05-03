"use client";

import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  CohortRetentionPoint,
  CohortRetentionSeries,
} from "@/lib/data/cohorts";

type CohortRetentionChartProps = {
  series: Array<CohortRetentionSeries>;
  data: Array<CohortRetentionPoint>;
};

const cellStyle = (value: number) => {
  const intensity = Math.max(0, Math.min(1, value));
  const pct = (intensity * 100).toFixed(1);

  return {
    backgroundColor: `color-mix(in oklch, var(--color-chart-1) ${pct}%, transparent)`,
  };
};

export const CohortRetentionChart = ({
  series,
  data,
}: CohortRetentionChartProps) => {
  if (series.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No cohort data available.
      </div>
    );
  }

  const horizonMonths = data.map((d) => {
    return d.monthsSinceInstall;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-xs tabular-nums">
        <thead>
          <tr className="text-muted-foreground">
            <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">
              Cohort
            </th>
            <th className="px-2 py-2 text-right font-medium">Size</th>
            {horizonMonths.map((m) => {
              return (
                <th
                  key={m}
                  className="px-2 py-2 text-center font-medium"
                >
                  M{m}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {series.map((s) => {
            return (
              <tr key={s.key} className="group">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-1.5 text-left font-medium text-foreground group-hover:bg-muted/40">
                  {s.label}
                </td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">
                  {s.cohortSize.toLocaleString()}
                </td>
                {horizonMonths.map((m, i) => {
                  const point = data[i];
                  const value = point[s.key];
                  const hasValue = typeof value === "number";

                  return (
                    <td
                      key={m}
                      className={cn(
                        "px-2 py-1.5 text-center",
                        hasValue
                          ? "text-foreground"
                          : "text-muted-foreground/40",
                      )}
                      style={hasValue ? cellStyle(value) : undefined}
                    >
                      {hasValue ? formatPercent(value, 0) : "–"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
