import { cache } from "react";

import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 1000;
const DAY_MS = 86_400_000;

export type ShopUserListRow = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  accountOwner: boolean;
  lastActiveAt: string | null;
  sessions30d: number;
};

export type ShopUserSession = {
  id: string;
  startedAt: string;
  lastSeenAt: string;
  durationSeconds: number;
};

export type ShopUserDetail = {
  id: number;
  shop: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  accountOwner: boolean;
  collaborator: boolean;
  createdAt: string;
  sessions: Array<ShopUserSession>;
};

type RawSession = {
  id: string;
  shop_user_id: number;
  started_at: string;
  last_seen_at: string;
  duration_seconds: number;
};

const fetchSessionsForUsers = async ({
  userIds,
}: {
  userIds: Array<number>;
}): Promise<Array<RawSession>> => {
  const sessions: Array<RawSession> = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: page, error: sessionsError } = await supabase
      .from("shop_user_sessions")
      .select(`
        id,
        shop_user_id,
        started_at,
        last_seen_at,
        duration_seconds
      `)
      .in("shop_user_id", userIds)
      .order("started_at", { ascending: false })
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

export const getShopUsers = cache(
  async ({ shop }: { shop: string }): Promise<Array<ShopUserListRow>> => {
    const { data: shopUsers, error: shopUsersError } = await supabase
      .from("shop_users")
      .select(`
        id,
        first_name,
        last_name,
        email,
        account_owner
      `)
      .eq("shop", shop);

    if (shopUsersError) {
      console.error("Error fetching shop users", shopUsersError);
      throw shopUsersError;
    }

    if (shopUsers.length === 0) {
      return [];
    }

    const sessions = await fetchSessionsForUsers({
      userIds: shopUsers.map((user) => user.id),
    });

    const since30dMs = Date.now() - 30 * DAY_MS;

    type Agg = { sessions30d: number; lastSeenMs: number };
    const byUser = new Map<number, Agg>();

    for (const session of sessions) {
      const agg = byUser.get(session.shop_user_id) ?? {
        sessions30d: 0,
        lastSeenMs: 0,
      };

      if (new Date(session.started_at).getTime() >= since30dMs) {
        agg.sessions30d += 1;
      }

      const lastSeenMs = new Date(session.last_seen_at).getTime();
      if (lastSeenMs > agg.lastSeenMs) {
        agg.lastSeenMs = lastSeenMs;
      }

      byUser.set(session.shop_user_id, agg);
    }

    return shopUsers
      .map((user) => {
        const agg = byUser.get(user.id);
        return {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          accountOwner: user.account_owner,
          lastActiveAt:
            agg && agg.lastSeenMs > 0
              ? new Date(agg.lastSeenMs).toISOString()
              : null,
          sessions30d: agg?.sessions30d ?? 0,
        };
      })
      .sort((a, b) => {
        const aMs = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const bMs = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return bMs - aMs;
      });
  },
);

export const getShopUserDetail = cache(
  async ({ userId }: { userId: number }): Promise<ShopUserDetail | null> => {
    const { data: shopUsers, error: shopUsersError } = await supabase
      .from("shop_users")
      .select(`
        id,
        shop,
        first_name,
        last_name,
        email,
        account_owner,
        collaborator,
        created_at
      `)
      .eq("id", userId);

    if (shopUsersError) {
      console.error("Error fetching shop user", shopUsersError);
      throw shopUsersError;
    }

    if (shopUsers.length === 0) {
      return null;
    }

    const user = shopUsers[0];
    const sessions = await fetchSessionsForUsers({ userIds: [userId] });

    return {
      id: user.id,
      shop: user.shop,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      accountOwner: user.account_owner,
      collaborator: user.collaborator,
      createdAt: user.created_at,
      sessions: sessions.map((session) => {
        return {
          id: session.id,
          startedAt: session.started_at,
          lastSeenAt: session.last_seen_at,
          durationSeconds: session.duration_seconds,
        };
      }),
    };
  },
);
