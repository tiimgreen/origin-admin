import { cache } from "react";

import { getShopProfiles, type ShopProfile } from "./insights";
import { getShopJourneys, type ShopJourney } from "./subscription-timeline";

export type PlanJourneyType =
  | "stayed"
  | "upgraded"
  | "downgraded"
  | "churned-while-paying"
  | "churned-after-upgrade";

export type PlanJourney = {
  shop: string;
  startPlan: string;
  endPlan: string | null;
  type: PlanJourneyType;
  daysToUpgrade: number | null;
  shopifyPlus: boolean;
  hasAdAccount: boolean;
  orderCountAtInstall: number | null;
};

export type PlanMatrixCell = {
  startPlan: string;
  endPlan: string;
  count: number;
};

export type TimeToUpgradeBucket = {
  label: string;
  count: number;
};

export type PredictorRow = {
  label: string;
  shopifyPlusRate: number;
  adAccountRate: number;
  ordersAtInstallMedian: number;
  count: number;
};

export type PlanProgressionResult = {
  journeys: Array<PlanJourney>;
  matrix: Array<PlanMatrixCell>;
  timeToUpgrade: Array<TimeToUpgradeBucket>;
  predictors: Array<PredictorRow>;
  planOrder: Array<string>;
};

const PLAN_ORDER = ["free", "standard", "pro", "platinum"];

const PLAN_RANK: Record<string, number> = {
  free: 0,
  standard: 1,
  pro: 2,
  platinum: 3,
};

const TIME_TO_UPGRADE_BUCKETS: Array<{
  label: string;
  min: number;
  max: number | null;
}> = [
  { label: "<7d", min: 0, max: 7 },
  { label: "7–30d", min: 7, max: 30 },
  { label: "30–60d", min: 30, max: 60 },
  { label: "60–90d", min: 60, max: 90 },
  { label: "90–180d", min: 90, max: 180 },
  { label: "180d+", min: 180, max: null },
];

const dayDiff = (from: Date, to: Date) => {
  return (to.getTime() - from.getTime()) / 86400000;
};

const classifyJourney = (params: {
  journey: ShopJourney;
  shop: ShopProfile | undefined;
}): PlanJourney | null => {
  const { journey } = params;
  if (!journey.firstPlan || !journey.firstPaidAt) {
    return null;
  }

  const churned = journey.churnedAt !== null;
  const startRank = PLAN_RANK[journey.firstPlan] ?? -1;
  const endPlan = churned ? null : journey.lastPlan;
  const endRank = endPlan ? (PLAN_RANK[endPlan] ?? -1) : -1;
  const upgradedAt = journey.upgradedAt;

  let type: PlanJourneyType;
  if (churned) {
    type = upgradedAt !== null ? "churned-after-upgrade" : "churned-while-paying";
  } else if (endRank > startRank) {
    type = "upgraded";
  } else if (endRank < startRank && endRank >= 0) {
    type = "downgraded";
  } else {
    type = "stayed";
  }

  const daysToUpgrade =
    upgradedAt && journey.firstPaidAt
      ? dayDiff(journey.firstPaidAt, upgradedAt)
      : null;

  return {
    shop: journey.shop,
    startPlan: journey.firstPlan,
    endPlan,
    type,
    daysToUpgrade,
    shopifyPlus: params.shop?.shopifyPlus ?? false,
    hasAdAccount: (params.shop?.connectedPlatformKeys.length ?? 0) > 0,
    orderCountAtInstall: params.shop?.orderCountAtInstall ?? null,
  };
};

const median = (values: Array<number>) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const buildMatrix = (journeys: Array<PlanJourney>): Array<PlanMatrixCell> => {
  const counts = new Map<string, PlanMatrixCell>();
  for (const j of journeys) {
    const endLabel = j.endPlan ?? "churned";
    const key = `${j.startPlan}|${endLabel}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, {
        startPlan: j.startPlan,
        endPlan: endLabel,
        count: 1,
      });
    }
  }
  return Array.from(counts.values());
};

const buildTimeToUpgrade = (
  journeys: Array<PlanJourney>,
): Array<TimeToUpgradeBucket> => {
  const buckets: Array<TimeToUpgradeBucket> = TIME_TO_UPGRADE_BUCKETS.map(
    (b) => {
      return { label: b.label, count: 0 };
    },
  );

  for (const j of journeys) {
    if (j.daysToUpgrade === null) {
      continue;
    }
    const idx = TIME_TO_UPGRADE_BUCKETS.findIndex((b) => {
      return (
        j.daysToUpgrade !== null &&
        j.daysToUpgrade >= b.min &&
        (b.max === null || j.daysToUpgrade < b.max)
      );
    });
    if (idx >= 0) {
      buckets[idx].count += 1;
    }
  }

  return buckets;
};

const buildPredictors = (
  journeys: Array<PlanJourney>,
): Array<PredictorRow> => {
  const groups: Array<{ label: string; type: PlanJourneyType }> = [
    { label: "Stayed on plan", type: "stayed" },
    { label: "Upgraded", type: "upgraded" },
    { label: "Downgraded", type: "downgraded" },
    { label: "Churned while paying", type: "churned-while-paying" },
    { label: "Churned after upgrade", type: "churned-after-upgrade" },
  ];

  return groups.map((group) => {
    const subset = journeys.filter((j) => {
      return j.type === group.type;
    });
    const count = subset.length;
    const plusCount = subset.filter((j) => j.shopifyPlus).length;
    const adCount = subset.filter((j) => j.hasAdAccount).length;
    const orderCounts = subset
      .map((j) => j.orderCountAtInstall)
      .filter((v): v is number => v !== null);

    return {
      label: group.label,
      count,
      shopifyPlusRate: count > 0 ? plusCount / count : 0,
      adAccountRate: count > 0 ? adCount / count : 0,
      ordersAtInstallMedian: median(orderCounts),
    };
  });
};

export const computePlanProgression = (params: {
  journeys: Array<ShopJourney>;
  shops: Array<ShopProfile>;
}): PlanProgressionResult => {
  const shopByShop = new Map(params.shops.map((s) => [s.shop, s]));

  const planJourneys: Array<PlanJourney> = [];
  for (const journey of params.journeys) {
    const classified = classifyJourney({
      journey,
      shop: shopByShop.get(journey.shop),
    });
    if (classified) {
      planJourneys.push(classified);
    }
  }

  return {
    journeys: planJourneys,
    matrix: buildMatrix(planJourneys),
    timeToUpgrade: buildTimeToUpgrade(planJourneys),
    predictors: buildPredictors(planJourneys),
    planOrder: PLAN_ORDER,
  };
};

export const getPlanProgression = cache(
  async (): Promise<PlanProgressionResult> => {
    const [journeys, shops] = await Promise.all([
      getShopJourneys(),
      getShopProfiles(),
    ]);
    return computePlanProgression({ journeys, shops });
  },
);
