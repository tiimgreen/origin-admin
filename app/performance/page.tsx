import { Suspense } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { ChartCard } from "@/components/performance/chart-card";
import { MrrChart } from "@/components/performance/mrr-chart";
import { MetricTrendChart } from "@/components/performance/metric-trend-chart";
import { TopPlansChart } from "@/components/performance/top-plans-chart";
import { MrrChangesChart } from "@/components/performance/mrr-changes-chart";
import { MrrChangesTable } from "@/components/performance/mrr-changes-table";
import { MaxMrrChart } from "@/components/performance/max-mrr-chart";
import { RangeSelect } from "@/components/performance/range-select";
import { getPerformanceMetrics, PerformancePeriod } from "@/lib/data/performance";
import {
  DEFAULT_PERFORMANCE_RANGE,
  isPerformanceRange,
  PERFORMANCE_RANGES,
  PerformanceRange,
} from "@/lib/data/performance-ranges";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

type ChartDelta = {
  label: string;
  direction: "up" | "down" | "flat";
};

const direction = (diff: number): ChartDelta["direction"] => {
  if (diff > 0) {
    return "up";
  }
  if (diff < 0) {
    return "down";
  }
  return "flat";
};

const currencyDelta = ({
  current,
  previous,
}: {
  current: number;
  previous: number;
}): ChartDelta => {
  const diff = current - previous;
  return {
    label: formatCurrency({ amount: Math.abs(diff) }),
    direction: direction(diff),
  };
};

const percentPointDelta = ({
  current,
  previous,
}: {
  current: number | null;
  previous: number | null;
}): ChartDelta => {
  if (current === null || previous === null) {
    return { label: "—", direction: "flat" };
  }

  const diff = current - previous;
  return {
    label: formatPercent(Math.abs(diff), 2),
    direction: direction(diff),
  };
};

const countDelta = ({
  current,
  previous,
}: {
  current: number;
  previous: number;
}): ChartDelta => {
  const diff = current - previous;
  return {
    label: formatNumber({ value: Math.abs(diff) }),
    direction: direction(diff),
  };
};

const firstNonNull = (values: Array<number | null>): number | null => {
  return values.find((value) => value !== null) ?? null;
};

const lastNonNull = (values: Array<number | null>): number | null => {
  return firstNonNull([...values].reverse());
};

