import { cache } from "react";

import { supabase } from "@/lib/supabase";

import { getShopActivity } from "./activity";
import { toUsd } from "./currencies";
import { estimateLtv } from "./shop-profile";

export type ShopListRow = {
  shop: string;
  name: string | null;
  isInstalled: boolean;
  initialInstalledAt: string | null;
  lastInstalledAt: string | null;
  shopifyPlanName: string | null;
  vertical: string | null;
  originPlanKey: string | null;
  originPlanPrice: number;
  ltv: number;
  sessions30d: number;
  lastSeenAt: string | null;
  revenue30d: number;
  adSpend30d: number;
};

type RawShopData = {
  plan?: {
    displayName?: string;
  };
};

const parseShopData = (raw: unknown): RawShopData | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return raw as RawShopData;
};

const PAGE_SIZE = 1000;

type ShopPerformance30d = {
  revenue30d: number;
  adSpend30d: number;
};

// Trailing-30-day revenue + ad spend per shop in USD, approximated from the
// monthly shop_performance_metrics rollup: the current month counts in full,
// the previous month is weighted by how many of its days fall inside the
// 30-day window.
const getShopPerformance30d = cache(
  async (): Promise<Map<string, ShopPerformance30d>> => {
    const now = new Date();
    const currentMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const prevMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );

    const daysInPrevMonth =
      (currentMonthStart.getTime() - prevMonthStart.getTime()) / 86_400_000;
    const daysElapsedThisMonth = now.getUTCDate() - 1;
    const prevMonthWeight =
      Math.max(0, 30 - daysElapsedThisMonth) / daysInPrevMonth;

    const sinceIso = prevMonthStart.toISOString().slice(0, 10);
    const currentMonthKey = currentMonthStart.toISOString().slice(0, 10);

    type RawRow = {
      shop: string;
      month: string;
      revenue: number;
      ad_spend: number;
      currency_code: string;
    };

    const rows: Array<RawRow> = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: page, error: metricsError } = await supabase
        .from("shop_performance_metrics")
        .select(`
          shop,
          month,
          revenue,
          ad_spend,
          currency_code
        `)
        .gte("month", sinceIso)
        .order("shop", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (metricsError) {
        console.error("Error fetching shop performance metrics", metricsError);
        throw metricsError;
      }

      rows.push(...page);

      hasMore = page.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    const byShop = new Map<string, ShopPerformance30d>();

    for (const row of rows) {
      const weight = row.month === currentMonthKey ? 1 : prevMonthWeight;

      const entry = byShop.get(row.shop) ?? { revenue30d: 0, adSpend30d: 0 };
      entry.revenue30d += toUsd(row.revenue, row.currency_code) * weight;
      entry.adSpend30d += toUsd(row.ad_spend, row.currency_code) * weight;
      byShop.set(row.shop, entry);
    }

    return byShop;
  },
);

type RawSubscription = {
  id: number;
  shop: string;
  plan_key: string;
  price: number | null;
  status: string;
  activated_at: string | null;
  deactivated_at: string | null;
  current_period_end: string | null;
};

const fetchAllSubscriptions = async (): Promise<Array<RawSubscription>> => {
  const subscriptions: Array<RawSubscription> = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: page, error: subscriptionsError } = await supabase
      .from("subscriptions")
      .select(`
        id,
        shop,
        plan_key,
        price,
        status,
        activated_at,
        deactivated_at,
        current_period_end
      `)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (subscriptionsError) {
      console.error("Error fetching subscriptions", subscriptionsError);
      throw subscriptionsError;
    }

    subscriptions.push(...page);

    hasMore = page.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return subscriptions;
};

export const getShopList = cache(async (): Promise<Array<ShopListRow>> => {
  const shopsPromise = supabase
    .from("shops")
    .select(`
      shop,
      name,
      isInstalled,
      initialInstalledAt,
      lastInstalledAt,
      vertical,
      plan_public_display_name,
      shopData,
      currently_active_subscription_id
    `)
    .limit(3000);

  const [{ data: shops, error: shopsError }, activity, performance, subscriptions] =
    await Promise.all([
      shopsPromise,
      getShopActivity(),
      getShopPerformance30d(),
      fetchAllSubscriptions(),
    ]);

  if (shopsError) {
    console.error("Error fetching shops", shopsError);
    throw shopsError;
  }

  const activityByShop = new Map(activity.map((a) => [a.shop, a]));

  const subsByShop = new Map<string, Array<RawSubscription>>();
  for (const sub of subscriptions) {
    const list = subsByShop.get(sub.shop) ?? [];
    list.push(sub);
    subsByShop.set(sub.shop, list);
  }

  return shops.map((shop) => {
    const shopData = parseShopData(shop.shopData);
    const shopActivity = activityByShop.get(shop.shop);
    const shopPerformance = performance.get(shop.shop);
    const subs = subsByShop.get(shop.shop) ?? [];

    const activeSub = shop.currently_active_subscription_id
      ? subs.find((s) => s.id === shop.currently_active_subscription_id)
      : null;

    return {
      shop: shop.shop,
      name: shop.name ?? null,
      isInstalled: shop.isInstalled === true,
      initialInstalledAt: shop.initialInstalledAt,
      lastInstalledAt: shop.lastInstalledAt,
      shopifyPlanName:
        shop.plan_public_display_name ?? shopData?.plan?.displayName ?? null,
      vertical: shop.vertical,
      originPlanKey: activeSub?.plan_key ?? null,
      originPlanPrice: activeSub?.price ?? 0,
      ltv: estimateLtv(subs),
      sessions30d: shopActivity?.sessions30d ?? 0,
      lastSeenAt: shopActivity?.lastSeenAt ?? null,
      revenue30d: shopPerformance?.revenue30d ?? 0,
      adSpend30d: shopPerformance?.adSpend30d ?? 0,
    };
  });
});
