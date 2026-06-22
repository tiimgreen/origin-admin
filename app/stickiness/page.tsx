import { Suspense } from "react";
import { Magnet, UserMinus, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/layout/kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { CohortCompareChart } from "@/components/charts/cohort-compare-chart";
import { SignalsCard } from "@/components/stickiness/signals-card";
import { getStickinessReport } from "@/lib/data/stickiness";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const StickinessBoard = async () => {
  const report = await getStickinessReport();

  const noData = report.stickyCount === 0 || report.churnedCount === 0;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Sticky merchants"
          value={formatNumber({ value: report.stickyCount })}
          hint="survived ≥ 6 months"
          icon={UserCheck}
        />
        <KpiCard
          label="Churned merchants"
          value={formatNumber({ value: report.churnedCount })}
          hint="uninstalled within 3 months"
          icon={UserMinus}
        />
        <KpiCard
          label="Shops analysed"
          value={formatNumber({
            value: report.stickyCount + report.churnedCount,
          })}
          hint={`of ${formatNumber({ value: report.totalShops })} paid · rest mid-tenure`}
          icon={Magnet}
        />
      </div>

      {noData ? (
        <Card>
          <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
            Need at least one shop in each cohort to compare. Sticky =
            survived ≥ 6 months, churned = uninstalled within 3 months.
          </CardContent>
        </Card>
      ) : (
        <>
          <SignalsCard signals={report.signals} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {report.dimensions.map((dim) => {
              return (
                <Card key={dim.key}>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-foreground">
                      {dim.label}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dim.description}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <Badge variant="success" className="gap-1">
                        {formatNumber({ value: report.stickyCount })} sticky
                      </Badge>
                      <Badge variant="destructive" className="gap-1">
                        {formatNumber({ value: report.churnedCount })} churned
                      </Badge>
                    </div>
                    <CohortCompareChart data={dim.buckets} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
};

const StickinessSkeleton = () => {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => {
          return (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    </>
  );
};

export default function StickinessPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stickiness"
        description="Among merchants who have been on a paid plan, compare those who churned in under 3 months with those who stayed past 6 months — spot the dimensions that predict retention."
      />

      <Suspense fallback={<StickinessSkeleton />}>
        <StickinessBoard />
      </Suspense>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Limited to merchants who have been on a paid plan at some point (ever had
        a subscription activated at a price &gt; 0) — shops that were only ever on
        the free plan are excluded entirely. Within that group, cohorts are
        defined by lifespan (install → uninstall, or install → today for shops
        still installed): sticky = lifespan ≥ 6 months; churned = uninstalled with
        lifespan &lt; 3 months. Shops between 3 and 6 months, or still installed for
        under 6 months, are excluded as their fate is not yet known.
      </p>
      <p className="text-xs text-muted-foreground">
        Attribution, plan, orders-at-install and vertical are all captured on the{" "}
        <code className="text-[10px]">shops</code> row, so they survive uninstall
        — unlike order and ad-account data, which is deleted when a shop churns.
      </p>
    </div>
  );
}
