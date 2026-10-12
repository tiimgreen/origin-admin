import { cache } from "react";

import { cloudflareGraphQL } from "@/lib/cloudflare";
import { supabaseAdmin } from "@/lib/supabase";

import { MONITORING_RANGES, MonitoringBucket, MonitoringRange } from "./monitoring-ranges";

export type TimeSeriesPoint = {
  // ISO timestamp (UTC) of the start of the bucket.
  ts: string;
  value: number;
};

const BUCKET_MS: Record<MonitoringBucket, number> = {
  minute: 60_000,
  hour: 3_600_000,
};

// Every bucket in the window, oldest first, ending with the current (partial)
// bucket. Sources only return buckets that have rows, so missing buckets are
// filled with zeros — an ingestion outage should show as a gap, not vanish.
const buildBuckets = ({ range }: { range: MonitoringRange }) => {
  const spec = MONITORING_RANGES[range];
  const size = BUCKET_MS[spec.bucket];
  const count = (spec.hours * 3_600_000) / size;
  const current = Math.floor(Date.now() / size) * size;

  const buckets: Array<string> = [];
  for (let i = count - 1; i >= 0; i--) {
    buckets.push(new Date(current - i * size).toISOString());
  }

  return buckets;
};

const fillSeries = ({
  buckets,
  values,
}: {
  buckets: Array<string>;
  values: Map<string, number>;
}): Array<TimeSeriesPoint> => {
  return buckets.map((ts) => {
    return { ts, value: values.get(ts) ?? 0 };
  });
};

export type IngestionCounts = {
  events: Array<TimeSeriesPoint>;
  sessions: Array<TimeSeriesPoint>;
};

// Rows created in shop_events / shop_sessions per bucket. Aggregated in
// Postgres by the admin_ingestion_counts RPC (service role only).
export const getIngestionCounts = cache(
  async ({ range }: { range: MonitoringRange }): Promise<IngestionCounts> => {
    const buckets = buildBuckets({ range });

    const { data: counts, error: countsError } = await supabaseAdmin.rpc(
      "admin_ingestion_counts",
      {
        p_since: buckets[0],
        p_bucket: MONITORING_RANGES[range].bucket,
      },
    );

    if (countsError) {
      console.error("Error fetching ingestion counts", countsError);
      throw countsError;
    }

    const events = new Map<string, number>();
    const sessions = new Map<string, number>();

    for (const row of counts) {
      const ts = new Date(row.bucket).toISOString();
      events.set(ts, row.events);
      sessions.set(ts, row.sessions);
    }

    return {
      events: fillSeries({ buckets, values: events }),
      sessions: fillSeries({ buckets, values: sessions }),
    };
  },
);

export type WorkerInvocations = {
  scriptName: string;
  total: number;
  points: Array<TimeSeriesPoint>;
};

type WorkerInvocationsResponse = {
  viewer: {
    accounts: Array<{
      workersInvocationsAdaptive: Array<{
        sum: { requests: number };
        dimensions: { scriptName: string; ts: string };
      }>;
    }>;
  };
};

const DATETIME_DIMENSION: Record<MonitoringBucket, string> = {
  minute: "datetimeMinute",
  hour: "datetimeHour",
};

// Invocations per Worker script per bucket, busiest Worker first.
export const getWorkerInvocations = cache(
  async ({ range }: { range: MonitoringRange }): Promise<Array<WorkerInvocations>> => {
    const buckets = buildBuckets({ range });
    const dimension = DATETIME_DIMENSION[MONITORING_RANGES[range].bucket];

    const response = await cloudflareGraphQL<WorkerInvocationsResponse>({
      query: `
        query WorkerInvocations($accountTag: string!, $since: Time!, $until: Time!) {
          viewer {
            accounts(filter: { accountTag: $accountTag }) {
              workersInvocationsAdaptive(
                limit: 10000
                filter: { datetime_geq: $since, datetime_leq: $until }
              ) {
                sum {
                  requests
                }
                dimensions {
                  scriptName
                  ts: ${dimension}
                }
              }
            }
          }
        }
      `,
      variables: {
        since: buckets[0],
        until: new Date().toISOString(),
      },
    });

    const rows = response.viewer.accounts.at(0)?.workersInvocationsAdaptive ?? [];

    const byScript = new Map<string, Map<string, number>>();

    for (const row of rows) {
      const values = byScript.get(row.dimensions.scriptName) ?? new Map<string, number>();
      const ts = new Date(row.dimensions.ts).toISOString();

      values.set(ts, (values.get(ts) ?? 0) + row.sum.requests);
      byScript.set(row.dimensions.scriptName, values);
    }

    return Array.from(byScript.entries())
      .map(([scriptName, values]) => {
        const points = fillSeries({ buckets, values });
        const total = points.reduce((sum, point) => sum + point.value, 0);

        return { scriptName, total, points };
      })
      .sort((a, b) => b.total - a.total);
  },
);
