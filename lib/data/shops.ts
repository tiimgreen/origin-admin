import { cache } from "react";

import { supabase } from "@/lib/supabase";

import { getShopActivity } from "./activity";
import { toUsd } from "./currencies";

export type ShopListRow = {
  shop: string;
  name: string | null;
  isInstalled: boolean;
  shopifyPlanName: string | null;
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

export const getShopList = cache(async (): Promise<Array<ShopListRow>> => {
  const shopsPromise = supabase
    .from("shops")
    .select(`
      shop,
      name,
      isInstalled,
      plan_public_display_name,
      shopData
    `)
    .limit(3000);

  const [{ data: shops, error: shopsError }, activity, performance] =
    await Promise.all([shopsPromise, getShopActivity(), getShopPerformance30d()]);

  if (shopsError) {
    console.error("Error fetching shops", shopsError);
    throw shopsError;
  }

  const activityByShop = new Map(activity.map((a) => [a.shop, a]));

  return shops.map((shop) => {
    const shopData = parseShopData(shop.shopData);
    const shopActivity = activityByShop.get(shop.shop);
    const shopPerformance = performance.get(shop.shop);

    return {
      shop: shop.shop,
      name: shop.name ?? null,
      isInstalled: shop.isInstalled === true,
      shopifyPlanName:
        shop.plan_public_display_name ?? shopData?.plan?.displayName ?? null,
      sessions30d: shopActivity?.sessions30d ?? 0,
      lastSeenAt: shopActivity?.lastSeenAt ?? null,
      revenue30d: shopPerformance?.revenue30d ?? 0,
      adSpend30d: shopPerformance?.adSpend30d ?? 0,
    };
  });
});
