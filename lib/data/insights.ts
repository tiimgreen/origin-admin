import { cache } from "react";

import { supabase } from "@/lib/supabase";
import { tinybirdQuery } from "@/lib/tinybird";

import type { ShopActivityRow } from "./activity";
import { fxToUsdSql } from "./currencies";

export type ShopRevenueRow = {
  shop: string;
  revenue90d: number;
  orders90d: number;
  monthlyAvgRevenue: number;
};

type RawShopRevenueRow = {
  shop: string;
  revenue: string | number;
  orders: string | number;
};

export const getShopRevenue90d = cache(
  async (): Promise<Array<ShopRevenueRow>> => {
    const sql = `
      SELECT
        shop,
        sum(amount * ${fxToUsdSql("ccy")}) AS revenue,
        count() AS orders
      FROM (
        SELECT
          id,
          shop,
          argMax(shop_money_order_amount, updated_at) AS amount,
          argMax(shop_money_currency_code, updated_at) AS ccy,
          argMax(_is_deleted, updated_at) AS del,
          argMax(is_visible, updated_at) AS vis
        FROM orders
        WHERE order_created_at >= today() - INTERVAL 90 DAY
        GROUP BY id, shop
      ) deduped
      WHERE del = 0 AND vis = 1
      GROUP BY shop
      ORDER BY revenue DESC
      LIMIT 5000
      FORMAT JSON
    `;

    const result = await tinybirdQuery<Array<RawShopRevenueRow>>({ q: sql });

    return result.data.map((row) => {
      const revenue = Number(row.revenue) || 0;
      return {
        shop: row.shop,
        revenue90d: revenue,
        orders90d: Number(row.orders) || 0,
        monthlyAvgRevenue: revenue / 3,
      };
    });
  },
);

export type ShopProfile = {
  shop: string;
  name: string | null;
  currency: string;
  plan: string | null;
  subscriptionPrice: number | null;
  isPaying: boolean;
  isInstalled: boolean;
  hasCompletedSetup: boolean;
  initialInstalledAt: string | null;
  lastInstalledAt: string | null;
  uninstalledAt: string | null;
  originPixelAddedAt: string | null;
  orderCountAtInstall: number | null;
  shopifyPlanName: string | null;
  shopifyPlus: boolean;
  isPartnerDev: boolean;
  installFbclid: string | null;
  installGclid: string | null;
  connectedPlatformKeys: Array<string>;
};

type RawShopData = {
  plan?: {
    displayName?: string;
    shopifyPlus?: boolean;
    partnerDevelopment?: boolean;
  };
};

const parseShopData = (raw: unknown): RawShopData | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return raw as RawShopData;
};

