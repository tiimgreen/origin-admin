import { cache } from "react";

import { supabase } from "@/lib/supabase";

export type ShopActivityRow = {
  shop: string;
  sessions30d: number;
  lastSeenAt: string | null;
};

export const ACTIVITY_WINDOW_DAYS = 30;

const PAGE_SIZE = 1000;

const subtractDaysIso = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
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

// Trailing 12 weeks — the window the ICP "avg ≥1 session per week" rule is
// evaluated over.
export const ICP_SESSION_WINDOW_DAYS = 84;

export const getShopSessionCounts = cache(
  async (): Promise<Map<string, number>> => {
    const [userMap, sessions] = await Promise.all([
      getShopUserMap(),
      fetchSessionsSince(subtractDaysIso(ICP_SESSION_WINDOW_DAYS)),
    ]);

    const counts = new Map<string, number>();

    for (const session of sessions) {
      const shop = userMap.get(session.shop_user_id);
      if (!shop) {
        continue;
      }

      counts.set(shop, (counts.get(shop) ?? 0) + 1);
    }

    return counts;
  },
);

export const getShopActivity = cache(
  async (): Promise<Array<ShopActivityRow>> => {
    const [userMap, sessions] = await Promise.all([
      getShopUserMap(),
      fetchSessionsSince(subtractDaysIso(ACTIVITY_WINDOW_DAYS)),
    ]);

    type Agg = { sessions30d: number; lastSeen: number };
    const byShop = new Map<string, Agg>();

    for (const session of sessions) {
      const shop = userMap.get(session.shop_user_id);
      if (!shop) {
        continue;
      }

      const lastSeenMs = new Date(session.last_seen_at).getTime();

      const agg = byShop.get(shop) ?? { sessions30d: 0, lastSeen: 0 };
      agg.sessions30d += 1;
      if (lastSeenMs > agg.lastSeen) {
        agg.lastSeen = lastSeenMs;
      }
      byShop.set(shop, agg);
    }

    return Array.from(byShop.entries()).map(([shop, agg]) => {
      return {
        shop,
        sessions30d: agg.sessions30d,
        lastSeenAt: agg.lastSeen > 0 ? new Date(agg.lastSeen).toISOString() : null,
      };
    });
  },
);
