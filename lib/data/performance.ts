import { cache } from "react";

import { supabaseAdmin } from "@/lib/supabase";
import {
  fetchAppEvents,
  fetchTransactions,
  PartnersAppEvent,
  PartnersTransaction,
} from "@/lib/partners";
import { Delta, formatDelta } from "@/lib/format";

import { isoDate, monthKey, startOfDayUtc, subtractDays } from "./dates";
import {
  Granularity,
  PERFORMANCE_RANGES,
  PerformanceRange,
} from "./performance-ranges";

const PAGE_SIZE = 1000;

// Backfill windows for the first sync. Transactions need the display window
// plus a year of annual-plan lookback; events go back far enough to name every
// charge that could still be active.
const TRANSACTIONS_BACKFILL_MONTHS = 38;
const EVENTS_BACKFILL_ISO = "2020-01-01T00:00:00Z";

const SYNC_TTL_MS = 60 * 60 * 1000;
const SYNC_OVERLAP_MS = 2 * 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

// Usage revenue is a trailing window rather than a calendar-month sum so the
// current (partial) month isn't understated.
const USAGE_LOOKBACK_MS = 30 * DAY_MS;

// Every churn point is a rolling rate: movements since the opening snapshot
// 30 days earlier, over the population at that opening snapshot.
const CHURN_WINDOW_MS = 30 * DAY_MS;

// When a merchant switches plan, Shopify cancels the old charge and activates
// the new one within about a second of each other, in either order. A gap
// longer than this means the shop churned and came back, not a plan change.
const PLAN_SWITCH_GRACE_MS = 60 * 1000;

// One point per period: a calendar month ("2026-09") or, for the 30-day
// range, a calendar day ("2026-09-15"). Levels, growth and churn are
// point-in-time values at the period end (or now); MRR movements and max MRR
// are summed over the period.
export type PerformancePeriod = {
  periodKey: string;
  subscriptionMrr: number;
  usageMrr: number;
  trialMrr: number;
  totalMrr: number;
  arr: number;
  growthRate: number;
  activeSubscriptions: number;
  arpu: number;
  ltv: number | null;
  revenueChurnRate: number | null;
  newMrr: number;
  expansionMrr: number;
  reactivationMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  netChangeMrr: number;
  maxMrr: number | null;
  planMrr: Record<string, number>;
};

export type PerformanceMetrics = {
  periods: Array<PerformancePeriod>;
  currentMrr: number;
  mrrDelta: Delta;
  topPlanNames: Array<string>;
};

let lastSyncAtMs = 0;

const syncPartnersData = async () => {
  if (Date.now() - lastSyncAtMs < SYNC_TTL_MS) {
    return;
  }

  const { data: latestTransactions, error: latestTransactionsError } =
    await supabaseAdmin
      .from("partners_transactions")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);

  if (latestTransactionsError) {
    console.error("Error fetching latest partners transaction", latestTransactionsError);
    throw latestTransactionsError;
  }

  const { data: latestEvents, error: latestEventsError } = await supabaseAdmin
    .from("partners_app_events")
    .select("occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(1);

  if (latestEventsError) {
    console.error("Error fetching latest partners app event", latestEventsError);
    throw latestEventsError;
  }

  const now = new Date();
  const backfillStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - TRANSACTIONS_BACKFILL_MONTHS, 1),
  ).toISOString();

  const createdAtMin =
    latestTransactions.length > 0
      ? new Date(
          new Date(latestTransactions[0].created_at).getTime() - SYNC_OVERLAP_MS,
        ).toISOString()
      : backfillStart;

  const occurredAtMin =
    latestEvents.length > 0
      ? new Date(
          new Date(latestEvents[0].occurred_at).getTime() - SYNC_OVERLAP_MS,
        ).toISOString()
      : EVENTS_BACKFILL_ISO;

  const transactions = await fetchTransactions({ createdAtMin });
  const events = await fetchAppEvents({ occurredAtMin });

  const transactionRows = transactions.map((transaction: PartnersTransaction) => {
    return {
      id: transaction.id,
      created_at: transaction.createdAt,
      type: transaction.type,
      shop_domain: transaction.shopDomain,
      charge_id: transaction.chargeId,
      billing_interval: transaction.billingInterval,
      gross_amount: transaction.grossAmount,
      currency_code: transaction.currencyCode,
    };
  });

  const eventRows = events.map((event: PartnersAppEvent) => {
    return {
      id: `${event.type}:${event.chargeId}:${event.occurredAt}`,
      occurred_at: event.occurredAt,
      type: event.type,
      shop_domain: event.shopDomain,
      charge_id: event.chargeId,
      charge_name: event.chargeName,
      charge_amount: event.chargeAmount,
      test: event.test,
      billing_on: event.billingOn,
    };
  });

  const UPSERT_CHUNK_SIZE = 500;

  for (let i = 0; i < transactionRows.length; i += UPSERT_CHUNK_SIZE) {
    const { error: upsertTransactionsError } = await supabaseAdmin
      .from("partners_transactions")
      .upsert(transactionRows.slice(i, i + UPSERT_CHUNK_SIZE), { onConflict: "id" });

    if (upsertTransactionsError) {
      console.error("Error upserting partners transactions", upsertTransactionsError);
      throw upsertTransactionsError;
    }
  }

  for (let i = 0; i < eventRows.length; i += UPSERT_CHUNK_SIZE) {
    const { error: upsertEventsError } = await supabaseAdmin
      .from("partners_app_events")
      .upsert(eventRows.slice(i, i + UPSERT_CHUNK_SIZE), { onConflict: "id" });

    if (upsertEventsError) {
      console.error("Error upserting partners app events", upsertEventsError);
      throw upsertEventsError;
    }
  }

  lastSyncAtMs = Date.now();
};