export const getShopProfiles = cache(async (): Promise<Array<ShopProfile>> => {
  const shopsPromise = supabase
    .from("shops")
    .select(`
      shop,
      name,
      currency_code,
      isInstalled,
      initialInstalledAt,
      lastInstalledAt,
      uninstalled_at,
      origin_pixel_added,
      order_count_at_install,
      app_install_fbclid,
      app_install_gclid,
      plan_public_display_name,
      shopify_plus,
      is_partner_development_plan,
      shopData,
      currently_active_subscription_id
    `)
    .limit(3000);

  const [
    { data: shops, error: shopsError },
    connectionsResult,
    subscriptionsResult
  ] = await Promise.all([
    shopsPromise,
    supabase
      .from("connected_platforms")
      .select(`
        shop,
        status,
        connectable_platforms (
          key
        )
      `)
      .limit(20000),
    supabase
      .from("subscriptions")
      .select(`
        id,
        plan_key,
        price,
        status,
        has_completed_setup
      `)
      .limit(20000),
  ]);

  if (shopsError) {
    console.error("Error fetching shops", shopsError);
    throw shopsError;
  }
  if (connectionsResult.error) {
    console.error("Error fetching connections", connectionsResult.error);
    throw connectionsResult.error;
  }
  if (subscriptionsResult.error) {
    console.error("Error fetching subscriptions", subscriptionsResult.error);
    throw subscriptionsResult.error;
  }

  const platformsByShop = new Map<string, Array<string>>();
  for (const conn of connectionsResult.data ?? []) {
    const key = conn.connectable_platforms?.key;
    if (!key) {
      continue;
    }
    const arr = platformsByShop.get(conn.shop) ?? [];
    if (!arr.includes(key)) {
      arr.push(key);
    }
    platformsByShop.set(conn.shop, arr);
  }

  const subscriptionsById = new Map<
    number,
    {
      plan_key: string;
      price: number | null;
      status: string;
      has_completed_setup: boolean;
    }
  >();
  for (const sub of subscriptionsResult.data ?? []) {
    subscriptionsById.set(sub.id, {
      plan_key: sub.plan_key,
      price: sub.price,
      status: sub.status,
      has_completed_setup: sub.has_completed_setup,
    });
  }

  return shops.map((shop) => {
    const sub = shop.currently_active_subscription_id
      ? subscriptionsById.get(shop.currently_active_subscription_id)
      : null;
    const shopData = parseShopData(shop.shopData);

    return {
      shop: shop.shop,
      name: shop.name ?? null,
      currency: shop.currency_code,
      plan: sub?.plan_key ?? null,
      subscriptionPrice: sub?.price ?? null,
      isPaying: sub?.status === "ACTIVE",
      isInstalled: shop.isInstalled === true,
      hasCompletedSetup: sub?.has_completed_setup === true,
      initialInstalledAt: shop.initialInstalledAt,
      lastInstalledAt: shop.lastInstalledAt,
      uninstalledAt: shop.uninstalled_at,
      originPixelAddedAt: shop.origin_pixel_added,
      orderCountAtInstall: shop.order_count_at_install,
      shopifyPlanName:
        shop.plan_public_display_name ?? shopData?.plan?.displayName ?? null,
      shopifyPlus:
        shop.shopify_plus ?? shopData?.plan?.shopifyPlus === true,
      isPartnerDev:
        shop.is_partner_development_plan ??
        shopData?.plan?.partnerDevelopment === true,
      installFbclid: shop.app_install_fbclid,
      installGclid: shop.app_install_gclid,
      connectedPlatformKeys: platformsByShop.get(shop.shop) ?? [],
    };
  });
});

export type RevenueBucket = {
  label: string;
  min: number;
  max: number | null;
};

export const REVENUE_BUCKETS: Array<RevenueBucket> = [
  { label: "$0", min: 0, max: 1 },
  { label: "<$1k/mo", min: 1, max: 1_000 },
  { label: "$1k–$10k", min: 1_000, max: 10_000 },
  { label: "$10k–$50k", min: 10_000, max: 50_000 },
  { label: "$50k–$200k", min: 50_000, max: 200_000 },
  { label: "$200k–$1M", min: 200_000, max: 1_000_000 },
  { label: "$1M+", min: 1_000_000, max: null },
];

const bucketForRevenue = (revenue: number) => {
  for (const bucket of REVENUE_BUCKETS) {
    if (revenue >= bucket.min && (bucket.max === null || revenue < bucket.max)) {
      return bucket.label;
    }
  }
  return REVENUE_BUCKETS[0].label;
};

export type RevenueHistogramPoint = {
  bucket: string;
  shops: number;
  shopsWithAds: number;
  shopsPaying: number;
};

export type ShopWithRevenue = ShopProfile & {
  monthlyAvgRevenue: number;
  revenue90d: number;
  pageviews30d: number;
  lastSeenAt: string | null;
};

