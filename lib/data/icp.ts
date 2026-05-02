import type { ShopProfile, ShopWithRevenue } from "./insights";

export type Segment = {
  label: string;
  shops: Array<ShopWithRevenue>;
};

const ageInDays = (timestamp: string | null) => {
  if (!timestamp) {
    return null;
  }
  return (Date.now() - new Date(timestamp).getTime()) / 86400000;
};

const tenureInDays = (shop: ShopProfile) => {
  return ageInDays(shop.initialInstalledAt);
};

const installToUninstallDays = (shop: ShopProfile) => {
  if (!shop.initialInstalledAt || !shop.uninstalledAt) {
    return null;
  }
  const diff =
    new Date(shop.uninstalledAt).getTime() -
    new Date(shop.initialInstalledAt).getTime();
  return diff / 86400000;
};

export const isChampion = (shop: ShopWithRevenue) => {
  const tenure = tenureInDays(shop);
  if (tenure === null || tenure < 90) {
    return false;
  }
  if (!shop.isPaying) {
    return false;
  }
  if (!shop.isInstalled) {
    return false;
  }
  if (shop.revenue90d <= 0) {
    return false;
  }
  if (shop.pageviews30d <= 0) {
    return false;
  }
  return true;
};

export const isEarlyChurner = (shop: ShopProfile) => {
  if (shop.isInstalled) {
    return false;
  }
  const lifespan = installToUninstallDays(shop);
  if (lifespan === null) {
    return false;
  }
  return lifespan <= 30;
};

export type ScorecardDimension = {
  key: string;
  label: string;
  group: string;
  buckets: Array<{
    label: string;
    championPct: number;
    churnerPct: number;
    allPct: number;
    delta: number;
  }>;
};

