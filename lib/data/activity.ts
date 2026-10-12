import { cache } from "react";

import { supabase } from "@/lib/supabase";

import { isoDate, startOfDayUtc, subtractDays } from "./dates";
import type { DailySessionsPoint } from "./shop-users";

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

type ShopUserInfo = {
  shop: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

// A session belongs to a shop via shop_users.shop. Build the lookup once and
// reuse it for every session-based fetcher in this module.
const getShopUserMap = cache(async (): Promise<Map<number, ShopUserInfo>> => {
  const map = new Map<number, ShopUserInfo>();
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: shopUsers, error: shopUsersError } = await supabase
      .from("shop_users")
      .select(`
        id,
        shop,
        first_name,
        last_name,
        email
      `)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (shopUsersError) {
      console.error("Error fetching shop users", shopUsersError);
      throw shopUsersError;
    }

    for (const shopUser of shopUsers) {
      if (shopUser.shop) {
        map.set(shopUser.id, {
          shop: shopUser.shop,
          firstName: shopUser.first_name,
          lastName: shopUser.last_name,
          email: shopUser.email,
        });
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
      const shop = userMap.get(session.shop_user_id)?.shop;
      if (!shop) {
        continue;
      }

      counts.set(shop, (counts.get(shop) ?? 0) + 1);
    }

    return counts;
  },
);

export type ActiveUserRow = {
  id: number;
  shop: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  sessions: number;
};

export type ActiveShopRow = {
  shop: string;
  sessions: number;
};

export type SessionActivity = {
  // One point per calendar day (UTC) for the last `days` days, oldest first.
  daily: Array<DailySessionsPoint>;
  topUsers: Array<ActiveUserRow>;
  topShops: Array<ActiveShopRow>;
};

const TOP_LIMIT = 10;

export const getSessionActivity = cache(
  async ({ days }: { days: number }): Promise<SessionActivity> => {
    const today = startOfDayUtc(new Date());
    const start = subtractDays(today, days - 1);

    const [userMap, sessions] = await Promise.all([
      getShopUserMap(),
      fetchSessionsSince(start.toISOString()),
    ]);

    const sessionsByDay = new Map<string, number>();
    const sessionsByUser = new Map<number, number>();
    const sessionsByShop = new Map<string, number>();

    for (const session of sessions) {
      const day = session.started_at.slice(0, 10);
      sessionsByDay.set(day, (sessionsByDay.get(day) ?? 0) + 1);

      const user = userMap.get(session.shop_user_id);
      if (!user) {
        continue;
      }

      sessionsByUser.set(
        session.shop_user_id,
        (sessionsByUser.get(session.shop_user_id) ?? 0) + 1,
      );
      sessionsByShop.set(user.shop, (sessionsByShop.get(user.shop) ?? 0) + 1);
    }

    const daily: Array<DailySessionsPoint> = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = isoDate(subtractDays(today, i));
      daily.push({ day, sessions: sessionsByDay.get(day) ?? 0 });
    }

    const topUsers = Array.from(sessionsByUser.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_LIMIT)
      .map(([id, count]) => {
        const user = userMap.get(id)!;
        return {
          id,
          shop: user.shop,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          sessions: count,
        };
      });

    const topShops = Array.from(sessionsByShop.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_LIMIT)
      .map(([shop, count]) => {
        return { shop, sessions: count };
      });

    return { daily, topUsers, topShops };
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
      const shop = userMap.get(session.shop_user_id)?.shop;
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
