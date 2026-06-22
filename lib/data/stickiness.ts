import { cache } from "react";

import { supabase } from "@/lib/supabase";

export type StickinessCohort = "sticky" | "churned";

export type StickinessShop = {
  shop: string;
  name: string | null;
  isInstalled: boolean;
  initialInstalledAt: string | null;
  uninstalledAt: string | null;
  originPlan: string | null;
  shopifyPlanName: string | null;
  vertical: string | null;
  orderCountAtInstall: number | null;
  firstOrderCreatedAt: string | null;
  installUtmSource: string | null;
  installUtmMedium: string | null;
  installUtmCampaign: string | null;
  installLandingPage: string | null;
  installFbclid: string | null;
  installGclid: string | null;
  installSurfaceType: string | null;
  installSurfaceDetail: string | null;
};

// Churned cohort = uninstalled in under 3 months. Sticky cohort = survived at
// least 6 months (whether still installed or uninstalled after the 6mo mark).
const CHURN_MAX_DAYS = 90;
const STICKY_MIN_DAYS = 180;

const DAY_MS = 86_400_000;
const MONTH_MS = DAY_MS * 30.44;

export const getStickinessShops = cache(
  async (): Promise<Array<StickinessShop>> => {
    const [
      { data: shops, error: shopsError },
      { data: subscriptions, error: subscriptionsError },
    ] = await Promise.all([
      supabase
        .from("shops")
        .select(`
          shop,
          name,
          isInstalled,
          initialInstalledAt,
          uninstalled_at,
          plan_public_display_name,
          vertical,
          order_count_at_install,
          first_order_created_at,
          app_install_utm_source,
          app_install_utm_medium,
          app_install_utm_campaign,
          app_install_landing_page,
          app_install_fbclid,
          app_install_gclid,
          app_install_surface_type,
          app_install_surface_detail
        `)
        .limit(5000),
      supabase
        .from("subscriptions")
        .select(`
          shop,
          plan_key,
          price,
          activated_at
        `)
        .limit(20000),
    ]);

    if (shopsError) {
      console.error("Error fetching shops for stickiness report", shopsError);
      throw shopsError;
    }
    if (subscriptionsError) {
      console.error(
        "Error fetching subscriptions for stickiness report",
        subscriptionsError,
      );
      throw subscriptionsError;
    }

    // Limit the whole report to merchants who have been on a paid plan at some
    // point — a shop counts if it ever had a subscription activated at price > 0.
    // While iterating, also capture the Origin plan each shop originally signed
    // up to: the plan_key of its earliest paid subscription (matching the
    // firstPaidAt definition used elsewhere).
    const everPaidShops = new Set<string>();
    const originPlanByShop = new Map<
      string,
      { plan: string; activatedAt: string }
    >();
    for (const sub of subscriptions ?? []) {
      if (sub.activated_at && (sub.price ?? 0) > 0) {
        everPaidShops.add(sub.shop);

        const existing = originPlanByShop.get(sub.shop);
        if (!existing || sub.activated_at < existing.activatedAt) {
          originPlanByShop.set(sub.shop, {
            plan: sub.plan_key,
            activatedAt: sub.activated_at,
          });
        }
      }
    }

    return shops
      .filter((shop) => everPaidShops.has(shop.shop))
      .map((shop) => {
        return {
          shop: shop.shop,
          name: shop.name ?? null,
          isInstalled: shop.isInstalled === true,
          initialInstalledAt: shop.initialInstalledAt,
          uninstalledAt: shop.uninstalled_at,
          originPlan: originPlanByShop.get(shop.shop)?.plan ?? null,
          shopifyPlanName: shop.plan_public_display_name,
          vertical: shop.vertical,
          orderCountAtInstall: shop.order_count_at_install,
          firstOrderCreatedAt: shop.first_order_created_at,
          installUtmSource: shop.app_install_utm_source,
          installUtmMedium: shop.app_install_utm_medium,
          installUtmCampaign: shop.app_install_utm_campaign,
          installLandingPage: shop.app_install_landing_page,
          installFbclid: shop.app_install_fbclid,
          installGclid: shop.app_install_gclid,
          installSurfaceType: shop.app_install_surface_type,
          installSurfaceDetail: shop.app_install_surface_detail,
        };
      });
  },
);

const lifespanDays = (shop: StickinessShop): number | null => {
  if (!shop.initialInstalledAt) {
    return null;
  }
  const end = shop.uninstalledAt
    ? new Date(shop.uninstalledAt).getTime()
    : Date.now();
  return (end - new Date(shop.initialInstalledAt).getTime()) / DAY_MS;
};

