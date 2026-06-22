import { cache } from "react";

import {
  getShopMonthlyActivity,
  type ShopMonthlyActivity,
} from "./activity";
import { monthKey } from "./dates";
import { getShopJourneys, type ShopJourney } from "./subscription-timeline";
import {
  getShopProfiles,
  getShopRevenue90d,
  type ShopProfile,
  type ShopRevenueRow,
} from "./insights";

export const RETAINED_MIN_MONTHS = 12;
export const TOP_RETAINED_COUNT = 20;
export const RETENTION_SESSION_MONTHS = 12;

const DAYS_PER_MONTH = 30.4375;

export type CohortKind = "retained" | "churned";

// How the "≥1 active session per month" rule is applied to the retained cohort.
// "monthly": a session in every one of the last 12 months.
// "average": ≥12 sessions total across the last 12 months (avg ≥1/month).
export type RetentionMode = "monthly" | "average";

const lastNMonthKeys = (now: Date, count: number): Array<string> => {
  const keys: Array<string> = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    keys.push(monthKey(date));
  }
  return keys;
};

const meetsSessionRequirement = (params: {
  sessionsByMonth: Map<string, number> | undefined;
  mode: RetentionMode;
  now: Date;
}): boolean => {
  const { sessionsByMonth, mode, now } = params;
  if (!sessionsByMonth) {
    return false;
  }

  const keys = lastNMonthKeys(now, RETENTION_SESSION_MONTHS);

  if (mode === "monthly") {
    return keys.every((key) => {
      return (sessionsByMonth.get(key) ?? 0) >= 1;
    });
  }

  const total = keys.reduce((sum, key) => {
    return sum + (sessionsByMonth.get(key) ?? 0);
  }, 0);
  return total >= RETENTION_SESSION_MONTHS;
};

export type CohortShop = {
  shop: string;
  name: string | null;
  mrr: number;
  tenureMonths: number;
  gmv90d: number;
  annualizedGmv: number;
  orderCountAtInstall: number | null;
  vertical: string | null;
  shopifyPlan: string | null;
  shopifyPlus: boolean;
  isPartnerDev: boolean;
  referralChannel: string;
};

const monthsBetween = (from: Date, to: Date) => {
  return (to.getTime() - from.getTime()) / (DAYS_PER_MONTH * 86400000);
};