export const joinShopsWithRevenue = (
  shops: Array<ShopProfile>,
  revenue: Array<ShopRevenueRow>,
  activity: Array<ShopActivityRow> = [],
): Array<ShopWithRevenue> => {
  const revenueByShop = new Map(revenue.map((r) => [r.shop, r]));
  const activityByShop = new Map(activity.map((a) => [a.shop, a]));

  return shops
    .filter((s) => s.isInstalled)
    .map((shop) => {
      const r = revenueByShop.get(shop.shop);
      const a = activityByShop.get(shop.shop);
      return {
        ...shop,
        monthlyAvgRevenue: r?.monthlyAvgRevenue ?? 0,
        revenue90d: r?.revenue90d ?? 0,
        pageviews30d: a?.pageviews30d ?? 0,
        lastSeenAt: a?.lastSeenAt ?? null,
      };
    });
};

export const joinAllShopsWithRevenue = (
  shops: Array<ShopProfile>,
  revenue: Array<ShopRevenueRow>,
  activity: Array<ShopActivityRow> = [],
): Array<ShopWithRevenue> => {
  const revenueByShop = new Map(revenue.map((r) => [r.shop, r]));
  const activityByShop = new Map(activity.map((a) => [a.shop, a]));

  return shops.map((shop) => {
    const r = revenueByShop.get(shop.shop);
    const a = activityByShop.get(shop.shop);
    return {
      ...shop,
      monthlyAvgRevenue: r?.monthlyAvgRevenue ?? 0,
      revenue90d: r?.revenue90d ?? 0,
      pageviews30d: a?.pageviews30d ?? 0,
      lastSeenAt: a?.lastSeenAt ?? null,
    };
  });
};

export const computeRevenueHistogram = (
  shops: Array<ShopWithRevenue>,
): Array<RevenueHistogramPoint> => {
  const counts = new Map<string, RevenueHistogramPoint>();

  for (const bucket of REVENUE_BUCKETS) {
    counts.set(bucket.label, {
      bucket: bucket.label,
      shops: 0,
      shopsWithAds: 0,
      shopsPaying: 0,
    });
  }

  for (const shop of shops) {
    const label = bucketForRevenue(shop.monthlyAvgRevenue);
    const point = counts.get(label);
    if (!point) {
      continue;
    }
    point.shops += 1;
    if (shop.connectedPlatformKeys.length > 0) {
      point.shopsWithAds += 1;
    }
    if (shop.isPaying) {
      point.shopsPaying += 1;
    }
  }

  return Array.from(counts.values());
};

export type CategoryBreakdown = {
  label: string;
  count: number;
};

export const computePlanBreakdown = (
  shops: Array<ShopProfile>,
): Array<CategoryBreakdown> => {
  const counts = new Map<string, number>();

  for (const shop of shops) {
    if (!shop.isInstalled) {
      continue;
    }
    const label = shop.plan ?? "no plan";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => {
      return { label, count };
    })
    .sort((a, b) => b.count - a.count);
};