export const cohortOf = (shop: StickinessShop): StickinessCohort | null => {
  const life = lifespanDays(shop);
  if (life === null || life < 0) {
    return null;
  }
  if (!shop.isInstalled && shop.uninstalledAt && life < CHURN_MAX_DAYS) {
    return "churned";
  }
  if (life >= STICKY_MIN_DAYS) {
    return "sticky";
  }
  return null;
};

// --- Dimension classifiers -------------------------------------------------

const META_SOURCES = new Set([
  "fb",
  "facebook",
  "meta",
  "ig",
  "instagram",
  "fb_ads",
  "meta_ads",
]);
const GOOGLE_SOURCES = new Set([
  "google",
  "adwords",
  "google_ads",
  "googleads",
  "gads",
]);

export const acquisitionChannel = (shop: StickinessShop): string => {
  const surface = shop.installSurfaceType?.trim().toLowerCase() ?? null;

  if (surface === "search_ad") {
    return "Shopify Ads";
  }

  if (surface === "search") {
    return "Shopify Organic";
  }

  const src = shop.installUtmSource?.trim().toLowerCase() ?? null;

  if (shop.installFbclid || (src && META_SOURCES.has(src))) {
    return "Meta";
  }

  if (shop.installGclid || (src && GOOGLE_SOURCES.has(src))) {
    return "Google";
  }

  if (src) {
    return src.charAt(0).toUpperCase() + src.slice(1);
  }

  if (shop.installLandingPage) {
    return "Direct / Organic";
  }

  return "Unknown";
};

// Average monthly order volume the store had *before* installing Origin —
// estimated from the lifetime order count and the store's first order date,
// since uninstalled stores keep no order rows. ORI-210.
export const ordersPerMonth = (shop: StickinessShop): number | null => {
  if (shop.orderCountAtInstall === null) {
    return null;
  }
  if (shop.orderCountAtInstall === 0) {
    return 0;
  }
  if (!shop.firstOrderCreatedAt || !shop.initialInstalledAt) {
    return null;
  }
  const span =
    new Date(shop.initialInstalledAt).getTime() -
    new Date(shop.firstOrderCreatedAt).getTime();
  const months = Math.max(1, span / MONTH_MS);
  return shop.orderCountAtInstall / months;
};

const ORDERS_BUCKET_ORDER = [
  "0–1 /mo",
  "1–10 /mo",
  "10–50 /mo",
  "50–200 /mo",
  "200–1k /mo",
  "1k+ /mo",
  "Unknown",
];

const ordersPerMonthBucket = (shop: StickinessShop): string => {
  const opm = ordersPerMonth(shop);
  if (opm === null) {
    return "Unknown";
  }
  if (opm < 1) {
    return "0–1 /mo";
  }
  if (opm < 10) {
    return "1–10 /mo";
  }
  if (opm < 50) {
    return "10–50 /mo";
  }
  if (opm < 200) {
    return "50–200 /mo";
  }
  if (opm < 1_000) {
    return "200–1k /mo";
  }
  return "1k+ /mo";
};

const ORIGIN_PLAN_ORDER = ["Free", "Standard", "Pro", "Platinum", "Unknown"];

const originPlanBucket = (shop: StickinessShop): string => {
  if (!shop.originPlan) {
    return "Unknown";
  }
  return shop.originPlan.charAt(0).toUpperCase() + shop.originPlan.slice(1);
};

const planBucket = (shop: StickinessShop): string => {
  return shop.shopifyPlanName ?? "Unknown";
};

const verticalBucket = (shop: StickinessShop): string => {
  return shop.vertical ?? "Unknown";
};

// --- Comparison ------------------------------------------------------------

export type CohortBucket = {
  label: string;
  stickyCount: number;
  churnedCount: number;
  stickyPct: number;
  churnedPct: number;
  delta: number;
};

export type DimensionComparison = {
  key: string;
  label: string;
  description: string;
  buckets: Array<CohortBucket>;
};

export type StickinessSignal = {
  dimensionKey: string;
  dimensionLabel: string;
  bucketLabel: string;
  stickyPct: number;
  churnedPct: number;
  delta: number;
  total: number;
};

export type StickinessReport = {
  stickyCount: number;
  churnedCount: number;
  totalShops: number;
  dimensions: Array<DimensionComparison>;
  signals: Array<StickinessSignal>;
};

const MAX_BUCKETS_PER_DIMENSION = 8;

