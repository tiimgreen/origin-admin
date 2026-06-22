import { cache } from "react";

import { supabase } from "@/lib/supabase";
import { tinybirdQuery } from "@/lib/tinybird";

import { isoDate, subtractDays } from "./dates";

export type ShopBasic = {
  shop: string;
  name: string | null;
  currency: string;
  isInstalled: boolean;
  initialInstalledAt: string | null;
  uninstalledAt: string | null;
};

const SHOP_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export const getShopBasic = cache(
  async ({ shop }: { shop: string }): Promise<ShopBasic | null> => {
    const { data: shops, error: shopsError } = await supabase
      .from("shops")
      .select(`
        shop,
        name,
        currency_code,
        isInstalled,
        initialInstalledAt,
        uninstalled_at
      `)
      .eq("shop", shop);

    if (shopsError) {
      console.error("Error fetching shop", shopsError);
      throw shopsError;
    }

    if (shops.length === 0) {
      return null;
    }

    const row = shops[0];

    return {
      shop: row.shop,
      name: row.name ?? null,
      currency: row.currency_code,
      isInstalled: row.isInstalled === true,
      initialInstalledAt: row.initialInstalledAt,
      uninstalledAt: row.uninstalled_at,
    };
  },
);

export type TrackingTrendPoint = {
  date: string;
  orders: number;
  originRate: number;
  shopifyRate: number;
};

type RawTrackingRow = {
  day: string;
  orders: string | number;
  origin_orders: string | number;
  shopify_orders: string | number;
};

const TRACKING_WINDOW_DAYS = 30;

export const getShopTrackingTrend = cache(
  async ({ shop }: { shop: string }): Promise<Array<TrackingTrendPoint>> => {
    if (!SHOP_PATTERN.test(shop)) {
      return [];
    }

    const sql = `
      SELECT
        toDate(order_dt) AS day,
        count() AS orders,
        countIf(origin = 1) AS origin_orders,
        countIf(shopify = 1) AS shopify_orders
      FROM (
        SELECT
          id,
          min(order_created_at) AS order_dt,
          argMax(tracked_by_origin, updated_at) AS origin,
          argMax(tracked_by_shopify, updated_at) AS shopify,
          argMax(_is_deleted, updated_at) AS del,
          argMax(is_visible, updated_at) AS vis
        FROM orders
        WHERE shop = '${shop}'
          AND order_created_at >= today() - INTERVAL ${TRACKING_WINDOW_DAYS - 1} DAY
        GROUP BY id
      ) deduped
      WHERE del = 0 AND vis = 1
      GROUP BY day
      ORDER BY day
      FORMAT JSON
    `;

    const result = await tinybirdQuery<Array<RawTrackingRow>>({ q: sql });

    const byDay = new Map<string, RawTrackingRow>();
    for (const row of result.data) {
      byDay.set(row.day, row);
    }

    const today = new Date();
    const points: Array<TrackingTrendPoint> = [];

    for (let i = TRACKING_WINDOW_DAYS - 1; i >= 0; i--) {
      const date = isoDate(subtractDays(today, i));
      const row = byDay.get(date);
      const orders = row ? Number(row.orders) || 0 : 0;
      const originOrders = row ? Number(row.origin_orders) || 0 : 0;
      const shopifyOrders = row ? Number(row.shopify_orders) || 0 : 0;

      points.push({
        date,
        orders,
        originRate: orders > 0 ? originOrders / orders : 0,
        shopifyRate: orders > 0 ? shopifyOrders / orders : 0,
      });
    }

    return points;
  },
);
