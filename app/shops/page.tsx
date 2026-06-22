import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { ShopsTable, type ShopRow } from "@/components/shops/shops-table";
import { getShopProfiles, getShopRevenue90d } from "@/lib/data/insights";

export const dynamic = "force-dynamic";

const ShopsBoard = async () => {
  const [shops, revenue] = await Promise.all([
    getShopProfiles(),
    getShopRevenue90d(),
  ]);

  const revenueByShop = new Map(revenue.map((r) => [r.shop, r.revenue90d]));

  const rows: Array<ShopRow> = shops
    .filter((shop) => shop.isInstalled)
    .map((shop) => {
      return {
        shop: shop.shop,
        name: shop.name,
        plan: shop.plan,
        revenue90d: revenueByShop.get(shop.shop) ?? 0,
      };
    })
    .sort((a, b) => b.revenue90d - a.revenue90d);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          Installed shops
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          {rows.length} shops · sorted by 90-day GMV · click a row to view its profile
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <ShopsTable shops={rows} />
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
        description="Browse every installed shop and drill into an individual profile."
      />

      <Suspense fallback={<ShopsSkeleton />}>
        <ShopsBoard />
      </Suspense>
    </div>
  );
}
