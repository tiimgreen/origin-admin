import { Suspense } from "react";

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { SingleDimensionCard } from "@/components/stickiness/single-dimension-card";
import {
  getShopifyAdKeywordStickiness,
  getShopifyChannelStickiness,
  getShopifyOrganicKeywordStickiness,
} from "@/lib/data/stickiness";

export const dynamic = "force-dynamic";

const ShopifyBoard = async () => {
  const [channel, organicKeywords, adKeywords] = await Promise.all([
    getShopifyChannelStickiness(),
    getShopifyOrganicKeywordStickiness(),
    getShopifyAdKeywordStickiness(),
  ]);

  return (
    <>
      <SingleDimensionCard report={channel} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SingleDimensionCard report={organicKeywords} />
        <SingleDimensionCard report={adKeywords} />
      </div>
    </>
  );
};

const SkeletonCard = () => {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-72" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[220px] w-full" />
      </CardContent>
    </Card>
  );
};

const ShopifySkeleton = () => {
  return (
    <>
      <SkeletonCard />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </>
  );
};

export default function ShopifyStickinessPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Shopify App Store"
        description="Stickiness of paid merchants acquired through the Shopify App Store — by ad-vs-search channel and by the keyword they searched."
      />

      <Suspense fallback={<ShopifySkeleton />}>
        <ShopifyBoard />
      </Suspense>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Source is Shopify&apos;s <code className="text-[10px]">surface_type</code>{" "}
        on the install landing page:{" "}
        <code className="text-[10px]">search</code> = organic App Store search,{" "}
        <code className="text-[10px]">search_ad</code> = a paid App Store ad. The
        keyword reports use <code className="text-[10px]">surface_detail</code>,
        split by that same surface into organic searches and paid ad keywords.
        Same paid-merchant scope and sticky (≥ 6mo) / churned (&lt; 3mo) cohort
        definitions as the main Stickiness report.
      </p>
    </div>
  );
}