type TransactionRow = {
  created_at: string;
  type: string;
  shop_domain: string;
  charge_id: string | null;
  billing_interval: string | null;
  gross_amount: number;
  currency_code: string;
};

type EventRow = {
  occurred_at: string;
  type: string;
  shop_domain: string;
  charge_id: string;
  charge_name: string;
  charge_amount: number;
  test: boolean;
  billing_on: string | null;
};

const loadPartnersRows = async ({ now }: { now: Date }) => {
  const windowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - TRANSACTIONS_BACKFILL_MONTHS, 1),
  ).toISOString();

  const transactions: Array<TransactionRow> = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: page, error: transactionsError } = await supabaseAdmin
      .from("partners_transactions")
      .select(`
        created_at,
        type,
        shop_domain,
        charge_id,
        billing_interval,
        gross_amount,
        currency_code
      `)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (transactionsError) {
      console.error("Error fetching partners transactions", transactionsError);
      throw transactionsError;
    }

    transactions.push(...page);
    hasMore = page.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  const events: Array<EventRow> = [];
  from = 0;
  hasMore = true;

  while (hasMore) {
    const { data: page, error: eventsError } = await supabaseAdmin
      .from("partners_app_events")
      .select(`
        occurred_at,
        type,
        shop_domain,
        charge_id,
        charge_name,
        charge_amount,
        test,
        billing_on
      `)
      .order("occurred_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (eventsError) {
      console.error("Error fetching partners app events", eventsError);
      throw eventsError;
    }

    events.push(...page);
    hasMore = page.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return { transactions, events };
};

// A shop's recurring value from `atMs` until its next state change. Amount is
// the monthly equivalent, and 0 once the shop has churned.
type ShopState = {
  atMs: number;
  amount: number;
  planName: string | null;
};

type MrrFlows = {
  newMrr: number;
  expansionMrr: number;
  reactivationMrr: number;
  contractionMrr: number;
  churnedMrr: number;
};

type FlowEvent = {
  atMs: number;
  flow: keyof MrrFlows;
  amount: number;
};

const emptyFlows = (): MrrFlows => {
  return {
    newMrr: 0,
    expansionMrr: 0,
    reactivationMrr: 0,
    contractionMrr: 0,
    churnedMrr: 0,
  };
};

const periodKeyOf = ({ date, granularity }: { date: Date; granularity: Granularity }) => {
  return granularity === "month" ? monthKey(date) : isoDate(date);
};

// Exclusive end of a period key, i.e. the start of the next month or day.
const periodEndMs = (key: string) => {
  const [year, month, day] = key.split("-").map((part) => Number(part));
  return day === undefined ? Date.UTC(year, month, 1) : Date.UTC(year, month - 1, day + 1);
};

