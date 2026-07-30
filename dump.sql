

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pgsodium";








ALTER SCHEMA "public" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."ATTRIBUTION_MODEL" AS ENUM (
    'LAST_TOUCH',
    'LAST_NON_DIRECT',
    'FIRST_TOUCH',
    'LINEAR',
    'TIME_DECAY'
);


ALTER TYPE "public"."ATTRIBUTION_MODEL" OWNER TO "postgres";


CREATE TYPE "public"."CONNECTED_ACCOUNT_STATUS" AS ENUM (
    'PENDING',
    'ERROR',
    'SYNCING',
    'OK'
);


ALTER TYPE "public"."CONNECTED_ACCOUNT_STATUS" OWNER TO "postgres";


CREATE TYPE "public"."COST_CATEGORY" AS ENUM (
    'COGS',
    'SHIPPING',
    'TAX',
    'REFUNDS',
    'MARKETING',
    'OPERATIONS',
    'OTHER',
    'TRANSACTION'
);


ALTER TYPE "public"."COST_CATEGORY" OWNER TO "postgres";


CREATE TYPE "public"."COST_RECURRING_INTERVAL" AS ENUM (
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'YEARLY'
);


ALTER TYPE "public"."COST_RECURRING_INTERVAL" OWNER TO "postgres";


CREATE TYPE "public"."COST_SOURCE" AS ENUM (
    'MANUAL',
    'SHOPIFY',
    'EXTERNAL_APP'
);


ALTER TYPE "public"."COST_SOURCE" OWNER TO "postgres";


CREATE TYPE "public"."DELAYED_EVENT_STATUS" AS ENUM (
    'PENDING',
    'PROCESSING',
    'DONE',
    'FAILED',
    'NEEDS_REVIEW'
);


ALTER TYPE "public"."DELAYED_EVENT_STATUS" OWNER TO "postgres";


CREATE TYPE "public"."NAMED_SOURCE_KIND" AS ENUM (
    'AD_PLATFORM',
    'UTM_SOURCE'
);


ALTER TYPE "public"."NAMED_SOURCE_KIND" OWNER TO "postgres";


CREATE TYPE "public"."ORDER_ATTRIBUTION_DATA_SOURCE" AS ENUM (
    'SHOPIFY',
    'PIXEL',
    'EMBED'
);


ALTER TYPE "public"."ORDER_ATTRIBUTION_DATA_SOURCE" OWNER TO "postgres";


CREATE TYPE "public"."ORDER_DOWNLOAD_STATUS" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'DONE',
    'ERROR',
    'ENQUEUED'
);


ALTER TYPE "public"."ORDER_DOWNLOAD_STATUS" OWNER TO "postgres";


CREATE TYPE "public"."ORDER_OVERAGE_STATUS" AS ENUM (
    'READY',
    'CHARGING',
    'CHARGED',
    'FAILED',
    'SKIPPED_TRIAL'
);


ALTER TYPE "public"."ORDER_OVERAGE_STATUS" OWNER TO "postgres";


CREATE TYPE "public"."PLAN_CHANGE_JOB_STATUS" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'DONE'
);


ALTER TYPE "public"."PLAN_CHANGE_JOB_STATUS" OWNER TO "postgres";


CREATE TYPE "public"."SHOP_CLIENT_SOURCE" AS ENUM (
    'SHOPIFY',
    'AUTO_GENERATED'
);


ALTER TYPE "public"."SHOP_CLIENT_SOURCE" OWNER TO "postgres";


CREATE TYPE "public"."SHOP_COST_SCOPE" AS ENUM (
    'STORE',
    'UTM',
    'AD_CAMPAIGN',
    'AD_SET',
    'AD'
);


ALTER TYPE "public"."SHOP_COST_SCOPE" OWNER TO "postgres";


CREATE TYPE "public"."SHOP_COST_TYPE" AS ENUM (
    'FIXED',
    'RECURRING',
    'PERCENT_AD_SPEND',
    'PER_CLICK'
);


ALTER TYPE "public"."SHOP_COST_TYPE" OWNER TO "postgres";


CREATE TYPE "public"."SHOP_EVENT_SOURCE" AS ENUM (
    'PIXEL',
    'EMBED'
);


ALTER TYPE "public"."SHOP_EVENT_SOURCE" OWNER TO "postgres";


CREATE TYPE "public"."STORE_SETUP_STATUS" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'DONE',
    'ERROR'
);


ALTER TYPE "public"."STORE_SETUP_STATUS" OWNER TO "postgres";


CREATE TYPE "public"."TOUCH_POSITION" AS ENUM (
    'FIRST',
    'LAST',
    'ANY'
);


ALTER TYPE "public"."TOUCH_POSITION" OWNER TO "postgres";


CREATE TYPE "public"."UTM_MATCH_TYPE" AS ENUM (
    'EXACT',
    'CONTAINS',
    'WILDCARD',
    'EMPTY'
);


ALTER TYPE "public"."UTM_MATCH_TYPE" OWNER TO "postgres";


CREATE TYPE "public"."UTM_SET_COST_MATCH_TYPE" AS ENUM (
    'EXACT',
    'CONTAINS',
    'REGEX',
    'NOT_SET',
    'WILDCARD'
);


ALTER TYPE "public"."UTM_SET_COST_MATCH_TYPE" OWNER TO "postgres";


CREATE TYPE "public"."UTM_SET_COST_TYPE" AS ENUM (
    'FIXED',
    'PER_CLICK'
);


ALTER TYPE "public"."UTM_SET_COST_TYPE" OWNER TO "postgres";


CREATE TYPE "public"."WEB_PIXEL_STATUS" AS ENUM (
    'OK',
    'ERROR',
    'DISABLED'
);


ALTER TYPE "public"."WEB_PIXEL_STATUS" OWNER TO "postgres";


CREATE TYPE "public"."ad_campaign_type" AS ENUM (
    'NORMAL',
    'PMAX'
);


ALTER TYPE "public"."ad_campaign_type" OWNER TO "postgres";


CREATE TYPE "public"."attribution_record" AS (
	"order_id" integer,
	"traffic_source_id" "uuid",
	"touch_ts" timestamp with time zone,
	"data_source" "public"."ORDER_ATTRIBUTION_DATA_SOURCE",
	"landing_page_id" "uuid"
);


ALTER TYPE "public"."attribution_record" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_kill_app_sessions"("p_app_name" "text", "p_min_age" interval DEFAULT '00:00:30'::interval, "p_limit" integer DEFAULT 100) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  killed int;
begin
  -- never kill autovacuum or the current session
  with victims as (
    select pid
    from pg_stat_activity
    where application_name = p_app_name
      and now() - backend_start >= p_min_age
      and pid <> pg_backend_pid()
      and application_name <> 'autovacuum'
    order by backend_start
    limit p_limit
  )
  select count(*) into killed
  from (
    select pg_terminate_backend(pid)
    from victims
  ) t;

  return killed;
end;
$$;


ALTER FUNCTION "public"."admin_kill_app_sessions"("p_app_name" "text", "p_min_age" interval, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_plan_visibility_change_flip_batch"("p_job_id" "uuid", "p_batch_size" integer DEFAULT 1000) RETURNS integer
    LANGUAGE "plpgsql"
    SET "statement_timeout" TO '30min'
    AS $$
DECLARE
    v_updated_count integer;
BEGIN
    -- Flip up to p_batch_size orders to their snapshot target. Idempotent: rows
    -- already at their target are excluded by IS DISTINCT FROM, so repeated calls
    -- (and retries) simply drain the remaining work. Returns the number flipped;
    -- the caller loops until this returns 0.
    WITH target AS (
        SELECT pvco.order_id, pvco.new_is_visible
        FROM public.plan_visibility_change_job_orders pvco
        JOIN public.orders o ON o.id = pvco.order_id
        WHERE pvco.job_id = p_job_id
        AND o.is_visible IS DISTINCT FROM pvco.new_is_visible
        LIMIT p_batch_size
    )
    UPDATE public.orders o
    SET is_visible = target.new_is_visible
    FROM target
    WHERE o.id = target.order_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$;


ALTER FUNCTION "public"."apply_plan_visibility_change_flip_batch"("p_job_id" "uuid", "p_batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_ads_summary_spend_shop_currency_for_shops"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_missing_count bigint;
BEGIN
  -- 1) Pre-check: find any rows that *need* a rate but don't have one
  WITH target_rows AS (
    SELECT
      asum.ad_id,
      asum.date,
      cp.shop,
      pa.currency_code              AS from_currency,
      s.currency_code    AS to_currency
    FROM public.ads_summary asum
    JOIN public.ads a
      ON a.id = asum.ad_id
    JOIN public.ad_sets aset
      ON aset.id = a.ad_set_id
    JOIN public.ad_campaigns ac
      ON ac.id = aset.ad_campaign_id
    JOIN public.platform_accounts pa
      ON pa.id = ac.platform_account_id
    JOIN public.connected_platforms cp
      ON cp.id = pa.platform_id
    JOIN public.shops s
      ON s.shop = cp.shop
    WHERE cp.shop IN (
      -- 'pn2dfz-py.myshopify.com'
      -- 'doctorblet.myshopify.com'
      'entropymakeup.myshopify.com'
    )
      AND asum.spend > 0
  ),
  missing_rates AS (
    SELECT tr.*
    FROM target_rows tr
    LEFT JOIN public.currency_conversion_rates ccr
      ON ccr.date          = tr.date
     AND ccr.from_currency = tr.from_currency
     AND ccr.to_currency   = tr.to_currency
    WHERE ccr.rate IS NULL
  )
  SELECT COUNT(*) INTO v_missing_count FROM missing_rates;

  IF v_missing_count > 0 THEN
    RAISE EXCEPTION
      'Missing currency conversion rates for % ads_summary rows. Please insert currency_conversion_rates first.',
      v_missing_count;
  END IF;

  -- 2) Perform the update now that we know all rates exist
	UPDATE public.ads_summary AS asum
	SET spend_shop_currency = asum.spend * ccr.rate
	FROM public.ads a
	JOIN public.ad_sets aset
	  ON aset.id = a.ad_set_id
	JOIN public.ad_campaigns ac
	  ON ac.id = aset.ad_campaign_id
	JOIN public.platform_accounts pa
	  ON pa.id = ac.platform_account_id
	JOIN public.connected_platforms cp
	  ON cp.id = pa.platform_id
	JOIN public.shops s
	  ON s.shop = cp.shop
	JOIN public.currency_conversion_rates ccr
	  ON ccr.from_currency = pa.currency_code
	 AND ccr.to_currency   = s.currency_code
	WHERE asum.ad_id = a.id
	  AND ccr.date   = asum.date              -- moved here
	  AND cp.shop IN (
	    -- 'pn2dfz-py.myshopify.com'
	    -- 'doctorblet.myshopify.com'
	    'entropymakeup.myshopify.com'
	  )
	  AND asum.spend > 0;
END;
$$;


ALTER FUNCTION "public"."backfill_ads_summary_spend_shop_currency_for_shops"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_converting_session_id_batch"("p_shop" "text", "p_batch_size" integer DEFAULT 500, "p_after_id" bigint DEFAULT 0) RETURNS TABLE("updated_count" bigint, "last_id" bigint, "batch_count" bigint, "done" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH batch AS (
    SELECT o.id
    FROM public.orders o
    WHERE o.shop = p_shop
      AND o.converting_session_id IS NULL
      AND o.id > p_after_id
    ORDER BY o.id
    LIMIT p_batch_size
  ),
  latest AS (
    SELECT DISTINCT ON (oa.order_id)
      oa.order_id,
      oa.session_id
    FROM public.order_attributions oa
    JOIN batch b ON b.id = oa.order_id
    WHERE oa.session_id IS NOT NULL
    ORDER BY oa.order_id, oa.touch_ts DESC
  ),
  upd AS (
    UPDATE public.orders o
    SET converting_session_id = l.session_id
    FROM latest l
    WHERE o.id = l.order_id
      AND o.converting_session_id IS NULL
    RETURNING o.id
  )
  SELECT
    (SELECT COUNT(*) FROM upd)                         AS updated_count,
    (SELECT COALESCE(MAX(id), p_after_id) FROM batch)  AS last_id,
    (SELECT COUNT(*) FROM batch)                       AS batch_count,
    ((SELECT COUNT(*) FROM batch) = 0)                 AS done;
END;
$$;


