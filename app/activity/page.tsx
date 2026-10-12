import { Suspense } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { UserSessionsChart } from "@/components/charts/user-sessions-chart";
import { TopShopsTable } from "@/components/activity/top-shops-table";
import { TopUsersTable } from "@/components/activity/top-users-table";
import { ChartCard } from "@/components/performance/chart-card";
import { RangeSelect } from "@/components/performance/range-select";
import { getSessionActivity } from "@/lib/data/activity";
import {
  ACTIVITY_RANGES,
  ActivityRange,
  DEFAULT_ACTIVITY_RANGE,
  isActivityRange,
} from "@/lib/data/activity-ranges";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const CHART_HEIGHT = 320;

const SessionsBoard = async ({ range }: { range: ActivityRange }) => {
  const spec = ACTIVITY_RANGES[range];
  const activity = await getSessionActivity({ days: spec.days });

  const total = activity.daily.reduce((sum, point) => sum + point.sessions, 0);

  return (
    <div className="space-y-6">
      <ChartCard
        title="Sessions"
        value={formatNumber({ value: total })}
        hint={`${spec.label} · ${formatNumber({ value: Math.round(total / spec.days) })} per day`}
      >
        <UserSessionsChart data={activity.daily} height={CHART_HEIGHT} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <TopUsersTable users={activity.topUsers} hint={spec.label} />
        <TopShopsTable shops={activity.topShops} hint={spec.label} />
      </div>
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

const SessionsSkeleton = () => {
  return (
    <div className="space-y-6">
      <CardSkeleton height={CHART_HEIGHT} />
      <div className="grid gap-6 lg:grid-cols-2">
        <CardSkeleton height={360} />
        <CardSkeleton height={360} />
      </div>
    </div>
  );
};

type ActivityPageProps = {
  searchParams: Promise<{ range?: string | Array<string> }>;
};

const ActivityPage = async ({ searchParams }: ActivityPageProps) => {
  const { range: rangeParam } = await searchParams;
  const range = isActivityRange(rangeParam) ? rangeParam : DEFAULT_ACTIVITY_RANGE;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Activity"
        description="Sessions per day across every shop, from shop_user_sessions."
        actions={
          <RangeSelect
            value={range}
            options={ACTIVITY_RANGES}
            basePath="/activity"
          />
        }
      />

      <Suspense key={range} fallback={<SessionsSkeleton />}>
        <SessionsBoard range={range} />
      </Suspense>
    </div>
  );
};

export default ActivityPage;
