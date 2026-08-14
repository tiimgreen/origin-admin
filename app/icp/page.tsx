import { Suspense } from "react";
import { Award, Clock, PiggyBank, Target, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/layout/kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { DimensionCard } from "@/components/icp/dimension-card";
import {
  BASELINE_MIN_MONTHS,
  IDEAL_MIN_SESSIONS,
  getIcp,
} from "@/lib/data/icp";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

const IcpBoard = async () => {
  const icp = await getIcp();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Ideal customers"
          value={formatNumber({ value: icp.idealCount })}
          hint="installed, paying, active weekly"
          icon={Award}
        />
        <KpiCard
          label="Baseline"
          value={formatNumber({ value: icp.baselineCount })}
          hint={`first paid ≥ ${BASELINE_MIN_MONTHS}mo ago`}
          icon={Users}
        />
        <KpiCard
          label="Ideal rate"
          value={formatPercent(icp.idealRate)}
          hint="of baseline"
          icon={Target}
        />
        <KpiCard
          label="Median MRR (ideal)"
          value={formatCurrency({ amount: icp.medianIdealMrr })}
          icon={PiggyBank}
        />
        <KpiCard
          label="Median tenure (ideal)"
          value={`${formatNumber({ value: icp.medianIdealTenureMonths, decimals: 0 })}mo`}
          hint="since first paid"
          icon={Clock}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Ideal:</span> first paid ≥{" "}
        {BASELINE_MIN_MONTHS} months ago, still installed and paying, and ≥{" "}
        {IDEAL_MIN_SESSIONS} merchant-app sessions in the trailing 12 weeks (avg
        ≥ 1/week).{" "}
        <span className="font-medium text-foreground">Not ideal:</span> everyone
        else in the baseline — churned or disengaged. Shops that first paid less
        than {BASELINE_MIN_MONTHS} months ago are excluded as too young to
        classify.
      </p>

      {icp.idealCount === 0 || icp.notIdealCount === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Not enough data yet — need at least one shop in each cohort to
            compare.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Cards are sorted by signal strength — the biggest
            ideal-vs-not-ideal gaps come first. Size bands run smallest to
            largest; other cards sort their bars by gap.
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {icp.dimensions.map((dimension) => {
              return (
                <DimensionCard key={dimension.key} dimension={dimension} />
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            Revenue, ad spend and order data are deleted when a shop
            uninstalls, so those cards compare still-installed shops only;
            merchant size uses orders at install, which survives uninstall and
            is comparable across both cohorts. Sessions are merchant sessions
            in the Origin app.
          </p>
        </>
      )}
    </div>
  );
};

const IcpSkeleton = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => {
          return (
            <Card key={index}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => {
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-64" />
                <Skeleton className="mt-4 h-[220px] w-full" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default function IcpPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="ICP"
        description="What ideal customers have in common that the rest of the baseline doesn't."
      />

      <Suspense fallback={<IcpSkeleton />}>
        <IcpBoard />
      </Suspense>
    </div>
  );
}