ALTER FUNCTION "public"."backfill_converting_session_id_batch"("p_shop" "text", "p_batch_size" integer, "p_after_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_shop_events_client_id"("p_batch_size" integer DEFAULT 5000, "p_pause_ms" integer DEFAULT 50) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_rows int;
begin
  loop
    with batch as (
      select e.id, s.client_id
      from public.shop_events e
      join public.shop_sessions s
        on s.id = e.session_id
      where e.client_id is null
      order by e.id
      limit p_batch_size
    )
    update public.shop_events e
       set client_id = b.client_id
      from batch b
     where e.id = b.id;

    get diagnostics v_rows = row_count;
    exit when v_rows = 0;

    -- small pause to reduce pressure; adjust as you like
    perform pg_sleep(p_pause_ms / 1000.0);
  end loop;
end;
$$;


ALTER FUNCTION "public"."backfill_shop_events_client_id"("p_batch_size" integer, "p_pause_ms" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_summary_zero_values"("p_shop" "text", "p_start_date" "date", "p_end_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "statement_timeout" TO '15min'
    AS $$
DECLARE
    v_platform_id BIGINT;
    v_platform_account_id BIGINT;
    v_ad_campaign_id BIGINT;
    v_ad_set_id BIGINT;
BEGIN
    -- Loop through each connected platform for the shop
    FOR v_platform_id IN (
        SELECT id FROM connected_platforms WHERE shop = p_shop
    ) LOOP
        -- Loop through each platform account
        FOR v_platform_account_id IN (
            SELECT id FROM platform_accounts WHERE platform_id = v_platform_id
        ) LOOP
            -- Insert zero-value rows for ad_campaigns_summary
            INSERT INTO ad_campaigns_summary (date, ad_campaign_id)
            SELECT d.date, ac.id
            FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d(date)
            CROSS JOIN ad_campaigns ac
            WHERE ac.platform_account_id = v_platform_account_id
            AND NOT EXISTS (
                SELECT 1 FROM ad_campaigns_summary acs
                WHERE acs.ad_campaign_id = ac.id AND acs.date = d.date
            );

            -- Loop through each ACTIVE ad campaign
            FOR v_ad_campaign_id IN (
                SELECT id FROM ad_campaigns
                WHERE platform_account_id = v_platform_account_id
                AND status = 'ACTIVE'
            ) LOOP
                -- Insert zero-value rows for ad_sets_summary
                INSERT INTO ad_sets_summary (date, ad_set_id)
                SELECT d.date, ads.id
                FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d(date)
                CROSS JOIN ad_sets ads
                WHERE ads.ad_campaign_id = v_ad_campaign_id
                AND NOT EXISTS (
                    SELECT 1 FROM ad_sets_summary ass
                    WHERE ass.ad_set_id = ads.id AND ass.date = d.date
                );

                -- Loop through each ad set
                FOR v_ad_set_id IN (
                    SELECT id FROM ad_sets WHERE ad_campaign_id = v_ad_campaign_id
                ) LOOP
                    -- Insert zero-value rows for ads_summary
                    INSERT INTO ads_summary (date, ad_id)
                    SELECT d.date, a.id
                    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d(date)
                    CROSS JOIN ads a
                    WHERE a.ad_set_id = v_ad_set_id
                    AND NOT EXISTS (
                        SELECT 1 FROM ads_summary ads
                        WHERE ads.ad_id = a.id AND ads.date = d.date
                    );
                END LOOP;
            END LOOP;
        END LOOP;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."backfill_summary_zero_values"("p_shop" "text", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_create_past_order_attributions_from_shopify_id"("p_order_ids" "text"[], "p_shop_url" "text") RETURNS TABLE("processed_orders" integer, "created_attributions" integer, "created_traffic_sources" integer, "created_landing_pages" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    processed_count INTEGER := 0;
    attributions_count INTEGER := 0;
    traffic_sources_count INTEGER := 0;
    landing_pages_count INTEGER := 0;
BEGIN
    -- Step 0: do not touch orders that already have attributions
    WITH orders_to_do AS (
      SELECT 
        o.id          AS order_id,
        o.shop        AS shop,
        o.first_visit AS first_visit,
        o.last_visit  AS last_visit
      FROM orders o
      WHERE o.order_id = ANY(p_order_ids)
        AND o.shop = p_shop_url
        AND (
          (
            (o.first_visit IS NOT NULL AND o.first_visit->>'occurredAt' IS NOT NULL) OR
            (o.last_visit  IS NOT NULL AND o.last_visit ->>'occurredAt' IS NOT NULL)
          )
          AND NOT EXISTS (SELECT 1 FROM order_attributions oa WHERE oa.order_id = o.id)
        )
    ),

    -- Step 1: Extract visit data (raw, no rank yet)
    visit_data AS (
      SELECT 
        od.order_id,
        od.shop,
        CASE 
          WHEN od.first_visit IS NOT NULL AND od.first_visit->>'occurredAt' IS NOT NULL THEN
            jsonb_build_object(
              'visit_type', 'first',
              'occurred_at',  od.first_visit->>'occurredAt',
              'utm_source',   COALESCE(od.first_visit->'utmParameters'->>'source',   ''),
              'utm_medium',   COALESCE(od.first_visit->'utmParameters'->>'medium',   ''),
              'utm_campaign', COALESCE(od.first_visit->'utmParameters'->>'campaign', ''),
              'utm_term',     COALESCE(od.first_visit->'utmParameters'->>'term',     ''),
              'utm_content',  COALESCE(od.first_visit->'utmParameters'->>'content',  ''),
              'landing_page', NULLIF(split_part(od.first_visit->>'landingPage', '?', 1), '')
            )
          ELSE NULL
        END AS first_visit_data,
        CASE 
          WHEN od.last_visit IS NOT NULL AND od.last_visit->>'occurredAt' IS NOT NULL THEN
            jsonb_build_object(
              'visit_type',  'last',
              'occurred_at',  od.last_visit->>'occurredAt',
              'utm_source',   COALESCE(od.last_visit->'utmParameters'->>'source',   ''),
              'utm_medium',   COALESCE(od.last_visit->'utmParameters'->>'medium',   ''),
              'utm_campaign', COALESCE(od.last_visit->'utmParameters'->>'campaign', ''),
              'utm_term',     COALESCE(od.last_visit->'utmParameters'->>'term',     ''),
              'utm_content',  COALESCE(od.last_visit->'utmParameters'->>'content',  ''),
              'landing_page', NULLIF(split_part(od.last_visit->>'landingPage', '?', 1), '')
            )
          ELSE NULL
        END AS last_visit_data
      FROM orders_to_do od
    ),

    -- Step 2: Flatten visits
    flattened_visits_raw AS (
      SELECT 
        order_id,
        shop,
        visit_data->>'visit_type'                       AS visit_type,
        (visit_data->>'occurred_at')::timestamptz       AS occurred_at,
        visit_data->>'utm_source'                       AS utm_source,
        visit_data->>'utm_medium'                       AS utm_medium,
        visit_data->>'utm_campaign'                     AS utm_campaign,
        visit_data->>'utm_term'                         AS utm_term,
        visit_data->>'utm_content'                      AS utm_content,
        visit_data->>'landing_page'                     AS landing_page
      FROM visit_data
      CROSS JOIN LATERAL (
        SELECT visit_data 
        FROM (VALUES (first_visit_data), (last_visit_data)) AS t(visit_data)
        WHERE visit_data IS NOT NULL
      ) AS visits
    ),

    -- Step 2b: DEDUP visits by (occurred_at, landing_page, UTM params) per order
    -- Prefer 'first' over 'last' when both exist with identical keys
    flattened_visits AS (
        SELECT
            order_id,
            shop,
            visit_type,
            occurred_at,
            utm_source,
            utm_medium,
            utm_campaign,
            utm_term,
            utm_content,
            landing_page,
            ROW_NUMBER() OVER (
                PARTITION BY order_id
                ORDER BY occurred_at ASC,
                         CASE visit_type WHEN 'first' THEN 1 WHEN 'last' THEN 2 ELSE 3 END
            ) - 1 AS touch_rank
        FROM (
            SELECT DISTINCT ON (
                order_id,
                occurred_at,
                COALESCE(landing_page, ''),
                COALESCE(utm_source,  ''),
                COALESCE(utm_medium,  ''),
                COALESCE(utm_campaign,''),
                COALESCE(utm_term,    ''),
                COALESCE(utm_content, '')
            )
                order_id,
                shop,
                visit_type,
                occurred_at,
                utm_source,
                utm_medium,
                utm_campaign,
                utm_term,
                utm_content,
                landing_page
            FROM flattened_visits_raw
            ORDER BY
                order_id,
                occurred_at,
                COALESCE(landing_page, ''),
                COALESCE(utm_source,  ''),
                COALESCE(utm_medium,  ''),
                COALESCE(utm_campaign,''),
                COALESCE(utm_term,    ''),
                COALESCE(utm_content, ''),
                CASE visit_type WHEN 'first' THEN 1 WHEN 'last' THEN 2 ELSE 3 END
        ) d
    ),

    -- Step 4: Create unique traffic sources (bulk upsert)
    unique_traffic_sources AS (
      SELECT DISTINCT
        shop,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content
      FROM flattened_visits
    ),

    upserted_traffic_sources AS (
      INSERT INTO traffic_sources (
        shop, platform_key, platform_ad_id, platform_campaign_id,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content
      )
      SELECT 
        shop, '', '', '',
        utm_source, utm_medium, utm_campaign, utm_term, utm_content
      FROM unique_traffic_sources
      ON CONFLICT (shop, platform_key, platform_ad_id, platform_campaign_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term) 
        DO UPDATE SET utm_source = EXCLUDED.utm_source
      RETURNING id, shop, utm_source, utm_medium, utm_campaign, utm_term, utm_content, created_at
    ),

    -- Step 5: existing + new traffic sources
    all_traffic_sources_raw AS (
      SELECT id, shop, utm_source, utm_medium, utm_campaign, utm_term, utm_content, created_at
      FROM upserted_traffic_sources
      UNION ALL
      SELECT ts.id, ts.shop, ts.utm_source, ts.utm_medium, ts.utm_campaign, ts.utm_term, ts.utm_content, ts.created_at
      FROM traffic_sources ts
      JOIN unique_traffic_sources uts ON (
        ts.shop = uts.shop
        AND COALESCE(ts.utm_source,  '') = COALESCE(uts.utm_source,  '')
        AND COALESCE(ts.utm_medium,  '') = COALESCE(uts.utm_medium,  '')
        AND COALESCE(ts.utm_campaign,'') = COALESCE(uts.utm_campaign,'')
        AND COALESCE(ts.utm_term,    '') = COALESCE(uts.utm_term,    '')
        AND COALESCE(ts.utm_content, '') = COALESCE(uts.utm_content, '')
        AND ts.platform_key = ''
        AND ts.platform_ad_id = ''
      )
    ),

    all_traffic_sources AS (
      SELECT DISTINCT ON (
        shop,
        COALESCE(utm_source,  ''),
        COALESCE(utm_medium,  ''),
        COALESCE(utm_campaign,''),
        COALESCE(utm_term,    ''),
        COALESCE(utm_content, '')
      )
      id, shop, utm_source, utm_medium, utm_campaign, utm_term, utm_content
      FROM all_traffic_sources_raw
      ORDER BY
        shop,
        COALESCE(utm_source,  ''),
        COALESCE(utm_medium,  ''),
        COALESCE(utm_campaign,''),
        COALESCE(utm_term,    ''),
        COALESCE(utm_content, ''),
        created_at ASC
    ),

    -- Step 6: landing pages (bulk upsert)
    unique_landing_pages AS (
      SELECT DISTINCT shop, landing_page AS normalized_landing_page
      FROM flattened_visits
      WHERE landing_page IS NOT NULL AND landing_page <> ''
    ),

    upserted_landing_pages AS (
      INSERT INTO landing_pages (shop, normalized_landing_page)
      SELECT shop, normalized_landing_page
      FROM unique_landing_pages
      ON CONFLICT (shop, normalized_landing_page) DO NOTHING
      RETURNING id, shop, normalized_landing_page, created_at
    ),

    all_landing_pages_raw AS (
      SELECT id, shop, normalized_landing_page, created_at
      FROM upserted_landing_pages
      UNION ALL
      SELECT lp.id, lp.shop, lp.normalized_landing_page, lp.created_at
      FROM landing_pages lp
      JOIN unique_landing_pages ulp
        ON lp.shop = ulp.shop
        AND lp.normalized_landing_page = ulp.normalized_landing_page
    ),

    all_landing_pages AS (
      SELECT DISTINCT ON (shop, normalized_landing_page)
        id, shop, normalized_landing_page
      FROM all_landing_pages_raw
      ORDER BY shop, normalized_landing_page, created_at ASC
    ),

    -- Step 7: Prepare attributions
    prepared_attributions AS (
      SELECT 
        fv.order_id,
        ats.id  AS traffic_source_id,
        fv.occurred_at AS touch_ts,
        fv.touch_rank,
        'SHOPIFY'::"ORDER_ATTRIBUTION_DATA_SOURCE" AS data_source,
        alp.id                                     AS landing_page_id
      FROM flattened_visits fv
      JOIN all_traffic_sources ats ON (
        fv.shop = ats.shop
        AND COALESCE(fv.utm_source,  '') = COALESCE(ats.utm_source,  '')
        AND COALESCE(fv.utm_medium,  '') = COALESCE(ats.utm_medium,  '')
        AND COALESCE(fv.utm_campaign,'') = COALESCE(ats.utm_campaign,'')
        AND COALESCE(fv.utm_term,    '') = COALESCE(ats.utm_term,    '')
        AND COALESCE(fv.utm_content, '') = COALESCE(ats.utm_content, '')
      )
      LEFT JOIN all_landing_pages alp ON (
        fv.shop = alp.shop
        AND fv.landing_page = alp.normalized_landing_page
      )
    ),

    -- Step 8: Insert attributions (extra guard: NOT EXISTS on order_id, touch_ts, ts, lp)
    inserted_attributions AS (
      INSERT INTO order_attributions (
        order_id, traffic_source_id, touch_rank,
        touch_ts, data_source, landing_page_id
      )
      SELECT
        pa.order_id, pa.traffic_source_id, pa.touch_rank,
        pa.touch_ts, pa.data_source, pa.landing_page_id
      FROM prepared_attributions pa
      WHERE NOT EXISTS (
        SELECT 1
        FROM order_attributions oa
        WHERE oa.order_id = pa.order_id
          AND oa.touch_ts = pa.touch_ts
          AND oa.traffic_source_id = pa.traffic_source_id
          AND oa.landing_page_id IS NOT DISTINCT FROM pa.landing_page_id
      )
      ON CONFLICT (order_id, traffic_source_id, touch_rank) DO NOTHING
      RETURNING 1
    )
    SELECT
      (SELECT COUNT(DISTINCT order_id) FROM flattened_visits)::INTEGER,
      (SELECT COUNT(*) FROM inserted_attributions)::INTEGER,
      (SELECT COUNT(*) FROM upserted_traffic_sources)::INTEGER,
      (SELECT COUNT(*) FROM upserted_landing_pages)::INTEGER
    INTO processed_count, attributions_count, traffic_sources_count, landing_pages_count;

    RETURN QUERY
    SELECT processed_count, attributions_count, traffic_sources_count, landing_pages_count;
END;
$$;


ALTER FUNCTION "public"."bulk_create_past_order_attributions_from_shopify_id"("p_order_ids" "text"[], "p_shop_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_insert_customer_first_orders_for_shop"("p_shop" "text") RETURNS integer
    LANGUAGE "sql"
    AS $$
WITH first_orders AS (
  SELECT
    shop,
    customer_shopify_id,
    id               AS order_id,
    order_created_at AS order_created_at
  FROM (
    SELECT
      o.*,
      row_number() OVER (
        PARTITION BY o.shop, o.customer_shopify_id
        ORDER BY o.order_created_at, o.id
      ) AS rn
    FROM public.orders o
    WHERE o.shop = p_shop
      AND o.customer_shopify_id IS NOT NULL
  ) t
  WHERE rn = 1
),
ins AS (
  INSERT INTO public.customer_first_orders (
    shop,
    customer_shopify_id,
    order_id,
    order_created_at
  )
  SELECT
    shop,
    customer_shopify_id,
    order_id,
    order_created_at
  FROM first_orders
  -- update in case new orders have come in since starting the sync
  -- and an order was incorrectly identified as the first
  ON CONFLICT (shop, customer_shopify_id) DO UPDATE SET
    order_id         = EXCLUDED.order_id,
    order_created_at = EXCLUDED.order_created_at
  RETURNING 1
)
SELECT COUNT(*) FROM ins;
$$;


ALTER FUNCTION "public"."bulk_insert_customer_first_orders_for_shop"("p_shop" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_insert_customer_first_orders_for_shop"("p_shop" "text", "p_batch_size" integer DEFAULT 5000, "p_sleep_ms" numeric DEFAULT 50) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_offset        INTEGER := 0;
  v_total_upserted INTEGER := 0;
  v_batch_count   INTEGER;
BEGIN
  -- Create a temp table of all distinct customers for this shop so we
  -- can page through them cheaply without re-scanning orders each time.
  CREATE TEMP TABLE _cfo_customers ON COMMIT DROP AS
    SELECT DISTINCT customer_shopify_id
    FROM public.orders
    WHERE shop = p_shop
      AND customer_shopify_id IS NOT NULL;

  LOOP
    WITH batch_customers AS (
      SELECT customer_shopify_id
      FROM _cfo_customers
      ORDER BY customer_shopify_id
      LIMIT p_batch_size
      OFFSET v_offset
    ),
    first_orders AS (
      SELECT DISTINCT ON (o.customer_shopify_id)
        o.shop,
        o.customer_shopify_id,
        o.id               AS order_id,
        o.order_created_at
      FROM public.orders o
      JOIN batch_customers bc USING (customer_shopify_id)
      WHERE o.shop = p_shop
        AND o.customer_shopify_id IS NOT NULL
      ORDER BY o.customer_shopify_id, o.order_created_at, o.id
    ),
    ins AS (
      INSERT INTO public.customer_first_orders (
        shop,
        customer_shopify_id,
        order_id,
        order_created_at
      )
      SELECT shop, customer_shopify_id, order_id, order_created_at
      FROM first_orders
      ON CONFLICT (shop, customer_shopify_id) DO UPDATE SET
        order_id         = EXCLUDED.order_id,
        order_created_at = EXCLUDED.order_created_at
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_batch_count FROM ins;

    v_total_upserted := v_total_upserted + v_batch_count;
    v_offset         := v_offset + p_batch_size;

    -- No more rows to process
    EXIT WHEN v_batch_count = 0;

    -- Yield briefly so other transactions can acquire locks
    PERFORM pg_sleep(p_sleep_ms / 1000.0);
  END LOOP;

  RETURN v_total_upserted;
END;
$$;


ALTER FUNCTION "public"."bulk_insert_customer_first_orders_for_shop"("p_shop" "text", "p_batch_size" integer, "p_sleep_ms" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_insert_customer_first_orders_for_shop_batch"("p_shop" "text", "p_batch_size" integer DEFAULT 5000, "p_sleep_ms" numeric DEFAULT 50) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_offset        INTEGER := 0;
  v_total_upserted INTEGER := 0;
  v_batch_count   INTEGER;
BEGIN
  -- Create a temp table of all distinct customers for this shop so we
  -- can page through them cheaply without re-scanning orders each time.
  CREATE TEMP TABLE _cfo_customers ON COMMIT DROP AS
    SELECT DISTINCT customer_shopify_id
    FROM public.orders
    WHERE shop = p_shop
      AND customer_shopify_id IS NOT NULL;

  LOOP
    WITH batch_customers AS (
      SELECT customer_shopify_id
      FROM _cfo_customers
      ORDER BY customer_shopify_id
      LIMIT p_batch_size
      OFFSET v_offset
    ),
    first_orders AS (
      SELECT DISTINCT ON (o.customer_shopify_id)
        o.shop,
        o.customer_shopify_id,
        o.id               AS order_id,
        o.order_created_at
      FROM public.orders o
      JOIN batch_customers bc USING (customer_shopify_id)
      WHERE o.shop = p_shop
        AND o.customer_shopify_id IS NOT NULL
      ORDER BY o.customer_shopify_id, o.order_created_at, o.id
    ),
    ins AS (
      INSERT INTO public.customer_first_orders (
        shop,
        customer_shopify_id,
        order_id,
        order_created_at
      )
      SELECT shop, customer_shopify_id, order_id, order_created_at
      FROM first_orders
      ON CONFLICT (shop, customer_shopify_id) DO UPDATE SET
        order_id         = EXCLUDED.order_id,
        order_created_at = EXCLUDED.order_created_at
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_batch_count FROM ins;

    v_total_upserted := v_total_upserted + v_batch_count;
    v_offset         := v_offset + p_batch_size;

    -- No more rows to process
    EXIT WHEN v_batch_count = 0;

    -- Yield briefly so other transactions can acquire locks
    PERFORM pg_sleep(p_sleep_ms / 1000.0);
  END LOOP;

  RETURN v_total_upserted;
END;
$$;


ALTER FUNCTION "public"."bulk_insert_customer_first_orders_for_shop_batch"("p_shop" "text", "p_batch_size" integer, "p_sleep_ms" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_update_orders_source_name"("p_orders" "jsonb") RETURNS SETOF bigint
    LANGUAGE "sql"
    AS $$
WITH payload AS (
  SELECT
    elem ->> 'order_id'              AS order_id,
    NULLIF(elem ->> 'source_name', '') AS source_name
  FROM jsonb_array_elements(p_orders) AS t(elem)
),
updated AS (
  UPDATE public.orders o
  SET source_name = COALESCE(p.source_name, o.source_name)
  FROM payload p
  WHERE o.order_id = p.order_id
    AND p.source_name IS NOT NULL      -- don’t overwrite with NULL/empty
  RETURNING o.id
)
SELECT id FROM updated;
$$;


ALTER FUNCTION "public"."bulk_update_orders_source_name"("p_orders" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_shop_ad_hierarchies_summary"("p_shop" "text", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("level" "text", "id" bigint, "updated_rows" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_ad_rows          BIGINT := 0;
  v_ad_set_rows      BIGINT;
  v_ad_campaign_rows BIGINT;
BEGIN
  WITH shop_ad_sets AS (
    SELECT DISTINCT as_set.id AS ad_set_id
    FROM ad_sets as_set
    JOIN ad_campaigns camp      ON as_set.ad_campaign_id = camp.id
    JOIN platform_accounts pa   ON camp.platform_account_id = pa.id
    JOIN connected_platforms cp ON pa.platform_id = cp.id
    JOIN shops s                ON cp.shop = s.shop
    WHERE s.shop = p_shop
  ),
  aggregated AS (
    SELECT
      ads.date,
      a.ad_set_id,
      SUM(ads.clicks)              AS clicks,
      SUM(ads.spend)               AS spend,
      SUM(ads.spend_shop_currency) AS spend_shop_currency,
      SUM(ads.impressions)         AS impressions
    FROM ads_summary ads
    JOIN ads a          ON ads.ad_id = a.id
    JOIN shop_ad_sets s ON a.ad_set_id = s.ad_set_id
    WHERE ads.date >= p_start_date AND ads.date <= p_end_date
    GROUP BY ads.date, a.ad_set_id
  ),
  upserted AS (
    INSERT INTO ad_sets_summary (
      date,
      ad_set_id,
      clicks,
      spend,
      spend_shop_currency,
      impressions
    )
    SELECT
      ag.date,
      ag.ad_set_id,
      ag.clicks,
      ag.spend,
      ag.spend_shop_currency,
      ag.impressions
    FROM aggregated ag
    ON CONFLICT ((date), ad_set_id) DO UPDATE
      SET clicks            = EXCLUDED.clicks,
        spend               = EXCLUDED.spend,
        spend_shop_currency = EXCLUDED.spend_shop_currency,
        impressions         = EXCLUDED.impressions
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_ad_set_rows FROM upserted;

  WITH shop_ad_campaigns AS (
    SELECT DISTINCT camp.id AS ad_campaign_id
    FROM ad_campaigns camp
    JOIN platform_accounts pa   ON camp.platform_account_id = pa.id
    JOIN connected_platforms cp ON pa.platform_id = cp.id
    JOIN shops s                ON cp.shop = s.shop
    WHERE s.shop = p_shop
  ),
  aggregated AS (
    SELECT
      ass.date,
      as_set.ad_campaign_id,
      SUM(ass.clicks)              AS clicks,
      SUM(ass.spend)               AS spend,
      SUM(ass.spend_shop_currency) AS spend_shop_currency,
      SUM(ass.impressions)         AS impressions
    FROM ad_sets_summary ass
    JOIN ad_sets as_set        ON ass.ad_set_id = as_set.id
    JOIN shop_ad_campaigns sac ON as_set.ad_campaign_id = sac.ad_campaign_id
    WHERE ass.date >= p_start_date AND ass.date <= p_end_date
    GROUP BY ass.date, as_set.ad_campaign_id
  ),
  upserted AS (
    INSERT INTO ad_campaigns_summary (
      date,
      ad_campaign_id,
      clicks,
      spend,
      spend_shop_currency,
      impressions
    )
    SELECT
      ag.date,
      ag.ad_campaign_id,
      ag.clicks,
      ag.spend,
      ag.spend_shop_currency,
      ag.impressions
    FROM aggregated ag
    ON CONFLICT ((date), ad_campaign_id) DO UPDATE
      SET clicks            = EXCLUDED.clicks,
        spend               = EXCLUDED.spend,
        spend_shop_currency = EXCLUDED.spend_shop_currency,
        impressions         = EXCLUDED.impressions
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_ad_campaign_rows FROM upserted;

  RETURN QUERY
  SELECT 'ad'          AS level, NULL::BIGINT AS id, v_ad_rows
  UNION ALL
  SELECT 'ad_set'      AS level, NULL::BIGINT AS id, v_ad_set_rows
  UNION ALL
  SELECT 'ad_campaign' AS level, NULL::BIGINT AS id, v_ad_campaign_rows;

END;
$$;


ALTER FUNCTION "public"."calculate_shop_ad_hierarchies_summary"("p_shop" "text", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carry_forward_order_count_on_plan_change"("p_shop" "text", "p_old_billing_period_end" timestamp with time zone, "p_new_billing_period_start" timestamp with time zone, "p_new_billing_period_end" timestamp with time zone) RETURNS TABLE("carried_seen_orders" bigint)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_seen_orders bigint;
  v_allowance   integer;
begin
  -- Read previous period counter
  select
    c.seen_orders,
    c.allowance
  into
    v_seen_orders,
    v_allowance
  from public.shop_billing_period_counters c
  where c.shop = p_shop
    and c.billing_period_end = p_old_billing_period_end;

  if not found then
    raise exception
      'Previous billing period counter not found for shop %, billing_period_end %',
      p_shop, p_old_billing_period_end;
  end if;

  -- Create / update the new billing period counter,
  -- carrying forward the consumed order count
  insert into public.shop_billing_period_counters (
    shop,
    billing_period_end,
    billing_period_start,
    allowance,
    seen_orders,

    -- IMPORTANT: reset pointers so the new cycle processes its own orders cleanly
    last_processed_order_created_at,
    last_processed_order_pk_id
  )
  values (
    p_shop,
    p_new_billing_period_end,
    p_new_billing_period_start,
    v_allowance,
    v_seen_orders,

    '-infinity'::timestamptz,
    0::bigint
  )
  on conflict (shop, billing_period_end) do update
  set
    billing_period_start = excluded.billing_period_start,
    allowance            = excluded.allowance,

    -- idempotent: never reduce the carried count
    seen_orders = greatest(
      public.shop_billing_period_counters.seen_orders,
      excluded.seen_orders
    ),

    -- keep pointers at the earliest possible value
    last_processed_order_created_at = least(
      public.shop_billing_period_counters.last_processed_order_created_at,
      excluded.last_processed_order_created_at
    ),
    last_processed_order_pk_id = least(
      public.shop_billing_period_counters.last_processed_order_pk_id,
      excluded.last_processed_order_pk_id
    );

  carried_seen_orders := v_seen_orders;
  return;
end $$;


ALTER FUNCTION "public"."carry_forward_order_count_on_plan_change"("p_shop" "text", "p_old_billing_period_end" timestamp with time zone, "p_new_billing_period_start" timestamp with time zone, "p_new_billing_period_end" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carry_forward_order_count_on_plan_change"("p_shop" "text", "p_old_billing_period_end" timestamp with time zone, "p_new_billing_period_start" timestamp with time zone, "p_new_billing_period_end" timestamp with time zone, "p_allowance" integer) RETURNS TABLE("carried_seen_orders" bigint)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_seen_orders bigint;
begin
  -- Read previous period counter
  select
    c.seen_orders
  into
    v_seen_orders
  from public.shop_billing_period_counters c
  where c.shop = p_shop
    and c.billing_period_end = p_old_billing_period_end;

  if not found then
    return;
  end if;

  -- Create / update the new billing period counter,
  -- carrying forward the consumed order count
  insert into public.shop_billing_period_counters (
    shop,
    billing_period_end,
    billing_period_start,
    allowance,
    seen_orders,

    -- IMPORTANT: reset pointers so the new cycle processes its own orders cleanly
    last_processed_order_created_at,
    last_processed_order_id
  )
  values (
    p_shop,
    p_new_billing_period_end,
    p_new_billing_period_start,
    p_allowance,
    v_seen_orders,

    '-infinity'::timestamptz,
    0::bigint
  )
  on conflict (shop, billing_period_end) do update
  set
    billing_period_start = excluded.billing_period_start,
    allowance            = excluded.allowance,

    -- idempotent: never reduce the carried count
    seen_orders = greatest(
      public.shop_billing_period_counters.seen_orders,
      excluded.seen_orders
    ),

    -- keep pointers at the earliest possible value
    last_processed_order_created_at = least(
      public.shop_billing_period_counters.last_processed_order_created_at,
      excluded.last_processed_order_created_at
    ),
    last_processed_order_id = least(
      public.shop_billing_period_counters.last_processed_order_id,
      excluded.last_processed_order_id
    );

  carried_seen_orders := v_seen_orders;
  return;
end $$;


ALTER FUNCTION "public"."carry_forward_order_count_on_plan_change"("p_shop" "text", "p_old_billing_period_end" timestamp with time zone, "p_new_billing_period_start" timestamp with time zone, "p_new_billing_period_end" timestamp with time zone, "p_allowance" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_order_overage_batch"("p_shop" "text", "p_billing_period_end" timestamp with time zone, "p_limit" integer DEFAULT 200) RETURNS TABLE("id" "uuid", "shop" "text", "billing_period_end" timestamp with time zone, "billing_period_start" timestamp with time zone, "order_id" bigint, "shopify_order_id" "text", "order_created_at" timestamp with time zone)
    LANGUAGE "sql"
    AS $$
with to_claim as (
  select r.id
  from public.order_overage_records r
  where r.shop = p_shop
    and r.billing_period_end = p_billing_period_end
    and r.status in ('READY', 'FAILED')
  order by r.order_created_at, r.order_id
  limit p_limit
  for update skip locked
)
update public.order_overage_records r
set
  status     = 'CHARGING',
  claimed_at = now(),
  error      = null
where r.id in (select id from to_claim)
returning
  r.id,
  r.shop,
  r.billing_period_end,
  r.billing_period_start,
  r.order_id,
  r.shopify_order_id,
  r.order_created_at;
$$;


ALTER FUNCTION "public"."claim_order_overage_batch"("p_shop" "text", "p_billing_period_end" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_shop_data"("p_shop" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- 1. Ad reporting
  delete from ads_summary              using ads a, ad_sets s, ad_campaigns c, platform_accounts pa, connected_platforms cp
    where ads_summary.ad_id = a.id
      and a.ad_set_id             = s.id
      and s.ad_campaign_id        = c.id
      and c.platform_account_id   = pa.id
      and pa.platform_id          = cp.id
      and cp.shop                 = p_shop;

  delete from ad_sets_summary          using ad_sets s, ad_campaigns c, platform_accounts pa, connected_platforms cp
    where ad_sets_summary.ad_set_id = s.id
      and s.ad_campaign_id         = c.id
      and c.platform_account_id    = pa.id
      and pa.platform_id           = cp.id
      and cp.shop                  = p_shop;

  delete from ad_campaigns_summary     using ad_campaigns c, platform_accounts pa, connected_platforms cp
    where ad_campaigns_summary.ad_campaign_id = c.id
      and c.platform_account_id              = pa.id
      and pa.platform_id                     = cp.id
      and cp.shop                            = p_shop;

  -- 2. Ads, AdSets, AdCampaigns
  delete from ads                        using ads a, ad_sets s, ad_campaigns c, platform_accounts pa, connected_platforms cp
    where a.id                   = ads.id
      and a.ad_set_id            = s.id
      and s.ad_campaign_id       = c.id
      and c.platform_account_id  = pa.id
      and pa.platform_id         = cp.id
      and cp.shop                = p_shop;

  delete from ad_sets                   using ad_sets s, ad_campaigns c, platform_accounts pa, connected_platforms cp
    where s.id                  = ad_sets.id
      and s.ad_campaign_id      = c.id
      and c.platform_account_id = pa.id
      and pa.platform_id        = cp.id
      and cp.shop               = p_shop;

  delete from ad_campaigns              using ad_campaigns c, platform_accounts pa, connected_platforms cp
    where c.id                  = ad_campaigns.id
      and c.platform_account_id = pa.id
      and pa.platform_id        = cp.id
      and cp.shop               = p_shop;

  -- 3. Platform & pixels
  delete from web_pixels                using platform_accounts pa, connected_platforms cp
    where web_pixels.platform_account_id = pa.id
      and pa.platform_id               = cp.id
      and cp.shop                      = p_shop;

  delete from platform_accounts         using connected_platforms cp
    where platform_accounts.platform_id = cp.id
      and cp.shop                      = p_shop;

  delete from connected_platforms
    where shop = p_shop;

  -- 4. Orders & children
  delete from order_attributions        using orders o
    where order_attributions.order_id = o.id
      and o.shop                     = p_shop;

  delete from order_attributions        using traffic_sources ts
    where order_attributions.traffic_source_id = ts.id
      and ts.shop                            = p_shop;

  delete from line_items                using orders o
    where line_items.order_id = o.id
      and o.shop             = p_shop;
end;
$$;


ALTER FUNCTION "public"."delete_shop_data"("p_shop" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_shop_data_part_1"("p_shop" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- 1. Ad reporting
  delete from ads_summary              using ads a, ad_sets s, ad_campaigns c, platform_accounts pa, connected_platforms cp
    where ads_summary.ad_id = a.id
      and a.ad_set_id             = s.id
      and s.ad_campaign_id        = c.id
      and c.platform_account_id   = pa.id
      and pa.platform_id          = cp.id
      and cp.shop                 = p_shop;

  delete from ad_sets_summary          using ad_sets s, ad_campaigns c, platform_accounts pa, connected_platforms cp
    where ad_sets_summary.ad_set_id = s.id
      and s.ad_campaign_id         = c.id
      and c.platform_account_id    = pa.id
      and pa.platform_id           = cp.id
      and cp.shop                  = p_shop;

  delete from ad_campaigns_summary     using ad_campaigns c, platform_accounts pa, connected_platforms cp
    where ad_campaigns_summary.ad_campaign_id = c.id
      and c.platform_account_id              = pa.id
      and pa.platform_id                     = cp.id
      and cp.shop                            = p_shop;

  -- 2. Ads, AdSets, AdCampaigns
  delete from ads                        using ads a, ad_sets s, ad_campaigns c, platform_accounts pa, connected_platforms cp
    where a.id                   = ads.id
      and a.ad_set_id            = s.id
      and s.ad_campaign_id       = c.id
      and c.platform_account_id  = pa.id
      and pa.platform_id         = cp.id
      and cp.shop                = p_shop;

  delete from ad_sets                   using ad_sets s, ad_campaigns c, platform_accounts pa, connected_platforms cp
    where s.id                  = ad_sets.id
      and s.ad_campaign_id      = c.id
      and c.platform_account_id = pa.id
      and pa.platform_id        = cp.id
      and cp.shop               = p_shop;

  delete from ad_campaigns              using ad_campaigns c, platform_accounts pa, connected_platforms cp
    where c.id                  = ad_campaigns.id
      and c.platform_account_id = pa.id
      and pa.platform_id        = cp.id
      and cp.shop               = p_shop;

  -- 3. Platform & pixels
  delete from web_pixels                using platform_accounts pa, connected_platforms cp
    where web_pixels.platform_account_id = pa.id
      and pa.platform_id               = cp.id
      and cp.shop                      = p_shop;

  delete from platform_accounts         using connected_platforms cp
    where platform_accounts.platform_id = cp.id
      and cp.shop                      = p_shop;

  delete from connected_platforms
    where shop = p_shop;

  delete from order_attributions        using orders o
    where order_attributions.order_id = o.id
      and o.shop                     = p_shop;

  delete from order_attributions        using traffic_sources ts
    where order_attributions.traffic_source_id = ts.id
      and ts.shop                            = p_shop;

  delete from line_items                using orders o
    where line_items.order_id = o.id
      and o.shop             = p_shop;
end;
$$;


ALTER FUNCTION "public"."delete_shop_data_part_1"("p_shop" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_shop_data_part_2"("p_shop" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM attributed_orders_export_jobs WHERE shop = p_shop;
  DELETE FROM order_export_jobs             WHERE shop = p_shop;
  DELETE FROM utm_set_export_jobs           WHERE shop = p_shop;
  DELETE FROM saved_utm_set_export_jobs     WHERE shop = p_shop;
  DELETE FROM bulk_fetch_jobs               WHERE shop = p_shop;

  DELETE FROM checkout_sessions      WHERE shop = p_shop;
  DELETE FROM early_access_requests  WHERE shop = p_shop;
  DELETE FROM mandatory_webhooks     WHERE shop = p_shop;
  DELETE FROM report_requests        WHERE shop = p_shop;

  DELETE FROM shop_events            WHERE shop = p_shop;
  DELETE FROM shop_sessions          WHERE shop = p_shop;
  DELETE FROM shop_users             WHERE shop = p_shop;
  DELETE FROM shopify_sessions       WHERE shop = p_shop;

  DELETE FROM traffic_source_group_utm_sets WHERE shop = p_shop;
  DELETE FROM traffic_source_groups         WHERE shop = p_shop;
END;
$$;


ALTER FUNCTION "public"."delete_shop_data_part_2"("p_shop" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_shop_data_part_2_batch"("p_shop" "text", "p_batch_size" integer) RETURNS TABLE("deleted_shop_events" bigint, "deleted_traffic_sources" bigint, "more_remaining" boolean)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_left_events   bigint;
  v_left_sources  bigint;
BEGIN
  -- Small tables in one go (no RETURNING)
  DELETE FROM attributed_orders_export_jobs WHERE shop = p_shop;
  DELETE FROM order_export_jobs            WHERE shop = p_shop;
  DELETE FROM utm_set_export_jobs          WHERE shop = p_shop;
  DELETE FROM saved_utm_set_export_jobs    WHERE shop = p_shop;
  DELETE FROM bulk_fetch_jobs              WHERE shop = p_shop;
  DELETE FROM checkout_sessions            WHERE shop = p_shop;
  DELETE FROM early_access_requests        WHERE shop = p_shop;
  DELETE FROM mandatory_webhooks           WHERE shop = p_shop;
  DELETE FROM report_requests              WHERE shop = p_shop;
  DELETE FROM shop_users                   WHERE shop = p_shop;
  DELETE FROM shopify_sessions             WHERE shop = p_shop;
  DELETE FROM utm_sets                     WHERE shop = p_shop;

  -- Batched delete: shop_events
  WITH victim AS (
    SELECT id
    FROM shop_events
    WHERE shop = p_shop
    ORDER BY id
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  )
  DELETE FROM shop_events se
  USING victim v
  WHERE se.id = v.id;
  GET DIAGNOSTICS deleted_shop_events = ROW_COUNT;

  -- Batched delete: traffic_sources
  WITH victim AS (
    SELECT id
    FROM traffic_sources
    WHERE shop = p_shop
    ORDER BY id
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  )
  DELETE FROM traffic_sources ts
  USING victim v
  WHERE ts.id = v.id;
  GET DIAGNOSTICS deleted_traffic_sources = ROW_COUNT;

  -- Check if more remain
  SELECT COUNT(*) INTO v_left_events   FROM shop_events     WHERE shop = p_shop;
  SELECT COUNT(*) INTO v_left_sources  FROM traffic_sources WHERE shop = p_shop;

  more_remaining := (v_left_events > 0 OR v_left_sources > 0);

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."delete_shop_data_part_2_batch"("p_shop" "text", "p_batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_shop_sessions_by_ids"("p_session_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF p_session_ids IS NULL OR array_length(p_session_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.shop_sessions s
  WHERE s.id = ANY (p_session_ids);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


ALTER FUNCTION "public"."delete_shop_sessions_by_ids"("p_session_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_order_overages_for_shop_period"("p_shop" "text", "p_billing_period_start" timestamp with time zone, "p_billing_period_end" timestamp with time zone, "p_allowance" integer, "p_max_new_orders" integer DEFAULT 50000) RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
declare
  v_inserted bigint := 0;
begin
  insert into public.shop_billing_period_counters (
    shop, billing_period_end, billing_period_start, allowance
  )
  values (
    p_shop, p_billing_period_end, p_billing_period_start, p_allowance
  )
  on conflict (shop, billing_period_end) do update
    set allowance            = excluded.allowance;

  with counter as (
    select *
    from public.shop_billing_period_counters
    where shop = p_shop
      and billing_period_end = p_billing_period_end
    for update
  ),
  new_orders as (
    select
      o.id              as order_id,
      o.order_id        as shopify_order_id,
      o.order_created_at,
      row_number() over (order by o.order_created_at, o.id) as rn
    from public.orders o
    join counter c on true
    where o.shop = p_shop
      and o.is_visible = 1
      and o.order_created_at >= p_billing_period_start
      and o.order_created_at <  p_billing_period_end
      and (
        o.order_created_at > c.last_processed_order_created_at
        or (o.order_created_at = c.last_processed_order_created_at and o.id > c.last_processed_order_id)
      )
    order by o.order_created_at, o.id
    limit p_max_new_orders
  ),
  ins as (
    insert into public.order_overage_records (
      shop,
      billing_period_end,
      billing_period_start,
      order_id,
      shopify_order_id,
      order_created_at,
      status
    )
    select
      p_shop,
      p_billing_period_end,
      p_billing_period_start,
      n.order_id,
      n.shopify_order_id,
      n.order_created_at,
      'READY'::public."ORDER_OVERAGE_STATUS"
    from new_orders n
    join counter c on true
    where (c.seen_orders + n.rn) > p_allowance
    on conflict (shop, order_id) do nothing
    returning 1
  ),
  upd as (
    update public.shop_billing_period_counters c
    set
      seen_orders = c.seen_orders + (select count(*) from new_orders),
      last_processed_order_created_at = coalesce((select max(order_created_at) from new_orders), c.last_processed_order_created_at),
      last_processed_order_id = coalesce(
        (select order_id from new_orders order by order_created_at desc, order_id desc limit 1),
        c.last_processed_order_id
      )
    where c.shop = p_shop
      and c.billing_period_end = p_billing_period_end
    returning 1
  )
  select count(*) into v_inserted from ins;

  return v_inserted;
end $$;


ALTER FUNCTION "public"."enqueue_order_overages_for_shop_period"("p_shop" "text", "p_billing_period_start" timestamp with time zone, "p_billing_period_end" timestamp with time zone, "p_allowance" integer, "p_max_new_orders" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_ads"("p_shop" "text") RETURNS TABLE("id" bigint, "shop" "text", "updated_at" timestamp with time zone, "title" "text", "status" "text", "currency_code" "text")
    LANGUAGE "sql" STABLE
    AS $$
  select
    ads.id           as id,
    cp.shop          as shop,
    now()            as updated_at,
    ads.name         as title,
    ads.status       as status,
    pa.currency_code as currency_code
  from public.ads ads
  join public.ad_sets aset
    on aset.id = ads.ad_set_id
  join public.ad_campaigns ac
    on ac.id = aset.ad_campaign_id
  join public.platform_accounts pa
    on pa.id = ac.platform_account_id
  join public.connected_platforms cp
    on cp.id = pa.platform_id
  where cp.shop = p_shop
  order by ads.id asc;
$$;


ALTER FUNCTION "public"."export_ads"("p_shop" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_ads_summary"("p_shop" "text") RETURNS TABLE("shop" "text", "ad_id" bigint, "date_in_shop_tz" "date", "updated_at" timestamp with time zone, "clicks" bigint, "spend" numeric, "spend_shop_currency" numeric, "impressions" bigint, "orders" bigint, "revenue" numeric, "conversion_rate" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  select
    cp.shop                              as shop,
    ads.id                               as ad_id,
    -- ads_summary.date is already a DATE; treat as shop-local reporting day
    ssum.date                            as date_in_shop_tz,

    now()                                as updated_at,

    ssum.clicks                          as clicks,
    ssum.spend                           as spend,
    ssum.spend_shop_currency             as spend_shop_currency,
    ssum.impressions                     as impressions,
    ssum.orders                          as orders,
    ssum.revenue                         as revenue,
    ssum.conversion_rate                 as conversion_rate
  from public.ads_summary ssum
  join public.ads ads
    on ads.id = ssum.ad_id
  join public.ad_sets aset
    on aset.id = ads.ad_set_id
  join public.ad_campaigns ac
    on ac.id = aset.ad_campaign_id
  join public.platform_accounts pa
    on pa.id = ac.platform_account_id
  join public.connected_platforms cp
    on cp.id = pa.platform_id
  where cp.shop = p_shop
  order by ssum.date asc, ads.id asc;
$$;


ALTER FUNCTION "public"."export_ads_summary"("p_shop" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_all_ad_campaigns"() RETURNS TABLE("id" bigint, "shop" "text", "platform" "text", "name" "text", "status" "text", "updated_at" timestamp with time zone, "currency_code" "text")
    LANGUAGE "sql" STABLE
    AS $$
  select
    ac.id            as id,
    cp.shop          as shop,
    cablep.key       as platform,
    ac.name          as name,
    ac.status        as status,
    now()            as updated_at,
    pa.currency_code as currency_code
  from public.ad_campaigns ac
  join public.platform_accounts pa
    on pa.id = ac.platform_account_id
  join public.connected_platforms cp
    on cp.id = pa.platform_id
  join public.connectable_platforms cablep
    on cablep.id = cp.connectable_platform_id
  order by ac.id asc;
$$;


ALTER FUNCTION "public"."export_all_ad_campaigns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_all_ad_sets"() RETURNS TABLE("id" bigint, "shop" "text", "ad_campaign_id" bigint, "platform" "text", "name" "text", "status" "text", "updated_at" timestamp with time zone, "currency_code" "text")
    LANGUAGE "sql" STABLE
    AS $$
  select
    aset.id          as id,
    cp.shop          as shop,
    ac.id            as ad_campaign_id,
    cablep.key       as platform,
    aset.name        as name,
    aset.status      as status,
    now()            as updated_at,
    pa.currency_code as currency_code
  from public.ad_sets aset
  join public.ad_campaigns ac
    on ac.id = aset.ad_campaign_id
  join public.platform_accounts pa
    on pa.id = ac.platform_account_id
  join public.connected_platforms cp
    on cp.id = pa.platform_id
  join public.connectable_platforms cablep
    on cablep.id = cp.connectable_platform_id
  order by aset.id asc;
$$;


ALTER FUNCTION "public"."export_all_ad_sets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_all_ads"() RETURNS TABLE("id" bigint, "shop" "text", "ad_set_id" bigint, "ad_campaign_id" bigint, "platform" "text", "name" "text", "status" "text", "website_url_valid" bigint, "updated_at" timestamp with time zone, "currency_code" "text")
    LANGUAGE "sql" STABLE
    AS $$
  select
    ads.id                 as id,
    cp.shop                as shop,
    aset.id                as ad_set_id,
    ac.id                  as ad_campaign_id,
    cablep.key             as platform,
    ads.name               as name,
    ads.status             as status,
    case
      when ads.website_url_valid
      then 1
      else 0
    end                    as website_url_valid,
    now()                  as updated_at,
    pa.currency_code       as currency_code
  from public.ads ads
  join public.ad_sets aset
    on aset.id = ads.ad_set_id
  join public.ad_campaigns ac
    on ac.id = aset.ad_campaign_id
  join public.platform_accounts pa
    on pa.id = ac.platform_account_id
  join public.connected_platforms cp
    on cp.id = pa.platform_id
  join public.connectable_platforms cablep
    on cablep.id = cp.connectable_platform_id
  order by ads.id asc;
$$;


ALTER FUNCTION "public"."export_all_ads"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_all_traffic_sources"() RETURNS TABLE("id" "uuid", "shop" "text", "updated_at" timestamp with time zone, "utm_source" "text", "utm_medium" "text", "utm_campaign" "text", "utm_term" "text", "utm_content" "text", "ad_platform_key" "text", "ad_external_id" "text", "ad_id" bigint, "ad_set_id" bigint, "ad_campaign_id" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  with ts as (
    select
      t.id,
      t.shop,
      t.platform_key,
      t.platform_ad_id,
      t.utm_source,
      t.utm_medium,
      t.utm_campaign,
      t.utm_term,
      t.utm_content
    from public.traffic_sources t
  ),
  ad_lookup as (
    select
      a.external_id as external_id,
      a.id          as ad_id,
      aset.id       as ad_set_id,
      camp.id       as ad_campaign_id
    from public.ads a
    join public.ad_sets aset
      on aset.id = a.ad_set_id
    join public.ad_campaigns camp
      on camp.id = aset.ad_campaign_id
  )
  select
    ts.id,
    ts.shop,
    now() as updated_at,
    ts.utm_source,
    ts.utm_medium,
    ts.utm_campaign,
    ts.utm_term,
    ts.utm_content,
    ts.platform_key as ad_platform_key,
    ts.platform_ad_id as ad_external_id,
    al.ad_id,
    al.ad_set_id,
    al.ad_campaign_id
  from ts
  left join ad_lookup al
    on al.external_id = ts.platform_ad_id::text
  order by ts.id;
$$;


ALTER FUNCTION "public"."export_all_traffic_sources"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_sessions"("p_shop" "text") RETURNS TABLE("id" "uuid", "shop" "text", "updated_at" timestamp with time zone, "started_at" timestamp with time zone, "started_at_in_shop_tz" "date", "traffic_source_id" "uuid", "landing_page_id" "uuid")
    LANGUAGE "sql" STABLE
    AS $$
  select
    ss.id                                                    as id,
    ss.shop                                                  as shop,
    now()                                                    as updated_at,
    ss.started_at                                            as started_at,
    (ss.started_at at time zone s.iana_timezone)::date       as started_at_in_shop_tz,
    ss.traffic_source_id                                     as traffic_source_id,
    ss.landing_page_id                                       as landing_page_id
  from public.shop_sessions ss
  join public.shops s
    on s.shop = ss.shop
  where ss.shop = p_shop
  order by ss.created_at asc;
$$;


ALTER FUNCTION "public"."export_sessions"("p_shop" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_touches_summary"("p_shop" "text") RETURNS TABLE("shop" "text", "order_id" bigint, "traffic_source_id" "uuid", "order_date" timestamp with time zone, "order_date_in_shop_tz" "date", "model_version" "text", "credit" numeric, "revenue_attributed" numeric, "is_new_customer" smallint)
    LANGUAGE "sql" STABLE
    AS $$
with windows(days) as (
  values (1),(7),(14),(28),(30),(90),(180),(365)
),
orders_enriched as (
  select
    o.shop,
    o.id::bigint as order_id,
    o.order_created_at as order_date,
    (o.order_created_at at time zone s.iana_timezone)::date as order_date_in_shop_tz,
    o.customer_shopify_id,
    coalesce(o.shop_money_order_amount, 0)::numeric(18,6) as order_revenue,
    case
      when o.customer_shopify_id is null then 1
      when row_number() over (
        partition by o.shop, o.customer_shopify_id
        order by o.order_created_at
      ) = 1 then 1
      else 0
    end::smallint as is_new_customer
  from public.orders o
  join public.shops s
    on s.shop = o.shop
  where o.shop = p_shop
),
touches_in_window as (
  select
    oe.shop,
    oe.order_id,
    oe.order_date,
    oe.order_date_in_shop_tz,
    oe.order_revenue,
    oe.is_new_customer,
    w.days,
    a.traffic_source_id,
    a.touch_ts,
    count(*) over (partition by oe.shop, oe.order_id, w.days) as n_touches,
    row_number() over (
      partition by oe.shop, oe.order_id, w.days
      order by a.touch_ts asc, a.id asc
    ) as rn_asc,
    row_number() over (
      partition by oe.shop, oe.order_id, w.days
      order by a.touch_ts desc, a.id desc
    ) as rn_desc
  from orders_enriched oe
  cross join windows w
  join public.order_attributions a
    on a.order_id = oe.order_id
   and a.touch_ts >= (oe.order_date - (w.days::text || ' days')::interval)
   and a.touch_ts <= oe.order_date
)
select
  shop,
  order_id,
  traffic_source_id,
  order_date,
  order_date_in_shop_tz,
  ('FT_' || days::text || 'D')::text as model_version,
  1::numeric(18,12) as credit,
  order_revenue::numeric(18,6) as revenue_attributed,
  is_new_customer
from touches_in_window
where rn_asc = 1

union all
select
  shop,
  order_id,
  traffic_source_id,
  order_date,
  order_date_in_shop_tz,
  ('LT_' || days::text || 'D')::text as model_version,
  1::numeric(18,12) as credit,
  order_revenue::numeric(18,6) as revenue_attributed,
  is_new_customer
from touches_in_window
where rn_desc = 1

union all
select
  shop,
  order_id,
  traffic_source_id,
  order_date,
  order_date_in_shop_tz,
  ('LN_' || days::text || 'D')::text as model_version,
  (1::numeric(18,12) / n_touches::numeric(18,12)) as credit,
  (order_revenue * (1::numeric(18,12) / n_touches::numeric(18,12)))::numeric(18,6) as revenue_attributed,
  is_new_customer
from touches_in_window;
$$;


ALTER FUNCTION "public"."export_touches_summary"("p_shop" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_traffic_sources"("p_shop" "text") RETURNS TABLE("id" "uuid", "shop" "text", "updated_at" timestamp with time zone, "utm_source" "text", "utm_medium" "text", "utm_campaign" "text", "utm_term" "text", "utm_content" "text", "ad_platform_key" "text", "ad_external_id" "text", "ad_id" bigint, "ad_set_id" bigint, "ad_campaign_id" bigint, "named_source_id" "uuid", "named_source_name" "text", "named_source_favicon" "text")
    LANGUAGE "sql" STABLE
    AS $$
  with ts as (
    select
      t.id,
      t.shop,
      t.platform_key,
      t.platform_ad_id,
      t.platform_campaign_id,
      t.utm_source,
      t.utm_medium,
      t.utm_campaign,
      t.utm_term,
      t.utm_content,
      t.named_source_id
    from public.traffic_sources t
    where t.shop = p_shop
  ),
  -- ad path: full ad -> ad_set -> ad_campaign hierarchy, scoped to the shop and
  -- matched on (platform, external_id) so ids can't collide across platforms/shops.
  ad_lookup as (
    select
      a.platform    as platform,
      a.external_id as external_id,
      a.id          as ad_id,
      aset.id       as ad_set_id,
      camp.id       as ad_campaign_id
    from public.ads a
    join public.ad_sets aset
      on aset.id = a.ad_set_id
    join public.ad_campaigns camp
      on camp.id = aset.ad_campaign_id
    join public.platform_accounts pa
      on pa.id = camp.platform_account_id
    join public.connected_platforms cp
      on cp.id = pa.platform_id
    where cp.shop = p_shop
  ),
  -- PMAX path: campaigns with no ads/ad_sets, linked directly by platform_campaign_id.
  campaign_lookup as (
    select
      camp.platform    as platform,
      camp.external_id as external_id,
      camp.id          as ad_campaign_id
    from public.ad_campaigns camp
    join public.platform_accounts pa
      on pa.id = camp.platform_account_id
    join public.connected_platforms cp
      on cp.id = pa.platform_id
    where cp.shop = p_shop
  )
  select
    ts.id,
    ts.shop,
    now() as updated_at,
    ts.utm_source,
    ts.utm_medium,
    ts.utm_campaign,
    ts.utm_term,
    ts.utm_content,
    ts.platform_key   as ad_platform_key,
    ts.platform_ad_id as ad_external_id,
    al.ad_id,
    al.ad_set_id,
    coalesce(al.ad_campaign_id, cl.ad_campaign_id) as ad_campaign_id,
    ts.named_source_id,
    ns.name        as named_source_name,
    ns.favicon_url as named_source_favicon
  from ts
  -- ad path only fires for rows that carry an ad external id
  left join ad_lookup al
    on al.platform = ts.platform_key
   and al.external_id = ts.platform_ad_id
   and ts.platform_ad_id <> ''
  -- campaign path only fires for PMAX rows (no ad external id, campaign id present)
  left join campaign_lookup cl
    on cl.platform = ts.platform_key
   and cl.external_id = ts.platform_campaign_id
   and ts.platform_ad_id = ''
   and ts.platform_campaign_id <> ''
  left join public.named_sources ns
    on ns.id = ts.named_source_id
  order by ts.id;
$$;


ALTER FUNCTION "public"."export_traffic_sources"("p_shop" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_grouped_utm_sets_v3"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer, "p_utm_source" "text" DEFAULT NULL::"text", "p_utm_campaign" "text" DEFAULT NULL::"text", "p_utm_medium" "text" DEFAULT NULL::"text", "p_utm_content" "text" DEFAULT NULL::"text", "p_utm_term" "text" DEFAULT NULL::"text", "p_search_term" "text" DEFAULT NULL::"text") RETURNS TABLE("results" "json", "total_count" bigint)
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_results JSON;
  v_total_count BIGINT;
  v_search_condition TEXT;
BEGIN
  -- Prepare the search condition
  IF p_search_term IS NOT NULL THEN
    v_search_condition := '
      AND (
        utm_source = $11 OR
        utm_campaign = $11 OR
        utm_medium = $11 OR
        utm_content = $11 OR
        utm_term = $11
      )';
  ELSE
    v_search_condition := '';
  END IF;

  -- Calculate the total count
  EXECUTE format('
    SELECT COUNT(*)
    FROM (
      SELECT 1
      FROM public.orders
      WHERE
        shop = $1 AND
        is_visible = 1 AND
        order_created_at BETWEEN $2 AND $3 AND
        ($4 IS NULL OR utm_source = $4) AND
        ($5 IS NULL OR utm_campaign = $5) AND
        ($6 IS NULL OR utm_medium = $6) AND
        ($7 IS NULL OR utm_content = $7) AND
        ($8 IS NULL OR utm_term = $8)
        %s
      GROUP BY
        utm_source, utm_campaign, utm_medium, utm_content, utm_term
      HAVING
        utm_source IS NOT NULL OR
        utm_campaign IS NOT NULL OR
        utm_medium IS NOT NULL OR
        utm_content IS NOT NULL OR
        utm_term IS NOT NULL
    ) AS grouped_count', v_search_condition)
  INTO v_total_count
  USING p_shop, p_start_date, p_end_date, p_utm_source, p_utm_campaign, p_utm_medium, p_utm_content, p_utm_term, p_limit, p_offset, p_search_term;

  -- Get the paginated results
  EXECUTE format('
    SELECT json_agg(r)
    FROM (
      SELECT
        utm_source,
        utm_campaign,
        utm_medium,
        utm_content,
        utm_term,
        COUNT(*) AS total_orders,
        SUM(shop_money_order_amount) AS total_revenue
      FROM
        public.orders
      WHERE
        shop = $1 AND
        is_visible = 1 AND
        order_created_at BETWEEN $2 AND $3 AND
        ($4 IS NULL OR utm_source = $4) AND
        ($5 IS NULL OR utm_campaign = $5) AND
        ($6 IS NULL OR utm_medium = $6) AND
        ($7 IS NULL OR utm_content = $7) AND
        ($8 IS NULL OR utm_term = $8)
        %s
      GROUP BY
        utm_source, utm_campaign, utm_medium, utm_content, utm_term
      HAVING
        utm_source IS NOT NULL OR
        utm_campaign IS NOT NULL OR
        utm_medium IS NOT NULL OR
        utm_content IS NOT NULL OR
        utm_term IS NOT NULL
      ORDER BY
        COUNT(*) DESC
      LIMIT $9
      OFFSET $10
    ) r', v_search_condition)
  INTO v_results
  USING p_shop, p_start_date, p_end_date, p_utm_source, p_utm_campaign, p_utm_medium, p_utm_content, p_utm_term, p_limit, p_offset, p_search_term;

  -- Return the results and total count
  RETURN QUERY SELECT v_results, v_total_count;
END;
$_$;


ALTER FUNCTION "public"."fetch_grouped_utm_sets_v3"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer, "p_utm_source" "text", "p_utm_campaign" "text", "p_utm_medium" "text", "p_utm_content" "text", "p_utm_term" "text", "p_search_term" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_duplicate_shop_sessions_to_remove"("p_limit" integer) RETURNS TABLE("session_id" "uuid", "shop" "text", "client_id" "uuid", "traffic_source_id" "uuid", "landing_page" "text", "landing_page_id" "uuid", "started_at" timestamp with time zone, "created_at" timestamp with time zone, "group_size" integer)
    LANGUAGE "sql"
    AS $$
WITH grouped AS (
  SELECT
    s.id,
    s.shop,
    s.client_id,
    s.traffic_source_id,
    s.landing_page,
    s.landing_page_id,
    s.started_at,
    s.created_at,
    COUNT(*) OVER (
      PARTITION BY
        s.shop,
        s.client_id,
        s.traffic_source_id,
        s.landing_page,
        s.landing_page_id,
        s.started_at
    ) AS group_size,
    ROW_NUMBER() OVER (
      PARTITION BY
        s.shop,
        s.client_id,
        s.traffic_source_id,
        s.landing_page,
        s.landing_page_id,
        s.started_at
      ORDER BY s.created_at ASC, s.id ASC   -- earliest kept
    ) AS rn
  FROM public.shop_sessions s
)
SELECT
  id        AS session_id,
  shop,
  client_id,
  traffic_source_id,
  landing_page,
  landing_page_id,
  started_at,
  created_at,
  group_size
FROM grouped
WHERE group_size > 1
  AND rn > 1  -- these are the ones to REMOVE
ORDER BY started_at DESC, created_at DESC, session_id DESC
LIMIT CASE
  WHEN p_limit IS NULL OR p_limit <= 0 THEN NULL
  ELSE p_limit
END;
$$;


ALTER FUNCTION "public"."find_duplicate_shop_sessions_to_remove"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_or_create_session_locked"("p_lock_key" "text", "p_shop" "text", "p_unique_hash" "text", "p_landing_page" "text", "p_landing_page_id" "uuid", "p_traffic_source_id" "uuid", "p_event_timestamp" timestamp with time zone, "p_is_landing_page" boolean, "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_user_agent" "text" DEFAULT NULL::"text", "p_ip_address" "text" DEFAULT NULL::"text", "p_referer" "text" DEFAULT NULL::"text") RETURNS TABLE("out_session_id" "uuid", "out_client_id" "uuid", "out_traffic_source_id" "uuid", "out_created_at" timestamp with time zone, "out_started_at" timestamp with time zone, "out_last_touch" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_session RECORD;
  v_client_id UUID;
  v_cutoff_lower TIMESTAMPTZ;
  v_cutoff_upper TIMESTAMPTZ;
  v_regular_duration INTERVAL := INTERVAL '30 minutes';
  v_landing_page_duration INTERVAL := INTERVAL '1 second';
BEGIN
  -- Acquire advisory lock scoped to this transaction
  -- Uses two int4 keys derived from the lock key for uniqueness
  PERFORM pg_advisory_xact_lock(hashtext('session_lock'), hashtext(p_lock_key));

  -- Calculate session time window cutoffs
  IF p_is_landing_page THEN
    v_cutoff_lower := p_event_timestamp - v_landing_page_duration;
    v_cutoff_upper := p_event_timestamp + v_landing_page_duration;
  ELSE
    v_cutoff_lower := p_event_timestamp - v_regular_duration;
    v_cutoff_upper := NULL; -- regular events only look backwards
  END IF;

  -- Phase 1: Try to find existing session by client_id
  IF p_client_id IS NOT NULL THEN
    IF p_is_landing_page THEN
      SELECT s.id, s.client_id, s.traffic_source_id, s.created_at, s.started_at, s.last_touch
        INTO v_session
        FROM shop_sessions s
       WHERE s.client_id = p_client_id
         AND s.shop = p_shop
         AND s.landing_page = p_landing_page
         AND s.last_touch >= v_cutoff_lower
         AND s.last_touch <= v_cutoff_upper
       ORDER BY s.last_touch DESC
       LIMIT 1;
    ELSE
      SELECT s.id, s.client_id, s.traffic_source_id, s.created_at, s.started_at, s.last_touch
        INTO v_session
        FROM shop_sessions s
       WHERE s.client_id = p_client_id
         AND s.shop = p_shop
         AND s.last_touch >= v_cutoff_lower
       ORDER BY s.last_touch DESC
       LIMIT 1;
    END IF;

    IF FOUND THEN
      RETURN QUERY SELECT v_session.id, v_session.client_id, v_session.traffic_source_id,
                          v_session.created_at, v_session.started_at, v_session.last_touch;
      RETURN;
    END IF;
  END IF;

  -- Phase 2: Try to find existing session via unique_hash -> shop_anonymous_clients
  IF p_unique_hash IS NOT NULL THEN
    SELECT sac.client_id INTO v_client_id
      FROM shop_anonymous_clients sac
     WHERE sac.hash = p_unique_hash
     LIMIT 1;

    IF v_client_id IS NOT NULL THEN
      IF p_is_landing_page THEN
        SELECT s.id, s.client_id, s.traffic_source_id, s.created_at, s.started_at, s.last_touch
          INTO v_session
          FROM shop_sessions s
         WHERE s.client_id = v_client_id
           AND s.shop = p_shop
           AND s.landing_page = p_landing_page
           AND s.last_touch >= v_cutoff_lower
           AND s.last_touch <= v_cutoff_upper
         ORDER BY s.last_touch DESC
         LIMIT 1;
      ELSE
        SELECT s.id, s.client_id, s.traffic_source_id, s.created_at, s.started_at, s.last_touch
          INTO v_session
          FROM shop_sessions s
         WHERE s.client_id = v_client_id
           AND s.shop = p_shop
           AND s.last_touch >= v_cutoff_lower
         ORDER BY s.last_touch DESC
         LIMIT 1;
      END IF;

      IF FOUND THEN
        RETURN QUERY SELECT v_session.id, v_session.client_id, v_session.traffic_source_id,
                            v_session.created_at, v_session.started_at, v_session.last_touch;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- No existing session found — resolve/create client
  IF p_client_id IS NOT NULL THEN
    -- Shopify-provided client ID: upsert client and anonymous mapping
    INSERT INTO shop_clients (id, source)
    VALUES (p_client_id, 'SHOPIFY')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO shop_anonymous_clients (hash, client_id)
    VALUES (p_unique_hash, p_client_id)
    ON CONFLICT (hash, client_id) DO NOTHING;

    v_client_id := p_client_id;
  ELSIF v_client_id IS NULL THEN
    -- No client found from hash lookup, create a new auto-generated client
    INSERT INTO shop_clients (source)
    VALUES ('AUTO_GENERATED')
    RETURNING id INTO v_client_id;

    INSERT INTO shop_anonymous_clients (hash, client_id)
    VALUES (p_unique_hash, v_client_id)
    ON CONFLICT (hash, client_id) DO NOTHING;
  END IF;
  -- else: v_client_id was already set from the hash lookup in phase 2

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Could not find or create visitor';
  END IF;

  -- Create the new session
  BEGIN
    INSERT INTO shop_sessions (
      client_id, shop, started_at, last_touch,
      traffic_source_id, landing_page, landing_page_id,
      user_agent, ip_address, referer
    ) VALUES (
      v_client_id, p_shop, p_event_timestamp, p_event_timestamp,
      p_traffic_source_id, p_landing_page, p_landing_page_id,
      p_user_agent, p_ip_address, p_referer
    )
    RETURNING shop_sessions.id, shop_sessions.client_id, shop_sessions.traffic_source_id,
              shop_sessions.created_at, shop_sessions.started_at, shop_sessions.last_touch
    INTO v_session;

    RETURN QUERY SELECT v_session.id, v_session.client_id, v_session.traffic_source_id,
                        v_session.created_at, v_session.started_at, v_session.last_touch;
    RETURN;
  EXCEPTION
    WHEN unique_violation THEN
      -- 23505: another transaction created the session, fetch it
      SELECT s.id, s.client_id, s.traffic_source_id, s.created_at, s.started_at, s.last_touch
        INTO v_session
        FROM shop_sessions s
       WHERE s.client_id = v_client_id
         AND s.shop = p_shop
         AND s.traffic_source_id = p_traffic_source_id
         AND s.landing_page = p_landing_page
         AND s.started_at = p_event_timestamp
       LIMIT 1;

      IF FOUND THEN
        RETURN QUERY SELECT v_session.id, v_session.client_id, v_session.traffic_source_id,
                            v_session.created_at, v_session.started_at, v_session.last_touch;
        RETURN;
      END IF;

      RAISE EXCEPTION 'No session found after unique constraint conflict';
  END;
END;
$$;


ALTER FUNCTION "public"."find_or_create_session_locked"("p_lock_key" "text", "p_shop" "text", "p_unique_hash" "text", "p_landing_page" "text", "p_landing_page_id" "uuid", "p_traffic_source_id" "uuid", "p_event_timestamp" timestamp with time zone, "p_is_landing_page" boolean, "p_client_id" "uuid", "p_user_agent" "text", "p_ip_address" "text", "p_referer" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_or_create_session_locked_v2"("p_lock_key" "text", "p_shop" "text", "p_landing_page" "text", "p_landing_page_id" "uuid", "p_traffic_source_id" "uuid", "p_event_timestamp" timestamp with time zone, "p_is_landing_page" boolean, "p_unique_hash" "text" DEFAULT NULL::"text", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_user_agent" "text" DEFAULT NULL::"text", "p_ip_address" "text" DEFAULT NULL::"text", "p_referer" "text" DEFAULT NULL::"text", "p_channel" "text" DEFAULT NULL::"text") RETURNS TABLE("out_session_id" "uuid", "out_client_id" "uuid", "out_traffic_source_id" "uuid", "out_created_at" timestamp with time zone, "out_started_at" timestamp with time zone, "out_last_touch" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_session RECORD;
  v_client_id UUID;
  v_cutoff_lower TIMESTAMPTZ;
  v_cutoff_upper TIMESTAMPTZ;
  v_regular_duration INTERVAL := INTERVAL '30 minutes';
  v_landing_page_duration INTERVAL := INTERVAL '1 second';
BEGIN
  -- Acquire advisory lock scoped to this transaction
  -- Uses two int4 keys derived from the lock key for uniqueness
  PERFORM pg_advisory_xact_lock(hashtext('session_lock'), hashtext(p_lock_key));

  -- Calculate session time window cutoffs
  IF p_is_landing_page THEN
    v_cutoff_lower := p_event_timestamp - v_landing_page_duration;
    v_cutoff_upper := p_event_timestamp + v_landing_page_duration;
  ELSE
    v_cutoff_lower := p_event_timestamp - v_regular_duration;
    v_cutoff_upper := NULL; -- regular events only look backwards
  END IF;

  -- Phase 1: Try to find existing session by client_id
  IF p_client_id IS NOT NULL THEN
    IF p_is_landing_page THEN
      SELECT s.id, s.client_id, s.traffic_source_id, s.created_at, s.started_at, s.last_touch
        INTO v_session
        FROM shop_sessions s
       WHERE s.client_id = p_client_id
         AND s.shop = p_shop
         AND s.landing_page = p_landing_page
         AND s.last_touch >= v_cutoff_lower
         AND s.last_touch <= v_cutoff_upper
       ORDER BY s.last_touch DESC
       LIMIT 1;
    ELSE
      SELECT s.id, s.client_id, s.traffic_source_id, s.created_at, s.started_at, s.last_touch
        INTO v_session
        FROM shop_sessions s
       WHERE s.client_id = p_client_id
         AND s.shop = p_shop
         AND s.last_touch >= v_cutoff_lower
       ORDER BY s.last_touch DESC
       LIMIT 1;
    END IF;

    IF FOUND THEN
      RETURN QUERY SELECT v_session.id, v_session.client_id, v_session.traffic_source_id,
                          v_session.created_at, v_session.started_at, v_session.last_touch;
      RETURN;
    END IF;
  END IF;

  -- Phase 2: Try to find existing session via unique_hash -> shop_anonymous_clients
  IF p_unique_hash IS NOT NULL THEN
    SELECT sac.client_id INTO v_client_id
      FROM shop_anonymous_clients sac
     WHERE sac.hash = p_unique_hash
     LIMIT 1;

    IF v_client_id IS NOT NULL THEN
      IF p_is_landing_page THEN
        SELECT s.id, s.client_id, s.traffic_source_id, s.created_at, s.started_at, s.last_touch
          INTO v_session
          FROM shop_sessions s
         WHERE s.client_id = v_client_id
           AND s.shop = p_shop
           AND s.landing_page = p_landing_page
           AND s.last_touch >= v_cutoff_lower
           AND s.last_touch <= v_cutoff_upper
         ORDER BY s.last_touch DESC
         LIMIT 1;
      ELSE
        SELECT s.id, s.client_id, s.traffic_source_id, s.created_at, s.started_at, s.last_touch
          INTO v_session
          FROM shop_sessions s
         WHERE s.client_id = v_client_id
           AND s.shop = p_shop
           AND s.last_touch >= v_cutoff_lower
         ORDER BY s.last_touch DESC
         LIMIT 1;
      END IF;

      IF FOUND THEN
        RETURN QUERY SELECT v_session.id, v_session.client_id, v_session.traffic_source_id,
                            v_session.created_at, v_session.started_at, v_session.last_touch;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- No existing session found — resolve/create client
  IF p_client_id IS NOT NULL THEN
    -- Shopify-provided client ID: upsert client and anonymous mapping
    INSERT INTO shop_clients (id, source)
    VALUES (p_client_id, 'SHOPIFY')
    ON CONFLICT (id) DO NOTHING;

    IF p_unique_hash IS NOT NULL THEN
      INSERT INTO shop_anonymous_clients (hash, client_id)
      VALUES (p_unique_hash, p_client_id)
      ON CONFLICT (hash, client_id) DO NOTHING;
    END IF;

    v_client_id := p_client_id;
  ELSIF v_client_id IS NULL THEN
    -- No client found from hash lookup, create a new auto-generated client
    INSERT INTO shop_clients (source)
    VALUES ('AUTO_GENERATED')
    RETURNING id INTO v_client_id;

    IF p_unique_hash IS NOT NULL THEN
      INSERT INTO shop_anonymous_clients (hash, client_id)
      VALUES (p_unique_hash, v_client_id)
      ON CONFLICT (hash, client_id) DO NOTHING;
    END IF;
  END IF;
  -- else: v_client_id was already set from the hash lookup in phase 2

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Could not find or create visitor';
  END IF;

  -- Create the new session
  BEGIN
    INSERT INTO shop_sessions (
      client_id, shop, started_at, last_touch,
      traffic_source_id, landing_page, landing_page_id,
      user_agent, ip_address, referer, channel
    ) VALUES (
      v_client_id, p_shop, p_event_timestamp, p_event_timestamp,
      p_traffic_source_id, p_landing_page, p_landing_page_id,
      p_user_agent, p_ip_address, p_referer, COALESCE(p_channel, '')
    )
    RETURNING shop_sessions.id, shop_sessions.client_id, shop_sessions.traffic_source_id,
              shop_sessions.created_at, shop_sessions.started_at, shop_sessions.last_touch
    INTO v_session;

    RETURN QUERY SELECT v_session.id, v_session.client_id, v_session.traffic_source_id,
                        v_session.created_at, v_session.started_at, v_session.last_touch;
    RETURN;
  EXCEPTION
    WHEN unique_violation THEN
      -- 23505: another transaction created the session, fetch it
      SELECT s.id, s.client_id, s.traffic_source_id, s.created_at, s.started_at, s.last_touch
        INTO v_session
        FROM shop_sessions s
       WHERE s.client_id = v_client_id
         AND s.shop = p_shop
         AND s.traffic_source_id = p_traffic_source_id
         AND s.landing_page = p_landing_page
         AND s.started_at = p_event_timestamp
       LIMIT 1;

      IF FOUND THEN
        RETURN QUERY SELECT v_session.id, v_session.client_id, v_session.traffic_source_id,
                            v_session.created_at, v_session.started_at, v_session.last_touch;
        RETURN;
      END IF;

      RAISE EXCEPTION 'No session found after unique constraint conflict';
  END;
END;
$$;


ALTER FUNCTION "public"."find_or_create_session_locked_v2"("p_lock_key" "text", "p_shop" "text", "p_landing_page" "text", "p_landing_page_id" "uuid", "p_traffic_source_id" "uuid", "p_event_timestamp" timestamp with time zone, "p_is_landing_page" boolean, "p_unique_hash" "text", "p_client_id" "uuid", "p_user_agent" "text", "p_ip_address" "text", "p_referer" "text", "p_channel" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_or_create_shop_user_session"("p_shop_user_id" bigint, "p_inactivity_threshold_seconds" integer DEFAULT 1800) RETURNS TABLE("session_id" "uuid", "created" boolean)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - make_interval(secs => p_inactivity_threshold_seconds);
  v_session_id uuid;
  v_started_at timestamptz;
begin
  -- serialize concurrent calls for the same user
  perform pg_advisory_xact_lock(hashtextextended('shop_user_session', p_shop_user_id));
  select id, started_at
    into v_session_id, v_started_at
    from shop_user_sessions
   where shop_user_id = p_shop_user_id
     and last_seen_at >= v_cutoff
   order by last_seen_at desc
   limit 1
   for update;
  if found then
    update shop_user_sessions
       set last_seen_at = v_now,
           duration_seconds = floor(extract(epoch from (v_now - v_started_at)))::int
     where id = v_session_id;
    return query select v_session_id, false;
    return;
  end if;
  insert into shop_user_sessions (shop_user_id, started_at, last_seen_at, duration_seconds)
  values (p_shop_user_id, v_now, v_now, 0)
  returning id into v_session_id;
  return query select v_session_id, true;
end;
$$;


ALTER FUNCTION "public"."find_or_create_shop_user_session"("p_shop_user_id" bigint, "p_inactivity_threshold_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_landing_pages_normalization_batch"("p_shop" "text", "p_limit" integer DEFAULT 5000) RETURNS TABLE("shop" "text", "merged_count" integer, "renamed_count" integer)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_merged int := 0;
  v_renamed int := 0;
begin
  -- rows in this shop whose normalized value would change under the new rules
  create temp table tmp_lp_bad on commit drop as
  select
    lp.id as bad_id,
    lp.shop,
    lp.normalized_landing_page as old_page,
    public.normalize_landing_page_url(lp.normalized_landing_page) as new_page
  from public.landing_pages lp
  where lp.shop = p_shop
    and lp.normalized_landing_page <> public.normalize_landing_page_url(lp.normalized_landing_page)
  limit p_limit;

  if not exists (select 1 from tmp_lp_bad) then
    return query select p_shop, 0, 0;
    return;
  end if;

  -- canonical id per (shop, new_page):
  -- prefer an existing row already at new_page; otherwise pick a deterministic id from the bad set.
  create temp table tmp_lp_canonical on commit drop as
  with keys as (
    select t.shop, t.new_page
    from tmp_lp_bad t
    group by t.shop, t.new_page
  )
  select
    k.shop,
    k.new_page,
    coalesce(
      (select lp2.id
      from public.landing_pages lp2
      where lp2.shop = k.shop and lp2.normalized_landing_page = k.new_page
      limit 1),
      (select b.bad_id
      from tmp_lp_bad b
      where b.shop = k.shop and b.new_page = k.new_page
      order by b.bad_id
      limit 1)
    ) as canonical_id
  from keys k;

  -- map every "bad" row to its canonical (excluding canonical itself)
  create temp table tmp_lp_map on commit drop as
  select
    b.bad_id as from_id,
    c.canonical_id as to_id
  from tmp_lp_bad b
  join tmp_lp_canonical c
    on c.shop = b.shop and c.new_page = b.new_page
  where b.bad_id <> c.canonical_id;

  -- repoint foreign keys (shop_sessions and order_attributions have no
  -- unique constraints involving landing_page_id, so a plain update is safe)
  update public.shop_sessions ss
  set landing_page_id = m.to_id
  from tmp_lp_map m
  where ss.landing_page_id = m.from_id;

  update public.order_attributions oa
  set landing_page_id = m.to_id
  from tmp_lp_map m
  where oa.landing_page_id = m.from_id;

  -- landing_pages_summary_daily has PK (landing_page_id, date), so we must
  -- aggregate conflicting rows before repointing to avoid a PK violation.

  -- fold conflicting summary rows into the canonical row
  with to_add as (
    select m.to_id as landing_page_id, lpsd.date,
      sum(lpsd.sessions_count) as sessions_count,
      sum(lpsd.unique_sessions_count) as unique_sessions_count,
      sum(lpsd.orders_count) as orders_count,
      sum(lpsd.revenue) as revenue
    from public.landing_pages_summary_daily lpsd
    join tmp_lp_map m on lpsd.landing_page_id = m.from_id
    where exists (
      select 1 from public.landing_pages_summary_daily lpsd2
      where lpsd2.landing_page_id = m.to_id and lpsd2.date = lpsd.date
    )
    group by m.to_id, lpsd.date
  )
  update public.landing_pages_summary_daily lpsd
  set
    sessions_count        = lpsd.sessions_count        + ta.sessions_count,
    unique_sessions_count = lpsd.unique_sessions_count + ta.unique_sessions_count,
    orders_count          = lpsd.orders_count          + ta.orders_count,
    revenue               = lpsd.revenue               + ta.revenue
  from to_add ta
  where lpsd.landing_page_id = ta.landing_page_id
    and lpsd.date = ta.date;

  -- delete the "from" rows whose data was just folded in
  delete from public.landing_pages_summary_daily lpsd
  using tmp_lp_map m
  where lpsd.landing_page_id = m.from_id
    and exists (
      select 1 from public.landing_pages_summary_daily lpsd2
      where lpsd2.landing_page_id = m.to_id and lpsd2.date = lpsd.date
    );

  -- repoint remaining non-conflicting summary rows
  update public.landing_pages_summary_daily lpsd
  set landing_page_id = m.to_id
  from tmp_lp_map m
  where lpsd.landing_page_id = m.from_id;

  -- delete duplicates (non-canonical)
  delete from public.landing_pages lp
  using tmp_lp_map m
  where lp.id = m.from_id;

  get diagnostics v_merged = row_count;

  -- rename remaining bad rows that don't conflict
  -- scoped to the current batch to avoid unique constraint violations
  -- when multiple batches have rows targeting the same new_page
  update public.landing_pages lp
  set normalized_landing_page = b.new_page
  from tmp_lp_bad b
  where lp.id = b.bad_id
    and lp.normalized_landing_page <> b.new_page
    and not exists (
      select 1 from public.landing_pages lp2
      where lp2.shop = lp.shop
        and lp2.normalized_landing_page = b.new_page
        and lp2.id <> lp.id
    );

  get diagnostics v_renamed = row_count;

  return query select p_shop, v_merged, v_renamed;
end;
$$;


ALTER FUNCTION "public"."fix_landing_pages_normalization_batch"("p_shop" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_order_counts"("p_shop" "text", "p_timezone" "text") RETURNS TABLE("month_start" "date", "order_count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    date_trunc('month', o.order_created_at AT TIME ZONE p_timezone)::date AS month_start,
    COUNT(*)::bigint AS order_count
  FROM public.orders AS o
  WHERE o.shop = p_shop
  GROUP BY 1
  ORDER BY 1;
$$;


ALTER FUNCTION "public"."get_monthly_order_counts"("p_shop" "text", "p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_order_totals"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) RETURNS TABLE("total_orders" bigint, "total_revenue" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  select
    count(*)::bigint as total_orders,
    coalesce(sum(shop_money_order_amount), 0) as total_revenue
  from public.orders o
  where o.shop = p_shop
    and o.order_created_at >= p_start_date
    and o.order_created_at <  p_end_date;
$$;


ALTER FUNCTION "public"."get_order_totals"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_touches_summary_for_shop"("p_shop" "text", "p_date_from" "date", "p_date_to" "date") RETURNS TABLE("shop" "text", "order_id" bigint, "customer_shopify_id" "text", "traffic_source_id" "uuid", "touch_index" integer, "order_date" timestamp with time zone, "order_date_in_shop_tz" "text", "model_version" "text", "credit" double precision, "revenue_attributed" double precision, "is_new_customer" integer, "is_visible" integer, "created_at" timestamp with time zone, "shop_money_order_amount" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  WITH orders_in_range AS (
    SELECT
      o.id,
      o.order_created_at,
      o.shop_money_order_amount,
      o.customer_shopify_id,
      o.is_visible,
      s.iana_timezone,
      s.production_host,
      CASE
        WHEN o.customer_shopify_id IS NULL OR o.customer_shopify_id = '' THEN 1
        WHEN cfo.order_id = o.id THEN 1
        ELSE 0
      END AS is_new_customer
    FROM orders o
    JOIN shops s ON s.shop = o.shop
    LEFT JOIN customer_first_orders cfo
      ON cfo.shop = o.shop
      AND cfo.customer_shopify_id = o.customer_shopify_id
    WHERE o.shop = p_shop
      AND o.order_created_at >= p_date_from::timestamptz
      AND o.order_created_at < (p_date_to + interval '1 day')::timestamptz
  ),
  windows AS (
    SELECT unnest(ARRAY[1, 7, 14, 28, 30, 90, 180, 365]) AS window_days
  ),
  order_window_touches AS (
    SELECT
      oir.id AS order_id,
      oir.order_created_at,
      oir.shop_money_order_amount,
      oir.customer_shopify_id,
      oir.iana_timezone,
      oir.is_new_customer,
      oir.is_visible,
      oir.production_host,
      w.window_days,
      oa.traffic_source_id,
      oa.touch_ts,
      oa.created_at AS oa_created_at,
      -- channel: ad platform if set, else utm_source, else NULL (untagged)
      CASE
        WHEN COALESCE(ts.platform_key, '') <> '' THEN ts.platform_key
        WHEN COALESCE(ts.utm_source, '') <> '' THEN ts.utm_source
        ELSE NULL
      END AS channel,
      -- direct: no platform AND no UTM AND (no parseable cross-site referer)
      CASE
        WHEN COALESCE(ts.platform_key, '') <> '' THEN false
        WHEN COALESCE(ts.has_nonempty_utm, false) THEN false
        WHEN ss.referer IS NULL OR ss.referer = '' THEN true
        WHEN LOWER(NULLIF(
          SPLIT_PART(
            SPLIT_PART(
              REGEXP_REPLACE(ss.referer, '^https?://', ''),
              '/', 1
            ),
            ':', 1
          ),
          ''
        )) = oir.production_host THEN true
        ELSE false
      END AS is_direct
    FROM orders_in_range oir
    CROSS JOIN windows w
    JOIN order_attributions oa
      ON oa.order_id = oir.id
      AND oa.touch_ts >= oir.order_created_at - make_interval(days => w.window_days)
      AND oa.touch_ts <= oir.order_created_at
    JOIN traffic_sources ts ON ts.id = oa.traffic_source_id
    LEFT JOIN shop_sessions ss ON ss.id = oa.session_id
  ),
  ranked AS (
    SELECT
      owt.*,
      ROW_NUMBER() OVER (
        PARTITION BY owt.order_id, owt.window_days ORDER BY owt.touch_ts ASC
      ) AS touch_rank_asc,
      ROW_NUMBER() OVER (
        PARTITION BY owt.order_id, owt.window_days ORDER BY owt.touch_ts DESC
      ) AS touch_rank_desc,
      COUNT(*) OVER (
        PARTITION BY owt.order_id, owt.window_days
      ) AS total_touches,
      ROW_NUMBER() OVER (
        PARTITION BY owt.order_id, owt.window_days, owt.is_direct
        ORDER BY owt.touch_ts DESC
      ) AS rank_within_direct_class,
      ROW_NUMBER() OVER (
        PARTITION BY owt.order_id, owt.window_days, owt.channel
        ORDER BY owt.touch_ts DESC
      ) AS rank_within_channel
    FROM order_window_touches owt
  )
  -- first touch
  SELECT
    p_shop,
    r.order_id,
    COALESCE(r.customer_shopify_id, ''),
    r.traffic_source_id,
    0,
    r.order_created_at,
    to_char(r.order_created_at AT TIME ZONE COALESCE(r.iana_timezone, 'UTC'), 'YYYY-MM-DD'),
    'FT_' || r.window_days || 'D',
    1.0,
    COALESCE(r.shop_money_order_amount, 0)::double precision,
    r.is_new_customer,
    r.is_visible,
    r.oa_created_at,
    r.shop_money_order_amount
  FROM ranked r
  WHERE r.touch_rank_asc = 1

  UNION ALL

  -- last touch
  SELECT
    p_shop,
    r.order_id,
    COALESCE(r.customer_shopify_id, ''),
    r.traffic_source_id,
    0,
    r.order_created_at,
    to_char(r.order_created_at AT TIME ZONE COALESCE(r.iana_timezone, 'UTC'), 'YYYY-MM-DD'),
    'LT_' || r.window_days || 'D',
    1.0,
    COALESCE(r.shop_money_order_amount, 0)::double precision,
    r.is_new_customer,
    r.is_visible,
    r.oa_created_at,
    r.shop_money_order_amount
  FROM ranked r
  WHERE r.touch_rank_desc = 1

  UNION ALL

  -- linear
  SELECT
    p_shop,
    r.order_id,
    COALESCE(r.customer_shopify_id, ''),
    r.traffic_source_id,
    (r.touch_rank_asc - 1)::integer,
    r.order_created_at,
    to_char(r.order_created_at AT TIME ZONE COALESCE(r.iana_timezone, 'UTC'), 'YYYY-MM-DD'),
    'LN_' || r.window_days || 'D',
    1.0 / r.total_touches,
    COALESCE(r.shop_money_order_amount, 0)::double precision * (1.0 / r.total_touches),
    r.is_new_customer,
    r.is_visible,
    r.oa_created_at,
    r.shop_money_order_amount
  FROM ranked r

  UNION ALL

  -- any click: every touch gets credit=1, full revenue
  SELECT
    p_shop,
    r.order_id,
    COALESCE(r.customer_shopify_id, ''),
    r.traffic_source_id,
    (r.touch_rank_asc - 1)::integer,
    r.order_created_at,
    to_char(r.order_created_at AT TIME ZONE COALESCE(r.iana_timezone, 'UTC'), 'YYYY-MM-DD'),
    'AC_' || r.window_days || 'D',
    1.0,
    COALESCE(r.shop_money_order_amount, 0)::double precision,
    r.is_new_customer,
    r.is_visible,
    r.oa_created_at,
    r.shop_money_order_amount
  FROM ranked r

  UNION ALL

  -- last non-direct click: one row on the latest non-direct touch
  SELECT
    p_shop,
    r.order_id,
    COALESCE(r.customer_shopify_id, ''),
    r.traffic_source_id,
    0,
    r.order_created_at,
    to_char(r.order_created_at AT TIME ZONE COALESCE(r.iana_timezone, 'UTC'), 'YYYY-MM-DD'),
    'LND_' || r.window_days || 'D',
    1.0,
    COALESCE(r.shop_money_order_amount, 0)::double precision,
    r.is_new_customer,
    r.is_visible,
    r.oa_created_at,
    r.shop_money_order_amount
  FROM ranked r
  WHERE NOT r.is_direct
    AND r.rank_within_direct_class = 1

  UNION ALL

  -- origin attribution: latest touch per channel
  SELECT
    p_shop,
    r.order_id,
    COALESCE(r.customer_shopify_id, ''),
    r.traffic_source_id,
    (r.touch_rank_asc - 1)::integer,
    r.order_created_at,
    to_char(r.order_created_at AT TIME ZONE COALESCE(r.iana_timezone, 'UTC'), 'YYYY-MM-DD'),
    'OA_' || r.window_days || 'D',
    1.0,
    COALESCE(r.shop_money_order_amount, 0)::double precision,
    r.is_new_customer,
    r.is_visible,
    r.oa_created_at,
    r.shop_money_order_amount
  FROM ranked r
  WHERE r.channel IS NOT NULL
    AND r.rank_within_channel = 1;
$$;


ALTER FUNCTION "public"."get_touches_summary_for_shop"("p_shop" "text", "p_date_from" "date", "p_date_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_session_event_count"("p_session_id" "uuid", "p_add_to_carts" integer, "p_checkout_starts" integer) RETURNS "void"
    LANGUAGE "sql"
    AS $$
  UPDATE shop_sessions
      SET number_of_add_to_carts   = number_of_add_to_carts   + p_add_to_carts,
          number_of_checkout_starts = number_of_checkout_starts + p_checkout_starts
    WHERE id = p_session_id;
$$;


ALTER FUNCTION "public"."increment_session_event_count"("p_session_id" "uuid", "p_add_to_carts" integer, "p_checkout_starts" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."make_shop_orders_visible_batch"("p_shop" "text", "p_batch_size" integer) RETURNS integer
    LANGUAGE "plpgsql"
    SET "statement_timeout" TO '30min'
    AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH target_rows AS (
    SELECT id
    FROM orders
    WHERE shop = p_shop
      AND is_visible = 0
    LIMIT p_batch_size
  )
  UPDATE orders
  SET is_visible = 1
  FROM target_rows
  WHERE orders.id = target_rows.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."make_shop_orders_visible_batch"("p_shop" "text", "p_batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."make_shop_orders_visible_batch_skip"("p_shop" "text", "p_batch_size" integer, "p_skip" integer DEFAULT 0) RETURNS integer
    LANGUAGE "plpgsql"
    SET "statement_timeout" TO '30min'
    AS $$
DECLARE
  v_ids bigint[];
BEGIN
  SELECT array_agg(id) INTO v_ids
  FROM (
    SELECT id
    FROM orders
    WHERE shop = p_shop
    ORDER BY order_created_at
    LIMIT p_batch_size
    OFFSET p_skip
  ) batch;

  IF v_ids IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE orders
  SET is_visible = 1
  WHERE id = ANY(v_ids)
    AND is_visible = 0;

  RETURN p_skip + p_batch_size;
END;
$$;


ALTER FUNCTION "public"."make_shop_orders_visible_batch_skip"("p_shop" "text", "p_batch_size" integer, "p_skip" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_first_orders_visible_date_range"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_order_limit" integer, "p_timezone" "text") RETURNS integer
    LANGUAGE "plpgsql"
    SET "statement_timeout" TO '30min'
    AS $$
DECLARE
    v_updated integer;
BEGIN
    IF p_start_date IS NULL OR p_end_date IS NULL THEN
        RAISE EXCEPTION 'start_date and end_date must not be NULL';
    END IF;

    IF p_start_date > p_end_date THEN
        RAISE EXCEPTION 'start_date (%) is after end_date (%)', p_start_date, p_end_date;
    END IF;

    IF p_order_limit IS NULL OR p_order_limit < 0 THEN
        RAISE EXCEPTION 'order_limit must be a non-negative integer';
    END IF;

    WITH ranked AS (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY date_trunc('month', order_created_at AT TIME ZONE p_timezone)
                ORDER BY order_created_at
            ) AS rn
        FROM orders
        WHERE shop = p_shop
        AND order_created_at >= p_start_date
        AND order_created_at <  p_end_date
    )
    UPDATE orders AS o
    SET is_visible = CASE WHEN r.rn <= p_order_limit THEN 1 ELSE 0 END
    FROM ranked r
    WHERE o.id = r.id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;


ALTER FUNCTION "public"."mark_first_orders_visible_date_range"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_order_limit" integer, "p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prepare_plan_visibility_change_job"("p_shop" "text", "p_job_id" "uuid", "p_batch_size" integer DEFAULT 5000) RETURNS TABLE("total_orders" integer, "total_batches" integer)
    LANGUAGE "plpgsql"
    SET "statement_timeout" TO '30min'
    AS $$
DECLARE
    v_timezone text;
    v_first_order_created_at timestamptz;
    v_orders_per_month integer;
    v_cost_per_order_overage numeric;
    v_first_month_start_local timestamp;
    v_current_month_start_local timestamp;
    v_range_start_utc timestamptz;
    v_range_end_utc timestamptz;
    v_total_orders integer := 0;
    v_total_batches integer := 0;
BEGIN
    -- Resolve shop + subscription.
    SELECT
        s.iana_timezone,
        s.first_order_created_at,
        sub.orders_per_month,
        sub.cost_per_order_overage
    INTO
        v_timezone,
        v_first_order_created_at,
        v_orders_per_month,
        v_cost_per_order_overage
    FROM public.shops s
    LEFT JOIN public.subscriptions sub ON sub.id = s.currently_active_subscription_id
    WHERE s.shop = p_shop;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop not found: %', p_shop;
    END IF;

    IF v_timezone IS NULL THEN
        v_timezone := 'UTC';
    END IF;

    -- Start clean so a rebuild is atomic and self-contained. This only ever runs
    -- before any flipping has begun (the caller gates rebuilds on started_at).
    DELETE FROM public.plan_visibility_change_job_orders WHERE job_id = p_job_id;
    DELETE FROM public.plan_visibility_change_job_batches WHERE job_id = p_job_id;

    -- Build the snapshot of intended flips. batch_index is computed inline (one
    -- chronological window over the flipped set) instead of a second UPDATE pass,
    -- and months are ranked with PARTITION BY instead of a month-by-month loop.
    -- Both avoid joining the freshly-inserted (unanalysed) snapshot table back to
    -- itself, which the planner was running as an O(n^2) nested loop.
    -- orders.is_visible is flipped later, in chunks, by
    -- apply_plan_visibility_change_flip_batch.
    IF v_orders_per_month IS NULL OR v_cost_per_order_overage IS NOT NULL THEN
        -- Case 1: unlimited or pay-per-overage — every order should become visible.
        INSERT INTO public.plan_visibility_change_job_orders (job_id, batch_index, order_id, old_is_visible, new_is_visible)
        SELECT
            p_job_id,
            ((row_number() OVER (ORDER BY o.order_created_at ASC, o.id ASC) - 1) / p_batch_size)::integer,
            o.id,
            0::smallint,
            1::smallint
        FROM public.orders o
        WHERE o.shop = p_shop
        AND o.is_visible = 0;

    ELSE
        -- Case 2: fixed allowance — the first v_orders_per_month orders of each
        -- calendar month (in the shop's timezone) are visible, the rest hidden.
        v_first_order_created_at := COALESCE(v_first_order_created_at, now() - interval '12 months');
        IF v_first_order_created_at < '2015-01-01 00:00:00+00'::timestamptz THEN
            v_first_order_created_at := '2015-01-01 00:00:00+00'::timestamptz;
        END IF;

        v_first_month_start_local := date_trunc('month', (v_first_order_created_at AT TIME ZONE v_timezone))::timestamp;
        v_current_month_start_local := date_trunc('month', (now() AT TIME ZONE v_timezone))::timestamp;

        v_range_start_utc := (v_first_month_start_local AT TIME ZONE v_timezone);
        v_range_end_utc := ((v_current_month_start_local + interval '1 month') AT TIME ZONE v_timezone);

        INSERT INTO public.plan_visibility_change_job_orders (job_id, batch_index, order_id, old_is_visible, new_is_visible)
        SELECT
            p_job_id,
            ((row_number() OVER (ORDER BY flips.order_created_at ASC, flips.id ASC) - 1) / p_batch_size)::integer,
            flips.id,
            flips.old_visible,
            flips.new_visible
        FROM (
            SELECT
                ranked.id,
                ranked.order_created_at,
                ranked.old_visible,
                ranked.new_visible
            FROM (
                SELECT
                    o.id,
                    o.order_created_at,
                    o.is_visible AS old_visible,
                    CASE
                        WHEN row_number() OVER (
                            PARTITION BY date_trunc('month', (o.order_created_at AT TIME ZONE v_timezone))
                            ORDER BY o.order_created_at ASC, o.id ASC
                        ) <= v_orders_per_month THEN 1::smallint
                        ELSE 0::smallint
                    END AS new_visible
                FROM public.orders o
                WHERE o.shop = p_shop
                AND o.order_created_at >= v_range_start_utc
                AND o.order_created_at <  v_range_end_utc
            ) ranked
            WHERE ranked.old_visible IS DISTINCT FROM ranked.new_visible
        ) flips;
    END IF;

    -- Count results and create per-batch tracker rows WITH date bounds.
    SELECT COUNT(*)::integer INTO v_total_orders
    FROM public.plan_visibility_change_job_orders
    WHERE job_id = p_job_id;

    IF v_total_orders > 0 THEN
        v_total_batches := ((v_total_orders - 1) / p_batch_size) + 1;

        INSERT INTO public.plan_visibility_change_job_batches (job_id, batch_index, status, date_from, date_to)
        SELECT
            p_job_id,
            pvco.batch_index,
            'PENDING',
            MIN((o.order_created_at AT TIME ZONE v_timezone)::date),
            MAX((o.order_created_at AT TIME ZONE v_timezone)::date)
        FROM public.plan_visibility_change_job_orders pvco
        JOIN public.orders o ON o.id = pvco.order_id
        WHERE pvco.job_id = p_job_id
        GROUP BY pvco.batch_index;
    END IF;

    UPDATE public.plan_visibility_change_jobs
    SET total_orders = v_total_orders,
        total_batches = v_total_batches,
        status = CASE WHEN status = 'PENDING' THEN 'IN_PROGRESS' ELSE status END,
        started_at = COALESCE(started_at, now())
    WHERE id = p_job_id;

    total_orders := v_total_orders;
    total_batches := v_total_batches;
    RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."prepare_plan_visibility_change_job"("p_shop" "text", "p_job_id" "uuid", "p_batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_order_attributions_for_order"("p_order_id" bigint, "p_client_id" "uuid", "p_order_created_at" timestamp with time zone) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count integer := 0;
  v_session_count integer := 0;
  v_last_session_id uuid;
BEGIN
  -- Guard: if this order has no qualifying pixel sessions we MUST NOT delete
  -- its existing order_attributions. The order may legitimately rely on a
  -- SHOPIFY-source attribution as a fallback, and erasing it here would
  -- orphan the order with no attribution at all.
  SELECT count(*)
  INTO v_session_count
  FROM public.shop_sessions s
  WHERE s.client_id = p_client_id
    AND s.started_at <= p_order_created_at;

  IF v_session_count = 0 THEN
    RETURN 0;
  END IF;

  -- Only wipe PIXEL-source rows. SHOPIFY-source rows (created via
  -- createOrderAttributionsManually as a fallback) live alongside pixel
  -- attributions and shouldn't be touched by the per-client recalc.
  DELETE FROM public.order_attributions
  WHERE order_id = p_order_id
    AND data_source = 'PIXEL'::public."ORDER_ATTRIBUTION_DATA_SOURCE";

  INSERT INTO public.order_attributions (
    session_id,
    order_id,
    traffic_source_id,
    touch_rank,
    touch_ts,
    data_source,
    landing_page_id
  )
  SELECT
    s.id,
    p_order_id,
    s.traffic_source_id,
    (ROW_NUMBER() OVER (ORDER BY s.started_at ASC) - 1)::integer,
    s.started_at,
    'PIXEL'::public."ORDER_ATTRIBUTION_DATA_SOURCE",
    s.landing_page_id
  FROM public.shop_sessions s
  WHERE s.client_id = p_client_id
    AND s.started_at <= p_order_created_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    -- Look only at PIXEL rows: SHOPIFY rows have a null session_id, so even
    -- if one had a later touch_ts it can't be the converting session.
    SELECT session_id
    INTO v_last_session_id
    FROM public.order_attributions
    WHERE order_id = p_order_id
      AND data_source = 'PIXEL'::public."ORDER_ATTRIBUTION_DATA_SOURCE"
    ORDER BY touch_ts DESC, session_id DESC
    LIMIT 1;

    IF v_last_session_id IS NOT NULL THEN
      UPDATE public.orders
      SET converting_session_id = v_last_session_id
      WHERE id = p_order_id;
    END IF;
  END IF;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."recalculate_order_attributions_for_order"("p_order_id" bigint, "p_client_id" "uuid", "p_order_created_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_session_event_counts"("p_session_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  r record; k jsonb; is_dup boolean;
  kept jsonb := '[]'::jsonb; atc_count int := 0; cs_count int := 0;
BEGIN
  -- newest-first, mirroring app/utils/events.server.ts greedy dedup
  FOR r IN
    SELECT event_name, source::text AS source, current_page, client_id, event_ts
    FROM shop_events
    WHERE session_id = p_session_id
      AND event_name IN ('product_added_to_cart', 'checkout_started')
    ORDER BY event_ts DESC, id DESC
  LOOP
    is_dup := false;
    FOR k IN SELECT * FROM jsonb_array_elements(kept) LOOP
      IF  k->>'source'       IS DISTINCT FROM r.source
      AND k->>'event_name'   =  r.event_name
      AND r.client_id IS NOT NULL
      AND k->>'client_id'    =  r.client_id::text
      AND k->>'current_page' IS NOT DISTINCT FROM r.current_page
      AND abs(extract(epoch FROM ((k->>'event_ts')::timestamptz - r.event_ts))) <= 30
      THEN is_dup := true; EXIT; END IF;
    END LOOP;

    IF NOT is_dup THEN
      kept := kept || jsonb_build_object(
        'event_name', r.event_name, 'source', r.source,
        'current_page', r.current_page, 'client_id', r.client_id, 'event_ts', r.event_ts);
      IF r.event_name = 'product_added_to_cart'
        THEN atc_count := atc_count + 1; ELSE cs_count := cs_count + 1; END IF;
    END IF;
  END LOOP;

  UPDATE shop_sessions
  SET number_of_add_to_carts = atc_count, number_of_checkout_starts = cs_count
  WHERE id = p_session_id
    AND (number_of_add_to_carts    IS DISTINCT FROM atc_count
      OR number_of_checkout_starts IS DISTINCT FROM cs_count);
END $$;


ALTER FUNCTION "public"."recompute_session_event_counts"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_session_event_counts_bulk"("p_shop" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_event_upper" timestamp with time zone) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  r record;
  g_session uuid; g_name text; g_client uuid; g_page text;
  have_group boolean := false;
  min_kept_pixel timestamptz; min_kept_embed timestamptz;
  is_dup boolean; updated_count int;
BEGIN
  -- p_event_upper is intentionally unused: we drive off the session_id index and
  -- count ALL of each window-session's add-to-cart / checkout events (exact,
  -- matching live recompute). Kept in the signature for call-site compatibility.
  CREATE TEMP TABLE _kept (session_id uuid, event_name text) ON COMMIT DROP;

  FOR r IN
    SELECT s.id AS session_id, e.event_name, e.source::text AS source,
            e.client_id, e.current_page, e.event_ts, e.id
    FROM shop_sessions s
    CROSS JOIN LATERAL (
      SELECT ev.event_name, ev.source, ev.client_id, ev.current_page, ev.event_ts, ev.id
      FROM shop_events ev
      WHERE ev.session_id = s.id
        AND ev.event_name IN ('product_added_to_cart','checkout_started')
    ) e
    WHERE s.shop = p_shop
      AND s.started_at >= p_from
      AND s.started_at <  p_to
    ORDER BY s.id, e.event_name, e.client_id, e.current_page,
              e.event_ts DESC, e.id DESC
  LOOP
    IF NOT have_group
        OR g_session IS DISTINCT FROM r.session_id
        OR g_name    IS DISTINCT FROM r.event_name
        OR g_client  IS DISTINCT FROM r.client_id
        OR g_page    IS DISTINCT FROM r.current_page THEN
      have_group := true;
      g_session := r.session_id; g_name := r.event_name;
      g_client := r.client_id;   g_page := r.current_page;
      min_kept_pixel := NULL; min_kept_embed := NULL;
    END IF;

    is_dup := false;
    IF r.client_id IS NOT NULL THEN
      IF r.source = 'PIXEL' THEN
        is_dup := min_kept_embed IS NOT NULL AND min_kept_embed <= r.event_ts + interval '30 seconds';
      ELSE
        is_dup := min_kept_pixel IS NOT NULL AND min_kept_pixel <= r.event_ts + interval '30 seconds';
      END IF;
    END IF;

    IF NOT is_dup THEN
      IF r.source = 'PIXEL' THEN min_kept_pixel := r.event_ts;
      ELSE                       min_kept_embed := r.event_ts; END IF;
      INSERT INTO _kept VALUES (r.session_id, r.event_name);
    END IF;
  END LOOP;

  WITH agg AS (
    SELECT session_id,
            count(*) FILTER (WHERE event_name = 'product_added_to_cart') AS atc,
            count(*) FILTER (WHERE event_name = 'checkout_started')        AS cs
    FROM _kept GROUP BY session_id
  ),
  upd AS (
    UPDATE shop_sessions s
    SET number_of_add_to_carts = agg.atc, number_of_checkout_starts = agg.cs
    FROM agg
    WHERE s.id = agg.session_id
      AND (s.number_of_add_to_carts    IS DISTINCT FROM agg.atc
        OR s.number_of_checkout_starts IS DISTINCT FROM agg.cs)
    RETURNING 1
  )
  SELECT count(*) INTO updated_count FROM upd;

  RETURN updated_count;
END $$;


ALTER FUNCTION "public"."recompute_session_event_counts_bulk"("p_shop" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_event_upper" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_shop_performance_metrics"("p_shop" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "statement_timeout" TO '5min'
    AS $$
BEGIN
  INSERT INTO shop_performance_metrics (shop, month, revenue, ad_spend, currency_code, updated_at)
  SELECT
      p_shop,
      COALESCE(r.month, sp.month) AS month,
      COALESCE(r.revenue, 0) AS revenue,
      COALESCE(sp.ad_spend, 0) AS ad_spend,
      s.currency_code,
      now()
  FROM (
      SELECT
          date_trunc('month', o.order_created_at AT TIME ZONE (SELECT iana_timezone FROM shops WHERE shop = p_shop))::date AS month,
          sum(o.shop_money_order_amount) AS revenue
      FROM orders o
      WHERE o.shop = p_shop
      GROUP BY 1
  ) r
  FULL OUTER JOIN (
      SELECT
          date_trunc('month', m.date_in_shop_tz)::date AS month,
          sum(m.spend_shop_currency) AS ad_spend
      FROM ad_campaign_external_metrics m
      WHERE m.shop = p_shop
      GROUP BY 1
  ) sp ON sp.month = r.month
  CROSS JOIN shops s
  WHERE s.shop = p_shop
  ON CONFLICT (shop, month) DO UPDATE SET
      revenue = EXCLUDED.revenue,
      ad_spend = EXCLUDED.ad_spend,
      currency_code = EXCLUDED.currency_code,
      updated_at = EXCLUDED.updated_at;
END;
$$;


ALTER FUNCTION "public"."refresh_shop_performance_metrics"("p_shop" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rollup_ad_external_metrics"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN

    -- =========================================================
    -- AD SET ROLLUP
    -- Aggregate inserted rows up to (shop, date, ad_set_id)
    -- =========================================================
    INSERT INTO ad_set_external_metrics (
        shop, date_in_shop_tz, ad_set_id, updated_at,
        impressions, clicks, page_views,
        spend, spend_shop_currency,
        orders, revenue, revenue_shop_currency,
        cpc, cpc_shop_currency,
        conversion_rate, roas
    )
    SELECT
        n.shop,
        n.date_in_shop_tz,
        a.ad_set_id,
        now(),
        SUM(n.impressions),
        SUM(n.clicks),
        SUM(n.page_views),
        SUM(n.spend),
        SUM(n.spend_shop_currency),
        SUM(n.orders),
        SUM(n.revenue),
        SUM(n.revenue_shop_currency),
        -- Derived metrics recalculated from summed base values
        CASE WHEN SUM(n.clicks) = 0 THEN 0 ELSE SUM(n.spend)              / SUM(n.clicks) END,
        CASE WHEN SUM(n.clicks) = 0 THEN 0 ELSE SUM(n.spend_shop_currency) / SUM(n.clicks) END,
        CASE WHEN SUM(n.clicks) = 0 THEN 0 ELSE SUM(n.orders)             / SUM(n.clicks) END,
        CASE WHEN SUM(n.spend)  = 0 THEN 0 ELSE SUM(n.revenue)            / SUM(n.spend)  END
    FROM inserted_rows n
    JOIN ads a ON a.id = n.ad_id
    GROUP BY n.shop, n.date_in_shop_tz, a.ad_set_id

    ON CONFLICT (shop, date_in_shop_tz, ad_set_id) DO UPDATE SET
        updated_at            = now(),
        impressions           = ad_set_external_metrics.impressions           + EXCLUDED.impressions,
        clicks                = ad_set_external_metrics.clicks                + EXCLUDED.clicks,
        page_views            = ad_set_external_metrics.page_views            + EXCLUDED.page_views,
        spend                 = ad_set_external_metrics.spend                 + EXCLUDED.spend,
        spend_shop_currency   = ad_set_external_metrics.spend_shop_currency   + EXCLUDED.spend_shop_currency,
        orders                = ad_set_external_metrics.orders                + EXCLUDED.orders,
        revenue               = ad_set_external_metrics.revenue               + EXCLUDED.revenue,
        revenue_shop_currency = ad_set_external_metrics.revenue_shop_currency + EXCLUDED.revenue_shop_currency,
        -- Recalculate derived metrics from the new totals
        cpc = CASE
            WHEN (ad_set_external_metrics.clicks + EXCLUDED.clicks) = 0 THEN 0
            ELSE (ad_set_external_metrics.spend + EXCLUDED.spend)
               / (ad_set_external_metrics.clicks + EXCLUDED.clicks)
        END,
        cpc_shop_currency = CASE
            WHEN (ad_set_external_metrics.clicks + EXCLUDED.clicks) = 0 THEN 0
            ELSE (ad_set_external_metrics.spend_shop_currency + EXCLUDED.spend_shop_currency)
               / (ad_set_external_metrics.clicks + EXCLUDED.clicks)
        END,
        conversion_rate = CASE
            WHEN (ad_set_external_metrics.clicks + EXCLUDED.clicks) = 0 THEN 0
            ELSE (ad_set_external_metrics.orders + EXCLUDED.orders)
               / (ad_set_external_metrics.clicks + EXCLUDED.clicks)
        END,
        roas = CASE
            WHEN (ad_set_external_metrics.spend + EXCLUDED.spend) = 0 THEN 0
            ELSE (ad_set_external_metrics.revenue + EXCLUDED.revenue)
               / (ad_set_external_metrics.spend + EXCLUDED.spend)
        END;


    -- =========================================================
    -- CAMPAIGN ROLLUP
    -- Aggregate inserted rows up to (shop, date, ad_campaign_id)
    -- =========================================================
    INSERT INTO ad_campaign_external_metrics (
        shop, date_in_shop_tz, ad_campaign_id, updated_at,
        impressions, clicks, page_views,
        spend, spend_shop_currency,
        orders, revenue, revenue_shop_currency,
        cpc, cpc_shop_currency,
        conversion_rate, roas
    )
    SELECT
        n.shop,
        n.date_in_shop_tz,
        s.ad_campaign_id,
        now(),
        SUM(n.impressions),
        SUM(n.clicks),
        SUM(n.page_views),
        SUM(n.spend),
        SUM(n.spend_shop_currency),
        SUM(n.orders),
        SUM(n.revenue),
        SUM(n.revenue_shop_currency),
        CASE WHEN SUM(n.clicks) = 0 THEN 0 ELSE SUM(n.spend)               / SUM(n.clicks) END,
        CASE WHEN SUM(n.clicks) = 0 THEN 0 ELSE SUM(n.spend_shop_currency)  / SUM(n.clicks) END,
        CASE WHEN SUM(n.clicks) = 0 THEN 0 ELSE SUM(n.orders)              / SUM(n.clicks) END,
        CASE WHEN SUM(n.spend)  = 0 THEN 0 ELSE SUM(n.revenue)             / SUM(n.spend)  END
    FROM inserted_rows n
    JOIN ads a       ON a.id          = n.ad_id
    JOIN ad_sets s   ON s.id          = a.ad_set_id
    GROUP BY n.shop, n.date_in_shop_tz, s.ad_campaign_id

    ON CONFLICT (shop, date_in_shop_tz, ad_campaign_id) DO UPDATE SET
        updated_at            = now(),
        impressions           = ad_campaign_external_metrics.impressions           + EXCLUDED.impressions,
        clicks                = ad_campaign_external_metrics.clicks                + EXCLUDED.clicks,
        page_views            = ad_campaign_external_metrics.page_views            + EXCLUDED.page_views,
        spend                 = ad_campaign_external_metrics.spend                 + EXCLUDED.spend,
        spend_shop_currency   = ad_campaign_external_metrics.spend_shop_currency   + EXCLUDED.spend_shop_currency,
        orders                = ad_campaign_external_metrics.orders                + EXCLUDED.orders,
        revenue               = ad_campaign_external_metrics.revenue               + EXCLUDED.revenue,
        revenue_shop_currency = ad_campaign_external_metrics.revenue_shop_currency + EXCLUDED.revenue_shop_currency,
        cpc = CASE
            WHEN (ad_campaign_external_metrics.clicks + EXCLUDED.clicks) = 0 THEN 0
            ELSE (ad_campaign_external_metrics.spend + EXCLUDED.spend)
               / (ad_campaign_external_metrics.clicks + EXCLUDED.clicks)
        END,
        cpc_shop_currency = CASE
            WHEN (ad_campaign_external_metrics.clicks + EXCLUDED.clicks) = 0 THEN 0
            ELSE (ad_campaign_external_metrics.spend_shop_currency + EXCLUDED.spend_shop_currency)
               / (ad_campaign_external_metrics.clicks + EXCLUDED.clicks)
        END,
        conversion_rate = CASE
            WHEN (ad_campaign_external_metrics.clicks + EXCLUDED.clicks) = 0 THEN 0
            ELSE (ad_campaign_external_metrics.orders + EXCLUDED.orders)
               / (ad_campaign_external_metrics.clicks + EXCLUDED.clicks)
        END,
        roas = CASE
            WHEN (ad_campaign_external_metrics.spend + EXCLUDED.spend) = 0 THEN 0
            ELSE (ad_campaign_external_metrics.revenue + EXCLUDED.revenue)
               / (ad_campaign_external_metrics.spend + EXCLUDED.spend)
        END;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."rollup_ad_external_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rollup_ad_external_metrics_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN

    -- =========================================================
    -- AD SET ROLLUP — full recalculation from all child rows
    -- =========================================================
    INSERT INTO ad_set_external_metrics (
        shop, date_in_shop_tz, ad_set_id, updated_at,
        impressions, clicks, page_views,
        spend, spend_shop_currency,
        orders, revenue, revenue_shop_currency,
        cpc, cpc_shop_currency, conversion_rate, roas
    )
    SELECT
        m.shop, m.date_in_shop_tz, a.ad_set_id, now(),
        SUM(m.impressions), SUM(m.clicks), SUM(m.page_views),
        SUM(m.spend), SUM(m.spend_shop_currency),
        SUM(m.orders), SUM(m.revenue), SUM(m.revenue_shop_currency),
        CASE WHEN SUM(m.clicks) = 0 THEN 0 ELSE SUM(m.spend)               / SUM(m.clicks) END,
        CASE WHEN SUM(m.clicks) = 0 THEN 0 ELSE SUM(m.spend_shop_currency)  / SUM(m.clicks) END,
        CASE WHEN SUM(m.clicks) = 0 THEN 0 ELSE SUM(m.orders)              / SUM(m.clicks) END,
        CASE WHEN SUM(m.spend)  = 0 THEN 0 ELSE SUM(m.revenue)             / SUM(m.spend)  END
    FROM ad_external_metrics m
    JOIN ads a ON a.id = m.ad_id
    -- Only recalculate the ad_sets that were actually touched
    WHERE (m.shop, m.date_in_shop_tz, a.ad_set_id) IN (
        SELECT n.shop, n.date_in_shop_tz, a2.ad_set_id
        FROM new_rows n
        JOIN ads a2 ON a2.id = n.ad_id
    )
    GROUP BY m.shop, m.date_in_shop_tz, a.ad_set_id

    ON CONFLICT (shop, date_in_shop_tz, ad_set_id) DO UPDATE SET
        updated_at            = now(),
        impressions           = EXCLUDED.impressions,
        clicks                = EXCLUDED.clicks,
        page_views            = EXCLUDED.page_views,
        spend                 = EXCLUDED.spend,
        spend_shop_currency   = EXCLUDED.spend_shop_currency,
        orders                = EXCLUDED.orders,
        revenue               = EXCLUDED.revenue,
        revenue_shop_currency = EXCLUDED.revenue_shop_currency,
        cpc                   = EXCLUDED.cpc,
        cpc_shop_currency     = EXCLUDED.cpc_shop_currency,
        conversion_rate       = EXCLUDED.conversion_rate,
        roas                  = EXCLUDED.roas;

    -- =========================================================
    -- CAMPAIGN ROLLUP — full recalculation from all child rows
    -- =========================================================
    INSERT INTO ad_campaign_external_metrics (
        shop, date_in_shop_tz, ad_campaign_id, updated_at,
        impressions, clicks, page_views,
        spend, spend_shop_currency,
        orders, revenue, revenue_shop_currency,
        cpc, cpc_shop_currency, conversion_rate, roas
    )
    SELECT
        m.shop, m.date_in_shop_tz, s.ad_campaign_id, now(),
        SUM(m.impressions), SUM(m.clicks), SUM(m.page_views),
        SUM(m.spend), SUM(m.spend_shop_currency),
        SUM(m.orders), SUM(m.revenue), SUM(m.revenue_shop_currency),
        CASE WHEN SUM(m.clicks) = 0 THEN 0 ELSE SUM(m.spend)               / SUM(m.clicks) END,
        CASE WHEN SUM(m.clicks) = 0 THEN 0 ELSE SUM(m.spend_shop_currency)  / SUM(m.clicks) END,
        CASE WHEN SUM(m.clicks) = 0 THEN 0 ELSE SUM(m.orders)              / SUM(m.clicks) END,
        CASE WHEN SUM(m.spend)  = 0 THEN 0 ELSE SUM(m.revenue)             / SUM(m.spend)  END
    FROM ad_external_metrics m
    JOIN ads a     ON a.id  = m.ad_id
    JOIN ad_sets s ON s.id  = a.ad_set_id
    -- Only recalculate the campaigns that were actually touched
    WHERE (m.shop, m.date_in_shop_tz, s.ad_campaign_id) IN (
        SELECT n.shop, n.date_in_shop_tz, s2.ad_campaign_id
        FROM new_rows n
        JOIN ads a2     ON a2.id = n.ad_id
        JOIN ad_sets s2 ON s2.id = a2.ad_set_id
    )
    GROUP BY m.shop, m.date_in_shop_tz, s.ad_campaign_id

    ON CONFLICT (shop, date_in_shop_tz, ad_campaign_id) DO UPDATE SET
        updated_at            = now(),
        impressions           = EXCLUDED.impressions,
        clicks                = EXCLUDED.clicks,
        page_views            = EXCLUDED.page_views,
        spend                 = EXCLUDED.spend,
        spend_shop_currency   = EXCLUDED.spend_shop_currency,
        orders                = EXCLUDED.orders,
        revenue               = EXCLUDED.revenue,
        revenue_shop_currency = EXCLUDED.revenue_shop_currency,
        cpc                   = EXCLUDED.cpc,
        cpc_shop_currency     = EXCLUDED.cpc_shop_currency,
        conversion_rate       = EXCLUDED.conversion_rate,
        roas                  = EXCLUDED.roas;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."rollup_ad_external_metrics_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."tg_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_order_status"("p_shop" "text", "p_order_id" "text", "p_financial_status" "text" DEFAULT NULL::"text", "p_fulfillment_status" "text" DEFAULT NULL::"text") RETURNS TABLE("id" bigint, "financial_status" "text", "fulfillment_status" "text")
    LANGUAGE "sql"
    AS $$
  UPDATE public.orders o
  SET financial_status   = p_financial_status,
      fulfillment_status = p_fulfillment_status
  WHERE o.shop = p_shop
    AND o.order_id = p_order_id
    AND (
      o.financial_status      IS DISTINCT FROM p_financial_status
      OR o.fulfillment_status IS DISTINCT FROM p_fulfillment_status
    )
  RETURNING o.id, o.financial_status, o.fulfillment_status;
$$;


ALTER FUNCTION "public"."update_order_status"("p_shop" "text", "p_order_id" "text", "p_financial_status" "text", "p_fulfillment_status" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ad_account_sync_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop_setup_job_id" "uuid" NOT NULL,
    "connectable_platform_id" bigint NOT NULL,
    "status" "public"."STORE_SETUP_STATUS" NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "connected_account" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."ad_account_sync_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ad_campaign_external_metrics" (
    "shop" "text" NOT NULL,
    "date_in_shop_tz" "date" NOT NULL,
    "ad_campaign_id" bigint NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT "now"() NOT NULL,
    "impressions" bigint DEFAULT '0'::bigint NOT NULL,
    "clicks" bigint DEFAULT '0'::bigint NOT NULL,
    "page_views" bigint DEFAULT '0'::bigint NOT NULL,
    "spend" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "spend_shop_currency" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "cpc" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "cpc_shop_currency" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "orders" numeric(18,6) DEFAULT 0 NOT NULL,
    "revenue" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "revenue_shop_currency" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "conversion_rate" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "roas" numeric(18,6) DEFAULT '0'::numeric NOT NULL
);

ALTER TABLE ONLY "public"."ad_campaign_external_metrics" REPLICA IDENTITY FULL;


ALTER TABLE "public"."ad_campaign_external_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ad_campaigns" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "platform_account_id" bigint NOT NULL,
    "external_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT ''::"text" NOT NULL,
    "campaign_created_at" timestamp with time zone,
    "platform" "text" NOT NULL,
    "campaign_type" "public"."ad_campaign_type" DEFAULT 'NORMAL'::"public"."ad_campaign_type" NOT NULL
);

ALTER TABLE ONLY "public"."ad_campaigns" REPLICA IDENTITY FULL;


ALTER TABLE "public"."ad_campaigns" OWNER TO "postgres";


ALTER TABLE "public"."ad_campaigns" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ad_campaigns_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ad_campaigns_summary" (
    "id" bigint NOT NULL,
    "date" "date" NOT NULL,
    "clicks" bigint DEFAULT '0'::bigint NOT NULL,
    "spend" numeric DEFAULT 0.00 NOT NULL,
    "impressions" bigint DEFAULT '0'::bigint NOT NULL,
    "orders" bigint DEFAULT '0'::bigint NOT NULL,
    "revenue" numeric DEFAULT '0'::numeric NOT NULL,
    "new_customers" bigint DEFAULT '0'::bigint NOT NULL,
    "roas" numeric DEFAULT '0'::numeric NOT NULL,
    "cac" numeric DEFAULT '0'::numeric NOT NULL,
    "aov" numeric DEFAULT '0'::numeric NOT NULL,
    "conversion_rate" numeric DEFAULT '0'::numeric NOT NULL,
    "ad_campaign_id" bigint NOT NULL,
    "spend_shop_currency" numeric DEFAULT '0'::numeric NOT NULL
);


ALTER TABLE "public"."ad_campaigns_summary" OWNER TO "postgres";


ALTER TABLE "public"."ad_campaigns_summary" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ad_campaigns_summary_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ad_external_metrics" (
    "shop" "text" NOT NULL,
    "date_in_shop_tz" "date" NOT NULL,
    "ad_id" bigint NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT "now"() NOT NULL,
    "impressions" bigint DEFAULT '0'::bigint NOT NULL,
    "clicks" bigint DEFAULT '0'::bigint NOT NULL,
    "page_views" bigint DEFAULT '0'::bigint NOT NULL,
    "spend" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "spend_shop_currency" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "cpc" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "cpc_shop_currency" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "orders" numeric(18,6) DEFAULT 0 NOT NULL,
    "revenue" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "revenue_shop_currency" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "conversion_rate" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "roas" numeric(18,6) DEFAULT '0'::numeric NOT NULL
);

ALTER TABLE ONLY "public"."ad_external_metrics" REPLICA IDENTITY FULL;


ALTER TABLE "public"."ad_external_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ad_set_external_metrics" (
    "shop" "text" NOT NULL,
    "date_in_shop_tz" "date" NOT NULL,
    "ad_set_id" bigint NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT "now"() NOT NULL,
    "impressions" bigint DEFAULT '0'::bigint NOT NULL,
    "clicks" bigint DEFAULT '0'::bigint NOT NULL,
    "page_views" bigint DEFAULT '0'::bigint NOT NULL,
    "spend" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "spend_shop_currency" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "cpc" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "cpc_shop_currency" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "orders" numeric(18,6) DEFAULT 0 NOT NULL,
    "revenue" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "revenue_shop_currency" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "conversion_rate" numeric(18,6) DEFAULT '0'::numeric NOT NULL,
    "roas" numeric(18,6) DEFAULT '0'::numeric NOT NULL
);

ALTER TABLE ONLY "public"."ad_set_external_metrics" REPLICA IDENTITY FULL;


ALTER TABLE "public"."ad_set_external_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ad_sets" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ad_campaign_id" bigint NOT NULL,
    "external_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT ''::"text" NOT NULL,
    "end_time" timestamp with time zone,
    "platform" "text" NOT NULL
);

ALTER TABLE ONLY "public"."ad_sets" REPLICA IDENTITY FULL;


ALTER TABLE "public"."ad_sets" OWNER TO "postgres";


ALTER TABLE "public"."ad_sets" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ad_sets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ad_sets_summary" (
    "id" bigint NOT NULL,
    "date" "date" NOT NULL,
    "clicks" bigint DEFAULT '0'::bigint NOT NULL,
    "spend" numeric DEFAULT 0.00 NOT NULL,
    "impressions" bigint DEFAULT '0'::bigint NOT NULL,
    "orders" bigint DEFAULT '0'::bigint NOT NULL,
    "revenue" numeric DEFAULT '0'::numeric NOT NULL,
    "new_customers" bigint DEFAULT '0'::bigint NOT NULL,
    "roas" numeric DEFAULT '0'::numeric NOT NULL,
    "cac" numeric DEFAULT '0'::numeric NOT NULL,
    "aov" numeric DEFAULT '0'::numeric NOT NULL,
    "conversion_rate" numeric DEFAULT '0'::numeric NOT NULL,
    "ad_set_id" bigint NOT NULL,
    "spend_shop_currency" numeric DEFAULT '0'::numeric NOT NULL
);


ALTER TABLE "public"."ad_sets_summary" OWNER TO "postgres";


ALTER TABLE "public"."ad_sets_summary" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ad_sets_summary_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ads" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ad_set_id" bigint NOT NULL,
    "external_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "internal_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "website_url" "text",
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_content" "text",
    "utm_term" "text",
    "platform" "text" NOT NULL,
    "ad_creative_external_id" "text",
    "status" "text" DEFAULT ''::"text" NOT NULL,
    "website_url_valid" boolean DEFAULT false NOT NULL,
    "ignored" boolean DEFAULT false NOT NULL,
    "url_tags" "text",
    "is_hidden" boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY "public"."ads" REPLICA IDENTITY FULL;


ALTER TABLE "public"."ads" OWNER TO "postgres";


ALTER TABLE "public"."ads" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ads_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ads_summary" (
    "id" bigint NOT NULL,
    "ad_id" bigint NOT NULL,
    "date" "date" NOT NULL,
    "clicks" bigint DEFAULT '0'::bigint NOT NULL,
    "spend" numeric DEFAULT 0.00 NOT NULL,
    "impressions" bigint DEFAULT '0'::bigint NOT NULL,
    "orders" bigint DEFAULT '0'::bigint NOT NULL,
    "revenue" numeric DEFAULT '0'::numeric NOT NULL,
    "new_customers" bigint DEFAULT '0'::bigint NOT NULL,
    "roas" numeric DEFAULT '0'::numeric NOT NULL,
    "cac" numeric DEFAULT '0'::numeric NOT NULL,
    "aov" numeric DEFAULT '0'::numeric NOT NULL,
    "conversion_rate" numeric DEFAULT '0'::numeric NOT NULL,
    "spend_shop_currency" numeric DEFAULT '0'::numeric NOT NULL
);


ALTER TABLE "public"."ads_summary" OWNER TO "postgres";


ALTER TABLE "public"."ads_summary" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ads_summary_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."attributed_orders_export_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "download_url" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL
);


ALTER TABLE "public"."attributed_orders_export_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bulk_fetch_jobs" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "shopifyGraphqlId" "text" NOT NULL,
    "status" "text" NOT NULL,
    "dataUrl" "text",
    "error_code" "text",
    "processed_until" timestamp with time zone,
    "type" "text" DEFAULT 'UPSERT'::"text" NOT NULL
);


ALTER TABLE "public"."bulk_fetch_jobs" OWNER TO "postgres";


ALTER TABLE "public"."bulk_fetch_jobs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."bulk_fetch_jobs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."cancellation_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "alternative_shown" "text",
    "action_taken" "text" NOT NULL,
    "feedback_text" "text"
);


ALTER TABLE "public"."cancellation_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."changelog_entries" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" "date" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "show_on_website" boolean NOT NULL,
    "show_in_app" boolean NOT NULL,
    "image_url" "text"
);


ALTER TABLE "public"."changelog_entries" OWNER TO "postgres";


ALTER TABLE "public"."changelog_entries" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."changelog_entry_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."checkout_sessions" (
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "landing_url" "text",
    "origin_id" "text",
    "origin_source" "text",
    "event_name" "text" DEFAULT ''::"text"
);


ALTER TABLE "public"."checkout_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."connectable_platforms" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "active" boolean NOT NULL,
    "key" "text" NOT NULL,
    "beta" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."connectable_platforms" OWNER TO "postgres";


ALTER TABLE "public"."connectable_platforms" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."connectable_platforms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."connected_platforms" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "connectable_platform_id" bigint NOT NULL,
    "shop" "text" NOT NULL,
    "connection_information" "jsonb" NOT NULL,
    "permissions" "text",
    "status" "public"."CONNECTED_ACCOUNT_STATUS" DEFAULT 'PENDING'::"public"."CONNECTED_ACCOUNT_STATUS" NOT NULL,
    "last_synced_at" timestamp with time zone,
    "syncing" boolean DEFAULT false NOT NULL,
    "has_completed_setup" boolean DEFAULT false NOT NULL,
    "sync_blocked_until" timestamp with time zone,
    "has_selected_accounts" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."connected_platforms" OWNER TO "postgres";


ALTER TABLE "public"."connected_platforms" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."connected_platforms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."contact_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "contacted_email" "text" NOT NULL,
    "email_type" "text" NOT NULL
);


ALTER TABLE "public"."contact_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."currency_conversion_rates" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" "date" NOT NULL,
    "from_currency" "text" NOT NULL,
    "to_currency" "text" NOT NULL,
    "rate" numeric NOT NULL
);


ALTER TABLE "public"."currency_conversion_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_first_orders" (
    "shop" "text" NOT NULL,
    "customer_shopify_id" "text" NOT NULL,
    "order_id" bigint NOT NULL,
    "order_created_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."customer_first_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_tag_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "customer_tag_rule_id" "uuid" NOT NULL,
    "order_id" bigint NOT NULL,
    "customer_shopify_id" "text" NOT NULL,
    "tags" "jsonb" NOT NULL,
    "order_attribution_id" "uuid" NOT NULL,
    "success" boolean NOT NULL,
    "error" "text"
);


ALTER TABLE "public"."customer_tag_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_tag_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text",
    "name" "text" NOT NULL,
    "tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "touch_position" "public"."TOUCH_POSITION" NOT NULL,
    "utm_source_match_type" "public"."UTM_MATCH_TYPE" NOT NULL,
    "utm_source_value" "text",
    "utm_medium_match_type" "public"."UTM_MATCH_TYPE" NOT NULL,
    "utm_medium_value" "text",
    "utm_campaign_match_type" "public"."UTM_MATCH_TYPE" NOT NULL,
    "utm_campaign_value" "text",
    "utm_content_match_type" "public"."UTM_MATCH_TYPE" NOT NULL,
    "utm_content_value" "text",
    "utm_term_match_type" "public"."UTM_MATCH_TYPE" NOT NULL,
    "utm_term_value" "text",
    "ad_id" bigint
);


ALTER TABLE "public"."customer_tag_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_export_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "gcs_path" "text",
    "download_url" "text",
    "expires_at" timestamp with time zone,
    "row_counts" "jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."data_export_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."early_access_requests" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "feature" "text" NOT NULL,
    "contacted" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."early_access_requests" OWNER TO "postgres";


ALTER TABLE "public"."early_access_requests" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."early_access_request_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."failed_embed_events" (
    "id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "source" "text",
    "processed_at" timestamp with time zone,
    "error" "text"
);


ALTER TABLE "public"."failed_embed_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."failed_events" (
    "id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "source" "text",
    "processed_at" timestamp with time zone,
    "error" "text"
);


ALTER TABLE "public"."failed_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_flag_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean NOT NULL,
    "value" "jsonb",
    "subscription_id" bigint NOT NULL
);


ALTER TABLE "public"."feature_flag_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flow_watermarks" (
    "slot" "text" NOT NULL,
    "watermark" "text"
);


ALTER TABLE "public"."flow_watermarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_backfill_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "shop_integration_id" bigint,
    "integration_key" "text" NOT NULL,
    "status" "public"."STORE_SETUP_STATUS" DEFAULT 'PENDING'::"public"."STORE_SETUP_STATUS" NOT NULL,
    "backfill_from" timestamp with time zone NOT NULL,
    "cursor" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "total_items" integer,
    "processed_items" integer DEFAULT 0 NOT NULL,
    "matched_items" integer DEFAULT 0 NOT NULL,
    "unmatched_items" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "error_message" "text"
);


ALTER TABLE "public"."integration_backfill_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "integration_key" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "external_number" "text",
    "order_id" bigint,
    "platform_order_id" "text",
    "status" "text",
    "amounts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "currency_code" "text" DEFAULT 'USD'::"text" NOT NULL,
    "external_created_at" timestamp with time zone
);


ALTER TABLE "public"."integration_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."landing_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "normalized_landing_page" "text" NOT NULL
);

ALTER TABLE ONLY "public"."landing_pages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."landing_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."landing_pages_summary_daily" (
    "landing_page_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sessions_count" integer DEFAULT 0 NOT NULL,
    "unique_sessions_count" integer DEFAULT 0 NOT NULL,
    "orders_count" integer DEFAULT 0 NOT NULL,
    "revenue" numeric DEFAULT '0'::numeric NOT NULL
);


ALTER TABLE "public"."landing_pages_summary_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."line_items" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shopify_id" "text" NOT NULL,
    "order_id" bigint NOT NULL,
    "quantity" integer NOT NULL,
    "product_shopify_id" "text",
    "product_title" "text",
    "variant_shopify_id" "text",
    "variant_title" "text",
    "shop_money_unit_price_amount" numeric NOT NULL,
    "shop_money_unit_price_currency_code" "text" NOT NULL
);


ALTER TABLE "public"."line_items" OWNER TO "postgres";


ALTER TABLE "public"."line_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."line_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."mandatory_webhooks" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "data" "json",
    "topic" "text",
    "shop" "text"
);


ALTER TABLE "public"."mandatory_webhooks" OWNER TO "postgres";


ALTER TABLE "public"."mandatory_webhooks" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."mandatory_webhooks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."named_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop" "text" NOT NULL,
    "kind" "public"."NAMED_SOURCE_KIND" NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "favicon_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."named_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_attribution_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop_setup_job_id" "uuid" NOT NULL,
    "status" "public"."STORE_SETUP_STATUS" NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone
);


ALTER TABLE "public"."order_attribution_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_attributions" (
    "order_id" bigint NOT NULL,
    "traffic_source_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "touch_rank" integer,
    "touch_ts" timestamp with time zone NOT NULL,
    "data_source" "public"."ORDER_ATTRIBUTION_DATA_SOURCE" DEFAULT 'SHOPIFY'::"public"."ORDER_ATTRIBUTION_DATA_SOURCE" NOT NULL,
    "landing_page_id" "uuid",
    "session_id" "uuid",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_method" "text",
    "confidence" numeric(3,2)
);

ALTER TABLE ONLY "public"."order_attributions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."order_attributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_batch_download_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order_download_job_id" "uuid" NOT NULL,
    "status" "public"."ORDER_DOWNLOAD_STATUS" NOT NULL,
    "order_batch_file_path" "text" NOT NULL,
    "error_code" "text",
    "finished_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "enqueued_at" timestamp with time zone
);


ALTER TABLE "public"."order_batch_download_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop" "text" NOT NULL,
    "order_id" bigint NOT NULL,
    "order_created_at" timestamp with time zone NOT NULL,
    "category" "public"."COST_CATEGORY" NOT NULL,
    "source" "public"."COST_SOURCE" NOT NULL,
    "amount" numeric(18,6) NOT NULL,
    "currency_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_costs_amount_non_negative" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."order_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_download_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."ORDER_DOWNLOAD_STATUS" NOT NULL,
    "order_file_url" "text",
    "error_code" "text",
    "finished_at" timestamp with time zone,
    "shop_setup_job_id" "uuid" NOT NULL,
    "created_batches" boolean DEFAULT false NOT NULL,
    "started_at" timestamp with time zone
);


ALTER TABLE "public"."order_download_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_export_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "download_url" "text"
);


ALTER TABLE "public"."order_export_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_overage_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop" "text" NOT NULL,
    "billing_period_end" timestamp with time zone NOT NULL,
    "billing_period_start" timestamp with time zone NOT NULL,
    "order_id" bigint NOT NULL,
    "shopify_order_id" "text" NOT NULL,
    "order_created_at" timestamp with time zone NOT NULL,
    "status" "public"."ORDER_OVERAGE_STATUS" DEFAULT 'READY'::"public"."ORDER_OVERAGE_STATUS" NOT NULL,
    "app_usage_record_id" "text",
    "claimed_at" timestamp with time zone,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_overage_records_period_valid" CHECK (("billing_period_start" < "billing_period_end"))
);


ALTER TABLE "public"."order_overage_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_totals_daily" (
    "shop" "text" NOT NULL,
    "day" "date" NOT NULL,
    "total_orders" bigint DEFAULT '0'::bigint NOT NULL,
    "total_revenue" numeric DEFAULT '0'::numeric NOT NULL,
    "shopify_tracked_orders" bigint DEFAULT '0'::bigint NOT NULL,
    "shopify_tracked_revenue" numeric DEFAULT '0'::numeric NOT NULL,
    "origin_tracked_orders" bigint DEFAULT '0'::bigint NOT NULL,
    "origin_tracked_revenue" numeric DEFAULT '0'::numeric NOT NULL,
    "origin_tracked_sessions" bigint DEFAULT '0'::bigint NOT NULL,
    "total_web_orders" bigint DEFAULT '0'::bigint NOT NULL,
    "total_web_revenue" numeric DEFAULT '0'::numeric NOT NULL
);


ALTER TABLE "public"."order_totals_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "order_created_at" timestamp with time zone NOT NULL,
    "name" "text",
    "order_id" "text" NOT NULL,
    "shop" "text" NOT NULL,
    "utm_source" "text",
    "utm_campaign" "text",
    "utm_medium" "text",
    "utm_content" "text",
    "utm_term" "text",
    "shop_money_order_amount" numeric,
    "shop_money_currency_code" "text",
    "customer_name" "text",
    "customer_shopify_id" "text",
    "checkout_token" "text",
    "financial_status" "text",
    "fulfillment_status" "text",
    "first_visit" "jsonb",
    "last_visit" "jsonb",
    "source_name" "text",
    "tracked_by_origin" smallint DEFAULT 0 NOT NULL,
    "tracked_by_shopify" smallint DEFAULT 0 NOT NULL,
    "converting_session_id" "uuid",
    "is_visible" smallint DEFAULT 0 NOT NULL,
    "processed_by_webhook" boolean DEFAULT false NOT NULL
)
WITH ("autovacuum_vacuum_scale_factor"='0.05');

ALTER TABLE ONLY "public"."orders" REPLICA IDENTITY FULL;


ALTER TABLE "public"."orders" OWNER TO "postgres";


ALTER TABLE "public"."orders" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."orphan_ad_account_sync_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "connectable_platform_id" bigint NOT NULL,
    "status" "public"."STORE_SETUP_STATUS" NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "shop" "text"
);


ALTER TABLE "public"."orphan_ad_account_sync_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orphan_plan_modify_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."STORE_SETUP_STATUS" NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "shop" "text" NOT NULL
);


ALTER TABLE "public"."orphan_plan_modify_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_change_jobs" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "status" "public"."PLAN_CHANGE_JOB_STATUS" DEFAULT 'PENDING'::"public"."PLAN_CHANGE_JOB_STATUS" NOT NULL
);


ALTER TABLE "public"."plan_change_jobs" OWNER TO "postgres";


ALTER TABLE "public"."plan_change_jobs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."plan_change_jobs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."plan_modify_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."STORE_SETUP_STATUS" NOT NULL,
    "shop_setup_job_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone
);


ALTER TABLE "public"."plan_modify_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_visibility_change_job_batches" (
    "job_id" "uuid" NOT NULL,
    "batch_index" integer NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "error" "text",
    "date_from" "date",
    "date_to" "date"
);


ALTER TABLE "public"."plan_visibility_change_job_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_visibility_change_job_orders" (
    "job_id" "uuid" NOT NULL,
    "batch_index" integer NOT NULL,
    "order_id" bigint NOT NULL,
    "old_is_visible" smallint NOT NULL,
    "new_is_visible" smallint NOT NULL
);


ALTER TABLE "public"."plan_visibility_change_job_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_visibility_change_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "shop" "text" NOT NULL,
    "orphan_plan_modify_job_id" "uuid",
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "total_orders" integer DEFAULT 0 NOT NULL,
    "total_batches" integer DEFAULT 0 NOT NULL,
    "error" "text"
);


ALTER TABLE "public"."plan_visibility_change_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_accounts" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "platform_id" bigint NOT NULL,
    "external_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "currency_code" "text" NOT NULL,
    "sync_blocked_until" timestamp with time zone,
    "is_manager" boolean DEFAULT false NOT NULL,
    "parent_platform_account_id" bigint
);


ALTER TABLE "public"."platform_accounts" OWNER TO "postgres";


ALTER TABLE "public"."platform_accounts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."platform_accounts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."replication_slot_alerts" (
    "id" integer NOT NULL,
    "checked_at" timestamp with time zone DEFAULT "now"(),
    "slot_name" "text",
    "lag_size" "text",
    "status" "text"
);


ALTER TABLE "public"."replication_slot_alerts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."replication_slot_alerts_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."replication_slot_alerts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."replication_slot_alerts_id_seq" OWNED BY "public"."replication_slot_alerts"."id";



CREATE TABLE IF NOT EXISTS "public"."report_requests" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text",
    "text" "text"
);


ALTER TABLE "public"."report_requests" OWNER TO "postgres";


ALTER TABLE "public"."report_requests" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."report_request_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."saved_utm_set_export_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "download_url" "text"
);


ALTER TABLE "public"."saved_utm_set_export_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_anonymous_clients" (
    "hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "uuid" NOT NULL
);


ALTER TABLE "public"."shop_anonymous_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_billing_period_counters" (
    "shop" "text" NOT NULL,
    "billing_period_end" timestamp with time zone NOT NULL,
    "billing_period_start" timestamp with time zone NOT NULL,
    "allowance" integer NOT NULL,
    "last_processed_order_created_at" timestamp with time zone DEFAULT '-infinity'::timestamp with time zone NOT NULL,
    "last_processed_order_id" bigint DEFAULT 0 NOT NULL,
    "seen_orders" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approaching_free_allowance_email_sent_at" timestamp with time zone,
    "used_free_allowance_email_sent_at" timestamp with time zone,
    CONSTRAINT "shop_billing_period_counters_period_valid" CHECK (("billing_period_start" < "billing_period_end"))
);


ALTER TABLE "public"."shop_billing_period_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "public"."SHOP_CLIENT_SOURCE" NOT NULL
);


ALTER TABLE "public"."shop_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "public"."COST_CATEGORY" NOT NULL,
    "source" "public"."COST_SOURCE" DEFAULT 'MANUAL'::"public"."COST_SOURCE" NOT NULL,
    "cost_type" "public"."SHOP_COST_TYPE" NOT NULL,
    "amount" numeric(18,6) NOT NULL,
    "currency_code" "text",
    "recurring_interval" "public"."COST_RECURRING_INTERVAL",
    "effective_from" "date" NOT NULL,
    "effective_to" "date",
    "scope" "public"."SHOP_COST_SCOPE" DEFAULT 'STORE'::"public"."SHOP_COST_SCOPE" NOT NULL,
    "utm_source_match_type" "public"."UTM_SET_COST_MATCH_TYPE" DEFAULT 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE" NOT NULL,
    "utm_source_value" "text",
    "utm_medium_match_type" "public"."UTM_SET_COST_MATCH_TYPE" DEFAULT 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE" NOT NULL,
    "utm_medium_value" "text",
    "utm_campaign_match_type" "public"."UTM_SET_COST_MATCH_TYPE" DEFAULT 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE" NOT NULL,
    "utm_campaign_value" "text",
    "utm_content_match_type" "public"."UTM_SET_COST_MATCH_TYPE" DEFAULT 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE" NOT NULL,
    "utm_content_value" "text",
    "utm_term_match_type" "public"."UTM_SET_COST_MATCH_TYPE" DEFAULT 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE" NOT NULL,
    "utm_term_value" "text",
    "ad_campaign_id" bigint,
    "ad_set_id" bigint,
    "ad_id" bigint,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shop_costs_amount_positive" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "shop_costs_currency_check" CHECK (((("cost_type" = 'PERCENT_AD_SPEND'::"public"."SHOP_COST_TYPE") AND ("currency_code" IS NULL)) OR (("cost_type" <> 'PERCENT_AD_SPEND'::"public"."SHOP_COST_TYPE") AND ("currency_code" IS NOT NULL)))),
    CONSTRAINT "shop_costs_effective_range_check" CHECK ((("effective_to" IS NULL) OR ("effective_to" >= "effective_from"))),
    CONSTRAINT "shop_costs_per_click_scope_check" CHECK ((("cost_type" <> 'PER_CLICK'::"public"."SHOP_COST_TYPE") OR ("scope" = 'UTM'::"public"."SHOP_COST_SCOPE"))),
    CONSTRAINT "shop_costs_recurring_interval_check" CHECK ((("cost_type" = 'RECURRING'::"public"."SHOP_COST_TYPE") = ("recurring_interval" IS NOT NULL))),
    CONSTRAINT "shop_costs_scope_ids_check" CHECK (((("ad_campaign_id" IS NOT NULL) = ("scope" = 'AD_CAMPAIGN'::"public"."SHOP_COST_SCOPE")) AND (("ad_set_id" IS NOT NULL) = ("scope" = 'AD_SET'::"public"."SHOP_COST_SCOPE")) AND (("ad_id" IS NOT NULL) = ("scope" = 'AD'::"public"."SHOP_COST_SCOPE")))),
    CONSTRAINT "shop_costs_scope_utm_check" CHECK ((("scope" = 'UTM'::"public"."SHOP_COST_SCOPE") = (("utm_source_match_type" <> 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE") OR ("utm_source_value" IS NOT NULL) OR ("utm_medium_match_type" <> 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE") OR ("utm_medium_value" IS NOT NULL) OR ("utm_campaign_match_type" <> 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE") OR ("utm_campaign_value" IS NOT NULL) OR ("utm_content_match_type" <> 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE") OR ("utm_content_value" IS NOT NULL) OR ("utm_term_match_type" <> 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE") OR ("utm_term_value" IS NOT NULL))))
);


ALTER TABLE "public"."shop_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_delayed_events_to_process" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop_event_id" "uuid" NOT NULL,
    "status" "public"."DELAYED_EVENT_STATUS" NOT NULL,
    "started_at" timestamp with time zone,
    "attempts" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."shop_delayed_events_to_process" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "event_name" "text" NOT NULL,
    "event_ts" timestamp with time zone NOT NULL,
    "props" "jsonb",
    "session_id" "uuid" NOT NULL,
    "traffic_source_id" "uuid" NOT NULL,
    "current_page" "text",
    "client_id" "uuid",
    "visible_to_capi" boolean DEFAULT false NOT NULL,
    "referer" "text",
    "shopify_id" "text",
    "source" "public"."SHOP_EVENT_SOURCE" DEFAULT 'PIXEL'::"public"."SHOP_EVENT_SOURCE" NOT NULL
);


ALTER TABLE "public"."shop_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_integrations" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "integration_key" "text" NOT NULL,
    "connection_information" "jsonb" NOT NULL,
    "status" "public"."CONNECTED_ACCOUNT_STATUS" DEFAULT 'PENDING'::"public"."CONNECTED_ACCOUNT_STATUS" NOT NULL,
    "last_synced_at" timestamp with time zone
);


ALTER TABLE "public"."shop_integrations" OWNER TO "postgres";


ALTER TABLE "public"."shop_integrations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."shop_integrations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."shop_performance_metrics" (
    "shop" "text" NOT NULL,
    "month" "date" NOT NULL,
    "revenue" numeric DEFAULT 0 NOT NULL,
    "ad_spend" numeric DEFAULT 0 NOT NULL,
    "currency_code" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shop_performance_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "traffic_source_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "landing_page" "text",
    "last_touch" timestamp with time zone,
    "landing_page_id" "uuid",
    "user_agent" "text",
    "ip_address" "text",
    "referer" "text",
    "number_of_add_to_carts" integer DEFAULT 0 NOT NULL,
    "number_of_checkout_starts" integer DEFAULT 0 NOT NULL,
    "channel" "text" DEFAULT ''::"text" NOT NULL
);

ALTER TABLE ONLY "public"."shop_sessions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."shop_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_setup_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "current_installation_shopify_id" "text" NOT NULL,
    "status" "public"."STORE_SETUP_STATUS" NOT NULL,
    "finished_at" timestamp with time zone,
    "error_message" "text",
    "started_at" timestamp with time zone,
    "bulk_operation_shopify_id" "text" NOT NULL
);


ALTER TABLE "public"."shop_setup_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_user_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop_user_id" bigint NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_seconds" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."shop_user_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_users" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text",
    "shopify_id" numeric NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text" NOT NULL,
    "email_verified" boolean NOT NULL,
    "account_owner" boolean NOT NULL,
    "locale" "text" NOT NULL,
    "collaborator" boolean NOT NULL,
    "last_touch" timestamp with time zone
);


ALTER TABLE "public"."shop_users" OWNER TO "postgres";


ALTER TABLE "public"."shop_users" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."shop_users_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."shopify_sessions" (
    "id" character varying(255) NOT NULL,
    "shop" character varying(255) NOT NULL,
    "state" character varying(255) NOT NULL,
    "isOnline" boolean NOT NULL,
    "scope" character varying(1024),
    "expires" integer,
    "accessToken" character varying(255),
    "refreshToken" character varying(255),
    "refreshTokenExpires" bigint,
    "userId" bigint,
    "firstName" character varying(255),
    "lastName" character varying(255),
    "email" character varying(255),
    "accountOwner" boolean,
    "locale" character varying(255),
    "collaborator" boolean,
    "emailVerified" boolean
);


ALTER TABLE "public"."shopify_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shopify_sessions_migrations" (
    "migration_name" character varying(255) NOT NULL
);


ALTER TABLE "public"."shopify_sessions_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shops" (
    "shop" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "lastInstalledAt" timestamp with time zone,
    "scopes" "text",
    "isInstalled" boolean,
    "shopData" "json",
    "initialInstalledAt" timestamp with time zone,
    "trialStartedAt" timestamp with time zone,
    "currently_active_subscription_id" bigint,
    "iana_timezone" "text" NOT NULL,
    "currency_code" "text" NOT NULL,
    "first_order_created_at" timestamp with time zone,
    "settings" "jsonb",
    "access_token" "text",
    "order_count_at_install" numeric,
    "hash_rotate_hour_utc" bigint,
    "origin_pixel_added" timestamp with time zone,
    "disabled" boolean DEFAULT false NOT NULL,
    "current_shop_setup_job_id" "uuid",
    "uninstalled_at" timestamp with time zone,
    "app_install_gclid" "text",
    "app_install_fbclid" "text",
    "has_seen_welcome_screen" boolean DEFAULT false NOT NULL,
    "name" "text",
    "description" "text",
    "plan_public_display_name" "text",
    "shopify_plus" boolean,
    "is_partner_development_plan" boolean,
    "production_host" "text",
    "vertical" "text",
    "app_install_landing_page" "text",
    "app_install_utm_source" "text",
    "app_install_utm_medium" "text",
    "app_install_utm_campaign" "text",
    "app_install_utm_term" "text",
    "app_install_utm_content" "text",
    "app_install_surface_type" "text",
    "app_install_surface_detail" "text",
    "seen_dashboard_with_attributions" timestamp with time zone,
    "dormant_at" timestamp with time zone,
    "cancelled_via_flow_at" timestamp with time zone,
    CONSTRAINT "shops_hash_rotate_hour_utc_check" CHECK (("hash_rotate_hour_utc" <= 23))
);


ALTER TABLE "public"."shops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subscription_id" bigint NOT NULL,
    "shop" "text" NOT NULL,
    "billing_period_start" timestamp with time zone NOT NULL,
    "currency_code" "text" NOT NULL,
    "amount" numeric
);


ALTER TABLE "public"."subscription_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "activated_at" timestamp with time zone,
    "shop" "text" NOT NULL,
    "shopify_id" "text",
    "orders_per_month" numeric,
    "plan_key" "text" NOT NULL,
    "feature_flags" "json",
    "trial_days" integer NOT NULL,
    "status" "text" NOT NULL,
    "price" numeric,
    "current_period_end" timestamp with time zone,
    "cost_per_order_overage" numeric,
    "max_cost_order_overage" numeric,
    "order_overage_subscription_line_item_id" "text",
    "previous_subscription_id" bigint,
    "has_completed_setup" boolean DEFAULT false NOT NULL,
    "deactivated_at" timestamp with time zone
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


ALTER TABLE "public"."subscriptions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."traffic_source_group_utm_sets" (
    "traffic_source_group_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "utm_source" "text" DEFAULT ''::"text" NOT NULL,
    "utm_medium" "text" DEFAULT ''::"text" NOT NULL,
    "utm_campaign" "text" DEFAULT ''::"text" NOT NULL,
    "utm_content" "text" DEFAULT ''::"text" NOT NULL,
    "utm_term" "text" DEFAULT ''::"text" NOT NULL,
    "shop" "text" NOT NULL
);


