import { cache } from "react";

import { tinybirdQuery } from "@/lib/tinybird";

import { getShopActivity } from "./activity";
import { fxToUsdSql } from "./currencies";
import {
  getShopProfiles,
  getShopRevenue90d,
  joinAllShopsWithRevenue,
  type ShopWithRevenue,
} from "./insights";

type RawShopTrendRow = {
  shop: string;
  last30: string | number;
  prev30: string | number;
  last30Orders: string | number;
};

export type ShopRevenueTrend = {
  shop: string;
  last30Revenue: number;
  prev30Revenue: number;
  last30Orders: number;
};

const getShopRevenueTrend = cache(
  async (): Promise<Array<ShopRevenueTrend>> => {
    const sql = `
      SELECT
        shop,
        sumIf(amount * ${fxToUsdSql("ccy")}, order_dt >= today() - INTERVAL 30 DAY) AS last30,
        sumIf(amount * ${fxToUsdSql("ccy")}, order_dt < today() - INTERVAL 30 DAY) AS prev30,
        countIf(order_dt >= today() - INTERVAL 30 DAY) AS last30Orders
      FROM (
        SELECT
          id,
          shop,
          min(order_created_at) AS order_dt,
          argMax(shop_money_order_amount, updated_at) AS amount,
          argMax(shop_money_currency_code, updated_at) AS ccy,
          argMax(_is_deleted, updated_at) AS del,
          argMax(is_visible, updated_at) AS vis
        FROM orders
        WHERE order_created_at >= today() - INTERVAL 60 DAY
        GROUP BY id, shop
      ) deduped
      WHERE del = 0 AND vis = 1
      GROUP BY shop
      FORMAT JSON
    `;

    const result = await tinybirdQuery<Array<RawShopTrendRow>>({ q: sql });

    return result.data.map((row) => {
      return {
        shop: row.shop,
        last30Revenue: Number(row.last30) || 0,
        prev30Revenue: Number(row.prev30) || 0,
        last30Orders: Number(row.last30Orders) || 0,
      };
    });
  },
);

export type PlanTier = "free" | "paid";
export type EngagementTier = "low" | "high";

export type HealthQuadrantShop = {
  shop: string;
  name: string | null;
  plan: string | null;
  subscriptionPrice: number | null;
  installedAt: string | null;
  sessions30d: number;
  revenue30d: number;
  orders30d: number;
};

export type HealthQuadrant = {
  key: string;
  title: string;
  subtitle: string;
  planTier: PlanTier;
  engagementTier: EngagementTier;
  shops: number;
  totalRevenue90d: number;
  medianMonthlyRevenue: number;
  trendingDown: number;
  shopList: Array<HealthQuadrantShop>;
};

const SHOP_LIST_LIMIT = 100;

const PAID_PLANS = new Set(["standard", "pro", "platinum"]);

const planTierFor = (shop: ShopWithRevenue): PlanTier => {
  if (shop.isPaying && shop.plan && PAID_PLANS.has(shop.plan)) {
    return "paid";
  }
  return "free";
};

const engagementTierFor = (shop: ShopWithRevenue): EngagementTier => {
  return shop.sessions30d > 0 ? "high" : "low";
};

const QUADRANT_DEFINITIONS: Array<{
  planTier: PlanTier;
  engagementTier: EngagementTier;
  title: string;
  subtitle: string;
}> = [
  {
    planTier: "paid",
    engagementTier: "high",
    title: "Champions",
    subtitle: "Paying & engaged · testimonial pipeline",
  },
  {
    planTier: "free",
    engagementTier: "high",
    title: "Upsell candidates",
    subtitle: "Engaged on free plan · sales outreach",
  },
  {
    planTier: "paid",
    engagementTier: "low",
    title: "At-risk",
    subtitle: "Paying but underactivated · onboarding intervention",
  },
  {
    planTier: "free",
    engagementTier: "low",
    title: "Churn candidates",
    subtitle: "Free & disengaged · low save value",
  },
];

const median = (values: Array<number>) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const TREND_DROP_THRESHOLD = 0.5;

const isTrendingDown = (params: {
  shop: ShopWithRevenue;
  trend: Map<string, ShopRevenueTrend>;
}) => {
  const t = params.trend.get(params.shop.shop);
  if (!t) {
    return false;
  }
  if (t.prev30Revenue <= 0) {
    return false;
  }
  return t.last30Revenue / t.prev30Revenue <= 1 - TREND_DROP_THRESHOLD;
};

export type HealthMatrix = {
  quadrants: Array<HealthQuadrant>;
  totalShops: number;
};

export const computeHealthMatrix = (params: {
  shops: Array<ShopWithRevenue>;
  trend: Array<ShopRevenueTrend>;
}): HealthMatrix => {
  const installed = params.shops.filter((s) => s.isInstalled);
  const trendByShop = new Map(params.trend.map((t) => [t.shop, t]));

  type Bucket = {
    shops: Array<ShopWithRevenue>;
    trendingDown: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const shop of installed) {
    const planTier = planTierFor(shop);
    const engagementTier = engagementTierFor(shop);
    const key = `${planTier}-${engagementTier}`;
    const bucket = buckets.get(key) ?? { shops: [], trendingDown: 0 };
    bucket.shops.push(shop);
    if (isTrendingDown({ shop, trend: trendByShop })) {
      bucket.trendingDown += 1;
    }
    buckets.set(key, bucket);
  }

  const quadrants: Array<HealthQuadrant> = QUADRANT_DEFINITIONS.map((def) => {
    const key = `${def.planTier}-${def.engagementTier}`;
    const bucket = buckets.get(key) ?? { shops: [], trendingDown: 0 };
    const totalRevenue90d = bucket.shops.reduce((sum, s) => {
      return sum + s.revenue90d;
    }, 0);
    const medianMonthlyRevenue = median(
      bucket.shops.map((s) => {
        return s.monthlyAvgRevenue;
      }),
    );

    const shopList: Array<HealthQuadrantShop> = bucket.shops
      .map((s) => {
        const t = trendByShop.get(s.shop);
        return {
          shop: s.shop,
          name: s.name,
          plan: s.plan,
          subscriptionPrice: s.subscriptionPrice,
          installedAt: s.initialInstalledAt ?? s.lastInstalledAt,
          sessions30d: s.sessions30d,
          revenue30d: t?.last30Revenue ?? 0,
          orders30d: t?.last30Orders ?? 0,
        };
      })
      .sort((a, b) => {
        if (b.revenue30d !== a.revenue30d) {
          return b.revenue30d - a.revenue30d;
        }
        return b.sessions30d - a.sessions30d;
      })
      .slice(0, SHOP_LIST_LIMIT);

    return {
      key,
      title: def.title,
      subtitle: def.subtitle,
      planTier: def.planTier,
      engagementTier: def.engagementTier,
      shops: bucket.shops.length,
      totalRevenue90d,
      medianMonthlyRevenue,
      trendingDown: bucket.trendingDown,
      shopList,
    };
  });

  return {
    quadrants,
    totalShops: installed.length,
  };
};

export const getHealthMatrix = cache(async (): Promise<HealthMatrix> => {
  const [shops, revenue, trend, activity] = await Promise.all([
    getShopProfiles(),
    getShopRevenue90d(),
    getShopRevenueTrend(),
    getShopActivity(),
  ]);

  const joined = joinAllShopsWithRevenue(shops, revenue, activity);
  return computeHealthMatrix({ shops: joined, trend });
});
