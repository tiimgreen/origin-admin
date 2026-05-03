import { cache } from "react";

import {
  getShopMonthlyActivity,
  type ShopMonthlyActivity,
} from "./activity";
import { monthKey } from "./dates";
import { getShopProfiles, type ShopProfile } from "./insights";

const COHORT_MONTHS = 18;
const RETENTION_HORIZON = 12;

export type CohortMetric = "active" | "super-active";

export type CohortSplit = "none" | "orders-at-install" | "acquisition-source";

export type CohortRetentionPoint = {
  monthsSinceInstall: number;
  [series: string]: number | null;
};

export type CohortRetentionSeries = {
  key: string;
  label: string;
  cohortSize: number;
};

export type CohortRetentionResult = {
  series: Array<CohortRetentionSeries>;
  data: Array<CohortRetentionPoint>;
};

const ordersAtInstallBucket = (count: number | null) => {
  if (count === null) {
    return "unknown";
  }
  if (count === 0) {
    return "0 orders";
  }
  if (count < 100) {
    return "1–99 orders";
  }
  if (count < 1_000) {
    return "100–999 orders";
  }
  if (count < 10_000) {
    return "1k–10k orders";
  }
  return "10k+ orders";
};

const ORDERS_BUCKET_ORDER = [
  "0 orders",
  "1–99 orders",
  "100–999 orders",
  "1k–10k orders",
  "10k+ orders",
  "unknown",
];

const acquisitionSource = (shop: ShopProfile) => {
  if (shop.installFbclid) {
    return "Meta ad click";
  }
  if (shop.installGclid) {
    return "Google ad click";
  }
  return "Organic / direct";
};

const ACQUISITION_ORDER = ["Meta ad click", "Google ad click", "Organic / direct"];

const monthsBetween = (fromKey: string, toKey: string) => {
  const [fy, fm] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

const addMonths = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return monthKey(d);
};

const formatCohortLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

type ClassifyResult = {
  key: string;
  label: string;
  order: number;
};

const classifyShop = (params: {
  shop: ShopProfile;
  split: CohortSplit;
  cohortKey: string;
}): ClassifyResult | null => {
  if (params.split === "none") {
    return {
      key: params.cohortKey,
      label: formatCohortLabel(params.cohortKey),
      order: -monthsBetween("1970-01", params.cohortKey),
    };
  }
  if (params.split === "orders-at-install") {
    const bucket = ordersAtInstallBucket(params.shop.orderCountAtInstall);
    return {
      key: bucket,
      label: bucket,
      order: ORDERS_BUCKET_ORDER.indexOf(bucket),
    };
  }
  const source = acquisitionSource(params.shop);
  return {
    key: source,
    label: source,
    order: ACQUISITION_ORDER.indexOf(source),
  };
};

export const computeCohortRetention = (params: {
  shops: Array<ShopProfile>;
  monthlyActivity: Array<ShopMonthlyActivity>;
  split: CohortSplit;
  metric: CohortMetric;
}): CohortRetentionResult => {
  const todayKey = monthKey(new Date());
  const earliestCohort = addMonths(todayKey, -(COHORT_MONTHS - 1));

  const activeMonthsByShop = new Map(
    params.monthlyActivity.map((a) => {
      return [
        a.shop,
        params.metric === "super-active" ? a.superActiveMonths : a.activeMonths,
      ];
    }),
  );

  type Bucket = {
    label: string;
    order: number;
    totals: Array<number>;
    retained: Array<number>;
    cohortSize: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const shop of params.shops) {
    if (!shop.initialInstalledAt) {
      continue;
    }
    const installKey = monthKey(new Date(shop.initialInstalledAt));
    if (installKey < earliestCohort) {
      continue;
    }

    const classification = classifyShop({
      shop,
      split: params.split,
      cohortKey: installKey,
    });
    if (!classification) {
      continue;
    }

    const bucket = buckets.get(classification.key) ?? {
      label: classification.label,
      order: classification.order,
      totals: Array.from({ length: RETENTION_HORIZON + 1 }, () => 0),
      retained: Array.from({ length: RETENTION_HORIZON + 1 }, () => 0),
      cohortSize: 0,
    };

    bucket.cohortSize += 1;

    const monthsObserved = monthsBetween(installKey, todayKey);
    const horizon = Math.min(RETENTION_HORIZON, monthsObserved);
    const activeMonths = activeMonthsByShop.get(shop.shop);

    for (let k = 0; k <= horizon; k++) {
      bucket.totals[k] += 1;
      const targetMonth = addMonths(installKey, k);
      if (activeMonths && activeMonths.has(targetMonth)) {
        bucket.retained[k] += 1;
      }
    }

    buckets.set(classification.key, bucket);
  }

  const seriesEntries = Array.from(buckets.entries())
    .sort((a, b) => a[1].order - b[1].order);

  const series: Array<CohortRetentionSeries> = seriesEntries.map(([key, bucket]) => {
    return {
      key,
      label: bucket.label,
      cohortSize: bucket.cohortSize,
    };
  });

  const data: Array<CohortRetentionPoint> = [];
  for (let k = 0; k <= RETENTION_HORIZON; k++) {
    const point: CohortRetentionPoint = { monthsSinceInstall: k };
    for (const [key, bucket] of seriesEntries) {
      const total = bucket.totals[k];
      point[key] = total > 0 ? bucket.retained[k] / total : null;
    }
    data.push(point);
  }

  return { series, data };
};

export const getCohortRetention = cache(
  async (params: {
    split: CohortSplit;
    metric: CohortMetric;
  }): Promise<CohortRetentionResult> => {
    const [shops, monthlyActivity] = await Promise.all([
      getShopProfiles(),
      getShopMonthlyActivity(),
    ]);
    return computeCohortRetention({
      shops,
      monthlyActivity,
      split: params.split,
      metric: params.metric,
    });
  },
);