ALTER TABLE "public"."traffic_source_group_utm_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."traffic_source_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "shop" "text" NOT NULL
);


ALTER TABLE "public"."traffic_source_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."traffic_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "platform_key" "text" DEFAULT ''::"text" NOT NULL,
    "utm_source" "text" DEFAULT ''::"text" NOT NULL,
    "utm_medium" "text" DEFAULT ''::"text" NOT NULL,
    "utm_campaign" "text" DEFAULT ''::"text" NOT NULL,
    "utm_content" "text" DEFAULT ''::"text" NOT NULL,
    "utm_term" "text" DEFAULT ''::"text" NOT NULL,
    "has_nonempty_utm" boolean GENERATED ALWAYS AS ((NOT (("utm_source" = ''::"text") AND ("utm_medium" = ''::"text") AND ("utm_campaign" = ''::"text") AND ("utm_content" = ''::"text") AND ("utm_term" = ''::"text")))) STORED,
    "platform_ad_id" "text" DEFAULT ''::"text" NOT NULL,
    "ad_id" bigint,
    "ad_campaign_id" bigint,
    "platform_campaign_id" "text" DEFAULT ''::"text" NOT NULL,
    "named_source_id" "uuid"
);


ALTER TABLE "public"."traffic_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."utm_notepad_preset_values" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text",
    "utm_parameter" "text" NOT NULL,
    "value" "text" NOT NULL
);


