import { cache } from "react";

import { monthKey } from "./dates";
import { getShopJourneys, type ShopJourney } from "./subscription-timeline";

export type MrrMovementPoint = {
  monthKey: string;
  newMrr: number;
  expansion: number;
  contraction: number;
  churn: number;
  netMrr: number;
};

const MRR_HISTORY_MONTHS = 18;

const startOfMonthKey = (date: Date) => {
  return monthKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
};

const addMonthsToKey = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return monthKey(d);
};

export const computeMrrMovement = (params: {
  journeys: Array<ShopJourney>;
  months: number;
}): Array<MrrMovementPoint> => {
  const today = new Date();
  const currentKey = startOfMonthKey(today);
  const earliestKey = addMonthsToKey(currentKey, -(params.months - 1));

  const buckets = new Map<string, MrrMovementPoint>();
  for (let i = 0; i < params.months; i++) {
    const key = addMonthsToKey(earliestKey, i);
    buckets.set(key, {
      monthKey: key,
      newMrr: 0,
      expansion: 0,
      contraction: 0,
      churn: 0,
      netMrr: 0,
    });
  }

  for (const journey of params.journeys) {
    for (const event of journey.events) {
      const key = startOfMonthKey(event.at);
      const point = buckets.get(key);
      if (!point) {
        continue;
      }
      if (event.type === "new") {
        point.newMrr += event.amount;
      } else if (event.type === "expansion") {
        point.expansion += event.amount;
      } else if (event.type === "contraction") {
        point.contraction += event.amount;
      } else if (event.type === "churn") {
        point.churn += event.amount;
      }
    }
  }

  for (const point of buckets.values()) {
    point.netMrr =
      point.newMrr + point.expansion - point.contraction - point.churn;
  }

  return Array.from(buckets.values());
};

export const getMrrMovement = cache(
  async (): Promise<Array<MrrMovementPoint>> => {
    const journeys = await getShopJourneys();
    return computeMrrMovement({ journeys, months: MRR_HISTORY_MONTHS });
  },
);
