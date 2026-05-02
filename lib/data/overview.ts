import { cache } from "react";

import { supabase } from "@/lib/supabase";
import { tinybirdQuery } from "@/lib/tinybird";

import { fxToUsdSql } from "./currencies";
import { isoDate, monthKey, subtractDays } from "./dates";

type RangeRow = {
  revenue: string | number;
  orders: string | number;
  origin_orders: string | number;
  origin_revenue: string | number;
};

const fetchOrdersForRange = async (params: {
  fromDate: string;
  toDate: string;
}) => {
  const sql = `
    SELECT
      sum(amount * ${fxToUsdSql("ccy")}) AS revenue,
      count() AS orders,
      countIf(tracked_by_origin = 1) AS origin_orders,
      sumIf(amount * ${fxToUsdSql("ccy")}, tracked_by_origin = 1) AS origin_revenue
    FROM (
      SELECT
        id,
        argMax(shop_money_order_amount, updated_at) AS amount,
        argMax(shop_money_currency_code, updated_at) AS ccy,
        argMax(tracked_by_origin, updated_at) AS tracked_by_origin,
        argMax(_is_deleted, updated_at) AS is_deleted,
        argMax(is_visible, updated_at) AS is_visible
      FROM orders
      WHERE order_created_at >= toDateTime64('${params.fromDate}', 3, 'UTC')
        AND order_created_at <  toDateTime64('${params.toDate}', 3, 'UTC')
      GROUP BY id
    ) deduped
    WHERE is_deleted = 0 AND is_visible = 1
    FORMAT JSON
  `;

  const result = await tinybirdQuery<Array<RangeRow>>({ q: sql });
  const row = result.data[0];

  return {
    revenue: row ? Number(row.revenue) || 0 : 0,
    orders: row ? Number(row.orders) || 0 : 0,
    originOrders: row ? Number(row.origin_orders) || 0 : 0,
    originRevenue: row ? Number(row.origin_revenue) || 0 : 0,
  };
};

export type RevenueTotals = {
  recentRevenue: number;
  recentOrders: number;
  recentMonths: number;
  last30Revenue: number;
  last30Orders: number;
  last30OriginOrders: number;
  last30OriginRevenue: number;
  prev30Revenue: number;
  prev30Orders: number;
  prev30OriginRevenue: number;
};

const RECENT_MONTHS = 18;

export const getRevenueTotals = cache(async (): Promise<RevenueTotals> => {
  const today = new Date();
  const last30Start = subtractDays(today, 30);
  const prev30Start = subtractDays(today, 60);
  const todayIso = isoDate(today);

  const [monthly, last30, prev30] = await Promise.all([
    getMonthlyRevenue(RECENT_MONTHS),
    fetchOrdersForRange({
      fromDate: isoDate(last30Start),
      toDate: todayIso,
    }),
    fetchOrdersForRange({
      fromDate: isoDate(prev30Start),
      toDate: isoDate(last30Start),
    }),
  ]);

  const recentRevenue = monthly.reduce((sum, m) => sum + m.revenue, 0);
  const recentOrders = monthly.reduce((sum, m) => sum + m.orders, 0);

  return {
    recentRevenue,
    recentOrders,
    recentMonths: RECENT_MONTHS,
    last30Revenue: last30.revenue,
    last30Orders: last30.orders,
    last30OriginOrders: last30.originOrders,
    last30OriginRevenue: last30.originRevenue,
    prev30Revenue: prev30.revenue,
    prev30Orders: prev30.orders,
    prev30OriginRevenue: prev30.originRevenue,
  };
});

export type MonthlyRevenuePoint = {
  monthKey: string;
  revenue: number;
  orders: number;
  originRevenue: number;
};

type MonthlyRow = {
  month: string;
  revenue: string | number;
  orders: string | number;
  origin_revenue: string | number;
};

export const getMonthlyRevenue = cache(
  async (months = 18): Promise<Array<MonthlyRevenuePoint>> => {
    const sql = `
      SELECT
        toStartOfMonth(order_dt) AS month,
        sum(amount * ${fxToUsdSql("ccy")}) AS revenue,
        count() AS orders,
        sumIf(amount * ${fxToUsdSql("ccy")}, tracked = 1) AS origin_revenue
      FROM (
        SELECT
          min(order_created_at) AS order_dt,
          argMax(shop_money_order_amount, updated_at) AS amount,
          argMax(shop_money_currency_code, updated_at) AS ccy,
          argMax(tracked_by_origin, updated_at) AS tracked,
          argMax(_is_deleted, updated_at) AS del,
          argMax(is_visible, updated_at) AS vis
        FROM orders
        WHERE order_created_at >= toStartOfMonth(today() - INTERVAL ${months} MONTH)
        GROUP BY id
      ) deduped
      WHERE del = 0 AND vis = 1
      GROUP BY month
      ORDER BY month
      FORMAT JSON
    `;

    const result = await tinybirdQuery<Array<MonthlyRow>>({ q: sql });

    return result.data.map((row) => {
      const date = new Date(row.month);
      return {
        monthKey: monthKey(date),
        revenue: Number(row.revenue) || 0,
        orders: Number(row.orders) || 0,
        originRevenue: Number(row.origin_revenue) || 0,
      };
    });
  },
);

