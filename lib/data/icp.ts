import { cache } from "react";

import { supabase } from "@/lib/supabase";
import { tinybirdQuery } from "@/lib/tinybird";

import { getShopSessionCounts } from "./activity";
import { toUsd } from "./currencies";

export const BASELINE_MIN_MONTHS = 6;
export const IDEAL_MIN_SESSIONS = 12;

const DAYS_PER_MONTH = 30.4375;
const PAGE_SIZE = 1000;

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

type IcpShop = {
  shop: string;
  isInstalled: boolean;
  mrr: number;
  tenureMonths: number;
  orderCountAtInstall: number | null;
  vertical: string | null;
  shopifyPlanName: string | null;
  shopifyPlus: boolean;
  isPartnerDev: boolean;
  referralChannel: string;
  originPlanKey: string | null;
  setupCompleted: boolean;
  adPlatformCount: number;
  monthlyRevenue: number | null;
  monthlyAdSpend: number | null;
  ordersPerMonth: number;
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
const referralChannel = (row: {
  app_install_utm_source: string | null;
  app_install_fbclid: string | null;
  app_install_gclid: string | null;
  app_install_surface_type: string | null;
}): string => {
  if (row.app_install_utm_source) {
    return titleCase(row.app_install_utm_source);
  }
  if (row.app_install_fbclid) {
    return "Meta (paid)";
  }
  if (row.app_install_gclid) {
    return "Google (paid)";
  }
  if (row.app_install_surface_type) {
    return titleCase(row.app_install_surface_type);
  }
  return "Direct / organic";
};

const shopifyPlanLabel = (shop: IcpShop): string => {
  if (shop.shopifyPlus) {
    return "Plus";
  }
  if (shop.isPartnerDev) {
    return "Partner dev";
  }
  return shop.shopifyPlanName ?? "unknown";
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

const monthlyRevenueBucket = (amount: number | null) => {
  if (amount === null) {
    return "unknown";
  }
  if (amount < 1) {
    return "$0";
  }
  if (amount < 1_000) {
    return "<$1k";
  }
  if (amount < 10_000) {
    return "$1k–$10k";
  }
  if (amount < 50_000) {
    return "$10k–$50k";
  }
  if (amount < 200_000) {
    return "$50k–$200k";
  }
  return "$200k+";
};

const monthlyAdSpendBucket = (amount: number | null) => {
  if (amount === null) {
    return "unknown";
  }
  if (amount < 1) {
    return "$0";
  }
  if (amount < 500) {
    return "<$500";
  }
  if (amount < 2_500) {
    return "$500–$2.5k";
  }
  if (amount < 10_000) {
    return "$2.5k–$10k";
  }
  return "$10k+";
};

const ordersPerMonthBucket = (count: number) => {
  if (count < 1) {
    return "0";
  }
  if (count < 50) {
    return "1–49";
  }
  if (count < 200) {
    return "50–199";
  }
  if (count < 1_000) {
    return "200–999";
  }
  return "1k+";
};

const adPlatformBucket = (count: number) => {
  if (count === 0) {
    return "0";
  }
  if (count === 1) {
    return "1";
  }
  return "2+";
};

const median = (values: Array<number>) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export type IcpBucket = {
  label: string;
  idealCount: number;
  notIdealCount: number;
  idealPct: number;
  notIdealPct: number;
  delta: number;
};

export type IcpDimension = {
  key: string;
  label: string;
  note: string;
  buckets: Array<IcpBucket>;
};

const MAX_BUCKETS = 8;

const distribute = (
  shops: Array<IcpShop>,
  classify: (shop: IcpShop) => string,
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
  // Ordinal dimensions (size bands) keep their declared bucket order;
  // categorical ones sort by delta so the strongest signal is on top.
  sortByDelta?: boolean;
  ideal: Array<IcpShop>;
  notIdeal: Array<IcpShop>;
  classify: (shop: IcpShop) => string;
}): IcpDimension => {
  const idealCounts = distribute(params.ideal, params.classify);
  const notIdealCounts = distribute(params.notIdeal, params.classify);
  const idealTotal = params.ideal.length;
  const notIdealTotal = params.notIdeal.length;

  const labels = Array.from(
    new Set([
      ...params.bucketOrder,
      ...idealCounts.keys(),
      ...notIdealCounts.keys(),
    ]),
  );

  const buckets = labels.map((label) => {
    const idealCount = idealCounts.get(label) ?? 0;
    const notIdealCount = notIdealCounts.get(label) ?? 0;
    const idealPct = idealTotal > 0 ? idealCount / idealTotal : 0;
    const notIdealPct = notIdealTotal > 0 ? notIdealCount / notIdealTotal : 0;
    return {
      label,
      idealCount,
      notIdealCount,
      idealPct,
      notIdealPct,
      delta: idealPct - notIdealPct,
    };
  });

  const ordered =
    params.sortByDelta === false
      ? buckets
      : buckets.sort((a, b) => b.delta - a.delta);

  return {
    key: params.key,
    label: params.label,
    note: params.note,
    buckets: ordered.slice(0, MAX_BUCKETS),
  };
};

type RawSubscription = {
  id: number;
  shop: string;
  plan_key: string | null;
  price: number | null;
  activated_at: string | null;
  has_completed_setup: boolean;
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
        activated_at,
        has_completed_setup
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

type MonthlyAverages = {
  monthlyRevenue: number;
  monthlyAdSpend: number;
};

// Average monthly revenue + ad spend (USD) per shop across every month in the
// shop_performance_metrics rollup. Rows are deleted on uninstall, so shops
// without rows come back absent, not zero.
const fetchMonthlyAverages = async (): Promise<Map<string, MonthlyAverages>> => {
  type RawRow = {
    shop: string;
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
        revenue,
        ad_spend,
        currency_code
      `)
      .order("shop", { ascending: true })
      .order("month", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (metricsError) {
      console.error("Error fetching shop performance metrics", metricsError);
      throw metricsError;
    }

    rows.push(...page);

    hasMore = page.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  type Totals = { revenue: number; adSpend: number; months: number };
  const totalsByShop = new Map<string, Totals>();

  for (const row of rows) {
    const totals = totalsByShop.get(row.shop) ?? {
      revenue: 0,
      adSpend: 0,
      months: 0,
    };
    totals.revenue += toUsd(row.revenue, row.currency_code);
    totals.adSpend += toUsd(row.ad_spend, row.currency_code);
    totals.months += 1;
    totalsByShop.set(row.shop, totals);
  }

  const averages = new Map<string, MonthlyAverages>();
  for (const [shop, totals] of totalsByShop) {
    averages.set(shop, {
      monthlyRevenue: totals.revenue / totals.months,
      monthlyAdSpend: totals.adSpend / totals.months,
    });
  }

  return averages;
};

// Tracked orders over the trailing 90 days per shop. The orders table is a CDC
// replica with duplicate rows per order, so dedupe by id before counting.
const fetchOrders90d = async (): Promise<Map<string, number>> => {
  type RawOrderRow = {
    shop: string;
    orders: string;
  };

  const sql = `
    SELECT
      shop,
      count() AS orders
    FROM (
      SELECT
        id,
        shop,
        argMax(_is_deleted, updated_at) AS del,
        argMax(is_visible, updated_at) AS vis
      FROM orders
      WHERE order_created_at >= today() - INTERVAL 90 DAY
      GROUP BY id, shop
    ) deduped
    WHERE del = 0 AND vis = 1
    GROUP BY shop
    LIMIT 5000
    FORMAT JSON
  `;

  const result = await tinybirdQuery<Array<RawOrderRow>>({ q: sql });

  const counts = new Map<string, number>();
  for (const row of result.data) {
    counts.set(row.shop, Number(row.orders) || 0);
  }
  return counts;
};

export type IcpSummary = {
  baselineCount: number;
  idealCount: number;
  notIdealCount: number;
  idealRate: number;
  medianIdealMrr: number;
  medianIdealTenureMonths: number;
  dimensions: Array<IcpDimension>;
};

export const getIcp = cache(async (): Promise<IcpSummary> => {
  const shopsPromise = supabase
    .from("shops")
    .select(`
      shop,
      vertical,
      isInstalled,
      order_count_at_install,
      app_install_utm_source,
      app_install_fbclid,
      app_install_gclid,
      app_install_surface_type,
      plan_public_display_name,
      shopify_plus,
      is_partner_development_plan,
      shopData,
      currently_active_subscription_id
    `)
    .limit(3000);

  const platformsPromise = supabase
    .from("connected_platforms")
    .select(`
      shop,
      status,
      connectable_platforms (
        key
      )
    `)
    .limit(20000);

  const [
    { data: shops, error: shopsError },
    { data: platforms, error: platformsError },
    subscriptions,
    sessionCounts,
    monthlyAverages,
    orders90d,
  ] = await Promise.all([
    shopsPromise,
    platformsPromise,
    fetchAllSubscriptions(),
    getShopSessionCounts(),
    fetchMonthlyAverages(),
    fetchOrders90d(),
  ]);

  if (shopsError) {
    console.error("Error fetching shops", shopsError);
    throw shopsError;
  }
  if (platformsError) {
    console.error("Error fetching connected platforms", platformsError);
    throw platformsError;
  }

  const subsByShop = new Map<string, Array<RawSubscription>>();
  for (const sub of subscriptions) {
    const list = subsByShop.get(sub.shop) ?? [];
    list.push(sub);
    subsByShop.set(sub.shop, list);
  }

  const platformCountByShop = new Map<string, number>();
  for (const platform of platforms) {
    if (platform.status !== "OK") {
      continue;
    }
    platformCountByShop.set(
      platform.shop,
      (platformCountByShop.get(platform.shop) ?? 0) + 1,
    );
  }

  const now = new Date();
  const baselineCutoffMs =
    now.getTime() - BASELINE_MIN_MONTHS * DAYS_PER_MONTH * 86400000;

  const ideal: Array<IcpShop> = [];
  const notIdeal: Array<IcpShop> = [];

  for (const row of shops) {
    const subs = subsByShop.get(row.shop) ?? [];

    let firstPaidAt: string | null = null;
    for (const sub of subs) {
      if (sub.activated_at && (sub.price ?? 0) > 0) {
        if (!firstPaidAt || sub.activated_at < firstPaidAt) {
          firstPaidAt = sub.activated_at;
        }
      }
    }

    // Baseline: shops whose first paid subscription is old enough to judge.
    // Anything younger hasn't had time to qualify as ideal, so it is excluded
    // rather than polluting the not-ideal cohort.
    if (!firstPaidAt || new Date(firstPaidAt).getTime() > baselineCutoffMs) {
      continue;
    }

    const activeSub = row.currently_active_subscription_id
      ? subs.find((s) => s.id === row.currently_active_subscription_id)
      : null;
    const isPaying = (activeSub?.price ?? 0) > 0;

    const shopData = parseShopData(row.shopData);

    // Most recent paid plan — the current plan for active shops, the final
    // plan for churned ones.
    let lastPaidSub: RawSubscription | null = null;
    for (const sub of subs) {
      if (sub.activated_at && (sub.price ?? 0) > 0) {
        if (!lastPaidSub || sub.activated_at > (lastPaidSub.activated_at ?? "")) {
          lastPaidSub = sub;
        }
      }
    }

    const averages = monthlyAverages.get(row.shop) ?? null;

    const icpShop: IcpShop = {
      shop: row.shop,
      isInstalled: row.isInstalled === true,
      mrr: activeSub?.price ?? 0,
      tenureMonths: monthsBetween(new Date(firstPaidAt), now),
      orderCountAtInstall: row.order_count_at_install,
      vertical: row.vertical,
      shopifyPlanName:
        row.plan_public_display_name ?? shopData?.plan?.displayName ?? null,
      shopifyPlus: row.shopify_plus ?? shopData?.plan?.shopifyPlus === true,
      isPartnerDev:
        row.is_partner_development_plan ??
        shopData?.plan?.partnerDevelopment === true,
      referralChannel: referralChannel(row),
      originPlanKey: lastPaidSub?.plan_key ?? null,
      setupCompleted: subs.some((s) => s.has_completed_setup),
      adPlatformCount: platformCountByShop.get(row.shop) ?? 0,
      monthlyRevenue: averages ? averages.monthlyRevenue : null,
      monthlyAdSpend: averages ? averages.monthlyAdSpend : null,
      ordersPerMonth: (orders90d.get(row.shop) ?? 0) / 3,
    };

    const isIdeal =
      row.isInstalled === true &&
      isPaying &&
      (sessionCounts.get(row.shop) ?? 0) >= IDEAL_MIN_SESSIONS;

    if (isIdeal) {
      ideal.push(icpShop);
    } else {
      notIdeal.push(icpShop);
    }
  }

  // Revenue, ad spend and order volume are deleted when a shop uninstalls, so
  // those dimensions only compare still-installed shops (every ideal shop is
  // installed by definition).
  const notIdealInstalled = notIdeal.filter((s) => s.isInstalled);

  const dimensions: Array<IcpDimension> = [
    buildDimension({
      key: "monthly_revenue",
      label: "Monthly revenue",
      note: "Avg tracked revenue per month (USD) · still-installed shops only — data is deleted on uninstall",
      bucketOrder: ["$0", "<$1k", "$1k–$10k", "$10k–$50k", "$50k–$200k", "$200k+", "unknown"],
      sortByDelta: false,
      ideal,
      notIdeal: notIdealInstalled,
      classify: (s) => monthlyRevenueBucket(s.monthlyRevenue),
    }),
    buildDimension({
      key: "monthly_ad_spend",
      label: "Monthly ad spend",
      note: "Avg ad spend per month (USD) · still-installed shops only — data is deleted on uninstall",
      bucketOrder: ["$0", "<$500", "$500–$2.5k", "$2.5k–$10k", "$10k+", "unknown"],
      sortByDelta: false,
      ideal,
      notIdeal: notIdealInstalled,
      classify: (s) => monthlyAdSpendBucket(s.monthlyAdSpend),
    }),
    buildDimension({
      key: "orders_per_month",
      label: "Orders / month",
      note: "Tracked orders in the last 90 days ÷ 3 · still-installed shops only — data is deleted on uninstall",
      bucketOrder: ["0", "1–49", "50–199", "200–999", "1k+"],
      sortByDelta: false,
      ideal,
      notIdeal: notIdealInstalled,
      classify: (s) => ordersPerMonthBucket(s.ordersPerMonth),
    }),
    buildDimension({
      key: "origin_plan",
      label: "Origin plan",
      note: "Most recent paid plan — current for active shops, final for churned",
      bucketOrder: [],
      ideal,
      notIdeal,
      classify: (s) =>
        s.originPlanKey ? titleCase(s.originPlanKey) : "unknown",
    }),
    buildDimension({
      key: "orders_at_install",
      label: "Merchant size",
      note: "Orders at install — survives uninstall, so comparable across both cohorts (live GMV is deleted for churned shops)",
      bucketOrder: ["0", "1–99", "100–999", "1k–10k", "10k+", "unknown"],
      sortByDelta: false,
      ideal,
      notIdeal,
      classify: (s) => orderCountBucket(s.orderCountAtInstall),
    }),
    buildDimension({
      key: "vertical",
      label: "Vertical",
      note: "Shopify-reported store vertical",
      bucketOrder: [],
      ideal,
      notIdeal,
      classify: (s) => (s.vertical ? titleCase(s.vertical) : "unknown"),
    }),
    buildDimension({
      key: "shopify_plan",
      label: "Shopify plan",
      note: "Plus / Partner dev flags take precedence over the public plan name",
      bucketOrder: [],
      ideal,
      notIdeal,
      classify: shopifyPlanLabel,
    }),
    buildDimension({
      key: "referral_channel",
      label: "Referral channel",
      note: "utm_source › paid-click marker › app-store surface › organic",
      bucketOrder: [],
      ideal,
      notIdeal,
      classify: (s) => s.referralChannel,
    }),
    buildDimension({
      key: "ad_platforms",
      label: "Ad platforms connected",
      note: "Platforms with a healthy (OK) connection today",
      bucketOrder: ["0", "1", "2+"],
      ideal,
      notIdeal,
      classify: (s) => adPlatformBucket(s.adPlatformCount),
    }),
    buildDimension({
      key: "setup_completed",
      label: "Completed setup",
      note: "Whether any subscription ever completed setup",
      bucketOrder: ["yes", "no"],
      ideal,
      notIdeal,
      classify: (s) => (s.setupCompleted ? "yes" : "no"),
    }),
  ];

  // Strongest-correlating dimension first, so the page reads top-to-bottom by
  // signal strength.
  const signal = (dimension: IcpDimension) => {
    return Math.max(...dimension.buckets.map((b) => Math.abs(b.delta)), 0);
  };
  dimensions.sort((a, b) => signal(b) - signal(a));

  const baselineCount = ideal.length + notIdeal.length;

  return {
    baselineCount,
    idealCount: ideal.length,
    notIdealCount: notIdeal.length,
    idealRate: baselineCount > 0 ? ideal.length / baselineCount : 0,
    medianIdealMrr: median(ideal.map((s) => s.mrr)),
    medianIdealTenureMonths: median(ideal.map((s) => s.tenureMonths)),
    dimensions,
  };
});
