import { cache } from "react";

import { posthogHogQLQueryAll } from "@/lib/posthog";

export type ShopActivityRow = {
  shop: string;
  pageviews14d: number;
  reportPageviews14d: number;
  pageviews30d: number;
  lastSeenAt: string | null;
};

type RawActivityRow = [string, number, number, number, string | null];

export const ACTIVE_PAGEVIEW_WINDOW_DAYS = 14;
export const SUPER_ACTIVE_PAGEVIEW_THRESHOLD = 3;
export const LEGACY_ENGAGEMENT_WINDOW_DAYS = 30;
export const MONTHLY_ACTIVITY_WINDOW_MONTHS = 18;

const NON_REPORT_PATH_FILTER = `(properties.$pathname LIKE '/settings%' OR properties.$pathname LIKE '/utm-notepad%')`;

export const getShopActivity = cache(
  async (): Promise<Array<ShopActivityRow>> => {
    const query = `
      SELECT
        distinct_id,
        countIf(timestamp >= now() - INTERVAL ${ACTIVE_PAGEVIEW_WINDOW_DAYS} DAY) AS pv14,
        countIf(
          timestamp >= now() - INTERVAL ${ACTIVE_PAGEVIEW_WINDOW_DAYS} DAY
          AND NOT ${NON_REPORT_PATH_FILTER}
        ) AS report_pv14,
        count() AS pv30,
        max(timestamp) AS last_seen
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - INTERVAL ${LEGACY_ENGAGEMENT_WINDOW_DAYS} DAY
      GROUP BY distinct_id
      ORDER BY distinct_id
    `;

    const rows = await posthogHogQLQueryAll<RawActivityRow>({ query });

    return rows
      .filter(([distinctId]) => {
        return typeof distinctId === "string" && distinctId.includes(".myshopify.com");
      })
      .map(([distinctId, pv14, reportPv14, pv30, lastSeen]) => {
        return {
          shop: distinctId,
          pageviews14d: Number(pv14) || 0,
          reportPageviews14d: Number(reportPv14) || 0,
          pageviews30d: Number(pv30) || 0,
          lastSeenAt: lastSeen ?? null,
        };
      });
  },
);

type ActivityCheckable = {
  firstPaidAt: string | null;
  lastSeenAt: string | null;
  pageviews14d: number;
  reportPageviews14d: number;
};

const isPostSubscribe = (shop: ActivityCheckable): boolean => {
  if (!shop.firstPaidAt || !shop.lastSeenAt) {
    return false;
  }
  return new Date(shop.lastSeenAt).getTime() >= new Date(shop.firstPaidAt).getTime();
};

export const isActive = (shop: ActivityCheckable): boolean => {
  if (shop.pageviews14d <= 0) {
    return false;
  }
  return isPostSubscribe(shop);
};

export const isSuperActive = (shop: ActivityCheckable): boolean => {
  if (shop.reportPageviews14d < SUPER_ACTIVE_PAGEVIEW_THRESHOLD) {
    return false;
  }
  return isPostSubscribe(shop);
};

export type ShopMonthlyActivity = {
  shop: string;
  activeMonths: Set<string>;
  superActiveMonths: Set<string>;
};

type RawMonthlyActivityRow = [string, string, number, number];

export const getShopMonthlyActivity = cache(
  async (): Promise<Array<ShopMonthlyActivity>> => {
    const query = `
      SELECT
        distinct_id,
        formatDateTime(toStartOfMonth(timestamp), '%Y-%m') AS month,
        count() AS pv,
        countIf(NOT ${NON_REPORT_PATH_FILTER}) AS report_pv
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - INTERVAL ${MONTHLY_ACTIVITY_WINDOW_MONTHS} MONTH
      GROUP BY distinct_id, month
      ORDER BY distinct_id, month
    `;

    const rows = await posthogHogQLQueryAll<RawMonthlyActivityRow>({ query });

    type Bucket = { active: Set<string>; superActive: Set<string> };
    const byShop = new Map<string, Bucket>();

    for (const [distinctId, month, pv, reportPv] of rows) {
      if (typeof distinctId !== "string" || !distinctId.includes(".myshopify.com")) {
        continue;
      }
      const bucket = byShop.get(distinctId) ?? {
        active: new Set<string>(),
        superActive: new Set<string>(),
      };
      if (Number(pv) > 0) {
        bucket.active.add(month);
      }
      if (Number(reportPv) >= SUPER_ACTIVE_PAGEVIEW_THRESHOLD) {
        bucket.superActive.add(month);
      }
      byShop.set(distinctId, bucket);
    }

    return Array.from(byShop.entries()).map(([shop, bucket]) => {
      return {
        shop,
        activeMonths: bucket.active,
        superActiveMonths: bucket.superActive,
      };
    });
  },
);