ALTER TABLE "public"."utm_notepad_preset_values" OWNER TO "postgres";


ALTER TABLE "public"."utm_notepad_preset_values" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."utm_notepad_preset_value_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."utm_set_cost_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop" "text" NOT NULL,
    "name" "text" NOT NULL,
    "cost_type" "public"."UTM_SET_COST_TYPE" NOT NULL,
    "cost_amount" numeric(18,6) NOT NULL,
    "currency_code" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "utm_source_match_type" "public"."UTM_SET_COST_MATCH_TYPE" DEFAULT 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE" NOT NULL,
    "utm_source_value" "text",
    "utm_medium_match_type" "public"."UTM_SET_COST_MATCH_TYPE" DEFAULT 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE" NOT NULL,
    "utm_medium_value" "text",
    "utm_campaign_match_type" "public"."UTM_SET_COST_MATCH_TYPE" DEFAULT 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE" NOT NULL,
    "utm_campaign_value" "text",
    "utm_content_match_type" "public"."UTM_SET_COST_MATCH_TYPE" DEFAULT 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE" NOT NULL,
    "utm_content_value" "text",
    "utm_term_match_type" "public"."UTM_SET_COST_MATCH_TYPE" DEFAULT 'WILDCARD'::"public"."UTM_SET_COST_MATCH_TYPE" NOT NULL,
    "utm_term_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."utm_set_cost_rules" REPLICA IDENTITY FULL;


