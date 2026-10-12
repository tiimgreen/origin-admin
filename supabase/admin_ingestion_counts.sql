-- Used by origin-admin's /monitoring page. Add as a migration in
-- origin-utm-tracking, then run `npm run supabase:generate-types` here.
--
-- Rows created in shop_events / shop_sessions per minute or hour (UTC) since
-- p_since. Only buckets with rows are returned; the dashboard fills gaps.

create or replace function public.admin_ingestion_counts(
  p_since timestamptz,
  p_bucket text
)
returns table (bucket timestamptz, events bigint, sessions bigint)
language sql
stable
set search_path = public
as $$
  with events as (
    select date_trunc(p_bucket, created_at, 'UTC') as bucket, count(*) as n
    from shop_events
    where created_at >= p_since
    group by 1
  ),
  sessions as (
    select date_trunc(p_bucket, created_at, 'UTC') as bucket, count(*) as n
    from shop_sessions
    where created_at >= p_since
    group by 1
  )
  select
    coalesce(events.bucket, sessions.bucket) as bucket,
    coalesce(events.n, 0) as events,
    coalesce(sessions.n, 0) as sessions
  from events
  full outer join sessions on sessions.bucket = events.bucket
  order by 1;
$$;

revoke execute on function public.admin_ingestion_counts(timestamptz, text) from public, anon, authenticated;
grant execute on function public.admin_ingestion_counts(timestamptz, text) to service_role;

-- Only needed if these don't already exist — check first. Without them every
-- call is a full table scan of shop_events.
-- create index concurrently if not exists shop_events_created_at_idx on public.shop_events (created_at);
-- create index concurrently if not exists shop_sessions_created_at_idx on public.shop_sessions (created_at);
