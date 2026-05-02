import { cache } from "react";

import { supabase } from "@/lib/supabase";

export type SubscriptionEvent = {
  shop: string;
  type: "new" | "expansion" | "contraction" | "churn";
  at: Date;
  amount: number;
  fromPlan: string | null;
  toPlan: string | null;
  fromPrice: number;
  toPrice: number;
};

export type ShopJourney = {
  shop: string;
  firstPaidAt: Date | null;
  firstPlan: string | null;
  firstPrice: number;
  lastPlan: string | null;
  lastPrice: number;
  churnedAt: Date | null;
  upgradedAt: Date | null;
  events: Array<SubscriptionEvent>;
};

type RawSub = {
  id: number;
  shop: string;
  plan_key: string;
  price: number | null;
  status: string;
  activated_at: string | null;
  created_at: string;
  current_period_end: string | null;
};

type RawShop = {
  shop: string;
  uninstalled_at: string | null;
  isInstalled: boolean | null;
};

const compareTimestamps = (a: string | null, b: string | null) => {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return new Date(a).getTime() - new Date(b).getTime();
};

export const buildShopJourneys = (params: {
  subscriptions: Array<RawSub>;
  shops: Array<RawShop>;
}): Array<ShopJourney> => {
  const subsByShop = new Map<string, Array<RawSub>>();
  for (const sub of params.subscriptions) {
    const arr = subsByShop.get(sub.shop) ?? [];
    arr.push(sub);
    subsByShop.set(sub.shop, arr);
  }

  const shopByShop = new Map(params.shops.map((s) => [s.shop, s]));
  const journeys: Array<ShopJourney> = [];

  for (const [shop, subs] of subsByShop.entries()) {
    const shopRow = shopByShop.get(shop);

    const activated = subs
      .filter((s) => {
        return s.activated_at !== null && (s.price ?? 0) > 0;
      })
      .sort((a, b) => {
        return compareTimestamps(a.activated_at, b.activated_at);
      });

    if (activated.length === 0) {
      continue;
    }

    const events: Array<SubscriptionEvent> = [];
    let prevPlan: string | null = null;
    let prevPrice = 0;
    let firstPaidAt: Date | null = null;
    let firstPlan: string | null = null;
    let firstPrice = 0;
    let upgradedAt: Date | null = null;

    for (const sub of activated) {
      const price = sub.price ?? 0;
      const at = new Date(sub.activated_at as string);

      if (prevPlan === null) {
        events.push({
          shop,
          type: "new",
          at,
          amount: price,
          fromPlan: null,
          toPlan: sub.plan_key,
          fromPrice: 0,
          toPrice: price,
        });
        firstPaidAt = at;
        firstPlan = sub.plan_key;
        firstPrice = price;
      } else if (price > prevPrice) {
        events.push({
          shop,
          type: "expansion",
          at,
          amount: price - prevPrice,
          fromPlan: prevPlan,
          toPlan: sub.plan_key,
          fromPrice: prevPrice,
          toPrice: price,
        });
        if (upgradedAt === null) {
          upgradedAt = at;
        }
      } else if (price < prevPrice) {
        events.push({
          shop,
          type: "contraction",
          at,
          amount: prevPrice - price,
          fromPlan: prevPlan,
          toPlan: sub.plan_key,
          fromPrice: prevPrice,
          toPrice: price,
        });
      }

      prevPlan = sub.plan_key;
      prevPrice = price;
    }

    const lastSub = activated[activated.length - 1];
    let churnedAt: Date | null = null;

    const shopUninstalled =
      shopRow?.isInstalled === false && shopRow.uninstalled_at !== null;

    if (lastSub.status === "CANCELLED" && lastSub.current_period_end) {
      churnedAt = new Date(lastSub.current_period_end);
    } else if (shopUninstalled && shopRow?.uninstalled_at) {
      churnedAt = new Date(shopRow.uninstalled_at);
    }

    if (churnedAt !== null && prevPlan !== null) {
      events.push({
        shop,
        type: "churn",
        at: churnedAt,
        amount: prevPrice,
        fromPlan: prevPlan,
        toPlan: null,
        fromPrice: prevPrice,
        toPrice: 0,
      });
    }

    journeys.push({
      shop,
      firstPaidAt,
      firstPlan,
      firstPrice,
      lastPlan: churnedAt !== null ? null : prevPlan,
      lastPrice: churnedAt !== null ? 0 : prevPrice,
      churnedAt,
      upgradedAt,
      events,
    });
  }

  return journeys;
};

export const getShopJourneys = cache(async (): Promise<Array<ShopJourney>> => {
  const [subsResult, shopsResult] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(`
        id,
        shop,
        plan_key,
        price,
        status,
        activated_at,
        created_at,
        current_period_end
      `)
      .limit(50000),
    supabase
      .from("shops")
      .select(`
        shop,
        uninstalled_at,
        isInstalled
      `)
      .limit(20000),
  ]);

  if (subsResult.error) {
    console.error("Error fetching subscriptions", subsResult.error);
    throw subsResult.error;
  }
  if (shopsResult.error) {
    console.error("Error fetching shops", shopsResult.error);
    throw shopsResult.error;
  }

  return buildShopJourneys({
    subscriptions: subsResult.data ?? [],
    shops: shopsResult.data ?? [],
  });
});
