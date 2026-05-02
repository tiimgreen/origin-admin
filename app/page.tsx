import { Suspense } from "react";
import {
  DollarSign,
  Globe,
  Link2,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { KpiCard } from "@/components/layout/kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { InstallBarChart } from "@/components/charts/install-bar-chart";
import {
  getAdPlatformBreakdown,
  getInstallTimeline,
  getMonthlyRevenue,
  getRevenueTotals,
  getShopCounts,
} from "@/lib/data/overview";
import { FX_AS_OF } from "@/lib/data/currencies";
import { formatCurrency, formatDelta, formatNumber, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

const KpiRow = async () => {
  const [revenue, shops] = await Promise.all([
    getRevenueTotals(),
    getShopCounts(),
  ]);

  const revenueDelta = formatDelta({
    current: revenue.last30Revenue,
    previous: revenue.prev30Revenue,
  });
  const orderDelta = formatDelta({
    current: revenue.last30Orders,
    previous: revenue.prev30Orders,
  });
  const installDelta = formatDelta({
    current: shops.installedLast30,
    previous: shops.installedPrev30,
  });
  const originDelta = formatDelta({
    current: revenue.last30OriginRevenue,
    previous: revenue.prev30OriginRevenue,
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label={`GMV (last ${revenue.recentMonths}mo)`}
        value={formatCurrency({
          amount: revenue.recentRevenue,
          compact: true,
        })}
        hint={`${formatNumber({ value: revenue.recentOrders, compact: true })} orders · USD-converted`}
        icon={DollarSign}
      />
      <KpiCard
        label="GMV (last 30d)"
        value={formatCurrency({
          amount: revenue.last30Revenue,
          compact: true,
        })}
        delta={{ label: revenueDelta.label, direction: revenueDelta.direction }}
        hint="vs prior 30d · USD-converted"
        icon={TrendingUp}
      />
      <KpiCard
        label="Orders (last 30d)"
        value={formatNumber({ value: revenue.last30Orders, compact: true })}
        delta={{ label: orderDelta.label, direction: orderDelta.direction }}
        hint="vs prior 30d · USD-converted"
        icon={ShoppingBag}
      />
      <KpiCard
        label="Origin-tracked GMV (30d)"
        value={formatCurrency({
          amount: revenue.last30OriginRevenue,
          compact: true,
        })}
        delta={{ label: originDelta.label, direction: originDelta.direction }}
        hint={
          revenue.last30Revenue > 0
            ? `${formatPercent(revenue.last30OriginRevenue / revenue.last30Revenue)} of GMV`
            : undefined
        }
        icon={Sparkles}
      />
      <KpiCard
        label="Installed shops"
        value={formatNumber({ value: shops.installed })}
        delta={{ label: installDelta.label, direction: installDelta.direction }}
        hint={`${shops.installedLast30} new (30d)`}
        icon={Store}
      />
      <KpiCard
        label="Paying shops"
        value={formatNumber({ value: shops.paying })}
        hint={
          shops.installed > 0
            ? `${formatPercent(shops.paying / shops.installed)} of installed`
            : undefined
        }
        icon={DollarSign}
      />
      <KpiCard
        label="Onboarded shops"
        value={formatNumber({ value: shops.onboardingComplete })}
        hint={
          shops.installed > 0
            ? `${formatPercent(shops.onboardingComplete / shops.installed)} of installed`
            : undefined
        }
        icon={Sparkles}
      />
      <KpiCard
        label="Uninstalled (lifetime)"
        value={formatNumber({ value: shops.uninstalled })}
        hint={
          shops.total > 0
            ? `${formatPercent(shops.uninstalled / shops.total)} churn`
            : undefined
        }
        icon={Link2}
      />
    </div>
  );
};

const KpiRowSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => {
        return (
          <Card key={i}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

const RevenueChartCard = async () => {
  const data = await getMonthlyRevenue(18);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            Monthly GMV
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Last 18 months · all currencies converted to USD at fixed rates ({FX_AS_OF})
          </p>
        </div>
        <Badge variant="outline" className="gap-1 text-[10px]">
          <Globe className="h-3 w-3" />
          USD-converted
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <RevenueAreaChart
          data={data.map((d) => {
            return {
              monthKey: d.monthKey,
              revenue: d.revenue,
              originRevenue: d.originRevenue,
            };
          })}
        />
      </CardContent>
    </Card>
  );
};

const InstallChartCard = async () => {
  const data = await getInstallTimeline(12);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            Install activity
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Last 12 months · installs vs uninstalls
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <InstallBarChart data={data} />
      </CardContent>
    </Card>
  );
};

const ChartCardSkeleton = ({ tall = false }: { tall?: boolean }) => {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className={tall ? "h-[300px] w-full" : "h-[260px] w-full"} />
      </CardContent>
    </Card>
  );
};

const AdPlatformsCard = async () => {
  const platforms = await getAdPlatformBreakdown();
  const totalActive = platforms.reduce((sum, p) => {
    return sum + p.activeShops;
  }, 0);
  const max = Math.max(1, ...platforms.map((p) => p.connectedShops));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            Connected ad platforms
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalActive} active connections across {platforms.length} platforms
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No connections yet.</p>
        ) : null}
        {platforms.map((p) => {
          const ratio = (p.connectedShops / max) * 100;

          return (
            <div key={p.platformKey} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{p.platformName}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  <span>{p.activeShops} active</span>
                  <span>·</span>
                  <span>{p.connectedShops} total</span>
                </div>
              </div>
              <Progress value={ratio} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

const AdPlatformsCardSkeleton = () => {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => {
          return (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-1.5 w-full" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default function HomePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="A snapshot of how Origin Attribution is performing across all shops."
      />

      <Suspense fallback={<KpiRowSkeleton />}>
        <KpiRow />
      </Suspense>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Suspense fallback={<ChartCardSkeleton tall />}>
          <RevenueChartCard />
        </Suspense>
        <Suspense fallback={<ChartCardSkeleton />}>
          <InstallChartCard />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense fallback={<AdPlatformsCardSkeleton />}>
          <AdPlatformsCard />
        </Suspense>
      </div>
    </div>
  );
}
