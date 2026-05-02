import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { HealthMatrixCard } from "@/components/insights/health-matrix";
import { MrrStackedBar } from "@/components/charts/mrr-stacked-bar";
import { PlanProgressionCard } from "@/components/insights/plan-progression";
import { getHealthMatrix } from "@/lib/data/health";
import { getMrrMovement } from "@/lib/data/mrr";
import { getPlanProgression } from "@/lib/data/plan-progression";

export const dynamic = "force-dynamic";

const HealthSection = async () => {
  const matrix = await getHealthMatrix();
  return <HealthMatrixCard matrix={matrix} />;
};

const HealthSectionSkeleton = () => {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-72" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => {
            return <Skeleton key={i} className="h-[140px] w-full" />;
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const MrrSection = async () => {
  const data = await getMrrMovement();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          MRR movement
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Monthly net new / expansion / contraction / churn · subscription price is in USD (Shopify Billing) · last 18 months
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <MrrStackedBar data={data} />
      </CardContent>
    </Card>
  );
};

const ChartSectionSkeleton = () => {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-72" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[320px] w-full" />
      </CardContent>
    </Card>
  );
};

export default function LifecyclePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Lifecycle"
        description="How shops move through the funnel — from install to paying customer to churn."
      />

      <Suspense fallback={<HealthSectionSkeleton />}>
        <HealthSection />
      </Suspense>

      <Suspense fallback={<ChartSectionSkeleton />}>
        <MrrSection />
      </Suspense>

      <Suspense fallback={<ChartSectionSkeleton />}>
        <PlanProgressionSection />
      </Suspense>
    </div>
  );
}

const PlanProgressionSection = async () => {
  const result = await getPlanProgression();
  return <PlanProgressionCard result={result} />;
};
