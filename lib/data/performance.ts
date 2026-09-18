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

// A shop counts as subscribed at a point in time if it was billed within the
// trailing window (35 days absorbs 30-day billing cycle drift) and its charge
// has not been canceled or frozen since.
const MONTHLY_LOOKBACK_MS = 35 * DAY_MS;
const ANNUAL_LOOKBACK_MS = 370 * DAY_MS;

// Usage revenue is a trailing window rather than a calendar-month sum so the
// current (partial) month isn't understated.
const USAGE_LOOKBACK_MS = 30 * DAY_MS;

// When a merchant switches plan, Shopify cancels the old charge and activates
// the new one within about a second of each other, in either order. A gap
// longer than this means the shop churned and came back, not a plan change.
const PLAN_SWITCH_GRACE_MS = 60 * 1000;

// One point per period: a calendar month ("2026-09") or, for the 30-day
// range, a calendar day ("2026-09-15"). Rates (growth, churn, LTV, max MRR)
// are computed over the period, so daily points are far noisier.
export type PerformancePeriod = {
  periodKey: string;
  subscriptionMrr: number;
  usageMrr: number;
  trialMrr: number;
  totalMrr: number;
  arr: number;
  growthRate: number | null;
  activeSubscriptions: number;
  arpu: number;
  ltv: number | null;
  netChurnRate: number | null;
  newMrr: number;
  expansionMrr: number;
  churnedMrr: number;
  netChangeMrr: number;
  convertedMrr: number;
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

type ShopSnapshotEntry = {
  amount: number;
  chargeId: string | null;
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

  // Most recent activation event per charge: names the plan and, via
  // billing_on (the first billing date), marks when its trial ends.
  const activationByChargeId = new Map<string, EventRow>();
  for (const event of validEvents) {
    if (event.type === "SUBSCRIPTION_CHARGE_ACTIVATED") {
      activationByChargeId.set(event.charge_id, event);
    }
  }

  const planNameByChargeId = new Map<string, string>();
  for (const [chargeId, activation] of activationByChargeId) {
    planNameByChargeId.set(chargeId, activation.charge_name);
  }

  // A charge without a billing_on has no trial: it is billable from activation.
  const trialEndMs = (activation: EventRow) => {
    return activation.billing_on
      ? new Date(activation.billing_on).getTime()
      : new Date(activation.occurred_at).getTime();
  };

  const subscriptionSalesByShop = new Map<string, Array<TransactionRow>>();
  const billedChargeFirstSaleMs = new Map<string, number>();
  const usageSales: Array<{ createdAtMs: number; amount: number }> = [];

  for (const transaction of validTransactions) {
    if (transaction.type === "usage") {
      usageSales.push({
        createdAtMs: new Date(transaction.created_at).getTime(),
        amount: transaction.gross_amount,
      });
      continue;
    }

    const sales = subscriptionSalesByShop.get(transaction.shop_domain) ?? [];
    sales.push(transaction);
    subscriptionSalesByShop.set(transaction.shop_domain, sales);

    if (transaction.charge_id) {
      const createdAtMs = new Date(transaction.created_at).getTime();
      const existing = billedChargeFirstSaleMs.get(transaction.charge_id);
      if (existing === undefined || createdAtMs < existing) {
        billedChargeFirstSaleMs.set(transaction.charge_id, createdAtMs);
      }
    }
  }

  for (const sales of subscriptionSalesByShop.values()) {
    sales.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  // Charge lifecycle, so canceled/frozen charges stop counting immediately
  // instead of lingering until their last sale ages out of the trailing
  // window. Events are ordered by occurred_at; the latest state at a point in
  // time wins (an UNFROZEN event revives a frozen charge).
  const eventsByChargeId = new Map<string, Array<EventRow>>();
  for (const event of validEvents) {
    const chargeEvents = eventsByChargeId.get(event.charge_id) ?? [];
    chargeEvents.push(event);
    eventsByChargeId.set(event.charge_id, chargeEvents);
  }

  const chargeEndedBy = ({ chargeId, atMs }: { chargeId: string; atMs: number }) => {
    const chargeEvents = eventsByChargeId.get(chargeId);
    if (!chargeEvents) {
      return false;
    }

    let lastState: string | null = null;
    for (const event of chargeEvents) {
      if (new Date(event.occurred_at).getTime() > atMs) {
        break;
      }
      lastState = event.type;
    }

    return (
      lastState === "SUBSCRIPTION_CHARGE_CANCELED" ||
      lastState === "SUBSCRIPTION_CHARGE_FROZEN"
    );
  };

  // MRR changes are driven by charge lifecycle events. A charge only counts
  // once its trial has ended (billing_on) and it is still active, so a shop's
  // MRR is the amount of its converted, uncancelled, unfrozen charge, and the
  // flows below always sum to the change in that figure.
  //
  // New MRR lands in the month a shop's first ever charge converts. A plan
  // switch during the trial only changes which plan converts; a switch after
  // conversion is expansion or contraction. Cancelling or freezing a
  // converted charge is churn. A shop that converts again after churning, or
  // is unfrozen, is a reactivation, reported under expansion.
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

  type MrrFlows = { newMrr: number; expansionMrr: number; churnedMrr: number };
  const flowsByPeriod = new Map<string, MrrFlows>();

  const addFlow = ({
    atMs,
    flow,
    amount,
  }: {
    atMs: number;
    flow: keyof MrrFlows;
    amount: number;
  }) => {
    const key = periodKeyOf({ date: new Date(atMs), granularity });
    const flows = flowsByPeriod.get(key) ?? { newMrr: 0, expansionMrr: 0, churnedMrr: 0 };
    flows[flow] += amount;
    flowsByPeriod.set(key, flows);
  };

  const conversionMs = (charge: EventRow) => {
    const activatedAtMs = new Date(charge.occurred_at).getTime();
    return charge.billing_on
      ? Math.max(activatedAtMs, new Date(charge.billing_on).getTime())
      : activatedAtMs;
  };

  for (const shopEvents of eventsByShop.values()) {
    // The charge still in trial, and the converted charge. Never both.
    let pending: EventRow | null = null;
    let live: EventRow | null = null;
    let hasConverted = false;

    const convertPendingBy = (atMs: number) => {
      if (!pending || conversionMs(pending) > atMs) {
        return;
      }

      addFlow({
        atMs: conversionMs(pending),
        flow: hasConverted ? "expansionMrr" : "newMrr",
        amount: pending.charge_amount,
      });
      live = pending;
      pending = null;
      hasConverted = true;
    };

    for (const [index, event] of shopEvents.entries()) {
      const occurredAtMs = new Date(event.occurred_at).getTime();
      convertPendingBy(occurredAtMs);

      if (event.type === "SUBSCRIPTION_CHARGE_ACTIVATED") {
        if (live) {
          // Plan switch on a converted charge takes effect immediately.
          const delta = event.charge_amount - live.charge_amount;
          if (delta > 0) {
            addFlow({ atMs: occurredAtMs, flow: "expansionMrr", amount: delta });
          } else if (delta < 0) {
            addFlow({ atMs: occurredAtMs, flow: "churnedMrr", amount: -delta });
          }
          live = event;
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

      addFlow({ atMs: occurredAtMs, flow: "churnedMrr", amount: live.charge_amount });
      live = null;
    }

    convertPendingBy(now.getTime());
  }

  // The display periods plus one before them for period-over-period deltas.
  const internalKeys: Array<string> = [];
  for (let i = count; i >= 0; i--) {
    const date =
      granularity === "month"
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
        : subtractDays(startOfDayUtc(now), i);
    internalKeys.push(periodKeyOf({ date, granularity }));
  }

  // Point-in-time per shop MRR snapshots at each period end (or now, for the
  // current period): the shop's latest subscription sale within the trailing
  // billing window, annual amounts spread across 12 months.
  const snapshots: Array<Map<string, ShopSnapshotEntry>> = internalKeys.map((key) => {
    const snapshotAtMs = Math.min(periodEndMs(key), now.getTime());

    const snapshot = new Map<string, ShopSnapshotEntry>();

    for (const [shopDomain, sales] of subscriptionSalesByShop) {
      let latest: TransactionRow | null = null;

      for (const sale of sales) {
        const createdAtMs = new Date(sale.created_at).getTime();
        if (createdAtMs > snapshotAtMs) {
          break;
        }

        const lookbackMs =
          sale.billing_interval === "ANNUAL" ? ANNUAL_LOOKBACK_MS : MONTHLY_LOOKBACK_MS;

        if (createdAtMs > snapshotAtMs - lookbackMs) {
          latest = sale;
        }
      }

      if (!latest) {
        continue;
      }

      if (
        latest.charge_id &&
        chargeEndedBy({ chargeId: latest.charge_id, atMs: snapshotAtMs })
      ) {
        continue;
      }

      snapshot.set(shopDomain, {
        amount:
          latest.billing_interval === "ANNUAL"
            ? latest.gross_amount / 12
            : latest.gross_amount,
        chargeId: latest.charge_id,
      });
    }

    // Charges whose trial has ended but whose first sale hasn't been reported
    // yet are real MRR from the trial end date, as long as they are still
    // active. If no sale ever lands within the billing window, the charge is
    // stale and drops out.
    for (const activation of activationByChargeId.values()) {
      const endMs = trialEndMs(activation);
      if (endMs > snapshotAtMs || snapshotAtMs - endMs > MONTHLY_LOOKBACK_MS) {
        continue;
      }

      const firstSaleMs = billedChargeFirstSaleMs.get(activation.charge_id);
      if (firstSaleMs !== undefined && firstSaleMs <= snapshotAtMs) {
        continue;
      }

      if (
        chargeEndedBy({ chargeId: activation.charge_id, atMs: snapshotAtMs }) ||
        snapshot.has(activation.shop_domain)
      ) {
        continue;
      }

      snapshot.set(activation.shop_domain, {
        amount: activation.charge_amount,
        chargeId: activation.charge_id,
      });
    }

    return snapshot;
  });

  // Only trials that are active today count as trial MRR. A trial that has
  // since ended is either real MRR from its end date (handled in the
  // snapshots above) or nothing, so historical months never show it.
  const activeTrials = Array.from(activationByChargeId.values()).filter((activation) => {
    return (
      trialEndMs(activation) > now.getTime() &&
      !billedChargeFirstSaleMs.has(activation.charge_id) &&
      !chargeEndedBy({ chargeId: activation.charge_id, atMs: now.getTime() })
    );
  });

  const trialMrrByIndex = internalKeys.map((key, index) => {
    const snapshotAtMs = Math.min(periodEndMs(key), now.getTime());
    const snapshot = snapshots[index];

    const trialShops = new Set<string>();
    let trialMrr = 0;

    for (const activation of activeTrials) {
      if (
        new Date(activation.occurred_at).getTime() > snapshotAtMs ||
        snapshot.has(activation.shop_domain) ||
        trialShops.has(activation.shop_domain)
      ) {
        continue;
      }

      trialShops.add(activation.shop_domain);
      trialMrr += activation.charge_amount;
    }

    return trialMrr;
  });

  // Every change to converted MRR is recorded as a flow, so its level at any
  // period end is the running sum of flows up to then.
  const netOf = (flows: MrrFlows) => {
    return flows.newMrr + flows.expansionMrr - flows.churnedMrr;
  };

  let convertedMrr = 0;
  for (const [key, flows] of flowsByPeriod) {
    if (key <= internalKeys[0]) {
      convertedMrr += netOf(flows);
    }
  }

  const periods: Array<PerformancePeriod> = [];
  let previousTotalMrr: number | null = null;

  for (let index = 1; index < internalKeys.length; index++) {
    const key = internalKeys[index];
    const snapshot = snapshots[index];
    const previousSnapshot = snapshots[index - 1];

    let subscriptionMrr = 0;
    const planMrr: Record<string, number> = {};

    for (const entry of snapshot.values()) {
      subscriptionMrr += entry.amount;
      const planName =
        (entry.chargeId ? planNameByChargeId.get(entry.chargeId) : undefined) ??
        "Unknown";
      planMrr[planName] = (planMrr[planName] ?? 0) + entry.amount;
    }

    const snapshotAtMs = Math.min(periodEndMs(key), now.getTime());

    const usageMrr = usageSales.reduce((sum, sale) => {
      const inWindow =
        sale.createdAtMs <= snapshotAtMs &&
        sale.createdAtMs > snapshotAtMs - USAGE_LOOKBACK_MS;
      return inWindow ? sum + sale.amount : sum;
    }, 0);
    const trialMrr = trialMrrByIndex[index];
    const totalMrr = subscriptionMrr + usageMrr + trialMrr;

    const flows = flowsByPeriod.get(key) ?? { newMrr: 0, expansionMrr: 0, churnedMrr: 0 };
    const { newMrr, expansionMrr, churnedMrr } = flows;

    // Max MRR (https://longform.asmartbear.com/max-mrr/): the level at which
    // churn dollars catch up with new dollars, given this period's rates.
    const startOfPeriodMrr = convertedMrr;
    convertedMrr += netOf(flows);
    const cancellationRate = startOfPeriodMrr > 0 ? churnedMrr / startOfPeriodMrr : null;

    // Snapshot-to-snapshot movement of billed MRR, which the churn rate and
    // LTV are still based on.
    let snapshotExpansionMrr = 0;
    let snapshotChurnedMrr = 0;
    let churnedShops = 0;

    for (const [shopDomain, entry] of snapshot) {
      const previous = previousSnapshot.get(shopDomain);
      if (!previous) {
        continue;
      }

      if (entry.amount > previous.amount) {
        snapshotExpansionMrr += entry.amount - previous.amount;
      } else if (entry.amount < previous.amount) {
        snapshotChurnedMrr += previous.amount - entry.amount;
      }
    }

    for (const [shopDomain, previous] of previousSnapshot) {
      if (!snapshot.has(shopDomain)) {
        snapshotChurnedMrr += previous.amount;
        churnedShops += 1;
      }
    }

    const previousSubscriptionMrr = Array.from(previousSnapshot.values()).reduce(
      (sum, entry) => sum + entry.amount,
      0,
    );

    const activeSubscriptions = snapshot.size;
    const arpu = activeSubscriptions > 0 ? subscriptionMrr / activeSubscriptions : 0;

    const customerChurnRate =
      previousSnapshot.size > 0 ? churnedShops / previousSnapshot.size : null;

    // Flow-derived rates only cover part of the current period, which would
    // understate churn (and so overstate LTV); leave them undefined until the
    // period completes. Point-in-time values (MRR, ARR, ARPU) stay valid.
    const isPartialPeriod = now.getTime() < periodEndMs(key);

    periods.push({
      periodKey: key,
      subscriptionMrr,
      usageMrr,
      trialMrr,
      totalMrr,
      arr: totalMrr * 12,
      growthRate:
        !isPartialPeriod && previousTotalMrr !== null && previousTotalMrr > 0
          ? totalMrr / previousTotalMrr - 1
          : null,
      activeSubscriptions,
      arpu,
      ltv:
        !isPartialPeriod && customerChurnRate !== null && customerChurnRate > 0
          ? arpu / customerChurnRate
          : null,
      netChurnRate:
        !isPartialPeriod && previousSubscriptionMrr > 0
          ? (snapshotChurnedMrr - snapshotExpansionMrr) / previousSubscriptionMrr
          : null,
      newMrr,
      expansionMrr,
      churnedMrr,
      netChangeMrr: newMrr + expansionMrr - churnedMrr,
      convertedMrr,
      maxMrr:
        !isPartialPeriod && cancellationRate !== null && cancellationRate > 0
          ? (newMrr + expansionMrr) / cancellationRate
          : null,
      planMrr,
    });

    previousTotalMrr = totalMrr;
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