type ComputeMetricsArgs = {
  transactions: Array<TransactionRow>;
  events: Array<EventRow>;
  now: Date;
  range: PerformanceRange;
};

export const computeMetrics = ({
  transactions,
  events,
  now,
  range,
}: ComputeMetricsArgs): PerformanceMetrics => {
  const { granularity, count } = PERFORMANCE_RANGES[range];

  const testChargeIds = new Set(
    events.filter((event) => event.test).map((event) => event.charge_id),
  );

  const validTransactions = transactions.filter((transaction) => {
    if (transaction.currency_code !== "USD") {
      return false;
    }
    return !(transaction.charge_id && testChargeIds.has(transaction.charge_id));
  });

  const validEvents = events.filter((event) => !event.test);

  // Lifecycle events don't carry the billing interval, so annual charges are
  // recognised by their sales. Their amount is spread across 12 months.
  const annualChargeIds = new Set<string>();
  const usageSales: Array<{ createdAtMs: number; amount: number }> = [];

  for (const transaction of validTransactions) {
    if (transaction.type === "usage") {
      usageSales.push({
        createdAtMs: new Date(transaction.created_at).getTime(),
        amount: transaction.gross_amount,
      });
      continue;
    }

    if (transaction.charge_id && transaction.billing_interval === "ANNUAL") {
      annualChargeIds.add(transaction.charge_id);
    }
  }

  const monthlyAmount = (charge: EventRow) => {
    return annualChargeIds.has(charge.charge_id)
      ? charge.charge_amount / 12
      : charge.charge_amount;
  };

  // MRR is reconstructed from charge lifecycle events. A charge only counts
  // once its trial has ended (billing_on) and it is still active, so a shop's
  // MRR is the monthly amount of its converted, uncancelled, unfrozen charge.
  // Every change to that figure is recorded as a movement, so the movements
  // always sum to the change in MRR.
  //
  // New MRR lands when a shop's first ever charge converts. A plan switch
  // during the trial only changes which plan converts; a switch after
  // conversion is expansion or contraction. Cancelling or freezing a
  // converted charge is churn. A shop that converts again after churning, or
  // is unfrozen, is a reactivation.
  //
  // Closed shops come back from the Partners API as "REDACTED", so each of
  // their charges has to be treated as its own shop.
  const eventsByShop = new Map<string, Array<EventRow>>();
  for (const event of validEvents) {
    const shopKey =
      event.shop_domain === "REDACTED"
        ? `REDACTED:${event.charge_id}`
        : event.shop_domain;
    const shopEvents = eventsByShop.get(shopKey) ?? [];
    shopEvents.push(event);
    eventsByShop.set(shopKey, shopEvents);
  }

  const flowEvents: Array<FlowEvent> = [];
  const timelines: Array<Array<ShopState>> = [];

  // Trials that are still running today. They are not MRR, but the MRR chart
  // shows them as their own band from the day they started.
  const activeTrials: Array<{ activatedAtMs: number; amount: number }> = [];

  const conversionMs = (charge: EventRow) => {
    const activatedAtMs = new Date(charge.occurred_at).getTime();
    return charge.billing_on
      ? Math.max(activatedAtMs, new Date(charge.billing_on).getTime())
      : activatedAtMs;
  };

  for (const shopEvents of eventsByShop.values()) {
    const timeline: Array<ShopState> = [];

    // The charge still in trial, and the converted charge. Never both.
    let pending: EventRow | null = null;
    let live: EventRow | null = null;
    let hasConverted = false;

    const recordState = ({ atMs, charge }: { atMs: number; charge: EventRow | null }) => {
      timeline.push({
        atMs,
        amount: charge ? monthlyAmount(charge) : 0,
        planName: charge ? charge.charge_name : null,
      });
    };

    const convertPendingBy = (atMs: number) => {
      if (!pending || conversionMs(pending) > atMs) {
        return;
      }

      flowEvents.push({
        atMs: conversionMs(pending),
        flow: hasConverted ? "reactivationMrr" : "newMrr",
        amount: monthlyAmount(pending),
      });
      live = pending;
      recordState({ atMs: conversionMs(pending), charge: pending });
      pending = null;
      hasConverted = true;
    };

    for (const [index, event] of shopEvents.entries()) {
      const occurredAtMs = new Date(event.occurred_at).getTime();
      convertPendingBy(occurredAtMs);

      if (event.type === "SUBSCRIPTION_CHARGE_ACTIVATED") {
        if (live) {
          // Plan switch on a converted charge takes effect immediately.
          const delta = monthlyAmount(event) - monthlyAmount(live);
          if (delta > 0) {
            flowEvents.push({ atMs: occurredAtMs, flow: "expansionMrr", amount: delta });
          } else if (delta < 0) {
            flowEvents.push({ atMs: occurredAtMs, flow: "contractionMrr", amount: -delta });
          }
          live = event;
          recordState({ atMs: occurredAtMs, charge: event });
        } else {
          pending = event;
        }
        continue;
      }

      if (event.type === "SUBSCRIPTION_CHARGE_UNFROZEN") {
        if (!live && !pending) {
          pending = event;
        }
        continue;
      }

      // Cancelled or frozen.
      if (pending && event.charge_id === pending.charge_id) {
        pending = null;
        continue;
      }

      if (!live || event.charge_id !== live.charge_id) {
        continue;
      }

      // If a new charge activates within the grace window this is the old
      // half of a plan switch, handled above.
      const isSwitch = shopEvents.slice(index + 1).some((next) => {
        return (
          next.type === "SUBSCRIPTION_CHARGE_ACTIVATED" &&
          new Date(next.occurred_at).getTime() - occurredAtMs <= PLAN_SWITCH_GRACE_MS
        );
      });
      if (isSwitch) {
        continue;
      }

      flowEvents.push({ atMs: occurredAtMs, flow: "churnedMrr", amount: monthlyAmount(live) });
      live = null;
      recordState({ atMs: occurredAtMs, charge: null });
    }

    convertPendingBy(now.getTime());
    timelines.push(timeline);

    if (pending) {
      activeTrials.push({
        activatedAtMs: new Date(pending.occurred_at).getTime(),
        amount: monthlyAmount(pending),
      });
    }
  }

  // Point-in-time population: every shop with a positive recurring amount.
  const snapshotAt = (atMs: number) => {
    let mrr = 0;
    let paidSubscriptions = 0;
    const planMrr: Record<string, number> = {};

    for (const timeline of timelines) {
      let state: ShopState | null = null;
      for (const entry of timeline) {
        if (entry.atMs > atMs) {
          break;
        }
        state = entry;
      }

      if (!state || state.amount <= 0) {
        continue;
      }

      mrr += state.amount;
      paidSubscriptions += 1;

      const planName = state.planName ?? "Unknown";
      planMrr[planName] = (planMrr[planName] ?? 0) + state.amount;
    }

    return { mrr, paidSubscriptions, planMrr };
  };

  // Movements after an opening snapshot, up to and including a report point.
  const movementsBetween = ({ fromMs, toMs }: { fromMs: number; toMs: number }) => {
    const flows = emptyFlows();
    let lostSubscriptions = 0;

    for (const event of flowEvents) {
      if (event.atMs <= fromMs || event.atMs > toMs) {
        continue;
      }

      flows[event.flow] += event.amount;
      if (event.flow === "churnedMrr" && event.amount > 0) {
        lostSubscriptions += 1;
      }
    }

    return { flows, lostSubscriptions };
  };

  const flowsByPeriod = new Map<string, MrrFlows>();
  for (const event of flowEvents) {
    const key = periodKeyOf({ date: new Date(event.atMs), granularity });
    const flows = flowsByPeriod.get(key) ?? emptyFlows();
    flows[event.flow] += event.amount;
    flowsByPeriod.set(key, flows);
  }

  const usageMrrAt = (atMs: number) => {
    return usageSales.reduce((sum, sale) => {
      const inWindow =
        sale.createdAtMs <= atMs && sale.createdAtMs > atMs - USAGE_LOOKBACK_MS;
      return inWindow ? sum + sale.amount : sum;
    }, 0);
  };

  // The display periods plus one before them for period-over-period deltas.
  const internalKeys: Array<string> = [];
  for (let i = count; i >= 0; i--) {
    const date =
      granularity === "month"
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
        : subtractDays(startOfDayUtc(now), i);
    internalKeys.push(periodKeyOf({ date, granularity }));
  }

  // Each period is reported at its end, or now for the current period.
  const pointMs = (key: string) => {
    return Math.min(periodEndMs(key), now.getTime());
  };

  const snapshots = internalKeys.map((key) => snapshotAt(pointMs(key)));

  const periods: Array<PerformancePeriod> = [];

  for (let index = 1; index < internalKeys.length; index++) {
    const key = internalKeys[index];
    const atMs = pointMs(key);
    const snapshot = snapshots[index];
    const previousSnapshot = snapshots[index - 1];

    const subscriptionMrr = snapshot.mrr;
    const usageMrr = usageMrrAt(atMs);
    const totalMrr = subscriptionMrr + usageMrr;

    const trialMrr = activeTrials.reduce((sum, trial) => {
      return trial.activatedAtMs <= atMs ? sum + trial.amount : sum;
    }, 0);

    const previousTotalMrr =
      previousSnapshot.mrr + usageMrrAt(pointMs(internalKeys[index - 1]));
    const growthRate =
      previousTotalMrr > 0 ? (totalMrr - previousTotalMrr) / previousTotalMrr : 0;

    // Rolling 30-day churn: revenue lost (cancellations and freezes) relative
    // to opening MRR, and subscriptions lost relative to opening subscriptions.
    const openingMs = atMs - CHURN_WINDOW_MS;
    const opening = snapshotAt(openingMs);
    const rolling = movementsBetween({ fromMs: openingMs, toMs: atMs });

    const revenueChurnRate =
      opening.mrr > 0 ? rolling.flows.churnedMrr / opening.mrr : null;
    const subscriptionChurnRate =
      opening.paidSubscriptions > 0
        ? rolling.lostSubscriptions / opening.paidSubscriptions
        : null;

    const activeSubscriptions = snapshot.paidSubscriptions;
    const arpu = activeSubscriptions > 0 ? subscriptionMrr / activeSubscriptions : 0;

    const flows = flowsByPeriod.get(key) ?? emptyFlows();
    const { newMrr, expansionMrr, reactivationMrr, contractionMrr, churnedMrr } = flows;
    const inflowMrr = newMrr + expansionMrr + reactivationMrr;
    const outflowMrr = contractionMrr + churnedMrr;

    // Max MRR (https://longform.asmartbear.com/max-mrr/): the level at which
    // lost dollars catch up with added dollars, given this period's rates.
    // Period movements only cover part of the current period, so it is left
    // undefined until the period completes.
    const startOfPeriodMrr = previousSnapshot.mrr;
    const cancellationRate = startOfPeriodMrr > 0 ? outflowMrr / startOfPeriodMrr : null;
    const isPartialPeriod = now.getTime() < periodEndMs(key);

    periods.push({
      periodKey: key,
      subscriptionMrr,
      usageMrr,
      trialMrr,
      totalMrr,
      arr: totalMrr * 12,
      growthRate,
      activeSubscriptions,
      arpu,
      ltv:
        subscriptionChurnRate !== null && subscriptionChurnRate > 0
          ? arpu / subscriptionChurnRate
          : null,
      revenueChurnRate,
      newMrr,
      expansionMrr,
      reactivationMrr,
      contractionMrr,
      churnedMrr,
      netChangeMrr: inflowMrr - outflowMrr,
      maxMrr:
        !isPartialPeriod && cancellationRate !== null && cancellationRate > 0
          ? inflowMrr / cancellationRate
          : null,
      planMrr: snapshot.planMrr,
    });
  }

  const first = periods[0];
  const last = periods[periods.length - 1];

  const latestPlanMrr = last?.planMrr ?? {};
  const topPlanNames = Object.entries(latestPlanMrr)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  return {
    periods,
    currentMrr: last?.totalMrr ?? 0,
    mrrDelta: formatDelta({
      current: last?.totalMrr ?? 0,
      previous: first?.totalMrr ?? 0,
    }),
    topPlanNames,
  };
};

export const getPerformanceMetrics = cache(
  async ({ range }: { range: PerformanceRange }): Promise<PerformanceMetrics> => {
    await syncPartnersData();

    const now = new Date();
    const { transactions, events } = await loadPartnersRows({ now });

    return computeMetrics({ transactions, events, now, range });
  },
);