export type ShopCounts = {
  total: number;
  installed: number;
  uninstalled: number;
  installedLast30: number;
  installedPrev30: number;
  paying: number;
  setupComplete: number;
};

export const getShopCounts = cache(async (): Promise<ShopCounts> => {
  const today = new Date();
  const last30Start = subtractDays(today, 30);
  const prev30Start = subtractDays(today, 60);

  const [
    totalRes,
    installedRes,
    uninstalledRes,
    installedLast30Res,
    installedPrev30Res,
    payingRes,
    setupCompleteRes,
  ] = await Promise.all([
    supabase.from("shops").select("*", { count: "exact", head: true }),
    supabase
      .from("shops")
      .select("*", { count: "exact", head: true })
      .eq("isInstalled", true),
    supabase
      .from("shops")
      .select("*", { count: "exact", head: true })
      .eq("isInstalled", false),
    supabase
      .from("shops")
      .select("*", { count: "exact", head: true })
      .eq("isInstalled", true)
      .gte("lastInstalledAt", last30Start.toISOString()),
    supabase
      .from("shops")
      .select("*", { count: "exact", head: true })
      .eq("isInstalled", true)
      .gte("lastInstalledAt", prev30Start.toISOString())
      .lt("lastInstalledAt", last30Start.toISOString()),
    supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
    supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("has_completed_setup", true),
  ]);

  for (const res of [
    totalRes,
    installedRes,
    uninstalledRes,
    installedLast30Res,
    installedPrev30Res,
    payingRes,
    setupCompleteRes,
  ]) {
    if (res.error) {
      console.error("Error fetching shop counts", res.error);
      throw res.error;
    }
  }

  return {
    total: totalRes.count ?? 0,
    installed: installedRes.count ?? 0,
    uninstalled: uninstalledRes.count ?? 0,
    installedLast30: installedLast30Res.count ?? 0,
    installedPrev30: installedPrev30Res.count ?? 0,
    paying: payingRes.count ?? 0,
    setupComplete: setupCompleteRes.count ?? 0,
  };
});

export type AdPlatformBreakdown = {
  platformKey: string;
  platformName: string;
  connectedShops: number;
  activeShops: number;
};

export const getAdPlatformBreakdown = cache(
  async (): Promise<Array<AdPlatformBreakdown>> => {
    const { data: connections, error: connectionsError } = await supabase
      .from("connected_platforms")
      .select(`
        shop,
        status,
        connectable_platform_id,
        connectable_platforms (
          key,
          name
        )
      `);

    if (connectionsError) {
      console.error("Error fetching connected platforms", connectionsError);
      throw connectionsError;
    }

    const byPlatform = new Map<
      string,
      { name: string; shops: Set<string>; activeShops: Set<string> }
    >();

    for (const conn of connections ?? []) {
      const platform = conn.connectable_platforms;
      if (!platform) {
        continue;
      }
      const entry = byPlatform.get(platform.key) ?? {
        name: platform.name,
        shops: new Set<string>(),
        activeShops: new Set<string>(),
      };
      entry.shops.add(conn.shop);
      if (conn.status === "OK") {
        entry.activeShops.add(conn.shop);
      }
      byPlatform.set(platform.key, entry);
    }

    return Array.from(byPlatform.entries())
      .map(([key, entry]) => {
        return {
          platformKey: key,
          platformName: entry.name,
          connectedShops: entry.shops.size,
          activeShops: entry.activeShops.size,
        };
      })
      .sort((a, b) => b.connectedShops - a.connectedShops);
  },
);

export type InstallTimelinePoint = {
  monthKey: string;
  installs: number;
  uninstalls: number;
};

export const getInstallTimeline = cache(
  async (months = 12): Promise<Array<InstallTimelinePoint>> => {
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
    cutoff.setUTCDate(1);
    cutoff.setUTCHours(0, 0, 0, 0);

    const [installsResult, uninstallsResult] = await Promise.all([
      supabase
        .from("shops")
        .select("initialInstalledAt")
        .gte("initialInstalledAt", cutoff.toISOString()),
      supabase
        .from("shops")
        .select("uninstalled_at")
        .gte("uninstalled_at", cutoff.toISOString()),
    ]);

    if (installsResult.error) {
      console.error("Error fetching installs", installsResult.error);
      throw installsResult.error;
    }
    if (uninstallsResult.error) {
      console.error("Error fetching uninstalls", uninstallsResult.error);
      throw uninstallsResult.error;
    }

    const buckets = new Map<string, InstallTimelinePoint>();

    for (let i = 0; i <= months; i++) {
      const d = new Date(cutoff);
      d.setUTCMonth(d.getUTCMonth() + i);
      const key = monthKey(d);
      buckets.set(key, { monthKey: key, installs: 0, uninstalls: 0 });
    }

    for (const row of installsResult.data ?? []) {
      if (!row.initialInstalledAt) {
        continue;
      }
      const key = monthKey(new Date(row.initialInstalledAt));
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.installs += 1;
      }
    }

    for (const row of uninstallsResult.data ?? []) {
      if (!row.uninstalled_at) {
        continue;
      }
      const key = monthKey(new Date(row.uninstalled_at));
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.uninstalls += 1;
      }
    }

    return Array.from(buckets.values());
  },
);