ALTER TABLE "public"."utm_set_cost_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."utm_set_export_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shop" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "download_url" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL
);


ALTER TABLE "public"."utm_set_export_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."utm_sets" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_content" "text",
    "utm_term" "text",
    "shop" "text",
    "domain" "text"
);


ALTER TABLE "public"."utm_sets" OWNER TO "postgres";


ALTER TABLE "public"."utm_sets" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."utm_sets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."v_cnt" (
    "count" bigint
);


ALTER TABLE "public"."v_cnt" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."web_pixels" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "external_id" "text" NOT NULL,
    "platform_account_id" bigint NOT NULL,
    "access_token" "text" NOT NULL,
    "name" "text",
    "status" "public"."WEB_PIXEL_STATUS" DEFAULT 'OK'::"public"."WEB_PIXEL_STATUS" NOT NULL
);


ALTER TABLE "public"."web_pixels" OWNER TO "postgres";


ALTER TABLE "public"."web_pixels" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."web_pixel_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."replication_slot_alerts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."replication_slot_alerts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ad_account_sync_jobs"
    ADD CONSTRAINT "ad_account_sync_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ad_account_sync_jobs"
    ADD CONSTRAINT "ad_account_sync_jobs_shop_platform_key" UNIQUE ("shop_setup_job_id", "connectable_platform_id");



