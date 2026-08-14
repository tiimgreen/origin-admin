import { cache } from "react";

import { supabase } from "@/lib/supabase";

import { toUsd } from "./currencies";
import { monthKey } from "./dates";

const MONTH_MS = 86_400_000 * 30.4375;

export type ShopCurrentPlan = {
  subscriptionId: number;
  planKey: string;
  price: number;
  status: string;
  activatedAt: string | null;
};

export type ShopDetail = {
  shop: string;
  name: string | null;
  currency: string;
  isInstalled: boolean;
  initialInstalledAt: string | null;
  uninstalledAt: string | null;
  shopifyPlanName: string | null;
  shopifyPlus: boolean;
  isPartnerDev: boolean;
  vertical: string | null;
  currentPlan: ShopCurrentPlan | null;
  firstPaidAt: string | null;
  // Estimated lifetime subscription revenue: months active × monthly price,
  // summed across every paid subscription the shop has held.
  ltv: number;
};

type RawShopData = {
  plan?: {
    displayName?: string;
    shopifyPlus?: boolean;
    partnerDevelopment?: boolean;
  };
};

const parseShopData = (raw: unknown): RawShopData | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return raw as RawShopData;
};

type RawSubscription = {
  id: number;
  plan_key: string;
  price: number | null;
  status: string;
  activated_at: string | null;
  deactivated_at: string | null;
  current_period_end: string | null;
};

export const estimateLtv = (subscriptions: Array<RawSubscription>): number => {
  let total = 0;

  for (const sub of subscriptions) {
    const price = sub.price ?? 0;
    if (price <= 0 || !sub.activated_at) {
      continue;
    }

    const startMs = new Date(sub.activated_at).getTime();
    const endIso =
      sub.deactivated_at ??
      (sub.status === "CANCELLED" ? sub.current_period_end : null);
    const endMs = endIso ? new Date(endIso).getTime() : Date.now();

    const months = Math.max(0, (endMs - startMs) / MONTH_MS);
    total += price * months;
  }

  return total;
};

export const getShopDetail = cache(
  async ({ shop }: { shop: string }): Promise<ShopDetail | null> => {
    const shopPromise = supabase
      .from("shops")
      .select(`
        shop,
        name,
        currency_code,
        isInstalled,
        initialInstalledAt,
        uninstalled_at,
        plan_public_display_name,
        shopify_plus,
        is_partner_development_plan,
        vertical,
        shopData,
        currently_active_subscription_id
      `)
      .eq("shop", shop);

    const subscriptionsPromise = supabase
      .from("subscriptions")
      .select(`
        id,
        plan_key,
        price,
        status,
        activated_at,
        deactivated_at,
        current_period_end
      `)
      .eq("shop", shop);

    const [
      { data: shops, error: shopsError },
      { data: subscriptions, error: subscriptionsError },
    ] = await Promise.all([shopPromise, subscriptionsPromise]);

    if (shopsError) {
      console.error("Error fetching shop", shopsError);
      throw shopsError;
    }
    if (subscriptionsError) {
      console.error("Error fetching subscriptions", subscriptionsError);
      throw subscriptionsError;
    }

    if (shops.length === 0) {
      return null;
    }

    const row = shops[0];
    const shopData = parseShopData(row.shopData);

    const activeSub = row.currently_active_subscription_id
      ? subscriptions.find((s) => s.id === row.currently_active_subscription_id)
      : null;

    let firstPaidAt: string | null = null;
    for (const sub of subscriptions) {
      if (sub.activated_at && (sub.price ?? 0) > 0) {
        if (!firstPaidAt || sub.activated_at < firstPaidAt) {
          firstPaidAt = sub.activated_at;
        }
      }
    }

    return {
      shop: row.shop,
      name: row.name ?? null,
      currency: row.currency_code,
      isInstalled: row.isInstalled === true,
      initialInstalledAt: row.initialInstalledAt,
      uninstalledAt: row.uninstalled_at,
      shopifyPlanName:
        row.plan_public_display_name ?? shopData?.plan?.displayName ?? null,
      shopifyPlus: row.shopify_plus ?? shopData?.plan?.shopifyPlus === true,
      isPartnerDev:
        row.is_partner_development_plan ??
        shopData?.plan?.partnerDevelopment === true,
      vertical: row.vertical,
      currentPlan: activeSub
        ? {
            subscriptionId: activeSub.id,
            planKey: activeSub.plan_key,
            price: activeSub.price ?? 0,
            status: activeSub.status,
            activatedAt: activeSub.activated_at,
          }
        : null,
      firstPaidAt,
      ltv: estimateLtv(subscriptions),
    };
  },
);

// Flags the main app understands (see FeatureFlags in lib/supabase.ts). Shown
// even when no record exists yet so any of them can be switched on.
export const KNOWN_FEATURE_FLAGS = [
  "csv_export",
  "facebook_link",
  "advanced_event_tracking",
  "multi_touch_attribution_models",
];

export type FeatureFlagState = {
  name: string;
  active: boolean;
};

export const getShopFeatureFlags = cache(
  async ({
    subscriptionId,
  }: {
    subscriptionId: number;
  }): Promise<Array<FeatureFlagState>> => {
    const { data: records, error: recordsError } = await supabase
      .from("feature_flag_records")
      .select(`
        name,
        active
      `)
      .eq("subscription_id", subscriptionId);

    if (recordsError) {
      console.error("Error fetching feature flag records", recordsError);
      throw recordsError;
    }

    const byName = new Map(records.map((r) => [r.name, r.active]));

    const names: Array<string> = [];
    for (const record of records) {
      if (!names.includes(record.name)) {
        names.push(record.name);
      }
    }

    return names.map((name) => {
      return {
        name,
        active: byName.get(name) === true,
      };
    });
  },
);

export type MonthlyFinancialsPoint = {
  monthKey: string;
  revenue: number;
  adSpend: number;
};

const FINANCIALS_WINDOW_MONTHS = 12;

const lastNMonthKeys = (count: number): Array<string> => {
  const now = new Date();
  const keys: Array<string> = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(
      monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))),
    );
  }
  return keys;
};

export const getShopMonthlyFinancials = cache(
  async ({ shop }: { shop: string }): Promise<Array<MonthlyFinancialsPoint>> => {
    const now = new Date();
    const windowStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - (FINANCIALS_WINDOW_MONTHS - 1),
        1,
      ),
    );

    const { data: rows, error: metricsError } = await supabase
      .from("shop_performance_metrics")
      .select(`
        month,
        revenue,
        ad_spend,
        currency_code
      `)
      .eq("shop", shop)
      .gte("month", windowStart.toISOString().slice(0, 10));

    if (metricsError) {
      console.error("Error fetching shop performance metrics", metricsError);
      throw metricsError;
    }

    const byMonth = new Map<string, { revenue: number; adSpend: number }>();
    for (const row of rows) {
      byMonth.set(row.month.slice(0, 7), {
        revenue: toUsd(row.revenue, row.currency_code),
        adSpend: toUsd(row.ad_spend, row.currency_code),
      });
    }

    return lastNMonthKeys(FINANCIALS_WINDOW_MONTHS).map((key) => {
      const entry = byMonth.get(key);
      return {
        monthKey: key,
        revenue: entry?.revenue ?? 0,
        adSpend: entry?.adSpend ?? 0,
      };
    });
  },
);