export const computeCurrencyBreakdown = (
  shops: Array<ShopProfile>,
): Array<CategoryBreakdown> => {
  const counts = new Map<string, number>();

  for (const shop of shops) {
    if (!shop.isInstalled) {
      continue;
    }
    counts.set(shop.currency, (counts.get(shop.currency) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => {
      return { label, count };
    })
    .sort((a, b) => b.count - a.count);
};

export type FunnelStep = {
  label: string;
  count: number;
  conversion: number;
};

export const computeFunnel = (
  shops: Array<ShopWithRevenue>,
): Array<FunnelStep> => {
  const installed = shops.length;
  const onboarded = shops.filter((s) => s.hasCompletedSetup).length;
  const withAdAccount = shops.filter((s) => s.connectedPlatformKeys.length > 0).length;
  const paying = shops.filter((s) => s.isPaying).length;
  const recentlyActive = shops.filter((s) => s.revenue90d > 0).length;

  const steps = [
    { label: "Installed", count: installed },
    { label: "Onboarded", count: onboarded },
    { label: "Connected ad account", count: withAdAccount },
    { label: "Paying", count: paying },
    { label: "Active in last 90d", count: recentlyActive },
  ];

  return steps.map((step) => {
    return {
      label: step.label,
      count: step.count,
      conversion: installed > 0 ? step.count / installed : 0,
    };
  });
};

export type AdConnectionMatrix = {
  bucket: string;
  shops: number;
  withAds: number;
  withoutAds: number;
  adRate: number;
};

export const computeAdConnectionMatrix = (
  shops: Array<ShopWithRevenue>,
): Array<AdConnectionMatrix> => {
  const histogram = computeRevenueHistogram(shops);

  return histogram.map((point) => {
    return {
      bucket: point.bucket,
      shops: point.shops,
      withAds: point.shopsWithAds,
      withoutAds: point.shops - point.shopsWithAds,
      adRate: point.shops > 0 ? point.shopsWithAds / point.shops : 0,
    };
  });
};

export type TenureBucket = {
  label: string;
  shops: number;
  totalRevenue90d: number;
  avgMonthlyRevenue: number;
};

const TENURE_BUCKETS: Array<{ label: string; min: number; max: number | null }> = [
  { label: "<1mo", min: 0, max: 30 },
  { label: "1–3mo", min: 30, max: 90 },
  { label: "3–6mo", min: 90, max: 180 },
  { label: "6–12mo", min: 180, max: 365 },
  { label: "1–2yr", min: 365, max: 730 },
  { label: "2yr+", min: 730, max: null },
];

export const computeTenureBuckets = (
  shops: Array<ShopWithRevenue>,
): Array<TenureBucket> => {
  const now = Date.now();
  const buckets = new Map<string, TenureBucket>();

  for (const bucket of TENURE_BUCKETS) {
    buckets.set(bucket.label, {
      label: bucket.label,
      shops: 0,
      totalRevenue90d: 0,
      avgMonthlyRevenue: 0,
    });
  }

  const totals = new Map<string, { revenue: number; count: number }>();

  for (const shop of shops) {
    if (!shop.initialInstalledAt) {
      continue;
    }
    const ageDays = (now - new Date(shop.initialInstalledAt).getTime()) / 86400000;
    const tenure = TENURE_BUCKETS.find((b) => {
      return ageDays >= b.min && (b.max === null || ageDays < b.max);
    });
    if (!tenure) {
      continue;
    }

    const point = buckets.get(tenure.label);
    if (!point) {
      continue;
    }
    point.shops += 1;
    point.totalRevenue90d += shop.revenue90d;

    const total = totals.get(tenure.label) ?? { revenue: 0, count: 0 };
    total.revenue += shop.monthlyAvgRevenue;
    total.count += 1;
    totals.set(tenure.label, total);
  }

  for (const [label, total] of totals.entries()) {
    const point = buckets.get(label);
    if (point && total.count > 0) {
      point.avgMonthlyRevenue = total.revenue / total.count;
    }
  }

  return Array.from(buckets.values());
};

export type PlatformAdoptionRow = {
  platformKey: string;
  shopsWithPlatform: number;
  totalRevenue90d: number;
  avgMonthlyRevenue: number;
};

export const computePlatformAdoption = (
  shops: Array<ShopWithRevenue>,
): Array<PlatformAdoptionRow> => {
  const stats = new Map<
    string,
    { shops: number; revenue: number; monthlyRev: number }
  >();

  for (const shop of shops) {
    for (const key of shop.connectedPlatformKeys) {
      const entry = stats.get(key) ?? {
        shops: 0,
        revenue: 0,
        monthlyRev: 0,
      };
      entry.shops += 1;
      entry.revenue += shop.revenue90d;
      entry.monthlyRev += shop.monthlyAvgRevenue;
      stats.set(key, entry);
    }
  }

  return Array.from(stats.entries())
    .map(([key, entry]) => {
      return {
        platformKey: key,
        shopsWithPlatform: entry.shops,
        totalRevenue90d: entry.revenue,
        avgMonthlyRevenue: entry.shops > 0 ? entry.monthlyRev / entry.shops : 0,
      };
    })
    .sort((a, b) => b.shopsWithPlatform - a.shopsWithPlatform);
};