const distribute = (
  shops: Array<StickinessShop>,
  classify: (shop: StickinessShop) => string,
): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const shop of shops) {
    const key = classify(shop);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

type BuildDimensionParams = {
  key: string;
  label: string;
  description: string;
  sticky: Array<StickinessShop>;
  churned: Array<StickinessShop>;
  classify: (shop: StickinessShop) => string;
  bucketOrder?: Array<string>;
  maxBuckets?: number;
};

const buildDimension = (params: BuildDimensionParams): DimensionComparison => {
  const stickyCounts = distribute(params.sticky, params.classify);
  const churnedCounts = distribute(params.churned, params.classify);
  const stickyTotal = params.sticky.length;
  const churnedTotal = params.churned.length;

  const labels = Array.from(
    new Set([...stickyCounts.keys(), ...churnedCounts.keys()]),
  );

  const buckets: Array<CohortBucket> = labels.map((label) => {
    const stickyCount = stickyCounts.get(label) ?? 0;
    const churnedCount = churnedCounts.get(label) ?? 0;
    const stickyPct = stickyTotal > 0 ? stickyCount / stickyTotal : 0;
    const churnedPct = churnedTotal > 0 ? churnedCount / churnedTotal : 0;
    return {
      label,
      stickyCount,
      churnedCount,
      stickyPct,
      churnedPct,
      delta: stickyPct - churnedPct,
    };
  });

  // Ordinal dimensions keep their natural order; categorical dimensions sort
  // by combined volume so the most populated buckets read first.
  if (params.bucketOrder) {
    const order = params.bucketOrder;
    buckets.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  } else {
    buckets.sort(
      (a, b) =>
        b.stickyCount + b.churnedCount - (a.stickyCount + a.churnedCount),
    );
  }

  return {
    key: params.key,
    label: params.label,
    description: params.description,
    buckets: buckets.slice(0, params.maxBuckets ?? MAX_BUCKETS_PER_DIMENSION),
  };
};

const SIGNAL_MIN_TOTAL = 3;
const SIGNAL_MIN_DELTA = 0.05;
const MAX_SIGNALS = 6;

const collectSignals = (
  dimensions: Array<DimensionComparison>,
): Array<StickinessSignal> => {
  const signals: Array<StickinessSignal> = [];

  for (const dim of dimensions) {
    for (const bucket of dim.buckets) {
      const total = bucket.stickyCount + bucket.churnedCount;
      if (bucket.label === "Unknown") {
        continue;
      }
      if (total < SIGNAL_MIN_TOTAL || Math.abs(bucket.delta) < SIGNAL_MIN_DELTA) {
        continue;
      }
      signals.push({
        dimensionKey: dim.key,
        dimensionLabel: dim.label,
        bucketLabel: bucket.label,
        stickyPct: bucket.stickyPct,
        churnedPct: bucket.churnedPct,
        delta: bucket.delta,
        total,
      });
    }
  }

  return signals
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, MAX_SIGNALS);
};

export const computeStickinessReport = (
  shops: Array<StickinessShop>,
): StickinessReport => {
  const sticky: Array<StickinessShop> = [];
  const churned: Array<StickinessShop> = [];

  for (const shop of shops) {
    const cohort = cohortOf(shop);
    if (cohort === "sticky") {
      sticky.push(shop);
    } else if (cohort === "churned") {
      churned.push(shop);
    }
  }

  const dimensions: Array<DimensionComparison> = [
    buildDimension({
      key: "acquisition",
      label: "Attribution source",
      description:
        "Channel that drove the app install — from fbclid / gclid and UTM source.",
      sticky,
      churned,
      classify: acquisitionChannel,
    }),
    buildDimension({
      key: "orders_per_month",
      label: "Orders per month at install",
      description:
        "Store's pre-install order velocity, estimated from lifetime orders and first-order date.",
      sticky,
      churned,
      classify: ordersPerMonthBucket,
      bucketOrder: ORDERS_BUCKET_ORDER,
    }),
    buildDimension({
      key: "origin_plan",
      label: "Origin plan at signup",
      description:
        "The Origin plan the merchant originally signed up to — the tier of their earliest paid subscription.",
      sticky,
      churned,
      classify: originPlanBucket,
      bucketOrder: ORIGIN_PLAN_ORDER,
    }),
    buildDimension({
      key: "shopify_plan",
      label: "Shopify plan",
      description: "Shopify subscription tier at install.",
      sticky,
      churned,
      classify: planBucket,
    }),
    buildDimension({
      key: "vertical",
      label: "Vertical",
      description: "AI-classified store category.",
      sticky,
      churned,
      classify: verticalBucket,
      maxBuckets: Infinity,
    }),
  ];

  return {
    stickyCount: sticky.length,
    churnedCount: churned.length,
    totalShops: shops.length,
    dimensions,
    signals: collectSignals(dimensions),
  };
};

