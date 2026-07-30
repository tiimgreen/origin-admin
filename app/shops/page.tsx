import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { ShopsTable } from "@/components/shops/shops-table";
import { getShopList } from "@/lib/data/shops";

export const dynamic = "force-dynamic";

const ShopsBoard = async () => {
  const shops = await getShopList();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          All shops
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Revenue and ad spend are the last 30 days in USD · click a row to view
          a shop&apos;s details
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <ShopsTable shops={shops} />
      </CardContent>
    </Card>
  );
};

const ShopsSkeleton = () => {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-72" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[400px] w-full" />
      </CardContent>
    </Card>
  );
};

export default function ShopsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Shops"
        description="Browse every shop and drill into an individual profile."
      />

      <Suspense fallback={<ShopsSkeleton />}>
        <ShopsBoard />
      </Suspense>
    </div>
  );
}
