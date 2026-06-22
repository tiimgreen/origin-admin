import { cache } from "react";

import { supabase } from "@/lib/supabase";

import { monthKey } from "./dates";

export type ShopActivityRow = {
  shop: string;
  sessions14d: number;
  sessions30d: number;
  lastSeenAt: string | null;
};

export const ACTIVE_SESSION_WINDOW_DAYS = 14;
export const SUPER_ACTIVE_SESSION_THRESHOLD = 3;
export const ENGAGEMENT_WINDOW_DAYS = 30;
export const MONTHLY_ACTIVITY_WINDOW_MONTHS = 18;

const PAGE_SIZE = 1000;

const subtractDaysIso = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
};

const subtractMonthsIso = (months: number) => {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString();
};

// A session belongs to a shop via shop_users.shop. Build the lookup once and
// reuse it for every session-based fetcher in this module.
const getShopUserMap = cache(async (): Promise<Map<number, string>> => {
  const map = new Map<number, string>();
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: shopUsers, error: shopUsersError } = await supabase
      .from("shop_users")
      .select(`
        id,
        shop
      `)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (shopUsersError) {
      console.error("Error fetching shop users", shopUsersError);
      throw shopUsersError;
    }

    for (const shopUser of shopUsers) {
      if (shopUser.shop) {
        map.set(shopUser.id, shopUser.shop);
      }
    }

    hasMore = shopUsers.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return map;
});

type RawSession = {
  shop_user_id: number;
  started_at: string;
  last_seen_at: string;
};

const fetchSessionsSince = async (
  sinceIso: string,
): Promise<Array<RawSession>> => {
  const sessions: Array<RawSession> = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: page, error: sessionsError } = await supabase
      .from("shop_user_sessions")
      .select(`
        shop_user_id,
        started_at,
        last_seen_at
      `)
      .gte("started_at", sinceIso)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (sessionsError) {
      console.error("Error fetching shop user sessions", sessionsError);
      throw sessionsError;
    }

    sessions.push(...page);

    hasMore = page.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return sessions;
};

export const getShopActivity = cache(
  async (): Promise<Array<ShopActivityRow>> => {
    const [userMap, sessions] = await Promise.all([
      getShopUserMap(),
      fetchSessionsSince(subtractDaysIso(ENGAGEMENT_WINDOW_DAYS)),
    ]);

    const cutoff14 = Date.now() - ACTIVE_SESSION_WINDOW_DAYS * 86400000;

    type Agg = { sessions14d: number; sessions30d: number; lastSeen: number };
    const byShop = new Map<string, Agg>();

    for (const session of sessions) {
      const shop = userMap.get(session.shop_user_id);
      if (!shop) {
        continue;
      }

      const startedMs = new Date(session.started_at).getTime();
      const lastSeenMs = new Date(session.last_seen_at).getTime();

      const agg = byShop.get(shop) ?? {
        sessions14d: 0,
        sessions30d: 0,
        lastSeen: 0,
      };
      agg.sessions30d += 1;
      if (startedMs >= cutoff14) {
        agg.sessions14d += 1;
      }
      if (lastSeenMs > agg.lastSeen) {
        agg.lastSeen = lastSeenMs;
      }
      byShop.set(shop, agg);
    }

    return Array.from(byShop.entries()).map(([shop, agg]) => {
      return {
        shop,
        sessions14d: agg.sessions14d,
        sessions30d: agg.sessions30d,
        lastSeenAt: agg.lastSeen > 0 ? new Date(agg.lastSeen).toISOString() : null,
      };
    });
  },
);

type ActivityCheckable = {
  firstPaidAt: string | null;
  lastSeenAt: string | null;
  sessions14d: number;
};

const isPostSubscribe = (shop: ActivityCheckable): boolean => {
  if (!shop.firstPaidAt || !shop.lastSeenAt) {
    return false;
  }
  return new Date(shop.lastSeenAt).getTime() >= new Date(shop.firstPaidAt).getTime();
};

export const isActive = (shop: ActivityCheckable): boolean => {
  if (shop.sessions14d <= 0) {
    return false;
  }
  return isPostSubscribe(shop);
};

export const isSuperActive = (shop: ActivityCheckable): boolean => {
  if (shop.sessions14d < SUPER_ACTIVE_SESSION_THRESHOLD) {
    return false;
  }
  return isPostSubscribe(shop);
};

export type ShopMonthlyActivity = {
  shop: string;
  activeMonths: Set<string>;
  superActiveMonths: Set<string>;
  sessionsByMonth: Map<string, number>;
};

export const getShopMonthlyActivity = cache(
  async (): Promise<Array<ShopMonthlyActivity>> => {
    const [userMap, sessions] = await Promise.all([
      getShopUserMap(),
      fetchSessionsSince(subtractMonthsIso(MONTHLY_ACTIVITY_WINDOW_MONTHS)),
    ]);

    const countsByShop = new Map<string, Map<string, number>>();

    for (const session of sessions) {
      const shop = userMap.get(session.shop_user_id);
      if (!shop) {
        continue;
      }

      const month = monthKey(new Date(session.started_at));
      const months = countsByShop.get(shop) ?? new Map<string, number>();
      months.set(month, (months.get(month) ?? 0) + 1);
      countsByShop.set(shop, months);
    }

    return Array.from(countsByShop.entries()).map(([shop, sessionsByMonth]) => {
      const activeMonths = new Set<string>();
      const superActiveMonths = new Set<string>();

      for (const [month, count] of sessionsByMonth) {
        if (count > 0) {
          activeMonths.add(month);
        }
        if (count >= SUPER_ACTIVE_SESSION_THRESHOLD) {
          superActiveMonths.add(month);
        }
      }

      return { shop, activeMonths, superActiveMonths, sessionsByMonth };
    });
  },
);