export const getStickinessReport = cache(
  async (): Promise<StickinessReport> => {
    const shops = await getStickinessShops();
    return computeStickinessReport(shops);
  },
);

// --- Shopify App Store acquisition reports ---------------------------------
//
// Shopify appends a `surface_type` to the listing URL describing where in the
// App Store the merchant clicked from: "search" (organic search results),
// "search_ad" (a paid App Store ad), "category", "home", … — and a
// `surface_detail` which, for searches, is the keyword the merchant typed.

const shopifyChannel = (shop: StickinessShop): string | null => {
  const type = shop.installSurfaceType?.trim().toLowerCase() ?? null;
  if (type === "search") {
    return "Shopify Search";
  }
  if (type === "search_ad") {
    return "Shopify Ads";
  }
  return null;
};

const keywordForSurface = (surfaceType: "search" | "search_ad") => {
  return (shop: StickinessShop): string | null => {
    const type = shop.installSurfaceType?.trim().toLowerCase() ?? null;
    if (type !== surfaceType) {
      return null;
    }
    const keyword = shop.installSurfaceDetail?.trim().toLowerCase();
    if (!keyword) {
      return null;
    }
    return keyword;
  };
};

export type SingleDimensionReport = DimensionComparison & {
  stickyCount: number;
  churnedCount: number;
};

type ComputeSingleDimensionParams = {
  shops: Array<StickinessShop>;
  key: string;
  label: string;
  description: string;
  classify: (shop: StickinessShop) => string | null;
  bucketOrder?: Array<string>;
  maxBuckets?: number;
};

// Builds a single-dimension sticky-vs-churned comparison over only the shops
// the classifier applies to (it returns null to exclude a shop entirely).
const computeSingleDimensionStickiness = (
  params: ComputeSingleDimensionParams,
): SingleDimensionReport => {
  const sticky: Array<StickinessShop> = [];
  const churned: Array<StickinessShop> = [];

  for (const shop of params.shops) {
    if (params.classify(shop) === null) {
      continue;
    }
    const cohort = cohortOf(shop);
    if (cohort === "sticky") {
      sticky.push(shop);
    } else if (cohort === "churned") {
      churned.push(shop);
    }
  }

  const dimension = buildDimension({
    key: params.key,
    label: params.label,
    description: params.description,
    sticky,
    churned,
    classify: (shop) => params.classify(shop) ?? "Unknown",
    bucketOrder: params.bucketOrder,
    maxBuckets: params.maxBuckets,
  });

  return {
    ...dimension,
    stickyCount: sticky.length,
    churnedCount: churned.length,
  };
};

export const getShopifyChannelStickiness = cache(
  async (): Promise<SingleDimensionReport> => {
    const shops = await getStickinessShops();
    return computeSingleDimensionStickiness({
      shops,
      key: "shopify_channel",
      label: "Shopify acquisition channel",
      description:
        "Shopify App Store ads vs organic Shopify search, from the install surface_type. Other surfaces (category, home, …) and non-Shopify sources are excluded.",
      classify: shopifyChannel,
      bucketOrder: ["Shopify Search", "Shopify Ads"],
    });
  },
);

const KEYWORD_MAX_BUCKETS = 15;

export const getShopifyOrganicKeywordStickiness = cache(
  async (): Promise<SingleDimensionReport> => {
    const shops = await getStickinessShops();
    return computeSingleDimensionStickiness({
      shops,
      key: "shopify_keyword_organic",
      label: "Organic search keywords",
      description:
        "Keyword the merchant typed into Shopify App Store organic search (surface_type=search) before installing — top 15 by volume.",
      classify: keywordForSurface("search"),
      maxBuckets: KEYWORD_MAX_BUCKETS,
    });
  },
);

export const getShopifyAdKeywordStickiness = cache(
  async (): Promise<SingleDimensionReport> => {
    const shops = await getStickinessShops();
    return computeSingleDimensionStickiness({
      shops,
      key: "shopify_keyword_ad",
      label: "Paid ad keywords",
      description:
        "Keyword that triggered a Shopify App Store ad (surface_type=search_ad) before installing — top 15 by volume.",
      classify: keywordForSurface("search_ad"),
      maxBuckets: KEYWORD_MAX_BUCKETS,
    });
  },
);