const titleCase = (value: string) => {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// "How did they get to us" — prefer an explicit UTM source, fall back to a
// paid-click marker, then the Shopify app-store surface, then organic.
const referralChannel = (profile: ShopProfile): string => {
  if (profile.installUtmSource) {
    return titleCase(profile.installUtmSource);
  }
  if (profile.installFbclid) {
    return "Meta (paid)";
  }
  if (profile.installGclid) {
    return "Google (paid)";
  }
  if (profile.installSurfaceType) {
    return titleCase(profile.installSurfaceType);
  }
  return "Direct / organic";
};

const shopifyPlanLabel = (shop: CohortShop): string => {
  if (shop.shopifyPlus) {
    return "Plus";
  }
  if (shop.isPartnerDev) {
    return "Partner dev";
  }
  return shop.shopifyPlan ?? "unknown";
};

const hasContraction = (journey: ShopJourney) => {
  return journey.events.some((event) => {
    return event.type === "contraction";
  });
};

const toCohortShop = (params: {
  journey: ShopJourney;
  profile: ShopProfile;
  revenue: ShopRevenueRow | undefined;
  now: Date;
}): CohortShop => {
  const { journey, profile, revenue, now } = params;
  const tenureMonths = journey.firstPaidAt
    ? monthsBetween(journey.firstPaidAt, now)
    : 0;
  const gmv90d = revenue?.revenue90d ?? 0;

  return {
    shop: profile.shop,
    name: profile.name,
    mrr: journey.lastPrice,
    tenureMonths,
    gmv90d,
    annualizedGmv: gmv90d * 4,
    orderCountAtInstall: profile.orderCountAtInstall,
    vertical: profile.vertical,
    shopifyPlan: profile.shopifyPlanName,
    shopifyPlus: profile.shopifyPlus,
    isPartnerDev: profile.isPartnerDev,
    referralChannel: referralChannel(profile),
  };
};

export type ComparisonBucket = {
  label: string;
  retainedCount: number;
  churnedCount: number;
  retainedPct: number;
  churnedPct: number;
  delta: number;
};

export type ComparisonDimension = {
  key: string;
  label: string;
  note: string;
  buckets: Array<ComparisonBucket>;
};

const distribute = (
  shops: Array<CohortShop>,
  classify: (shop: CohortShop) => string,
): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const shop of shops) {
    const key = classify(shop);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

const buildDimension = (params: {
  key: string;
  label: string;
  note: string;
  bucketOrder: Array<string>;
  retained: Array<CohortShop>;
  churned: Array<CohortShop>;
  classify: (shop: CohortShop) => string;
}): ComparisonDimension => {
  const retainedCounts = distribute(params.retained, params.classify);
  const churnedCounts = distribute(params.churned, params.classify);
  const retainedTotal = params.retained.length;
  const churnedTotal = params.churned.length;

  const labels = Array.from(
    new Set([
      ...params.bucketOrder,
      ...retainedCounts.keys(),
      ...churnedCounts.keys(),
    ]),
  );

  const buckets = labels.map((label) => {
    const retainedCount = retainedCounts.get(label) ?? 0;
    const churnedCount = churnedCounts.get(label) ?? 0;
    const retainedPct = retainedTotal > 0 ? retainedCount / retainedTotal : 0;
    const churnedPct = churnedTotal > 0 ? churnedCount / churnedTotal : 0;
    return {
      label,
      retainedCount,
      churnedCount,
      retainedPct,
      churnedPct,
      delta: retainedPct - churnedPct,
    };
  });

  return {
    key: params.key,
    label: params.label,
    note: params.note,
    buckets: buckets.sort((a, b) => b.delta - a.delta),
  };
};

const orderCountBucket = (count: number | null) => {
  if (count === null) {
    return "unknown";
  }
  if (count === 0) {
    return "0";
  }
  if (count < 100) {
    return "1–99";
  }
  if (count < 1_000) {
    return "100–999";
  }
  if (count < 10_000) {
    return "1k–10k";
  }
  return "10k+";
};

const verticalLabel = (shop: CohortShop) => {
  if (!shop.vertical) {
    return "unknown";
  }
  return titleCase(shop.vertical);
};

const median = (values: Array<number>) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export type RetentionICP = {
  retainedCount: number;
  churnedCount: number;
  medianRetainedMrr: number;
  medianRetainedTenureMonths: number;
  medianRetainedOrdersAtInstall: number;
  medianChurnedOrdersAtInstall: number;
  topRetained: Array<CohortShop>;
  dimensions: Array<ComparisonDimension>;
};

export const computeRetentionICP = (params: {
  journeys: Array<ShopJourney>;
  profiles: Array<ShopProfile>;
  revenue: Array<ShopRevenueRow>;
  monthlyActivity: Array<ShopMonthlyActivity>;
  mode: RetentionMode;
  now: Date;
}): RetentionICP => {
  const profileByShop = new Map(params.profiles.map((p) => [p.shop, p]));
  const revenueByShop = new Map(params.revenue.map((r) => [r.shop, r]));
  const sessionsByShop = new Map(
    params.monthlyActivity.map((a) => [a.shop, a.sessionsByMonth]),
  );

  const retained: Array<CohortShop> = [];
  const churned: Array<CohortShop> = [];

  for (const journey of params.journeys) {
    const profile = profileByShop.get(journey.shop);
    if (!profile) {
      continue;
    }

    const cohortShop = toCohortShop({
      journey,
      profile,
      revenue: revenueByShop.get(journey.shop),
      now: params.now,
    });

    if (journey.churnedAt !== null) {
      churned.push(cohortShop);
      continue;
    }

    const isRetained =
      journey.firstPaidAt !== null &&
      profile.isInstalled &&
      profile.isPaying &&
      cohortShop.tenureMonths >= RETAINED_MIN_MONTHS &&
      !hasContraction(journey) &&
      meetsSessionRequirement({
        sessionsByMonth: sessionsByShop.get(journey.shop),
        mode: params.mode,
        now: params.now,
      });

    if (isRetained) {
      retained.push(cohortShop);
    }
  }

  const topRetained = [...retained]
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, TOP_RETAINED_COUNT);

  const dimensions: Array<ComparisonDimension> = [
    buildDimension({
      key: "orders_at_install",
      label: "Merchant size",
      note: "Orders at install — survives uninstall, so comparable across both cohorts (live GMV is deleted for churned shops)",
      bucketOrder: ["0", "1–99", "100–999", "1k–10k", "10k+", "unknown"],
      retained,
      churned,
      classify: (s) => orderCountBucket(s.orderCountAtInstall),
    }),
    buildDimension({
      key: "vertical",
      label: "Vertical",
      note: "Shopify-reported store vertical",
      bucketOrder: [],
      retained,
      churned,
      classify: verticalLabel,
    }),
    buildDimension({
      key: "shopify_plan",
      label: "Shopify plan",
      note: "Plus / Partner dev flags take precedence over the public plan name",
      bucketOrder: [],
      retained,
      churned,
      classify: shopifyPlanLabel,
    }),
    buildDimension({
      key: "referral_channel",
      label: "Referral channel",
      note: "utm_source › paid-click marker › app-store surface › organic",
      bucketOrder: [],
      retained,
      churned,
      classify: (s) => s.referralChannel,
    }),
  ];

  const ordersAtInstall = (shops: Array<CohortShop>) => {
    return shops
      .map((s) => s.orderCountAtInstall)
      .filter((c): c is number => c !== null);
  };

  return {
    retainedCount: retained.length,
    churnedCount: churned.length,
    medianRetainedMrr: median(retained.map((s) => s.mrr)),
    medianRetainedTenureMonths: median(retained.map((s) => s.tenureMonths)),
    medianRetainedOrdersAtInstall: median(ordersAtInstall(retained)),
    medianChurnedOrdersAtInstall: median(ordersAtInstall(churned)),
    topRetained,
    dimensions,
  };
};

export const getRetentionICP = cache(
  async (params: { mode: RetentionMode }): Promise<RetentionICP> => {
    const [journeys, profiles, revenue, monthlyActivity] = await Promise.all([
      getShopJourneys(),
      getShopProfiles(),
      getShopRevenue90d(),
      getShopMonthlyActivity(),
    ]);

    return computeRetentionICP({
      journeys,
      profiles,
      revenue,
      monthlyActivity,
      mode: params.mode,
      now: new Date(),
    });
  },
);
