@AGENTS.md

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## Fundamental rules

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project introduction

This will server as an admin dashboard for my order attribution shopify app, Origin.

## Data sources

The dashboard fans out to three systems. Each lives behind its own client in `lib/`.

- **Supabase (OLTP)** — `lib/supabase.ts`. Source of truth for shops, subscriptions, connected ad platforms, etc. Generated types in `types/database.types.ts` (do not edit). The main app at `/Users/tim/code/origin-utm-tracking` writes to this database; we only read.
- **Tinybird (analytics)** — `lib/tinybird.ts`. CDC replica of the OLTP data plus order/ad-spend tables. We use it for revenue aggregations (e.g. 90-day GMV, revenue trend) and any per-shop metric that would be too slow to compute against Supabase. Queries are HogQL-flavoured ClickHouse SQL via the `/v0/sql` endpoint. Currency conversion uses `fxToUsdSql` in `lib/data/currencies.ts` (fixed mid-market rates as of `FX_AS_OF`).
- **PostHog (product analytics)** — `lib/posthog.ts`. Source of truth for in-app activity. The main app calls `posthog.identify(shop)` on every page render, so `distinct_id` for any `$pageview` event equals the `*.myshopify.com` shop URL. We query via the HogQL endpoint (`/api/projects/:id/query/`) and always filter to distinct_ids ending in `.myshopify.com` to drop pre-identify anonymous events.

Caching: every cross-system fetcher in `lib/data/` is wrapped in React's `cache()` so a single page render makes one round trip per data source even when multiple components consume it.

## Activity & engagement model

Activity-based signals come from PostHog `$pageview` events and live in `lib/data/activity.ts`. There are two fetchers:

- `getShopActivity()` — last 30 days. Returns `{ shop, pageviews30d, lastSeenAt }`. Window length is `ACTIVE_PAGEVIEW_WINDOW_DAYS`.
- `getShopMonthlyActivity()` — last 18 months, bucketed by calendar month. Returns `{ shop, activeMonths: Set<"YYYY-MM"> }`. Window length is `MONTHLY_ACTIVITY_WINDOW_MONTHS` and matches `COHORT_MONTHS` in `cohorts.ts` so the retention chart has full coverage.

`ShopWithRevenue` (in `lib/data/insights.ts`) carries `pageviews30d` and `lastSeenAt`. Both join helpers (`joinShopsWithRevenue`, `joinAllShopsWithRevenue`) accept an optional `activity` array and default the fields to 0/null when omitted.

### Metric definitions

These definitions live in code, but documenting them here prevents silent drift when reading the UI:

- **Active shop (last 30d)** — `pageviews30d > 0`. Surfaced as the "Active shops (30d)" KPI on `/insights`.
- **Engagement tier** (`lib/data/health.ts`) — `high` if `pageviews30d > 0`, else `low`. Drives the customer-health matrix on `/lifecycle` (Champions / Upsell candidates / At-risk / Churn candidates). Pre-Apr 2026 this was a 3-signal score (revenue + pixel + ad platform); it was replaced because pixel/ad-platform are install-time signals, not usage signals.
- **Champion** (`lib/data/icp.ts:isChampion`) — installed AND paying AND tenure ≥ 90d AND `revenue90d > 0` AND `pageviews30d > 0`. The activity check is what stops a shop that paid once a year ago and never came back from being labelled a champion.
- **Plan tier** (`lib/data/health.ts`) — `paid` if `isPaying && plan ∈ {standard, pro, platinum}`, else `free`.
- **Cohort retention** (`lib/data/cohorts.ts`) — cohort = install month. A shop is "retained in month N" iff it fired ≥1 `$pageview` in the calendar month that is N months after its install month. Crucially this is *not* "still installed" — shops that stay installed but stop using the app drop off the curve. Cohort size still comes from installs, so percentages are comparable across rows.

### Where to look for what

| Concern | File |
|---------|------|
| Active / engagement / pageview signal | `lib/data/activity.ts` |
| Shop profile + revenue join | `lib/data/insights.ts` |
| Champion / ICP scorecard / churn classification | `lib/data/icp.ts` |
| Health matrix (plan tier × engagement tier) | `lib/data/health.ts` |
| Cohort retention | `lib/data/cohorts.ts` |
| MRR movement | `lib/data/mrr.ts` |

## Writing code

Ensure code is clean and always follows the style of the existing code.

### Warnings

NEVER ask for env vars or search for them. Just stub them and ask me to add them in.

### Style guide

1. Do not use single line `if` statments, e.g.:

```typescript
if (condition) return true;
```

ALWAYS use multi-line statements:

```typescript
if (condition) {
  return true;
}
```

2. Always use double quotes for strings, never single quotes

3. Always include curly braces (`{}`) and an explicit return for named functions e.g.:

Bad:

```typescript
const function = () => "test"
```

Good:

```typescript
const function = () => {
  return "test";
}
```

For anonymous functions this does not apply, e.g.:

Good:

```typescript
arr.filter((el) => el.visible);
```

4. Use empty lines to separate groups of logic, you don't need to bunch everything next to each other

5. Prefer a single object parameter to functions over multiple, position-specific parameters

#### Supabase

1. Always name the error related to the query, even if its the only one in the block, e.g.

```typescript
const { data: shops, error: shopsError } = await supabase
  .from("shops")
  .select("shop");
```

2. Always use backticks and multi-line select statements with supabase, unless you are only fetching 1 parameter, e.g.

Bad:

```typescript
const { data: shops, error: shopsError } = await supabase
  .from("shops")
  .select("shop, lastInstalledAt, isInstalled, ...");
```

Good:

```typescript
const { data: shops, error: shopsError } = await supabase
  .from("shops")
  .select(`
    shop,
    lastInstalledAt,
    isInstalled,
    ...
  `);
```

3. Always select multiple rows and throw an error if its empty, rather than `.single()`, e.g.

```typescript
const { data: dataExportJobs, error: dataExportError } = await supabase
  .from("data_export_jobs")
  .select(`
    id,
    shop,
    status
  `)
  .eq("id", dataExportJobId);

if (dataExportError) {
  console.error(`[${dataExportJobId}] Error fetching data export job`, dataExportError);
  res.status(500).send({ success: false, error: "Error fetching data export job" });
  return;
}

if (dataExportJobs.length === 0) {
  console.error(`[${dataExportJobId}] Data export job not found`);
  res.status(404).send({ success: false, error: "Data export job not found" });
  return;
}
```

### TypeScript

1. Be strongly typed where possible, importing types where appropriate.

2. Do not use `any` unless absolutely necessary. When accessing JSON fields from the db through supabase using `any` is acceptable with appropriate presence checks.

3. Do not use `as` to manually cast a type unless absolutely necessary. You should fix the problem to make the type work as intended. Note sometimes this is necessary (e.g. to get around Shopify Polaris' overly string type definitions). It's only a problem when its NOT necessary (i.e. could be strongly typed with existing types).

3. Use `Array<T>` instead of `T[]`

4. Always used named types for react component props (placed direcly above the component), instead of writing the types inline

### React

1. All components must go in their own folder in the `components/` directory. e.g.

the `Banner` component would live in `components/banner/banner.tsx`.

Never place components in a page file or another components file (unless they are tightly coupled)
