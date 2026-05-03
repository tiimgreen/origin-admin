import { Suspense } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { CohortRetentionChart } from "@/components/charts/cohort-retention-chart";
import {
  getCohortRetention,
  type CohortMetric,
  type CohortSplit,
} from "@/lib/data/cohorts";
import { SUPER_ACTIVE_PAGEVIEW_THRESHOLD } from "@/lib/data/activity";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SPLIT_OPTIONS: Array<{ key: CohortSplit; label: string; hint: string }> = [
  {
    key: "none",
    label: "Install month",
    hint: "One line per install-month cohort",
  },
  {
    key: "orders-at-install",
    label: "Orders at install",
    hint: "Bucket shops by order count when they installed",
  },
  {
    key: "acquisition-source",
    label: "Acquisition source",
    hint: "Split by Meta / Google ad click vs organic",
  },
];

const isCohortSplit = (value: string | undefined): value is CohortSplit => {
  return value === "none" || value === "orders-at-install" || value === "acquisition-source";
};

type SplitToggleProps = {
  current: CohortSplit;
};

const SplitToggle = ({ current }: SplitToggleProps) => {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border bg-muted p-1">
      {SPLIT_OPTIONS.map((option) => {
        const isActive = option.key === current;
        const href = option.key === "none" ? "/cohorts" : `/cohorts?split=${option.key}`;

        return (
          <Link
            key={option.key}
            href={href}
            className={cn(
              "rounded px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
};

type CohortChartProps = {
  metric: CohortMetric;
  split: CohortSplit;
  splitHint: string;
};

const CohortChart = async ({ metric, split, splitHint }: CohortChartProps) => {
  const result = await getCohortRetention({ split, metric });

  const title =
    metric === "super-active" ? "Super-active retention" : "Active retention";
  const description =
    metric === "super-active"
      ? `% of cohort with ≥${SUPER_ACTIVE_PAGEVIEW_THRESHOLD} report-page pageviews in their N-th month since install`
      : "% of cohort with ≥1 app pageview in their N-th month since install";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            {title}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {description} · last 18 months · {splitHint}
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {result.series.length} series
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <CohortRetentionChart series={result.series} data={result.data} />
      </CardContent>
    </Card>
  );
};

const CohortChartSkeleton = () => {
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

type CohortsPageProps = {
  searchParams: Promise<{ split?: string }>;
};

export default async function CohortsPage({ searchParams }: CohortsPageProps) {
  const params = await searchParams;
  const split: CohortSplit = isCohortSplit(params.split) ? params.split : "none";
  const splitHint =
    SPLIT_OPTIONS.find((o) => o.key === split)?.hint ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cohort retention"
        description="Which install-month cohorts retain best — and which segments drive the spread."
        actions={<SplitToggle current={split} />}
      />

      <Suspense key={`active-${split}`} fallback={<CohortChartSkeleton />}>
        <CohortChart metric="active" split={split} splitHint={splitHint} />
      </Suspense>

      <Suspense key={`super-${split}`} fallback={<CohortChartSkeleton />}>
        <CohortChart metric="super-active" split={split} splitHint={splitHint} />
      </Suspense>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Cohort = shops grouped by their <code className="text-[10px]">initialInstalledAt</code> month.
        &ldquo;Active in month N&rdquo; means ≥1 PostHog{" "}
        <code className="text-[10px]">$pageview</code> in the calendar month that is N months after
        install. &ldquo;Super-active&rdquo; tightens this to ≥{SUPER_ACTIVE_PAGEVIEW_THRESHOLD} pageviews
        on report pages (excluding <code className="text-[10px]">/settings</code> and{" "}
        <code className="text-[10px]">/utm-notepad</code>) — a proxy for shops actually getting value.
      </p>
    </div>
  );
}