const PerformanceBoard = async ({ range }: { range: PerformanceRange }) => {
  const metrics = await getPerformanceMetrics({ range });
  const periods = metrics.periods;
  const rangeLabel = PERFORMANCE_RANGES[range].label;

  const first = periods[0];
  const last = periods[periods.length - 1];

  const topPlanMrr = (period: PerformancePeriod | undefined) => {
    if (!period) {
      return 0;
    }
    return metrics.topPlanNames.reduce((sum, planName) => {
      return sum + (period.planMrr[planName] ?? 0);
    }, 0);
  };

  return (
    <div className="space-y-6">
      <ChartCard
        title="MRR"
        value={formatCurrency({ amount: metrics.currentMrr })}
        delta={currencyDelta({
          current: last?.totalMrr ?? 0,
          previous: first?.totalMrr ?? 0,
        })}
        hint={rangeLabel}
      >
        <MrrChart
          data={periods.map((period) => {
            return {
              periodKey: period.periodKey,
              subscriptionMrr: period.subscriptionMrr,
              usageMrr: period.usageMrr,
              trialMrr: period.trialMrr,
            };
          })}
        />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="ARR"
          value={formatCurrency({ amount: last?.arr ?? 0 })}
          delta={currencyDelta({
            current: last?.arr ?? 0,
            previous: first?.arr ?? 0,
          })}
          hint={rangeLabel}
        >
          <MetricTrendChart
            data={periods.map((period) => {
              return { periodKey: period.periodKey, value: period.arr };
            })}
            name="ARR"
            valueFormat="currency"
          />
        </ChartCard>

        <ChartCard
          title="MRR growth rate"
          value={(() => {
            const rate = lastNonNull(periods.map((period) => period.growthRate));
            return rate !== null ? formatPercent(rate, 2) : "—";
          })()}
          delta={percentPointDelta({
            current: lastNonNull(periods.map((period) => period.growthRate)),
            previous: firstNonNull(periods.map((period) => period.growthRate)),
          })}
          hint={rangeLabel}
        >
          <MetricTrendChart
            data={periods.map((period) => {
              return { periodKey: period.periodKey, value: period.growthRate };
            })}
            name="MRR growth rate"
            valueFormat="percent"
          />
        </ChartCard>

        <ChartCard
          title="Top plans by MRR"
          value={formatCurrency({ amount: topPlanMrr(last) })}
          delta={currencyDelta({
            current: topPlanMrr(last),
            previous: topPlanMrr(first),
          })}
          hint={rangeLabel}
        >
          <TopPlansChart
            data={periods.map((period) => {
              return { periodKey: period.periodKey, plans: period.planMrr };
            })}
            planNames={metrics.topPlanNames}
          />
        </ChartCard>

        <ChartCard
          title="Active subscriptions"
          value={formatNumber({ value: last?.activeSubscriptions ?? 0 })}
          delta={countDelta({
            current: last?.activeSubscriptions ?? 0,
            previous: first?.activeSubscriptions ?? 0,
          })}
          hint={rangeLabel}
        >
          <MetricTrendChart
            data={periods.map((period) => {
              return { periodKey: period.periodKey, value: period.activeSubscriptions };
            })}
            name="Active subscriptions"
            valueFormat="number"
          />
        </ChartCard>

        <ChartCard
          title="ARPU"
          value={formatCurrency({ amount: last?.arpu ?? 0 })}
          delta={currencyDelta({
            current: last?.arpu ?? 0,
            previous: first?.arpu ?? 0,
          })}
          hint={rangeLabel}
        >
          <MetricTrendChart
            data={periods.map((period) => {
              return { periodKey: period.periodKey, value: period.arpu };
            })}
            name="ARPU"
            valueFormat="currency"
          />
        </ChartCard>

        <ChartCard
          title="LTV"
          value={(() => {
            const ltv = lastNonNull(periods.map((period) => period.ltv));
            return ltv !== null ? formatCurrency({ amount: ltv }) : "—";
          })()}
          delta={currencyDelta({
            current: lastNonNull(periods.map((period) => period.ltv)) ?? 0,
            previous: firstNonNull(periods.map((period) => period.ltv)) ?? 0,
          })}
          hint={`${rangeLabel} · ARPU ÷ customer churn rate`}
        >
          <MetricTrendChart
            data={periods.map((period) => {
              return { periodKey: period.periodKey, value: period.ltv };
            })}
            name="LTV"
            valueFormat="currency"
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Net churn rate"
        value={(() => {
          const rate = lastNonNull(periods.map((period) => period.netChurnRate));
          return rate !== null ? formatPercent(rate, 2) : "—";
        })()}
        delta={percentPointDelta({
          current: lastNonNull(periods.map((period) => period.netChurnRate)),
          previous: firstNonNull(periods.map((period) => period.netChurnRate)),
        })}
        hint={rangeLabel}
      >
        <MetricTrendChart
          data={periods.map((period) => {
            return { periodKey: period.periodKey, value: period.netChurnRate };
          })}
          name="Net churn rate"
          valueFormat="percent"
          showTrend={false}
        />
      </ChartCard>

      <ChartCard
        title="MRR changes"
        value={formatCurrency({
          amount: periods.reduce((sum, period) => sum + period.netChangeMrr, 0),
        })}
        delta={{
          label: `net over ${rangeLabel.toLowerCase()}`,
          direction: direction(
            periods.reduce((sum, period) => sum + period.netChangeMrr, 0),
          ),
        }}
        hint="New vs expansion vs churned MRR"
      >
        <div className="space-y-6">
          <MrrChangesChart
            data={periods.map((period) => {
              return {
                periodKey: period.periodKey,
                newMrr: period.newMrr,
                expansionMrr: period.expansionMrr,
                churnedMrr: period.churnedMrr,
                netChangeMrr: period.netChangeMrr,
              };
            })}
          />
          <MrrChangesTable
            data={periods.map((period) => {
              return {
                periodKey: period.periodKey,
                newMrr: period.newMrr,
                expansionMrr: period.expansionMrr,
                churnedMrr: period.churnedMrr,
                netChangeMrr: period.netChangeMrr,
              };
            })}
          />
        </div>
      </ChartCard>

      <ChartCard
        title="Max MRR"
        value={(() => {
          const maxMrr = lastNonNull(periods.map((period) => period.maxMrr));
          return maxMrr !== null ? formatCurrency({ amount: maxMrr }) : "—";
        })()}
        delta={currencyDelta({
          current: lastNonNull(periods.map((period) => period.maxMrr)) ?? 0,
          previous: firstNonNull(periods.map((period) => period.maxMrr)) ?? 0,
        })}
        hint={`${rangeLabel} · (new + expansion MRR) ÷ cancellation rate`}
      >
        <MaxMrrChart
          data={periods.map((period) => {
            return {
              periodKey: period.periodKey,
              mrr: period.convertedMrr,
              maxMrr: period.maxMrr,
            };
          })}
        />
      </ChartCard>
    </div>
  );
};

const ChartCardSkeleton = ({ height = 260 }: { height?: number }) => {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-40" />
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="w-full" style={{ height }} />
      </CardContent>
    </Card>
  );
};

const PerformanceSkeleton = () => {
  return (
    <div className="space-y-6">
      <ChartCardSkeleton height={300} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      <ChartCardSkeleton />
      <ChartCardSkeleton height={320} />
    </div>
  );
};

type PerformancePageProps = {
  searchParams: Promise<{ range?: string | Array<string> }>;
};

const PerformancePage = async ({ searchParams }: PerformancePageProps) => {
  const { range: rangeParam } = await searchParams;
  const range = isPerformanceRange(rangeParam) ? rangeParam : DEFAULT_PERFORMANCE_RANGE;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Performance"
        description="MRR, growth and retention computed from Shopify Partners API payouts. First load after a deploy may take a while to sync."
        actions={<RangeSelect value={range} />}
      />

      <Suspense key={range} fallback={<PerformanceSkeleton />}>
        <PerformanceBoard range={range} />
      </Suspense>
    </div>
  );
};

export default PerformancePage;