const distribute = <T>(
  shops: Array<T>,
  classify: (shop: T) => string | null,
): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const shop of shops) {
    const key = classify(shop);
    if (key === null) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

const buildDimension = (params: {
  key: string;
  label: string;
  group: string;
  bucketOrder: Array<string>;
  champions: Array<ShopWithRevenue>;
  churners: Array<ShopProfile>;
  baseline: Array<ShopProfile>;
  classifyChampion: (shop: ShopWithRevenue) => string | null;
  classifyChurner: (shop: ShopProfile) => string | null;
  classifyBaseline: (shop: ShopProfile) => string | null;
}): ScorecardDimension => {
  const champCounts = distribute(params.champions, params.classifyChampion);
  const churnCounts = distribute(params.churners, params.classifyChurner);
  const allCounts = distribute(params.baseline, params.classifyBaseline);
  const champTotal = Array.from(champCounts.values()).reduce(
    (s, n) => s + n,
    0,
  );
  const churnTotal = Array.from(churnCounts.values()).reduce(
    (s, n) => s + n,
    0,
  );
  const allTotal = Array.from(allCounts.values()).reduce((s, n) => s + n, 0);

  const allBuckets = Array.from(
    new Set([
      ...params.bucketOrder,
      ...champCounts.keys(),
      ...churnCounts.keys(),
      ...allCounts.keys(),
    ]),
  );

  const buckets = allBuckets.map((bucket) => {
    const championPct =
      champTotal > 0 ? (champCounts.get(bucket) ?? 0) / champTotal : 0;
    const churnerPct =
      churnTotal > 0 ? (churnCounts.get(bucket) ?? 0) / churnTotal : 0;
    const allPct = allTotal > 0 ? (allCounts.get(bucket) ?? 0) / allTotal : 0;
    return {
      label: bucket,
      championPct,
      churnerPct,
      allPct,
      delta: championPct - churnerPct,
    };
  });

  return {
    key: params.key,
    label: params.label,
    group: params.group,
    buckets: buckets.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
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
  if (count < 100_000) {
    return "10k–100k";
  }
  return "100k+";
};

const timeToPixelBucket = (shop: ShopProfile) => {
  if (!shop.originPixelAddedAt) {
    return "never";
  }
  const start = shop.lastInstalledAt ?? shop.initialInstalledAt;
  if (!start) {
    return "unknown";
  }
  const diff =
    new Date(shop.originPixelAddedAt).getTime() - new Date(start).getTime();
  const hours = diff / 3_600_000;
  if (hours < 0) {
    return "before install";
  }
  if (hours < 1) {
    return "<1h";
  }
  if (hours < 24) {
    return "1–24h";
  }
  const days = hours / 24;
  if (days < 7) {
    return "1–7d";
  }
  if (days < 30) {
    return "7–30d";
  }
  return "30d+";
};

const yesNo = (predicate: boolean) => {
  return predicate ? "yes" : "no";
};

const hasAnyAd = (shop: ShopProfile) => {
  return shop.connectedPlatformKeys.length > 0;
};

const installSource = (shop: ShopProfile) => {
  if (shop.installFbclid) {
    return "Meta ad click";
  }
  if (shop.installGclid) {
    return "Google ad click";
  }
  return "organic / direct";
};

export type ICPScorecard = {
  championCount: number;
  earlyChurnerCount: number;
  baselineCount: number;
  dimensions: Array<ScorecardDimension>;
};

export const computeICPScorecard = (
  shops: Array<ShopWithRevenue>,
): ICPScorecard => {
  const champions = shops.filter(isChampion);
  const churners = shops.filter(isEarlyChurner);
  const baseline = shops.filter((s) => s.isInstalled);

  const dimensions: Array<ScorecardDimension> = [
    buildDimension({
      key: "shopify_plus",
      label: "Shopify Plus",
      group: "Firmographics",
      bucketOrder: ["yes", "no"],
      champions,
      churners,
      baseline,
      classifyChampion: (s) => yesNo(s.shopifyPlus),
      classifyChurner: (s) => yesNo(s.shopifyPlus),
      classifyBaseline: (s) => yesNo(s.shopifyPlus),
    }),
    buildDimension({
      key: "partner_dev",
      label: "Partner dev store",
      group: "Firmographics",
      bucketOrder: ["yes", "no"],
      champions,
      churners,
      baseline,
      classifyChampion: (s) => yesNo(s.isPartnerDev),
      classifyChurner: (s) => yesNo(s.isPartnerDev),
      classifyBaseline: (s) => yesNo(s.isPartnerDev),
    }),
    buildDimension({
      key: "shopify_plan",
      label: "Shopify plan",
      group: "Firmographics",
      bucketOrder: [],
      champions,
      churners,
      baseline,
      classifyChampion: (s) => s.shopifyPlanName ?? "unknown",
      classifyChurner: (s) => s.shopifyPlanName ?? "unknown",
      classifyBaseline: (s) => s.shopifyPlanName ?? "unknown",
    }),
    buildDimension({
      key: "currency",
      label: "Currency",
      group: "Firmographics",
      bucketOrder: [],
      champions,
      churners,
      baseline,
      classifyChampion: (s) => s.currency,
      classifyChurner: (s) => s.currency,
      classifyBaseline: (s) => s.currency,
    }),
    buildDimension({
      key: "order_count_at_install",
      label: "Orders at install",
      group: "Maturity",
      bucketOrder: ["0", "1–99", "100–999", "1k–10k", "10k–100k", "100k+", "unknown"],
      champions,
      churners,
      baseline,
      classifyChampion: (s) => orderCountBucket(s.orderCountAtInstall),
      classifyChurner: (s) => orderCountBucket(s.orderCountAtInstall),
      classifyBaseline: (s) => orderCountBucket(s.orderCountAtInstall),
    }),
    buildDimension({
      key: "pixel_installed",
      label: "Origin pixel installed",
      group: "Activation",
      bucketOrder: ["yes", "no"],
      champions,
      churners,
      baseline,
      classifyChampion: (s) => yesNo(s.originPixelAddedAt !== null),
      classifyChurner: (s) => yesNo(s.originPixelAddedAt !== null),
      classifyBaseline: (s) => yesNo(s.originPixelAddedAt !== null),
    }),
    buildDimension({
      key: "time_to_pixel",
      label: "Time to pixel",
      group: "Activation",
      bucketOrder: [
        "<1h",
        "1–24h",
        "1–7d",
        "7–30d",
        "30d+",
        "never",
        "before install",
        "unknown",
      ],
      champions,
      churners,
      baseline,
      classifyChampion: (s) => timeToPixelBucket(s),
      classifyChurner: (s) => timeToPixelBucket(s),
      classifyBaseline: (s) => timeToPixelBucket(s),
    }),
    buildDimension({
      key: "setup_complete",
      label: "Completed setup",
      group: "Activation",
      bucketOrder: ["yes", "no"],
      champions,
      churners,
      baseline,
      classifyChampion: (s) => yesNo(s.hasCompletedSetup),
      classifyChurner: (s) => yesNo(s.hasCompletedSetup),
      classifyBaseline: (s) => yesNo(s.hasCompletedSetup),
    }),
    buildDimension({
      key: "install_source",
      label: "Install attribution",
      group: "Acquisition",
      bucketOrder: ["Meta ad click", "Google ad click", "organic / direct"],
      champions,
      churners,
      baseline,
      classifyChampion: (s) => installSource(s),
      classifyChurner: (s) => installSource(s),
      classifyBaseline: (s) => installSource(s),
    }),
  ];

  return {
    championCount: champions.length,
    earlyChurnerCount: churners.length,
    baselineCount: baseline.length,
    dimensions,
  };
};

export type ActivationFunnelStep = {
  label: string;
  count: number;
  conversionFromTop: number;
  conversionFromPrev: number;
};

export const computeActivationFunnel = (
  shops: Array<ShopWithRevenue>,
): Array<ActivationFunnelStep> => {
  const installed = shops.length;
  const pixelLive = shops.filter((s) => s.originPixelAddedAt !== null).length;
  const adConnected = shops.filter((s) => hasAnyAd(s)).length;
  const firstOrder = shops.filter((s) => s.revenue90d > 0).length;
  const onboarded = shops.filter((s) => s.hasCompletedSetup).length;
  const paying = shops.filter((s) => s.isPaying).length;

  const raw = [
    { label: "Installed", count: installed },
    { label: "Pixel live", count: pixelLive },
    { label: "Ad platform connected", count: adConnected },
    { label: "First order tracked (90d)", count: firstOrder },
    { label: "Completed setup", count: onboarded },
    { label: "Paying", count: paying },
  ];

  return raw.map((step, index) => {
    const prev = index === 0 ? installed : raw[index - 1].count;
    return {
      label: step.label,
      count: step.count,
      conversionFromTop: installed > 0 ? step.count / installed : 0,
      conversionFromPrev: prev > 0 ? step.count / prev : 0,
    };
  });
};

export type ChurnDistributionPoint = {
  bucket: string;
  [series: string]: number | string;
};

export type ChurnDistributionSeries = {
  key: string;
  label: string;
  total: number;
};

export type ChurnSplitBy =
  | "none"
  | "install-source"
  | "shopify-plus";

const CHURN_BUCKETS: Array<{ label: string; min: number; max: number | null }> = [
  { label: "<1d", min: 0, max: 1 },
  { label: "1–7d", min: 1, max: 7 },
  { label: "7–14d", min: 7, max: 14 },
  { label: "14–30d", min: 14, max: 30 },
  { label: "30–60d", min: 30, max: 60 },
  { label: "60–90d", min: 60, max: 90 },
  { label: "90–180d", min: 90, max: 180 },
  { label: "180d+", min: 180, max: null },
];

const ORDER_FOR_SPLIT: Record<ChurnSplitBy, Array<string>> = {
  "none": ["all"],
  "install-source": ["Meta ad click", "Google ad click", "organic / direct"],
  "shopify-plus": ["yes", "no"],
};

const seriesKeyFor = (params: {
  shop: ShopWithRevenue;
  splitBy: ChurnSplitBy;
}): string => {
  const { shop, splitBy } = params;
  if (splitBy === "none") {
    return "all";
  }
  if (splitBy === "install-source") {
    return installSource(shop);
  }
  return yesNo(shop.shopifyPlus);
};

export type ChurnDistributionResult = {
  data: Array<ChurnDistributionPoint>;
  series: Array<ChurnDistributionSeries>;
};

export const computeChurnDistribution = (params: {
  shops: Array<ShopWithRevenue>;
  splitBy?: ChurnSplitBy;
}): ChurnDistributionResult => {
  const splitBy = params.splitBy ?? "none";
  const seriesOrder = ORDER_FOR_SPLIT[splitBy];

  const buckets = new Map<string, ChurnDistributionPoint>();
  for (const bucket of CHURN_BUCKETS) {
    const point: ChurnDistributionPoint = { bucket: bucket.label };
    for (const key of seriesOrder) {
      point[key] = 0;
    }
    buckets.set(bucket.label, point);
  }

  const totals = new Map<string, number>();
  const observedKeys = new Set<string>();

  for (const shop of params.shops) {
    const days = installToUninstallDays(shop);
    if (days === null || days < 0) {
      continue;
    }
    const bucket = CHURN_BUCKETS.find((b) => {
      return days >= b.min && (b.max === null || days < b.max);
    });
    if (!bucket) {
      continue;
    }
    const point = buckets.get(bucket.label);
    if (!point) {
      continue;
    }

    const seriesKey = seriesKeyFor({ shop, splitBy });
    observedKeys.add(seriesKey);
    point[seriesKey] = ((point[seriesKey] as number | undefined) ?? 0) + 1;
    totals.set(seriesKey, (totals.get(seriesKey) ?? 0) + 1);
  }

  const orderedKeys = Array.from(
    new Set([...seriesOrder, ...Array.from(observedKeys)]),
  );

  for (const point of buckets.values()) {
    for (const key of orderedKeys) {
      if (point[key] === undefined) {
        point[key] = 0;
      }
    }
  }

  const series: Array<ChurnDistributionSeries> = orderedKeys.map((key) => {
    return {
      key,
      label: key,
      total: totals.get(key) ?? 0,
    };
  });

  return {
    data: Array.from(buckets.values()),
    series,
  };
};

export type ChurnTypeBreakdown = {
  neverActivated: number;
  gotValue: number;
  total: number;
};

export const computeChurnTypeBreakdown = (
  shops: Array<ShopWithRevenue>,
): ChurnTypeBreakdown => {
  const churned = shops.filter((s) => {
    return !s.isInstalled && s.uninstalledAt !== null;
  });

  let neverActivated = 0;
  let gotValue = 0;
  for (const shop of churned) {
    if (shop.originPixelAddedAt === null && shop.revenue90d === 0) {
      neverActivated += 1;
    } else {
      gotValue += 1;
    }
  }

  return {
    neverActivated,
    gotValue,
    total: churned.length,
  };
};

export type AcquisitionRow = {
  source: string;
  installs: number;
  paying: number;
  champions: number;
  payingRate: number;
  championRate: number;
};

export const computeAcquisitionBreakdown = (
  shops: Array<ShopProfile>,
  withRevenue: Array<ShopWithRevenue>,
): Array<AcquisitionRow> => {
  const championIds = new Set(
    withRevenue.filter(isChampion).map((s) => s.shop),
  );
  const counts = new Map<
    string,
    { installs: number; paying: number; champions: number }
  >();

  for (const shop of shops) {
    const source = installSource(shop);
    const entry = counts.get(source) ?? {
      installs: 0,
      paying: 0,
      champions: 0,
    };
    entry.installs += 1;
    if (shop.isPaying) {
      entry.paying += 1;
    }
    if (championIds.has(shop.shop)) {
      entry.champions += 1;
    }
    counts.set(source, entry);
  }

  return Array.from(counts.entries())
    .map(([source, entry]) => {
      return {
        source,
        installs: entry.installs,
        paying: entry.paying,
        champions: entry.champions,
        payingRate: entry.installs > 0 ? entry.paying / entry.installs : 0,
        championRate: entry.installs > 0 ? entry.champions / entry.installs : 0,
      };
    })
    .sort((a, b) => b.installs - a.installs);
};