ALTER TABLE ONLY "public"."ad_campaign_external_metrics"
    ADD CONSTRAINT "ad_campaign_external_metrics_pkey" PRIMARY KEY ("shop", "date_in_shop_tz", "ad_campaign_id");



ALTER TABLE ONLY "public"."ad_campaigns"
    ADD CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ad_campaigns"
    ADD CONSTRAINT "ad_campaigns_platform_account_id_external_id_unique" UNIQUE ("platform_account_id", "external_id");



ALTER TABLE ONLY "public"."ad_campaigns_summary"
    ADD CONSTRAINT "ad_campaigns_summary_ad_campaign_id_date_unique" UNIQUE ("ad_campaign_id", "date");



ALTER TABLE ONLY "public"."ad_campaigns_summary"
    ADD CONSTRAINT "ad_campaigns_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ad_external_metrics"
    ADD CONSTRAINT "ad_external_metrics_pkey" PRIMARY KEY ("shop", "date_in_shop_tz", "ad_id");



ALTER TABLE ONLY "public"."ad_set_external_metrics"
    ADD CONSTRAINT "ad_set_external_metrics_pkey" PRIMARY KEY ("shop", "date_in_shop_tz", "ad_set_id");



ALTER TABLE ONLY "public"."ad_sets"
    ADD CONSTRAINT "ad_sets_ad_campaign_id_external_id_unique" UNIQUE ("ad_campaign_id", "external_id");



ALTER TABLE ONLY "public"."ad_sets"
    ADD CONSTRAINT "ad_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ad_sets_summary"
    ADD CONSTRAINT "ad_sets_summary_ad_set_id_date_unique" UNIQUE ("ad_set_id", "date");



ALTER TABLE ONLY "public"."ad_sets_summary"
    ADD CONSTRAINT "ad_sets_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ads"
    ADD CONSTRAINT "ads_ad_set_id_external_id_unique" UNIQUE ("ad_set_id", "external_id");



ALTER TABLE ONLY "public"."ads"
    ADD CONSTRAINT "ads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ads_summary"
    ADD CONSTRAINT "ads_summary_ad_campaign_id_date_key" UNIQUE ("ad_id", "date");



ALTER TABLE ONLY "public"."ads_summary"
    ADD CONSTRAINT "ads_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attributed_orders_export_jobs"
    ADD CONSTRAINT "attributed_orders_export_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bulk_fetch_jobs"
    ADD CONSTRAINT "bulk_fetch_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bulk_fetch_jobs"
    ADD CONSTRAINT "bulk_fetch_jobs_shopifyGraphqlId_key" UNIQUE ("shopifyGraphqlId");



ALTER TABLE ONLY "public"."cancellation_responses"
    ADD CONSTRAINT "cancellation_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."changelog_entries"
    ADD CONSTRAINT "changelog_entry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("token");



ALTER TABLE ONLY "public"."connectable_platforms"
    ADD CONSTRAINT "connectable_platforms_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."connectable_platforms"
    ADD CONSTRAINT "connectable_platforms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connected_platforms"
    ADD CONSTRAINT "connected_platforms_connectable_account_id_shop_key" UNIQUE ("connectable_platform_id", "shop");



ALTER TABLE ONLY "public"."connected_platforms"
    ADD CONSTRAINT "connected_platforms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_events"
    ADD CONSTRAINT "contact_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."currency_conversion_rates"
    ADD CONSTRAINT "currency_conversion_rates_pkey" PRIMARY KEY ("date", "from_currency", "to_currency");



ALTER TABLE ONLY "public"."customer_first_orders"
    ADD CONSTRAINT "customer_first_orders_pkey" PRIMARY KEY ("shop", "customer_shopify_id");



ALTER TABLE ONLY "public"."customer_tag_applications"
    ADD CONSTRAINT "customer_tag_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_tag_rules"
    ADD CONSTRAINT "customer_tag_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_export_jobs"
    ADD CONSTRAINT "data_export_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."early_access_requests"
    ADD CONSTRAINT "early_access_request_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."failed_embed_events"
    ADD CONSTRAINT "failed_embedded_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."failed_events"
    ADD CONSTRAINT "failed_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flag_records"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flag_records"
    ADD CONSTRAINT "feature_flags_subscription_id_name_key" UNIQUE ("subscription_id", "name");



ALTER TABLE ONLY "public"."flow_watermarks"
    ADD CONSTRAINT "flow_watermarks_pkey" PRIMARY KEY ("slot");



ALTER TABLE ONLY "public"."integration_backfill_jobs"
    ADD CONSTRAINT "integration_backfill_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_order_items"
    ADD CONSTRAINT "integration_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_order_items"
    ADD CONSTRAINT "integration_order_items_unique" UNIQUE ("shop", "integration_key", "external_id");



ALTER TABLE ONLY "public"."landing_pages"
    ADD CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."landing_pages"
    ADD CONSTRAINT "landing_pages_shop_normpage_unique" UNIQUE ("shop", "normalized_landing_page");



ALTER TABLE ONLY "public"."landing_pages_summary_daily"
    ADD CONSTRAINT "landing_pages_summary_daily_pkey" PRIMARY KEY ("landing_page_id", "date");



ALTER TABLE ONLY "public"."line_items"
    ADD CONSTRAINT "line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."line_items"
    ADD CONSTRAINT "line_items_shopify_id_key" UNIQUE ("shopify_id");



ALTER TABLE ONLY "public"."mandatory_webhooks"
    ADD CONSTRAINT "mandatory_webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."named_sources"
    ADD CONSTRAINT "named_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."named_sources"
    ADD CONSTRAINT "named_sources_shop_kind_key_key" UNIQUE ("shop", "kind", "key");



ALTER TABLE ONLY "public"."order_attribution_jobs"
    ADD CONSTRAINT "order_attribution_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_attribution_jobs"
    ADD CONSTRAINT "order_attribution_jobs_shop_setup_job_id_key" UNIQUE ("shop_setup_job_id");



ALTER TABLE ONLY "public"."order_attributions"
    ADD CONSTRAINT "order_attributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_batch_download_jobs"
    ADD CONSTRAINT "order_batch_download_job_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_costs"
    ADD CONSTRAINT "order_costs_order_category_source_key" UNIQUE ("order_id", "category", "source");



ALTER TABLE ONLY "public"."order_costs"
    ADD CONSTRAINT "order_costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_download_jobs"
    ADD CONSTRAINT "order_download_job_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_download_jobs"
    ADD CONSTRAINT "order_download_jobs_shop_setup_job_id_key" UNIQUE ("shop_setup_job_id");



ALTER TABLE ONLY "public"."order_export_jobs"
    ADD CONSTRAINT "order_export_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_overage_records"
    ADD CONSTRAINT "order_overage_records_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_overage_records"
    ADD CONSTRAINT "order_overage_shop_orderid_uniq" UNIQUE ("shop", "order_id");



ALTER TABLE ONLY "public"."order_overage_records"
    ADD CONSTRAINT "order_overage_shop_shopifyorderid_uniq" UNIQUE ("shop", "shopify_order_id");



ALTER TABLE ONLY "public"."order_totals_daily"
    ADD CONSTRAINT "order_totals_daily_pkey" PRIMARY KEY ("shop", "day");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orphan_ad_account_sync_jobs"
    ADD CONSTRAINT "orphan_ad_account_sync_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orphan_plan_modify_jobs"
    ADD CONSTRAINT "orphan_plan_modify_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_change_jobs"
    ADD CONSTRAINT "plan_change_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_modify_jobs"
    ADD CONSTRAINT "plan_modfy_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_modify_jobs"
    ADD CONSTRAINT "plan_modfy_jobs_shop_setup_job_id_key" UNIQUE ("shop_setup_job_id");



ALTER TABLE ONLY "public"."plan_visibility_change_job_batches"
    ADD CONSTRAINT "plan_visibility_change_job_batches_pkey" PRIMARY KEY ("job_id", "batch_index");



ALTER TABLE ONLY "public"."plan_visibility_change_job_orders"
    ADD CONSTRAINT "plan_visibility_change_job_orders_pkey" PRIMARY KEY ("job_id", "order_id");



ALTER TABLE ONLY "public"."plan_visibility_change_jobs"
    ADD CONSTRAINT "plan_visibility_change_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_accounts"
    ADD CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_accounts"
    ADD CONSTRAINT "platform_accounts_platform_id_external_id_unique" UNIQUE ("platform_id", "external_id");



ALTER TABLE ONLY "public"."replication_slot_alerts"
    ADD CONSTRAINT "replication_slot_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_requests"
    ADD CONSTRAINT "report_request_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_utm_set_export_jobs"
    ADD CONSTRAINT "saved_utm_set_export_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_anonymous_clients"
    ADD CONSTRAINT "shop_anonymous_clients_pkey" PRIMARY KEY ("hash", "client_id");



ALTER TABLE ONLY "public"."shop_billing_period_counters"
    ADD CONSTRAINT "shop_billing_period_counters_pk" PRIMARY KEY ("shop", "billing_period_end");



ALTER TABLE ONLY "public"."shop_clients"
    ADD CONSTRAINT "shop_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_costs"
    ADD CONSTRAINT "shop_costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_delayed_events_to_process"
    ADD CONSTRAINT "shop_delayed_events_to_process_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_delayed_events_to_process"
    ADD CONSTRAINT "shop_delayed_events_to_process_shop_event_id_key" UNIQUE ("shop_event_id");



ALTER TABLE ONLY "public"."shop_events"
    ADD CONSTRAINT "shop_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_events"
    ADD CONSTRAINT "shop_events_shopify_id_key" UNIQUE ("shopify_id");



ALTER TABLE ONLY "public"."shop_integrations"
    ADD CONSTRAINT "shop_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_integrations"
    ADD CONSTRAINT "shop_integrations_shop_key_key" UNIQUE ("shop", "integration_key");



ALTER TABLE ONLY "public"."shop_performance_metrics"
    ADD CONSTRAINT "shop_performance_metrics_pkey" PRIMARY KEY ("shop", "month");



ALTER TABLE ONLY "public"."shop_sessions"
    ADD CONSTRAINT "shop_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_setup_jobs"
    ADD CONSTRAINT "shop_setup_jobs_bulk_operation_shopify_id_key" UNIQUE ("bulk_operation_shopify_id");



ALTER TABLE ONLY "public"."shop_user_sessions"
    ADD CONSTRAINT "shop_user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_users"
    ADD CONSTRAINT "shop_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_users"
    ADD CONSTRAINT "shop_users_shop_shopify_id_key" UNIQUE ("shop", "shopify_id");



ALTER TABLE ONLY "public"."shopify_sessions_migrations"
    ADD CONSTRAINT "shopify_sessions_migrations_pkey" PRIMARY KEY ("migration_name");



ALTER TABLE ONLY "public"."shopify_sessions"
    ADD CONSTRAINT "shopify_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_pkey" PRIMARY KEY ("shop");



ALTER TABLE ONLY "public"."shop_setup_jobs"
    ADD CONSTRAINT "store_setup_job_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_subscription_id_billing_period_start_key" UNIQUE ("subscription_id", "billing_period_start");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_shopify_id_key" UNIQUE ("shopify_id");



