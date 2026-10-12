import { Suspense } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { ChartCard } from "@/components/performance/chart-card";
import { RangeSelect } from "@/components/performance/range-select";
import { getIngestionCounts, getWorkerInvocations } from "@/lib/data/monitoring";
import {
  DEFAULT_MONITORING_RANGE,
  isMonitoringRange,
  MONITORING_RANGES,
  MonitoringRange,
} from "@/lib/data/monitoring-ranges";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const CHART_HEIGHT = 240;

const sum = (points: Array<{ value: number }>) => {
  return points.reduce((total, point) => total + point.value, 0);
};

const VisitorsBoard = async ({ range }: { range: MonitoringRange }) => {
  const spec = MONITORING_RANGES[range];
  const counts = await getIngestionCounts({ range });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard
        title="Events ingested"
        value={formatNumber({ value: sum(counts.events) })}
        hint={`${spec.label} · per ${spec.bucket}`}
      >
        <TimeSeriesChart
          data={counts.events}
          bucket={spec.bucket}
          unit="events"
          height={CHART_HEIGHT}
        />
      </ChartCard>

      <ChartCard
        title="Sessions created"
        value={formatNumber({ value: sum(counts.sessions) })}
        hint={`${spec.label} · per ${spec.bucket}`}
      >
        <TimeSeriesChart
          data={counts.sessions}
          bucket={spec.bucket}
          unit="sessions"
          height={CHART_HEIGHT}
        />
      </ChartCard>
    </div>
  );
};

const WorkersBoard = async ({ range }: { range: MonitoringRange }) => {
  const spec = MONITORING_RANGES[range];
  const workers = await getWorkerInvocations({ range });

  if (workers.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No Worker invocations in this range.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {workers.map((worker) => {
        return (
          <ChartCard
            key={worker.scriptName}
            title={worker.scriptName}
            value={formatNumber({ value: worker.total })}
            hint={`${spec.label} · per ${spec.bucket}`}
          >
            <TimeSeriesChart
              data={worker.points}
              bucket={spec.bucket}
              unit="invocations"
              height={CHART_HEIGHT}
            />
          </ChartCard>
        );
      })}
    </div>
  );
};

const CardSkeleton = ({ height }: { height: number }) => {
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

const BoardSkeleton = () => {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CardSkeleton height={CHART_HEIGHT} />
      <CardSkeleton height={CHART_HEIGHT} />
    </div>
  );
};

type SectionProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

const Section = ({ title, description, children }: SectionProps) => {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
};

type MonitoringPageProps = {
  searchParams: Promise<{ range?: string | Array<string> }>;
};

const MonitoringPage = async ({ searchParams }: MonitoringPageProps) => {
  const { range: rangeParam } = await searchParams;
  const range = isMonitoringRange(rangeParam) ? rangeParam : DEFAULT_MONITORING_RANGE;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        title="Monitoring"
        description="Ingestion and infrastructure health. Times in UTC."
        actions={
          <RangeSelect
            value={range}
            options={MONITORING_RANGES}
            basePath="/monitoring"
          />
        }
      />

      <Section
        title="Visitors"
        description="Rows created in shop_events and shop_sessions."
      >
        <Suspense key={range} fallback={<BoardSkeleton />}>
          <VisitorsBoard range={range} />
        </Suspense>
      </Section>

      <Section
        title="Infra"
        description="Cloudflare Worker invocations, busiest first."
      >
        <Suspense key={range} fallback={<BoardSkeleton />}>
          <WorkersBoard range={range} />
        </Suspense>
      </Section>
    </div>
  );
};

export default MonitoringPage;
