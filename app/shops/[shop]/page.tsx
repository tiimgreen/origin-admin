import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { TrackingTrendChart } from "@/components/charts/tracking-trend-chart";
import { getShopBasic, getShopTrackingTrend } from "@/lib/data/shop-profile";

export const dynamic = "force-dynamic";

type LegendItem = {
  label: string;
  colorVar: string;
};

const LEGEND: Array<LegendItem> = [
  { label: "Tracked by Origin", colorVar: "var(--color-chart-1)" },
  { label: "Tracked by Shopify", colorVar: "var(--color-chart-2)" },
];

const TrackingCard = async ({ shop }: { shop: string }) => {
  const trend = await getShopTrackingTrend({ shop });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            Order tracking coverage
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Last 30 days · share of daily orders tracked by each system
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {LEGEND.map((item) => {
            return (
              <div key={item.label} className="flex items-center gap-1.5 text-xs">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.colorVar }}
                />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <TrackingTrendChart data={trend} />
      </CardContent>
    </Card>
  );
};

const TrackingCardSkeleton = () => {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
};

type ShopProfilePageProps = {
  params: Promise<{ shop: string }>;
};

export default async function ShopProfilePage({ params }: ShopProfilePageProps) {
  const { shop } = await params;
  const basic = await getShopBasic({ shop });

  if (!basic) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/shops"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All shops
      </Link>

      <PageHeader
        title={basic.name ?? basic.shop}
        description={basic.name ? basic.shop : undefined}
        actions={
          <Badge variant={basic.isInstalled ? "success" : "secondary"}>
            {basic.isInstalled ? "Installed" : "Uninstalled"}
          </Badge>
        }
      />

      <Suspense fallback={<TrackingCardSkeleton />}>
        <TrackingCard shop={basic.shop} />
      </Suspense>
    </div>
  );
}