ALTER TABLE ONLY "public"."traffic_source_group_utm_sets"
    ADD CONSTRAINT "traffic_source_group_utm_sets_pkey" PRIMARY KEY ("traffic_source_group_id", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term");



ALTER TABLE ONLY "public"."traffic_source_groups"
    ADD CONSTRAINT "traffic_source_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."traffic_sources"
    ADD CONSTRAINT "traffic_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."traffic_sources"
    ADD CONSTRAINT "traffic_sources_unique_params" UNIQUE ("shop", "platform_key", "platform_ad_id", "platform_campaign_id", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term");



ALTER TABLE ONLY "public"."utm_notepad_preset_values"
    ADD CONSTRAINT "utm_notepad_preset_value_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."utm_set_cost_rules"
    ADD CONSTRAINT "utm_set_cost_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."utm_set_export_jobs"
    ADD CONSTRAINT "utm_set_export_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."utm_sets"
    ADD CONSTRAINT "utm_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."web_pixels"
    ADD CONSTRAINT "web_pixel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."web_pixels"
    ADD CONSTRAINT "web_pixels_external_id_platform_account_id_unique" UNIQUE ("external_id", "platform_account_id");



CREATE INDEX "connected_platforms_connectable_account_id_shop_connection__idx" ON "public"."connected_platforms" USING "btree" ("connectable_platform_id", "shop") INCLUDE ("connection_information");



CREATE UNIQUE INDEX "contact_events_shop_email_type_key" ON "public"."contact_events" USING "btree" ("shop", "email_type");



CREATE INDEX "data_export_jobs_shop_created_at_idx" ON "public"."data_export_jobs" USING "btree" ("shop", "created_at" DESC);



CREATE INDEX "data_export_jobs_type_status_idx" ON "public"."data_export_jobs" USING "btree" ("type", "status");



CREATE INDEX "idx_ad_campaigns_platform_created" ON "public"."ad_campaigns" USING "btree" ("platform_account_id", "campaign_created_at") INCLUDE ("external_id", "name", "status");



CREATE INDEX "idx_ad_campaigns_summary_campaign_date" ON "public"."ad_campaigns_summary" USING "btree" ("ad_campaign_id", "date");



CREATE INDEX "idx_ad_campaigns_summary_date_expanded" ON "public"."ad_campaigns_summary" USING "btree" ("date", "ad_campaign_id") INCLUDE ("revenue", "spend", "clicks", "impressions", "orders");



CREATE INDEX "idx_ad_campaigns_summary_revenue" ON "public"."ad_campaigns_summary" USING "btree" ("ad_campaign_id", "revenue") INCLUDE ("spend", "clicks", "impressions", "orders");



CREATE INDEX "idx_ad_sets_campaign_id" ON "public"."ad_sets" USING "btree" ("ad_campaign_id") INCLUDE ("id");



CREATE INDEX "idx_ad_sets_summary_campaign_date" ON "public"."ad_sets_summary" USING "btree" ("ad_set_id", "date");



CREATE INDEX "idx_ads_ad_set_id" ON "public"."ads" USING "btree" ("ad_set_id") INCLUDE ("external_id", "name");



CREATE INDEX "idx_ads_external_id" ON "public"."ads" USING "btree" ("external_id");



CREATE INDEX "idx_ads_internal_id" ON "public"."ads" USING "btree" ("internal_id") INCLUDE ("id", "ad_set_id");



CREATE INDEX "idx_ads_summary_campaign_date" ON "public"."ads_summary" USING "btree" ("ad_id", "date");



CREATE INDEX "idx_ads_summary_metrics" ON "public"."ads_summary" USING "btree" ("ad_id", "date") INCLUDE ("revenue", "spend", "clicks", "impressions", "orders");



CREATE INDEX "idx_attributed_orders_export_jobs_shop" ON "public"."attributed_orders_export_jobs" USING "btree" ("shop");



CREATE INDEX "idx_bulk_fetch_jobs_shop" ON "public"."bulk_fetch_jobs" USING "btree" ("shop");



CREATE INDEX "idx_cancellation_responses_shop" ON "public"."cancellation_responses" USING "btree" ("shop");



CREATE INDEX "idx_changelog_entries_date_desc_show_in_app_true" ON "public"."changelog_entries" USING "btree" ("date" DESC) WHERE ("show_in_app" IS TRUE);



CREATE INDEX "idx_checkout_sessions_shop" ON "public"."checkout_sessions" USING "btree" ("shop");



CREATE INDEX "idx_connected_platforms_shop" ON "public"."connected_platforms" USING "btree" ("shop");



CREATE INDEX "idx_connected_platforms_shop_id" ON "public"."connected_platforms" USING "btree" ("shop", "id");



CREATE INDEX "idx_connected_platforms_shop_lookup" ON "public"."connected_platforms" USING "btree" ("shop", "connectable_platform_id");



CREATE INDEX "idx_delayed_events_status_created_attempts" ON "public"."shop_delayed_events_to_process" USING "btree" ("status", "created_at", "attempts");



CREATE INDEX "idx_early_access_requests_shop" ON "public"."early_access_requests" USING "btree" ("shop");



CREATE INDEX "idx_failed_embedded_events_shop_created" ON "public"."failed_embed_events" USING "btree" ("shop", "created_at" DESC);



CREATE INDEX "idx_failed_embedded_events_unprocessed" ON "public"."failed_embed_events" USING "btree" ("created_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "idx_integration_backfill_jobs_shop_created_at" ON "public"."integration_backfill_jobs" USING "btree" ("shop", "created_at" DESC);



CREATE INDEX "idx_integration_order_items_order_id" ON "public"."integration_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_integration_order_items_unmatched" ON "public"."integration_order_items" USING "btree" ("shop", "integration_key") WHERE ("order_id" IS NULL);



CREATE INDEX "idx_landing_pages_shop" ON "public"."landing_pages" USING "btree" ("shop");



CREATE INDEX "idx_landing_pages_summary_daily_landing_page_id" ON "public"."landing_pages_summary_daily" USING "btree" ("landing_page_id");



CREATE INDEX "idx_oa_order_id" ON "public"."order_attributions" USING "btree" ("order_id");



CREATE INDEX "idx_oa_order_source_rank" ON "public"."order_attributions" USING "btree" ("order_id", "traffic_source_id", "touch_rank" DESC);



CREATE INDEX "idx_oa_order_touch_asc" ON "public"."order_attributions" USING "btree" ("order_id", "touch_rank") INCLUDE ("traffic_source_id");



CREATE INDEX "idx_oa_order_touch_desc" ON "public"."order_attributions" USING "btree" ("order_id", "touch_rank" DESC) INCLUDE ("traffic_source_id");



CREATE INDEX "idx_oa_order_touch_ts" ON "public"."order_attributions" USING "btree" ("order_id", "touch_ts");



CREATE INDEX "idx_oa_session_id" ON "public"."order_attributions" USING "btree" ("session_id");



CREATE INDEX "idx_oa_session_id_data_source" ON "public"."order_attributions" USING "btree" ("session_id", "data_source");



CREATE INDEX "idx_order_attr_by_source" ON "public"."order_attributions" USING "btree" ("traffic_source_id") INCLUDE ("order_id", "landing_page_id");



CREATE INDEX "idx_order_attributions_landing_page_id" ON "public"."order_attributions" USING "btree" ("landing_page_id");



CREATE INDEX "idx_order_costs_order_id" ON "public"."order_costs" USING "btree" ("order_id");



CREATE INDEX "idx_order_costs_shop_order_created_at" ON "public"."order_costs" USING "btree" ("shop", "order_created_at");



CREATE INDEX "idx_order_export_jobs_shop" ON "public"."order_export_jobs" USING "btree" ("shop");



CREATE INDEX "idx_orders_shop_checkout_token" ON "public"."orders" USING "btree" ("shop", "checkout_token");



CREATE INDEX "idx_orders_shop_converting_session_id" ON "public"."orders" USING "btree" ("shop", "converting_session_id") WHERE ("converting_session_id" IS NOT NULL);



CREATE INDEX "idx_orders_shop_customer_created_at" ON "public"."orders" USING "btree" ("shop", "customer_shopify_id", "order_created_at");



CREATE INDEX "idx_orders_shop_customer_id" ON "public"."orders" USING "btree" ("shop", "customer_shopify_id");



CREATE INDEX "idx_orders_shop_id_null_conv" ON "public"."orders" USING "btree" ("shop", "id") WHERE ("converting_session_id" IS NULL);



CREATE INDEX "idx_orders_shop_name_is_visible" ON "public"."orders" USING "btree" ("shop", "name", "is_visible");



CREATE INDEX "idx_orders_shop_order_created_at_is_visible" ON "public"."orders" USING "btree" ("shop", "order_created_at", "is_visible");



CREATE INDEX "idx_platform_accounts_connected" ON "public"."platform_accounts" USING "btree" ("platform_id") INCLUDE ("external_id", "name", "currency_code");



CREATE INDEX "idx_report_requests_shop" ON "public"."report_requests" USING "btree" ("shop");



CREATE INDEX "idx_saved_utm_set_export_jobs_shop" ON "public"."saved_utm_set_export_jobs" USING "btree" ("shop");



CREATE INDEX "idx_sessions_shop_src_time_incl" ON "public"."shop_sessions" USING "btree" ("shop", "traffic_source_id", "started_at") INCLUDE ("client_id", "landing_page_id");



CREATE INDEX "idx_shop_costs_shop" ON "public"."shop_costs" USING "btree" ("shop");



CREATE INDEX "idx_shop_events_session_id" ON "public"."shop_events" USING "btree" ("session_id");



CREATE INDEX "idx_shop_events_shop_checkout_token" ON "public"."shop_events" USING "btree" ("shop", (("props" ->> 'checkout_token'::"text")));



CREATE INDEX "idx_shop_events_shop_checkout_token_partial" ON "public"."shop_events" USING "btree" ("shop", (("props" ->> 'checkout_token'::"text"))) WHERE ("props" ? 'checkout_token'::"text");



CREATE INDEX "idx_shop_events_shop_client_ts" ON "public"."shop_events" USING "btree" ("shop", "client_id", "event_ts" DESC);



CREATE INDEX "idx_shop_events_shop_event_ts_desc" ON "public"."shop_events" USING "btree" ("shop", "event_ts" DESC);



CREATE INDEX "idx_shop_events_traffic_source_id" ON "public"."shop_events" USING "btree" ("traffic_source_id");



CREATE INDEX "idx_shop_integrations_shop" ON "public"."shop_integrations" USING "btree" ("shop");



CREATE INDEX "idx_shop_sessions_landing_page_started" ON "public"."shop_sessions" USING "btree" ("landing_page_id", "started_at");



CREATE INDEX "idx_shop_sessions_shop" ON "public"."shop_sessions" USING "btree" ("shop");



CREATE INDEX "idx_shop_sessions_shop_client_started_at_desc" ON "public"."shop_sessions" USING "btree" ("shop", "client_id", "started_at" DESC);



CREATE INDEX "idx_shop_sessions_shop_started_at" ON "public"."shop_sessions" USING "btree" ("shop", "started_at");



CREATE INDEX "idx_shop_sessions_traffic_source_id" ON "public"."shop_sessions" USING "btree" ("traffic_source_id");



CREATE INDEX "idx_shop_users_shop" ON "public"."shop_users" USING "btree" ("shop");



CREATE INDEX "idx_subscription_payments_subscription_id" ON "public"."subscription_payments" USING "btree" ("subscription_id");



CREATE INDEX "idx_subscriptions" ON "public"."subscriptions" USING "btree" ("id", "status", "orders_per_month", "plan_key", "shopify_id", "activated_at");



CREATE INDEX "idx_subscriptions_shop" ON "public"."subscriptions" USING "btree" ("shop");



CREATE INDEX "idx_traffic_sources_ad_id" ON "public"."traffic_sources" USING "btree" ("ad_id");



CREATE INDEX "idx_traffic_sources_platform_ad" ON "public"."traffic_sources" USING "btree" ("platform_ad_id") INCLUDE ("id", "shop", "platform_key");



CREATE INDEX "idx_traffic_sources_shop" ON "public"."traffic_sources" USING "btree" ("shop");



CREATE INDEX "idx_traffic_sources_shop_utm_params" ON "public"."traffic_sources" USING "btree" ("shop", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term") INCLUDE ("id");



CREATE INDEX "idx_ts_shop_has_nonempty" ON "public"."traffic_sources" USING "btree" ("shop") WHERE "has_nonempty_utm";



CREATE INDEX "idx_ts_shop_utm_campaign" ON "public"."traffic_sources" USING "btree" ("shop", "utm_campaign") WHERE "has_nonempty_utm";



CREATE INDEX "idx_ts_shop_utm_content" ON "public"."traffic_sources" USING "btree" ("shop", "utm_content") WHERE "has_nonempty_utm";



CREATE INDEX "idx_ts_shop_utm_medium" ON "public"."traffic_sources" USING "btree" ("shop", "utm_medium") WHERE "has_nonempty_utm";



CREATE INDEX "idx_ts_shop_utm_source" ON "public"."traffic_sources" USING "btree" ("shop", "utm_source") WHERE "has_nonempty_utm";



CREATE INDEX "idx_ts_shop_utm_term" ON "public"."traffic_sources" USING "btree" ("shop", "utm_term") WHERE "has_nonempty_utm";



CREATE INDEX "idx_tsgul_utm_set" ON "public"."traffic_source_group_utm_sets" USING "btree" ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term") INCLUDE ("traffic_source_group_id");



CREATE INDEX "idx_utm_cost_rules_shop" ON "public"."utm_set_cost_rules" USING "btree" ("shop");



CREATE INDEX "idx_utm_set_export_jobs_shop" ON "public"."utm_set_export_jobs" USING "btree" ("shop");



CREATE INDEX "idx_utm_sets_shop" ON "public"."utm_sets" USING "btree" ("shop");



CREATE UNIQUE INDEX "order_attributions_order_source_rank_uniq" ON "public"."order_attributions" USING "btree" ("order_id", "traffic_source_id", "touch_rank");



CREATE INDEX "order_overage_shop_period_status_created_idx" ON "public"."order_overage_records" USING "btree" ("shop", "billing_period_end", "status", "order_created_at", "order_id");



CREATE INDEX "order_overage_work_partial_idx" ON "public"."order_overage_records" USING "btree" ("shop", "billing_period_end", "order_created_at", "order_id") WHERE ("status" = ANY (ARRAY['READY'::"public"."ORDER_OVERAGE_STATUS", 'FAILED'::"public"."ORDER_OVERAGE_STATUS"]));



CREATE UNIQUE INDEX "orders_order_id" ON "public"."orders" USING "btree" ("order_id");



CREATE INDEX "orders_processed_by_webhook_false_idx" ON "public"."orders" USING "btree" ("shop", "order_created_at") WHERE ("processed_by_webhook" = false);



CREATE INDEX "plan_visibility_change_job_orders_batch_idx" ON "public"."plan_visibility_change_job_orders" USING "btree" ("job_id", "batch_index");



CREATE INDEX "plan_visibility_change_jobs_shop_status_idx" ON "public"."plan_visibility_change_jobs" USING "btree" ("shop", "status");



CREATE INDEX "shop_events_session_event_ts_idx" ON "public"."shop_events" USING "btree" ("session_id", "event_name", "event_ts" DESC);



CREATE INDEX "shop_sessions_client_id" ON "public"."shop_sessions" USING "btree" ("client_id");



CREATE INDEX "shop_sessions_landing_page_idx" ON "public"."shop_sessions" USING "btree" ("landing_page_id");



CREATE UNIQUE INDEX "shop_sessions_unique_session_key" ON "public"."shop_sessions" USING "btree" ("shop", "client_id", "traffic_source_id", "landing_page", "started_at");



CREATE INDEX "shop_user_sessions_shop_user_id_last_seen_at_idx" ON "public"."shop_user_sessions" USING "btree" ("shop_user_id", "last_seen_at" DESC);



CREATE UNIQUE INDEX "traffic_source_groups_shop_name_lower_idx" ON "public"."traffic_source_groups" USING "btree" ("shop", "lower"("name"));



CREATE INDEX "traffic_sources_shop_ad_campaign_id_idx" ON "public"."traffic_sources" USING "btree" ("shop", "ad_campaign_id");



CREATE INDEX "traffic_sources_shop_named_source_id_idx" ON "public"."traffic_sources" USING "btree" ("shop", "named_source_id");



CREATE OR REPLACE TRIGGER "trg_order_overage_updated_at" BEFORE UPDATE ON "public"."order_overage_records" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rollup_ad_external_metrics" AFTER INSERT ON "public"."ad_external_metrics" REFERENCING NEW TABLE AS "inserted_rows" FOR EACH STATEMENT EXECUTE FUNCTION "public"."rollup_ad_external_metrics"();



CREATE OR REPLACE TRIGGER "trg_rollup_ad_external_metrics_update" AFTER UPDATE ON "public"."ad_external_metrics" REFERENCING OLD TABLE AS "old_rows" NEW TABLE AS "new_rows" FOR EACH STATEMENT EXECUTE FUNCTION "public"."rollup_ad_external_metrics_update"();



CREATE OR REPLACE TRIGGER "trg_shop_counters_updated_at" BEFORE UPDATE ON "public"."shop_billing_period_counters" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



ALTER TABLE ONLY "public"."ad_account_sync_jobs"
    ADD CONSTRAINT "ad_account_sync_jobs_connectable_platform_id_fkey" FOREIGN KEY ("connectable_platform_id") REFERENCES "public"."connectable_platforms"("id");



ALTER TABLE ONLY "public"."ad_account_sync_jobs"
    ADD CONSTRAINT "ad_account_sync_jobs_shop_setup_job_id_fkey" FOREIGN KEY ("shop_setup_job_id") REFERENCES "public"."shop_setup_jobs"("id");



ALTER TABLE ONLY "public"."ad_campaign_external_metrics"
    ADD CONSTRAINT "ad_campaign_external_metrics_ad_campaign_id_fkey" FOREIGN KEY ("ad_campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ad_campaign_external_metrics"
    ADD CONSTRAINT "ad_campaign_external_metrics_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."ad_campaigns"
    ADD CONSTRAINT "ad_campaigns_platform_account_id_fkey" FOREIGN KEY ("platform_account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ad_campaigns_summary"
    ADD CONSTRAINT "ad_campaigns_summary_ad_campaign_id_fkey" FOREIGN KEY ("ad_campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ad_external_metrics"
    ADD CONSTRAINT "ad_external_metrics_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ad_external_metrics"
    ADD CONSTRAINT "ad_external_metrics_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."ad_set_external_metrics"
    ADD CONSTRAINT "ad_set_external_metrics_ad_set_id_fkey" FOREIGN KEY ("ad_set_id") REFERENCES "public"."ad_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ad_set_external_metrics"
    ADD CONSTRAINT "ad_set_external_metrics_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."ad_sets"
    ADD CONSTRAINT "ad_sets_ad_campaign_id_fkey" FOREIGN KEY ("ad_campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ad_sets"
    ADD CONSTRAINT "ad_sets_platform_fkey" FOREIGN KEY ("platform") REFERENCES "public"."connectable_platforms"("key") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ad_campaigns"
    ADD CONSTRAINT "ad_sets_platform_fkey" FOREIGN KEY ("platform") REFERENCES "public"."connectable_platforms"("key") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ad_sets_summary"
    ADD CONSTRAINT "ad_sets_summary_ad_set_id_fkey" FOREIGN KEY ("ad_set_id") REFERENCES "public"."ad_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ads"
    ADD CONSTRAINT "ads_ad_set_id_fkey" FOREIGN KEY ("ad_set_id") REFERENCES "public"."ad_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ads"
    ADD CONSTRAINT "ads_platform_fkey" FOREIGN KEY ("platform") REFERENCES "public"."connectable_platforms"("key") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ads_summary"
    ADD CONSTRAINT "ads_summary_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attributed_orders_export_jobs"
    ADD CONSTRAINT "attributed_orders_export_jobs_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cancellation_responses"
    ADD CONSTRAINT "cancellation_responses_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connected_platforms"
    ADD CONSTRAINT "connected_platforms_connectable_platform_id_fkey" FOREIGN KEY ("connectable_platform_id") REFERENCES "public"."connectable_platforms"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connected_platforms"
    ADD CONSTRAINT "connected_platforms_shop_fkey1" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_tag_applications"
    ADD CONSTRAINT "customer_tag_applications_customer_tag_rule_id_fkey" FOREIGN KEY ("customer_tag_rule_id") REFERENCES "public"."customer_tag_rules"("id");



ALTER TABLE ONLY "public"."customer_tag_applications"
    ADD CONSTRAINT "customer_tag_applications_order_attribution_id_fkey" FOREIGN KEY ("order_attribution_id") REFERENCES "public"."order_attributions"("id");



ALTER TABLE ONLY "public"."customer_tag_applications"
    ADD CONSTRAINT "customer_tag_applications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."customer_tag_applications"
    ADD CONSTRAINT "customer_tag_applications_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."customer_tag_rules"
    ADD CONSTRAINT "customer_tag_rules_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id");



ALTER TABLE ONLY "public"."customer_tag_rules"
    ADD CONSTRAINT "customer_tag_rules_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."data_export_jobs"
    ADD CONSTRAINT "data_export_jobs_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."early_access_requests"
    ADD CONSTRAINT "early_access_request_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."failed_embed_events"
    ADD CONSTRAINT "failed_embedded_events_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."failed_events"
    ADD CONSTRAINT "failed_events_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."feature_flag_records"
    ADD CONSTRAINT "feature_flags_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id");



ALTER TABLE ONLY "public"."integration_backfill_jobs"
    ADD CONSTRAINT "integration_backfill_jobs_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_backfill_jobs"
    ADD CONSTRAINT "integration_backfill_jobs_shop_integration_id_fkey" FOREIGN KEY ("shop_integration_id") REFERENCES "public"."shop_integrations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."integration_order_items"
    ADD CONSTRAINT "integration_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_order_items"
    ADD CONSTRAINT "integration_order_items_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."landing_pages"
    ADD CONSTRAINT "landing_pages_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."landing_pages_summary_daily"
    ADD CONSTRAINT "landing_pages_summary_daily_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "public"."landing_pages"("id");



ALTER TABLE ONLY "public"."line_items"
    ADD CONSTRAINT "line_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."named_sources"
    ADD CONSTRAINT "named_sources_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."order_attribution_jobs"
    ADD CONSTRAINT "order_attribution_jobs_shop_setup_job_id_fkey" FOREIGN KEY ("shop_setup_job_id") REFERENCES "public"."shop_setup_jobs"("id");



ALTER TABLE ONLY "public"."order_attributions"
    ADD CONSTRAINT "order_attributions_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "public"."landing_pages"("id");



ALTER TABLE ONLY "public"."order_attributions"
    ADD CONSTRAINT "order_attributions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_attributions"
    ADD CONSTRAINT "order_attributions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."shop_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_attributions"
    ADD CONSTRAINT "order_attributions_traffic_source_id_fkey" FOREIGN KEY ("traffic_source_id") REFERENCES "public"."traffic_sources"("id");



ALTER TABLE ONLY "public"."order_batch_download_jobs"
    ADD CONSTRAINT "order_batch_download_job_order_download_job_id_fkey" FOREIGN KEY ("order_download_job_id") REFERENCES "public"."order_download_jobs"("id");



ALTER TABLE ONLY "public"."order_costs"
    ADD CONSTRAINT "order_costs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_costs"
    ADD CONSTRAINT "order_costs_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_download_jobs"
    ADD CONSTRAINT "order_download_jobs_shop_setup_job_id_fkey" FOREIGN KEY ("shop_setup_job_id") REFERENCES "public"."shop_setup_jobs"("id");



ALTER TABLE ONLY "public"."order_export_jobs"
    ADD CONSTRAINT "order_export_jobs_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_overage_records"
    ADD CONSTRAINT "order_overage_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."order_overage_records"
    ADD CONSTRAINT "order_overage_records_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."order_totals_daily"
    ADD CONSTRAINT "order_totals_daily_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_converting_session_id_fkey" FOREIGN KEY ("converting_session_id") REFERENCES "public"."shop_sessions"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."orphan_ad_account_sync_jobs"
    ADD CONSTRAINT "orphan_ad_account_sync_jobs_connectable_platform_id_fkey" FOREIGN KEY ("connectable_platform_id") REFERENCES "public"."connectable_platforms"("id");



ALTER TABLE ONLY "public"."orphan_ad_account_sync_jobs"
    ADD CONSTRAINT "orphan_ad_account_sync_jobs_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."orphan_plan_modify_jobs"
    ADD CONSTRAINT "orphan_plan_modify_jobs_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."plan_change_jobs"
    ADD CONSTRAINT "plan_change_jobs_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."plan_modify_jobs"
    ADD CONSTRAINT "plan_modfy_jobs_shop_setup_job_id_fkey" FOREIGN KEY ("shop_setup_job_id") REFERENCES "public"."shop_setup_jobs"("id");



ALTER TABLE ONLY "public"."plan_visibility_change_job_batches"
    ADD CONSTRAINT "plan_visibility_change_job_batches_job_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."plan_visibility_change_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_visibility_change_job_orders"
    ADD CONSTRAINT "plan_visibility_change_job_orders_job_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."plan_visibility_change_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_accounts"
    ADD CONSTRAINT "platform_accounts_parent_platform_account_id_fkey" FOREIGN KEY ("parent_platform_account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_accounts"
    ADD CONSTRAINT "platform_accounts_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."connected_platforms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bulk_fetch_jobs"
    ADD CONSTRAINT "public_bulk_fetch_jobs_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_requests"
    ADD CONSTRAINT "report_request_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_utm_set_export_jobs"
    ADD CONSTRAINT "saved_utm_set_export_jobs_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_anonymous_clients"
    ADD CONSTRAINT "shop_anonymous_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."shop_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_costs"
    ADD CONSTRAINT "shop_costs_ad_campaign_id_fkey" FOREIGN KEY ("ad_campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_costs"
    ADD CONSTRAINT "shop_costs_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_costs"
    ADD CONSTRAINT "shop_costs_ad_set_id_fkey" FOREIGN KEY ("ad_set_id") REFERENCES "public"."ad_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_costs"
    ADD CONSTRAINT "shop_costs_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_delayed_events_to_process"
    ADD CONSTRAINT "shop_delayed_events_to_process_shop_event_id_fkey" FOREIGN KEY ("shop_event_id") REFERENCES "public"."shop_events"("id");



ALTER TABLE ONLY "public"."shop_events"
    ADD CONSTRAINT "shop_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."shop_sessions"("id");



ALTER TABLE ONLY "public"."shop_events"
    ADD CONSTRAINT "shop_events_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."shop_events"
    ADD CONSTRAINT "shop_events_traffic_source_id_fkey" FOREIGN KEY ("traffic_source_id") REFERENCES "public"."traffic_sources"("id");



ALTER TABLE ONLY "public"."shop_integrations"
    ADD CONSTRAINT "shop_integrations_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_performance_metrics"
    ADD CONSTRAINT "shop_performance_metrics_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."shop_sessions"
    ADD CONSTRAINT "shop_sessions_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "public"."landing_pages"("id");



ALTER TABLE ONLY "public"."shop_sessions"
    ADD CONSTRAINT "shop_sessions_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_sessions"
    ADD CONSTRAINT "shop_sessions_traffic_source_id_fkey" FOREIGN KEY ("traffic_source_id") REFERENCES "public"."traffic_sources"("id");



ALTER TABLE ONLY "public"."shop_user_sessions"
    ADD CONSTRAINT "shop_user_sessions_shop_user_id_fkey" FOREIGN KEY ("shop_user_id") REFERENCES "public"."shop_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_users"
    ADD CONSTRAINT "shop_users_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_current_shop_setup_job_id_fkey" FOREIGN KEY ("current_shop_setup_job_id") REFERENCES "public"."shop_setup_jobs"("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_currently_active_subscription_id_fkey" FOREIGN KEY ("currently_active_subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shop_setup_jobs"
    ADD CONSTRAINT "store_setup_job_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_previous_subscription_id_fkey" FOREIGN KEY ("previous_subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."traffic_source_group_utm_sets"
    ADD CONSTRAINT "traffic_source_group_utm_sets_group_fkey" FOREIGN KEY ("traffic_source_group_id") REFERENCES "public"."traffic_source_groups"("id");



ALTER TABLE ONLY "public"."traffic_source_group_utm_sets"
    ADD CONSTRAINT "traffic_source_group_utm_sets_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."traffic_source_groups"
    ADD CONSTRAINT "traffic_source_groups_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."traffic_sources"
    ADD CONSTRAINT "traffic_sources_ad_campaign_id_fkey" FOREIGN KEY ("ad_campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."traffic_sources"
    ADD CONSTRAINT "traffic_sources_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."traffic_sources"
    ADD CONSTRAINT "traffic_sources_named_source_id_fkey" FOREIGN KEY ("named_source_id") REFERENCES "public"."named_sources"("id");



ALTER TABLE ONLY "public"."traffic_sources"
    ADD CONSTRAINT "traffic_sources_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."utm_notepad_preset_values"
    ADD CONSTRAINT "utm_notepad_preset_value_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."utm_set_cost_rules"
    ADD CONSTRAINT "utm_set_cost_rules_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop");



ALTER TABLE ONLY "public"."utm_set_export_jobs"
    ADD CONSTRAINT "utm_set_export_jobs_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."utm_sets"
    ADD CONSTRAINT "utm_sets_shop_fkey" FOREIGN KEY ("shop") REFERENCES "public"."shops"("shop") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."web_pixels"
    ADD CONSTRAINT "web_pixel_platform_account_id_fkey" FOREIGN KEY ("platform_account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE CASCADE;



CREATE PUBLICATION "flow_publication" WITH (publish = 'insert, update, delete, truncate', publish_via_partition_root = true);


ALTER PUBLICATION "flow_publication" OWNER TO "postgres";


CREATE PUBLICATION "sequin_pub" WITH (publish = 'insert, update, delete, truncate', publish_via_partition_root = true);


ALTER PUBLICATION "sequin_pub" OWNER TO "postgres";




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."ad_campaign_external_metrics";



ALTER PUBLICATION "sequin_pub" ADD TABLE ONLY "public"."ad_campaigns";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."ad_campaigns";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."ad_external_metrics";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."ad_set_external_metrics";



ALTER PUBLICATION "sequin_pub" ADD TABLE ONLY "public"."ad_sets";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."ad_sets";



ALTER PUBLICATION "sequin_pub" ADD TABLE ONLY "public"."ads";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."ads";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."flow_watermarks";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."landing_pages";



ALTER PUBLICATION "sequin_pub" ADD TABLE ONLY "public"."order_attributions";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."order_attributions";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."order_costs";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."orders";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."shop_costs";



ALTER PUBLICATION "sequin_pub" ADD TABLE ONLY "public"."shop_sessions";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."shop_sessions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."shopify_sessions";



ALTER PUBLICATION "flow_publication" ADD TABLE ONLY "public"."utm_set_cost_rules";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "debezium";
GRANT ALL ON SCHEMA "public" TO "prisma";





























































































































































































REVOKE ALL ON FUNCTION "public"."admin_kill_app_sessions"("p_app_name" "text", "p_min_age" interval, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_kill_app_sessions"("p_app_name" "text", "p_min_age" interval, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_kill_app_sessions"("p_app_name" "text", "p_min_age" interval, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_kill_app_sessions"("p_app_name" "text", "p_min_age" interval, "p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_kill_app_sessions"("p_app_name" "text", "p_min_age" interval, "p_limit" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."apply_plan_visibility_change_flip_batch"("p_job_id" "uuid", "p_batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."apply_plan_visibility_change_flip_batch"("p_job_id" "uuid", "p_batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_plan_visibility_change_flip_batch"("p_job_id" "uuid", "p_batch_size" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."apply_plan_visibility_change_flip_batch"("p_job_id" "uuid", "p_batch_size" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."backfill_ads_summary_spend_shop_currency_for_shops"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_ads_summary_spend_shop_currency_for_shops"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_ads_summary_spend_shop_currency_for_shops"() TO "service_role";
GRANT ALL ON FUNCTION "public"."backfill_ads_summary_spend_shop_currency_for_shops"() TO "prisma";



GRANT ALL ON FUNCTION "public"."backfill_converting_session_id_batch"("p_shop" "text", "p_batch_size" integer, "p_after_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_converting_session_id_batch"("p_shop" "text", "p_batch_size" integer, "p_after_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_converting_session_id_batch"("p_shop" "text", "p_batch_size" integer, "p_after_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."backfill_converting_session_id_batch"("p_shop" "text", "p_batch_size" integer, "p_after_id" bigint) TO "prisma";



GRANT ALL ON FUNCTION "public"."backfill_shop_events_client_id"("p_batch_size" integer, "p_pause_ms" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_shop_events_client_id"("p_batch_size" integer, "p_pause_ms" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_shop_events_client_id"("p_batch_size" integer, "p_pause_ms" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."backfill_shop_events_client_id"("p_batch_size" integer, "p_pause_ms" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."backfill_summary_zero_values"("p_shop" "text", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_summary_zero_values"("p_shop" "text", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_summary_zero_values"("p_shop" "text", "p_start_date" "date", "p_end_date" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."backfill_summary_zero_values"("p_shop" "text", "p_start_date" "date", "p_end_date" "date") TO "prisma";



GRANT ALL ON FUNCTION "public"."bulk_create_past_order_attributions_from_shopify_id"("p_order_ids" "text"[], "p_shop_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_create_past_order_attributions_from_shopify_id"("p_order_ids" "text"[], "p_shop_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_create_past_order_attributions_from_shopify_id"("p_order_ids" "text"[], "p_shop_url" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."bulk_create_past_order_attributions_from_shopify_id"("p_order_ids" "text"[], "p_shop_url" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."bulk_insert_customer_first_orders_for_shop"("p_shop" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_insert_customer_first_orders_for_shop"("p_shop" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_insert_customer_first_orders_for_shop"("p_shop" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."bulk_insert_customer_first_orders_for_shop"("p_shop" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."bulk_insert_customer_first_orders_for_shop"("p_shop" "text", "p_batch_size" integer, "p_sleep_ms" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_insert_customer_first_orders_for_shop"("p_shop" "text", "p_batch_size" integer, "p_sleep_ms" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_insert_customer_first_orders_for_shop"("p_shop" "text", "p_batch_size" integer, "p_sleep_ms" numeric) TO "service_role";
GRANT ALL ON FUNCTION "public"."bulk_insert_customer_first_orders_for_shop"("p_shop" "text", "p_batch_size" integer, "p_sleep_ms" numeric) TO "prisma";



GRANT ALL ON FUNCTION "public"."bulk_insert_customer_first_orders_for_shop_batch"("p_shop" "text", "p_batch_size" integer, "p_sleep_ms" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_insert_customer_first_orders_for_shop_batch"("p_shop" "text", "p_batch_size" integer, "p_sleep_ms" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_insert_customer_first_orders_for_shop_batch"("p_shop" "text", "p_batch_size" integer, "p_sleep_ms" numeric) TO "service_role";
GRANT ALL ON FUNCTION "public"."bulk_insert_customer_first_orders_for_shop_batch"("p_shop" "text", "p_batch_size" integer, "p_sleep_ms" numeric) TO "prisma";



GRANT ALL ON FUNCTION "public"."bulk_update_orders_source_name"("p_orders" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_update_orders_source_name"("p_orders" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_update_orders_source_name"("p_orders" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."bulk_update_orders_source_name"("p_orders" "jsonb") TO "prisma";



GRANT ALL ON FUNCTION "public"."calculate_shop_ad_hierarchies_summary"("p_shop" "text", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_shop_ad_hierarchies_summary"("p_shop" "text", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_shop_ad_hierarchies_summary"("p_shop" "text", "p_start_date" "date", "p_end_date" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."calculate_shop_ad_hierarchies_summary"("p_shop" "text", "p_start_date" "date", "p_end_date" "date") TO "prisma";



GRANT ALL ON FUNCTION "public"."carry_forward_order_count_on_plan_change"("p_shop" "text", "p_old_billing_period_end" timestamp with time zone, "p_new_billing_period_start" timestamp with time zone, "p_new_billing_period_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."carry_forward_order_count_on_plan_change"("p_shop" "text", "p_old_billing_period_end" timestamp with time zone, "p_new_billing_period_start" timestamp with time zone, "p_new_billing_period_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."carry_forward_order_count_on_plan_change"("p_shop" "text", "p_old_billing_period_end" timestamp with time zone, "p_new_billing_period_start" timestamp with time zone, "p_new_billing_period_end" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."carry_forward_order_count_on_plan_change"("p_shop" "text", "p_old_billing_period_end" timestamp with time zone, "p_new_billing_period_start" timestamp with time zone, "p_new_billing_period_end" timestamp with time zone) TO "prisma";



GRANT ALL ON FUNCTION "public"."carry_forward_order_count_on_plan_change"("p_shop" "text", "p_old_billing_period_end" timestamp with time zone, "p_new_billing_period_start" timestamp with time zone, "p_new_billing_period_end" timestamp with time zone, "p_allowance" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."carry_forward_order_count_on_plan_change"("p_shop" "text", "p_old_billing_period_end" timestamp with time zone, "p_new_billing_period_start" timestamp with time zone, "p_new_billing_period_end" timestamp with time zone, "p_allowance" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."carry_forward_order_count_on_plan_change"("p_shop" "text", "p_old_billing_period_end" timestamp with time zone, "p_new_billing_period_start" timestamp with time zone, "p_new_billing_period_end" timestamp with time zone, "p_allowance" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."carry_forward_order_count_on_plan_change"("p_shop" "text", "p_old_billing_period_end" timestamp with time zone, "p_new_billing_period_start" timestamp with time zone, "p_new_billing_period_end" timestamp with time zone, "p_allowance" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."claim_order_overage_batch"("p_shop" "text", "p_billing_period_end" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_order_overage_batch"("p_shop" "text", "p_billing_period_end" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_order_overage_batch"("p_shop" "text", "p_billing_period_end" timestamp with time zone, "p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."claim_order_overage_batch"("p_shop" "text", "p_billing_period_end" timestamp with time zone, "p_limit" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."delete_shop_data"("p_shop" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_shop_data"("p_shop" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_shop_data"("p_shop" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_shop_data"("p_shop" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."delete_shop_data_part_1"("p_shop" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_shop_data_part_1"("p_shop" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_shop_data_part_1"("p_shop" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_shop_data_part_1"("p_shop" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."delete_shop_data_part_2"("p_shop" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_shop_data_part_2"("p_shop" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_shop_data_part_2"("p_shop" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_shop_data_part_2"("p_shop" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."delete_shop_data_part_2_batch"("p_shop" "text", "p_batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_shop_data_part_2_batch"("p_shop" "text", "p_batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_shop_data_part_2_batch"("p_shop" "text", "p_batch_size" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_shop_data_part_2_batch"("p_shop" "text", "p_batch_size" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."delete_shop_sessions_by_ids"("p_session_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_shop_sessions_by_ids"("p_session_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_shop_sessions_by_ids"("p_session_ids" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_shop_sessions_by_ids"("p_session_ids" "uuid"[]) TO "prisma";



GRANT ALL ON FUNCTION "public"."enqueue_order_overages_for_shop_period"("p_shop" "text", "p_billing_period_start" timestamp with time zone, "p_billing_period_end" timestamp with time zone, "p_allowance" integer, "p_max_new_orders" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_order_overages_for_shop_period"("p_shop" "text", "p_billing_period_start" timestamp with time zone, "p_billing_period_end" timestamp with time zone, "p_allowance" integer, "p_max_new_orders" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_order_overages_for_shop_period"("p_shop" "text", "p_billing_period_start" timestamp with time zone, "p_billing_period_end" timestamp with time zone, "p_allowance" integer, "p_max_new_orders" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."enqueue_order_overages_for_shop_period"("p_shop" "text", "p_billing_period_start" timestamp with time zone, "p_billing_period_end" timestamp with time zone, "p_allowance" integer, "p_max_new_orders" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."export_ads"("p_shop" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_ads"("p_shop" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_ads"("p_shop" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."export_ads"("p_shop" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."export_ads_summary"("p_shop" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_ads_summary"("p_shop" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_ads_summary"("p_shop" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."export_ads_summary"("p_shop" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."export_all_ad_campaigns"() TO "anon";
GRANT ALL ON FUNCTION "public"."export_all_ad_campaigns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_all_ad_campaigns"() TO "service_role";
GRANT ALL ON FUNCTION "public"."export_all_ad_campaigns"() TO "prisma";



GRANT ALL ON FUNCTION "public"."export_all_ad_sets"() TO "anon";
GRANT ALL ON FUNCTION "public"."export_all_ad_sets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_all_ad_sets"() TO "service_role";
GRANT ALL ON FUNCTION "public"."export_all_ad_sets"() TO "prisma";



GRANT ALL ON FUNCTION "public"."export_all_ads"() TO "anon";
GRANT ALL ON FUNCTION "public"."export_all_ads"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_all_ads"() TO "service_role";
GRANT ALL ON FUNCTION "public"."export_all_ads"() TO "prisma";



GRANT ALL ON FUNCTION "public"."export_all_traffic_sources"() TO "anon";
GRANT ALL ON FUNCTION "public"."export_all_traffic_sources"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_all_traffic_sources"() TO "service_role";
GRANT ALL ON FUNCTION "public"."export_all_traffic_sources"() TO "prisma";



GRANT ALL ON FUNCTION "public"."export_sessions"("p_shop" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_sessions"("p_shop" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_sessions"("p_shop" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."export_sessions"("p_shop" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."export_touches_summary"("p_shop" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_touches_summary"("p_shop" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_touches_summary"("p_shop" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."export_touches_summary"("p_shop" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."export_traffic_sources"("p_shop" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."export_traffic_sources"("p_shop" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_traffic_sources"("p_shop" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."export_traffic_sources"("p_shop" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."fetch_grouped_utm_sets_v3"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer, "p_utm_source" "text", "p_utm_campaign" "text", "p_utm_medium" "text", "p_utm_content" "text", "p_utm_term" "text", "p_search_term" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_grouped_utm_sets_v3"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer, "p_utm_source" "text", "p_utm_campaign" "text", "p_utm_medium" "text", "p_utm_content" "text", "p_utm_term" "text", "p_search_term" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_grouped_utm_sets_v3"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer, "p_utm_source" "text", "p_utm_campaign" "text", "p_utm_medium" "text", "p_utm_content" "text", "p_utm_term" "text", "p_search_term" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."fetch_grouped_utm_sets_v3"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_limit" integer, "p_offset" integer, "p_utm_source" "text", "p_utm_campaign" "text", "p_utm_medium" "text", "p_utm_content" "text", "p_utm_term" "text", "p_search_term" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."find_duplicate_shop_sessions_to_remove"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_duplicate_shop_sessions_to_remove"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_duplicate_shop_sessions_to_remove"("p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."find_duplicate_shop_sessions_to_remove"("p_limit" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."find_or_create_session_locked"("p_lock_key" "text", "p_shop" "text", "p_unique_hash" "text", "p_landing_page" "text", "p_landing_page_id" "uuid", "p_traffic_source_id" "uuid", "p_event_timestamp" timestamp with time zone, "p_is_landing_page" boolean, "p_client_id" "uuid", "p_user_agent" "text", "p_ip_address" "text", "p_referer" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_or_create_session_locked"("p_lock_key" "text", "p_shop" "text", "p_unique_hash" "text", "p_landing_page" "text", "p_landing_page_id" "uuid", "p_traffic_source_id" "uuid", "p_event_timestamp" timestamp with time zone, "p_is_landing_page" boolean, "p_client_id" "uuid", "p_user_agent" "text", "p_ip_address" "text", "p_referer" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_or_create_session_locked"("p_lock_key" "text", "p_shop" "text", "p_unique_hash" "text", "p_landing_page" "text", "p_landing_page_id" "uuid", "p_traffic_source_id" "uuid", "p_event_timestamp" timestamp with time zone, "p_is_landing_page" boolean, "p_client_id" "uuid", "p_user_agent" "text", "p_ip_address" "text", "p_referer" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."find_or_create_session_locked"("p_lock_key" "text", "p_shop" "text", "p_unique_hash" "text", "p_landing_page" "text", "p_landing_page_id" "uuid", "p_traffic_source_id" "uuid", "p_event_timestamp" timestamp with time zone, "p_is_landing_page" boolean, "p_client_id" "uuid", "p_user_agent" "text", "p_ip_address" "text", "p_referer" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."find_or_create_session_locked_v2"("p_lock_key" "text", "p_shop" "text", "p_landing_page" "text", "p_landing_page_id" "uuid", "p_traffic_source_id" "uuid", "p_event_timestamp" timestamp with time zone, "p_is_landing_page" boolean, "p_unique_hash" "text", "p_client_id" "uuid", "p_user_agent" "text", "p_ip_address" "text", "p_referer" "text", "p_channel" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_or_create_session_locked_v2"("p_lock_key" "text", "p_shop" "text", "p_landing_page" "text", "p_landing_page_id" "uuid", "p_traffic_source_id" "uuid", "p_event_timestamp" timestamp with time zone, "p_is_landing_page" boolean, "p_unique_hash" "text", "p_client_id" "uuid", "p_user_agent" "text", "p_ip_address" "text", "p_referer" "text", "p_channel" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_or_create_session_locked_v2"("p_lock_key" "text", "p_shop" "text", "p_landing_page" "text", "p_landing_page_id" "uuid", "p_traffic_source_id" "uuid", "p_event_timestamp" timestamp with time zone, "p_is_landing_page" boolean, "p_unique_hash" "text", "p_client_id" "uuid", "p_user_agent" "text", "p_ip_address" "text", "p_referer" "text", "p_channel" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."find_or_create_session_locked_v2"("p_lock_key" "text", "p_shop" "text", "p_landing_page" "text", "p_landing_page_id" "uuid", "p_traffic_source_id" "uuid", "p_event_timestamp" timestamp with time zone, "p_is_landing_page" boolean, "p_unique_hash" "text", "p_client_id" "uuid", "p_user_agent" "text", "p_ip_address" "text", "p_referer" "text", "p_channel" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."find_or_create_shop_user_session"("p_shop_user_id" bigint, "p_inactivity_threshold_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_or_create_shop_user_session"("p_shop_user_id" bigint, "p_inactivity_threshold_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_or_create_shop_user_session"("p_shop_user_id" bigint, "p_inactivity_threshold_seconds" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."find_or_create_shop_user_session"("p_shop_user_id" bigint, "p_inactivity_threshold_seconds" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."fix_landing_pages_normalization_batch"("p_shop" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fix_landing_pages_normalization_batch"("p_shop" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_landing_pages_normalization_batch"("p_shop" "text", "p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."fix_landing_pages_normalization_batch"("p_shop" "text", "p_limit" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."get_monthly_order_counts"("p_shop" "text", "p_timezone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_order_counts"("p_shop" "text", "p_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_order_counts"("p_shop" "text", "p_timezone" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_monthly_order_counts"("p_shop" "text", "p_timezone" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."get_order_totals"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_totals"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_totals"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_order_totals"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "prisma";



GRANT ALL ON FUNCTION "public"."get_touches_summary_for_shop"("p_shop" "text", "p_date_from" "date", "p_date_to" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_touches_summary_for_shop"("p_shop" "text", "p_date_from" "date", "p_date_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_touches_summary_for_shop"("p_shop" "text", "p_date_from" "date", "p_date_to" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_touches_summary_for_shop"("p_shop" "text", "p_date_from" "date", "p_date_to" "date") TO "prisma";



GRANT ALL ON FUNCTION "public"."increment_session_event_count"("p_session_id" "uuid", "p_add_to_carts" integer, "p_checkout_starts" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_session_event_count"("p_session_id" "uuid", "p_add_to_carts" integer, "p_checkout_starts" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_session_event_count"("p_session_id" "uuid", "p_add_to_carts" integer, "p_checkout_starts" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."increment_session_event_count"("p_session_id" "uuid", "p_add_to_carts" integer, "p_checkout_starts" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."make_shop_orders_visible_batch"("p_shop" "text", "p_batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."make_shop_orders_visible_batch"("p_shop" "text", "p_batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."make_shop_orders_visible_batch"("p_shop" "text", "p_batch_size" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."make_shop_orders_visible_batch"("p_shop" "text", "p_batch_size" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."make_shop_orders_visible_batch_skip"("p_shop" "text", "p_batch_size" integer, "p_skip" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."make_shop_orders_visible_batch_skip"("p_shop" "text", "p_batch_size" integer, "p_skip" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."make_shop_orders_visible_batch_skip"("p_shop" "text", "p_batch_size" integer, "p_skip" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."make_shop_orders_visible_batch_skip"("p_shop" "text", "p_batch_size" integer, "p_skip" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."mark_first_orders_visible_date_range"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_order_limit" integer, "p_timezone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_first_orders_visible_date_range"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_order_limit" integer, "p_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_first_orders_visible_date_range"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_order_limit" integer, "p_timezone" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."mark_first_orders_visible_date_range"("p_shop" "text", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_order_limit" integer, "p_timezone" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."prepare_plan_visibility_change_job"("p_shop" "text", "p_job_id" "uuid", "p_batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."prepare_plan_visibility_change_job"("p_shop" "text", "p_job_id" "uuid", "p_batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."prepare_plan_visibility_change_job"("p_shop" "text", "p_job_id" "uuid", "p_batch_size" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."prepare_plan_visibility_change_job"("p_shop" "text", "p_job_id" "uuid", "p_batch_size" integer) TO "prisma";



GRANT ALL ON FUNCTION "public"."recalculate_order_attributions_for_order"("p_order_id" bigint, "p_client_id" "uuid", "p_order_created_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_order_attributions_for_order"("p_order_id" bigint, "p_client_id" "uuid", "p_order_created_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_order_attributions_for_order"("p_order_id" bigint, "p_client_id" "uuid", "p_order_created_at" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."recalculate_order_attributions_for_order"("p_order_id" bigint, "p_client_id" "uuid", "p_order_created_at" timestamp with time zone) TO "prisma";



GRANT ALL ON FUNCTION "public"."recompute_session_event_counts"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_session_event_counts"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_session_event_counts"("p_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."recompute_session_event_counts"("p_session_id" "uuid") TO "prisma";



GRANT ALL ON FUNCTION "public"."recompute_session_event_counts_bulk"("p_shop" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_event_upper" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_session_event_counts_bulk"("p_shop" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_event_upper" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_session_event_counts_bulk"("p_shop" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_event_upper" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."recompute_session_event_counts_bulk"("p_shop" "text", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_event_upper" timestamp with time zone) TO "prisma";



GRANT ALL ON FUNCTION "public"."refresh_shop_performance_metrics"("p_shop" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_shop_performance_metrics"("p_shop" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_shop_performance_metrics"("p_shop" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."refresh_shop_performance_metrics"("p_shop" "text") TO "prisma";



GRANT ALL ON FUNCTION "public"."rollup_ad_external_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."rollup_ad_external_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollup_ad_external_metrics"() TO "service_role";
GRANT ALL ON FUNCTION "public"."rollup_ad_external_metrics"() TO "prisma";



GRANT ALL ON FUNCTION "public"."rollup_ad_external_metrics_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."rollup_ad_external_metrics_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollup_ad_external_metrics_update"() TO "service_role";
GRANT ALL ON FUNCTION "public"."rollup_ad_external_metrics_update"() TO "prisma";



GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "prisma";



GRANT ALL ON FUNCTION "public"."update_order_status"("p_shop" "text", "p_order_id" "text", "p_financial_status" "text", "p_fulfillment_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_status"("p_shop" "text", "p_order_id" "text", "p_financial_status" "text", "p_fulfillment_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_status"("p_shop" "text", "p_order_id" "text", "p_financial_status" "text", "p_fulfillment_status" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_order_status"("p_shop" "text", "p_order_id" "text", "p_financial_status" "text", "p_fulfillment_status" "text") TO "prisma";





















GRANT ALL ON TABLE "public"."ad_account_sync_jobs" TO "anon";
GRANT ALL ON TABLE "public"."ad_account_sync_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_account_sync_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."ad_account_sync_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."ad_campaign_external_metrics" TO "anon";
GRANT ALL ON TABLE "public"."ad_campaign_external_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_campaign_external_metrics" TO "service_role";
GRANT ALL ON TABLE "public"."ad_campaign_external_metrics" TO "prisma";



GRANT ALL ON TABLE "public"."ad_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."ad_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_campaigns" TO "service_role";
GRANT ALL ON TABLE "public"."ad_campaigns" TO "prisma";



GRANT ALL ON SEQUENCE "public"."ad_campaigns_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ad_campaigns_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ad_campaigns_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."ad_campaigns_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."ad_campaigns_summary" TO "anon";
GRANT ALL ON TABLE "public"."ad_campaigns_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_campaigns_summary" TO "service_role";
GRANT ALL ON TABLE "public"."ad_campaigns_summary" TO "prisma";



GRANT ALL ON SEQUENCE "public"."ad_campaigns_summary_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ad_campaigns_summary_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ad_campaigns_summary_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."ad_campaigns_summary_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."ad_external_metrics" TO "anon";
GRANT ALL ON TABLE "public"."ad_external_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_external_metrics" TO "service_role";
GRANT ALL ON TABLE "public"."ad_external_metrics" TO "prisma";



GRANT ALL ON TABLE "public"."ad_set_external_metrics" TO "anon";
GRANT ALL ON TABLE "public"."ad_set_external_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_set_external_metrics" TO "service_role";
GRANT ALL ON TABLE "public"."ad_set_external_metrics" TO "prisma";



GRANT ALL ON TABLE "public"."ad_sets" TO "anon";
GRANT ALL ON TABLE "public"."ad_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_sets" TO "service_role";
GRANT ALL ON TABLE "public"."ad_sets" TO "prisma";



GRANT ALL ON SEQUENCE "public"."ad_sets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ad_sets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ad_sets_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."ad_sets_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."ad_sets_summary" TO "anon";
GRANT ALL ON TABLE "public"."ad_sets_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_sets_summary" TO "service_role";
GRANT ALL ON TABLE "public"."ad_sets_summary" TO "prisma";



GRANT ALL ON SEQUENCE "public"."ad_sets_summary_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ad_sets_summary_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ad_sets_summary_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."ad_sets_summary_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."ads" TO "anon";
GRANT ALL ON TABLE "public"."ads" TO "authenticated";
GRANT ALL ON TABLE "public"."ads" TO "service_role";
GRANT ALL ON TABLE "public"."ads" TO "prisma";



GRANT ALL ON SEQUENCE "public"."ads_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ads_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ads_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."ads_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."ads_summary" TO "anon";
GRANT ALL ON TABLE "public"."ads_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."ads_summary" TO "service_role";
GRANT ALL ON TABLE "public"."ads_summary" TO "prisma";



GRANT ALL ON SEQUENCE "public"."ads_summary_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ads_summary_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ads_summary_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."ads_summary_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."attributed_orders_export_jobs" TO "anon";
GRANT ALL ON TABLE "public"."attributed_orders_export_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."attributed_orders_export_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."attributed_orders_export_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."bulk_fetch_jobs" TO "anon";
GRANT ALL ON TABLE "public"."bulk_fetch_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."bulk_fetch_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."bulk_fetch_jobs" TO "prisma";



GRANT ALL ON SEQUENCE "public"."bulk_fetch_jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bulk_fetch_jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bulk_fetch_jobs_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."bulk_fetch_jobs_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."cancellation_responses" TO "anon";
GRANT ALL ON TABLE "public"."cancellation_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."cancellation_responses" TO "service_role";
GRANT ALL ON TABLE "public"."cancellation_responses" TO "prisma";



GRANT ALL ON TABLE "public"."changelog_entries" TO "anon";
GRANT ALL ON TABLE "public"."changelog_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."changelog_entries" TO "service_role";
GRANT ALL ON TABLE "public"."changelog_entries" TO "prisma";



GRANT ALL ON SEQUENCE "public"."changelog_entry_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."changelog_entry_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."changelog_entry_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."changelog_entry_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."checkout_sessions" TO "anon";
GRANT ALL ON TABLE "public"."checkout_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."checkout_sessions" TO "service_role";
GRANT ALL ON TABLE "public"."checkout_sessions" TO "prisma";



GRANT ALL ON TABLE "public"."connectable_platforms" TO "anon";
GRANT ALL ON TABLE "public"."connectable_platforms" TO "authenticated";
GRANT ALL ON TABLE "public"."connectable_platforms" TO "service_role";
GRANT ALL ON TABLE "public"."connectable_platforms" TO "prisma";



GRANT ALL ON SEQUENCE "public"."connectable_platforms_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."connectable_platforms_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."connectable_platforms_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."connectable_platforms_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."connected_platforms" TO "anon";
GRANT ALL ON TABLE "public"."connected_platforms" TO "authenticated";
GRANT ALL ON TABLE "public"."connected_platforms" TO "service_role";
GRANT ALL ON TABLE "public"."connected_platforms" TO "prisma";



GRANT ALL ON SEQUENCE "public"."connected_platforms_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."connected_platforms_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."connected_platforms_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."connected_platforms_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."contact_events" TO "anon";
GRANT ALL ON TABLE "public"."contact_events" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_events" TO "service_role";
GRANT ALL ON TABLE "public"."contact_events" TO "prisma";



GRANT ALL ON TABLE "public"."currency_conversion_rates" TO "anon";
GRANT ALL ON TABLE "public"."currency_conversion_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."currency_conversion_rates" TO "service_role";
GRANT ALL ON TABLE "public"."currency_conversion_rates" TO "prisma";



GRANT ALL ON TABLE "public"."customer_first_orders" TO "anon";
GRANT ALL ON TABLE "public"."customer_first_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_first_orders" TO "service_role";
GRANT ALL ON TABLE "public"."customer_first_orders" TO "prisma";



GRANT ALL ON TABLE "public"."customer_tag_applications" TO "anon";
GRANT ALL ON TABLE "public"."customer_tag_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_tag_applications" TO "service_role";
GRANT ALL ON TABLE "public"."customer_tag_applications" TO "prisma";



GRANT ALL ON TABLE "public"."customer_tag_rules" TO "anon";
GRANT ALL ON TABLE "public"."customer_tag_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_tag_rules" TO "service_role";
GRANT ALL ON TABLE "public"."customer_tag_rules" TO "prisma";



GRANT ALL ON TABLE "public"."data_export_jobs" TO "anon";
GRANT ALL ON TABLE "public"."data_export_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."data_export_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."data_export_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."early_access_requests" TO "anon";
GRANT ALL ON TABLE "public"."early_access_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."early_access_requests" TO "service_role";
GRANT ALL ON TABLE "public"."early_access_requests" TO "prisma";



GRANT ALL ON SEQUENCE "public"."early_access_request_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."early_access_request_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."early_access_request_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."early_access_request_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."failed_embed_events" TO "anon";
GRANT ALL ON TABLE "public"."failed_embed_events" TO "authenticated";
GRANT ALL ON TABLE "public"."failed_embed_events" TO "service_role";
GRANT ALL ON TABLE "public"."failed_embed_events" TO "prisma";



GRANT ALL ON TABLE "public"."failed_events" TO "anon";
GRANT ALL ON TABLE "public"."failed_events" TO "authenticated";
GRANT ALL ON TABLE "public"."failed_events" TO "service_role";
GRANT ALL ON TABLE "public"."failed_events" TO "prisma";



GRANT ALL ON TABLE "public"."feature_flag_records" TO "anon";
GRANT ALL ON TABLE "public"."feature_flag_records" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flag_records" TO "service_role";
GRANT ALL ON TABLE "public"."feature_flag_records" TO "prisma";



GRANT ALL ON TABLE "public"."flow_watermarks" TO "anon";
GRANT ALL ON TABLE "public"."flow_watermarks" TO "authenticated";
GRANT ALL ON TABLE "public"."flow_watermarks" TO "service_role";
GRANT ALL ON TABLE "public"."flow_watermarks" TO "flow_capture";
GRANT ALL ON TABLE "public"."flow_watermarks" TO "prisma";



GRANT ALL ON TABLE "public"."integration_backfill_jobs" TO "anon";
GRANT ALL ON TABLE "public"."integration_backfill_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_backfill_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."integration_backfill_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."integration_order_items" TO "anon";
GRANT ALL ON TABLE "public"."integration_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_order_items" TO "service_role";
GRANT ALL ON TABLE "public"."integration_order_items" TO "prisma";



GRANT ALL ON TABLE "public"."landing_pages" TO "anon";
GRANT ALL ON TABLE "public"."landing_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."landing_pages" TO "service_role";
GRANT ALL ON TABLE "public"."landing_pages" TO "prisma";



GRANT ALL ON TABLE "public"."landing_pages_summary_daily" TO "anon";
GRANT ALL ON TABLE "public"."landing_pages_summary_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."landing_pages_summary_daily" TO "service_role";
GRANT ALL ON TABLE "public"."landing_pages_summary_daily" TO "prisma";



GRANT ALL ON TABLE "public"."line_items" TO "anon";
GRANT ALL ON TABLE "public"."line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."line_items" TO "service_role";
GRANT ALL ON TABLE "public"."line_items" TO "prisma";



GRANT ALL ON SEQUENCE "public"."line_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."line_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."line_items_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."line_items_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."mandatory_webhooks" TO "anon";
GRANT ALL ON TABLE "public"."mandatory_webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."mandatory_webhooks" TO "service_role";
GRANT ALL ON TABLE "public"."mandatory_webhooks" TO "prisma";



GRANT ALL ON SEQUENCE "public"."mandatory_webhooks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mandatory_webhooks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mandatory_webhooks_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."mandatory_webhooks_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."named_sources" TO "anon";
GRANT ALL ON TABLE "public"."named_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."named_sources" TO "service_role";
GRANT ALL ON TABLE "public"."named_sources" TO "prisma";



GRANT ALL ON TABLE "public"."order_attribution_jobs" TO "anon";
GRANT ALL ON TABLE "public"."order_attribution_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."order_attribution_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."order_attribution_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."order_attributions" TO "anon";
GRANT ALL ON TABLE "public"."order_attributions" TO "authenticated";
GRANT ALL ON TABLE "public"."order_attributions" TO "service_role";
GRANT ALL ON TABLE "public"."order_attributions" TO "prisma";



GRANT ALL ON TABLE "public"."order_batch_download_jobs" TO "anon";
GRANT ALL ON TABLE "public"."order_batch_download_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."order_batch_download_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."order_batch_download_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."order_costs" TO "anon";
GRANT ALL ON TABLE "public"."order_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."order_costs" TO "service_role";
GRANT ALL ON TABLE "public"."order_costs" TO "prisma";



GRANT ALL ON TABLE "public"."order_download_jobs" TO "anon";
GRANT ALL ON TABLE "public"."order_download_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."order_download_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."order_download_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."order_export_jobs" TO "anon";
GRANT ALL ON TABLE "public"."order_export_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."order_export_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."order_export_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."order_overage_records" TO "anon";
GRANT ALL ON TABLE "public"."order_overage_records" TO "authenticated";
GRANT ALL ON TABLE "public"."order_overage_records" TO "service_role";
GRANT ALL ON TABLE "public"."order_overage_records" TO "prisma";



GRANT ALL ON TABLE "public"."order_totals_daily" TO "anon";
GRANT ALL ON TABLE "public"."order_totals_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."order_totals_daily" TO "service_role";
GRANT ALL ON TABLE "public"."order_totals_daily" TO "prisma";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";
GRANT SELECT ON TABLE "public"."orders" TO "debezium";
GRANT ALL ON TABLE "public"."orders" TO "prisma";



GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."orphan_ad_account_sync_jobs" TO "anon";
GRANT ALL ON TABLE "public"."orphan_ad_account_sync_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."orphan_ad_account_sync_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."orphan_ad_account_sync_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."orphan_plan_modify_jobs" TO "anon";
GRANT ALL ON TABLE "public"."orphan_plan_modify_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."orphan_plan_modify_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."orphan_plan_modify_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."plan_change_jobs" TO "anon";
GRANT ALL ON TABLE "public"."plan_change_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_change_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."plan_change_jobs" TO "prisma";



GRANT ALL ON SEQUENCE "public"."plan_change_jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."plan_change_jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."plan_change_jobs_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."plan_change_jobs_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."plan_modify_jobs" TO "anon";
GRANT ALL ON TABLE "public"."plan_modify_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_modify_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."plan_modify_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."plan_visibility_change_job_batches" TO "anon";
GRANT ALL ON TABLE "public"."plan_visibility_change_job_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_visibility_change_job_batches" TO "service_role";
GRANT ALL ON TABLE "public"."plan_visibility_change_job_batches" TO "prisma";



GRANT ALL ON TABLE "public"."plan_visibility_change_job_orders" TO "anon";
GRANT ALL ON TABLE "public"."plan_visibility_change_job_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_visibility_change_job_orders" TO "service_role";
GRANT ALL ON TABLE "public"."plan_visibility_change_job_orders" TO "prisma";



GRANT ALL ON TABLE "public"."plan_visibility_change_jobs" TO "anon";
GRANT ALL ON TABLE "public"."plan_visibility_change_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_visibility_change_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."plan_visibility_change_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."platform_accounts" TO "anon";
GRANT ALL ON TABLE "public"."platform_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_accounts" TO "service_role";
GRANT ALL ON TABLE "public"."platform_accounts" TO "prisma";



GRANT ALL ON SEQUENCE "public"."platform_accounts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."platform_accounts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."platform_accounts_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."platform_accounts_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."replication_slot_alerts" TO "anon";
GRANT ALL ON TABLE "public"."replication_slot_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."replication_slot_alerts" TO "service_role";
GRANT ALL ON TABLE "public"."replication_slot_alerts" TO "prisma";



GRANT ALL ON SEQUENCE "public"."replication_slot_alerts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."replication_slot_alerts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."replication_slot_alerts_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."replication_slot_alerts_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."report_requests" TO "anon";
GRANT ALL ON TABLE "public"."report_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."report_requests" TO "service_role";
GRANT ALL ON TABLE "public"."report_requests" TO "prisma";



GRANT ALL ON SEQUENCE "public"."report_request_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."report_request_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."report_request_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."report_request_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."saved_utm_set_export_jobs" TO "anon";
GRANT ALL ON TABLE "public"."saved_utm_set_export_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_utm_set_export_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."saved_utm_set_export_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."shop_anonymous_clients" TO "anon";
GRANT ALL ON TABLE "public"."shop_anonymous_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_anonymous_clients" TO "service_role";
GRANT ALL ON TABLE "public"."shop_anonymous_clients" TO "prisma";



GRANT ALL ON TABLE "public"."shop_billing_period_counters" TO "anon";
GRANT ALL ON TABLE "public"."shop_billing_period_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_billing_period_counters" TO "service_role";
GRANT ALL ON TABLE "public"."shop_billing_period_counters" TO "prisma";



GRANT ALL ON TABLE "public"."shop_clients" TO "anon";
GRANT ALL ON TABLE "public"."shop_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_clients" TO "service_role";
GRANT ALL ON TABLE "public"."shop_clients" TO "prisma";



GRANT ALL ON TABLE "public"."shop_costs" TO "anon";
GRANT ALL ON TABLE "public"."shop_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_costs" TO "service_role";
GRANT ALL ON TABLE "public"."shop_costs" TO "prisma";



GRANT ALL ON TABLE "public"."shop_delayed_events_to_process" TO "anon";
GRANT ALL ON TABLE "public"."shop_delayed_events_to_process" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_delayed_events_to_process" TO "service_role";
GRANT ALL ON TABLE "public"."shop_delayed_events_to_process" TO "prisma";



GRANT ALL ON TABLE "public"."shop_events" TO "anon";
GRANT ALL ON TABLE "public"."shop_events" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_events" TO "service_role";
GRANT ALL ON TABLE "public"."shop_events" TO "prisma";



GRANT ALL ON TABLE "public"."shop_integrations" TO "anon";
GRANT ALL ON TABLE "public"."shop_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_integrations" TO "service_role";
GRANT ALL ON TABLE "public"."shop_integrations" TO "prisma";



GRANT ALL ON SEQUENCE "public"."shop_integrations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shop_integrations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shop_integrations_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."shop_integrations_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."shop_performance_metrics" TO "anon";
GRANT ALL ON TABLE "public"."shop_performance_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_performance_metrics" TO "service_role";
GRANT ALL ON TABLE "public"."shop_performance_metrics" TO "prisma";



GRANT ALL ON TABLE "public"."shop_sessions" TO "anon";
GRANT ALL ON TABLE "public"."shop_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_sessions" TO "service_role";
GRANT ALL ON TABLE "public"."shop_sessions" TO "prisma";



GRANT ALL ON TABLE "public"."shop_setup_jobs" TO "anon";
GRANT ALL ON TABLE "public"."shop_setup_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_setup_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."shop_setup_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."shop_user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."shop_user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_user_sessions" TO "service_role";
GRANT ALL ON TABLE "public"."shop_user_sessions" TO "prisma";



GRANT ALL ON TABLE "public"."shop_users" TO "anon";
GRANT ALL ON TABLE "public"."shop_users" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_users" TO "service_role";
GRANT ALL ON TABLE "public"."shop_users" TO "prisma";



GRANT ALL ON SEQUENCE "public"."shop_users_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shop_users_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shop_users_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."shop_users_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."shopify_sessions" TO "anon";
GRANT ALL ON TABLE "public"."shopify_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."shopify_sessions" TO "service_role";
GRANT ALL ON TABLE "public"."shopify_sessions" TO "prisma";



GRANT ALL ON TABLE "public"."shopify_sessions_migrations" TO "anon";
GRANT ALL ON TABLE "public"."shopify_sessions_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."shopify_sessions_migrations" TO "service_role";
GRANT ALL ON TABLE "public"."shopify_sessions_migrations" TO "prisma";



GRANT ALL ON TABLE "public"."shops" TO "anon";
GRANT ALL ON TABLE "public"."shops" TO "authenticated";
GRANT ALL ON TABLE "public"."shops" TO "service_role";
GRANT ALL ON TABLE "public"."shops" TO "prisma";



GRANT ALL ON TABLE "public"."subscription_payments" TO "anon";
GRANT ALL ON TABLE "public"."subscription_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_payments" TO "service_role";
GRANT ALL ON TABLE "public"."subscription_payments" TO "prisma";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";
GRANT ALL ON TABLE "public"."subscriptions" TO "prisma";



GRANT ALL ON SEQUENCE "public"."subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."subscriptions_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."subscriptions_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."traffic_source_group_utm_sets" TO "anon";
GRANT ALL ON TABLE "public"."traffic_source_group_utm_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."traffic_source_group_utm_sets" TO "service_role";
GRANT ALL ON TABLE "public"."traffic_source_group_utm_sets" TO "prisma";



GRANT ALL ON TABLE "public"."traffic_source_groups" TO "anon";
GRANT ALL ON TABLE "public"."traffic_source_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."traffic_source_groups" TO "service_role";
GRANT ALL ON TABLE "public"."traffic_source_groups" TO "prisma";



GRANT ALL ON TABLE "public"."traffic_sources" TO "anon";
GRANT ALL ON TABLE "public"."traffic_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."traffic_sources" TO "service_role";
GRANT ALL ON TABLE "public"."traffic_sources" TO "prisma";



GRANT ALL ON TABLE "public"."utm_notepad_preset_values" TO "anon";
GRANT ALL ON TABLE "public"."utm_notepad_preset_values" TO "authenticated";
GRANT ALL ON TABLE "public"."utm_notepad_preset_values" TO "service_role";
GRANT ALL ON TABLE "public"."utm_notepad_preset_values" TO "prisma";



GRANT ALL ON SEQUENCE "public"."utm_notepad_preset_value_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."utm_notepad_preset_value_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."utm_notepad_preset_value_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."utm_notepad_preset_value_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."utm_set_cost_rules" TO "anon";
GRANT ALL ON TABLE "public"."utm_set_cost_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."utm_set_cost_rules" TO "service_role";
GRANT ALL ON TABLE "public"."utm_set_cost_rules" TO "prisma";



GRANT ALL ON TABLE "public"."utm_set_export_jobs" TO "anon";
GRANT ALL ON TABLE "public"."utm_set_export_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."utm_set_export_jobs" TO "service_role";
GRANT ALL ON TABLE "public"."utm_set_export_jobs" TO "prisma";



GRANT ALL ON TABLE "public"."utm_sets" TO "anon";
GRANT ALL ON TABLE "public"."utm_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."utm_sets" TO "service_role";
GRANT ALL ON TABLE "public"."utm_sets" TO "prisma";



GRANT ALL ON SEQUENCE "public"."utm_sets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."utm_sets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."utm_sets_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."utm_sets_id_seq" TO "prisma";



GRANT ALL ON TABLE "public"."v_cnt" TO "anon";
GRANT ALL ON TABLE "public"."v_cnt" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cnt" TO "service_role";
GRANT ALL ON TABLE "public"."v_cnt" TO "prisma";



GRANT ALL ON TABLE "public"."web_pixels" TO "anon";
GRANT ALL ON TABLE "public"."web_pixels" TO "authenticated";
GRANT ALL ON TABLE "public"."web_pixels" TO "service_role";
GRANT ALL ON TABLE "public"."web_pixels" TO "prisma";



GRANT ALL ON SEQUENCE "public"."web_pixel_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."web_pixel_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."web_pixel_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."web_pixel_id_seq" TO "prisma";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "prisma";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "prisma";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "prisma";






























