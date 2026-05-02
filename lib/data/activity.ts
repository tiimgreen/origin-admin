import { cache } from "react";

import { posthogHogQLQuery } from "@/lib/posthog";

export type ShopActivityRow = {
  shop: string;
  pageviews30d: number;
  lastSeenAt: string | null;
};

type RawActivityRow = [string, number, string | null];

export const ACTIVE_PAGEVIEW_WINDOW_DAYS = 30;
export const MONTHLY_ACTIVITY_WINDOW_MONTHS = 18;

export const getShopActivity = cache(
  async (): Promise<Array<ShopActivityRow>> => {
    const query = `
      SELECT
        distinct_id,
        count() AS pageviews,
        max(timestamp) AS last_seen
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - INTERVAL ${ACTIVE_PAGEVIEW_WINDOW_DAYS} DAY
      GROUP BY distinct_id
    `;

    const result = await posthogHogQLQuery<Array<RawActivityRow>>({ query });

    return result.results
      .filter(([distinctId]) => {
        return typeof distinctId === "string" && distinctId.includes(".myshopify.com");
      })
      .map(([distinctId, pageviews, lastSeen]) => {
        return {
          shop: distinctId,
          pageviews30d: Number(pageviews) || 0,
          lastSeenAt: lastSeen ?? null,
        };
      });
  },
);

export type ShopMonthlyActivity = {
  shop: string;
  activeMonths: Set<string>;
};

type RawMonthlyActivityRow = [string, string];

export const getShopMonthlyActivity = cache(
  async (): Promise<Array<ShopMonthlyActivity>> => {
    const query = `
      SELECT
        distinct_id,
        formatDateTime(toStartOfMonth(timestamp), '%Y-%m') AS month
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - INTERVAL ${MONTHLY_ACTIVITY_WINDOW_MONTHS} MONTH
      GROUP BY distinct_id, month
    `;

    const result = await posthogHogQLQuery<Array<RawMonthlyActivityRow>>({ query });

    const byShop = new Map<string, Set<string>>();
    for (const [distinctId, month] of result.results) {
      if (typeof distinctId !== "string" || !distinctId.includes(".myshopify.com")) {
        continue;
      }
      const set = byShop.get(distinctId) ?? new Set<string>();
      set.add(month);
      byShop.set(distinctId, set);
    }

    return Array.from(byShop.entries()).map(([shop, activeMonths]) => {
      return { shop, activeMonths };
    });
  },
);
