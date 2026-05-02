import axios from "axios";

const TINYBIRD_VERSION = "v0";
const TINYBIRD_HOST = process.env.TINYBIRD_HOST;
const TINYBIRD_TOKEN = process.env.TINYBIRD_TOKEN;

if (!TINYBIRD_HOST || !TINYBIRD_TOKEN) {
  throw new Error("TINYBIRD_HOST or TINYBIRD_TOKEN is not set");
}

export type TinybirdResponse<D> = {
  meta: Array<{ name: string; type: string }>;
  data: D;
  rows: number;
  rows_before_limit_at_least?: number;
  statistics: object;
};

type TinybirdParams = {
  q: string;
  params?: Record<string, string | number | boolean>;
};

export const tinybirdQuery = async <D>({
  q,
  params,
}: TinybirdParams) => {
  const path = `/${TINYBIRD_VERSION}/sql`;
  const url = new URL(path, TINYBIRD_HOST);

  const data = {
    ...params,
    q,
  };

  const response = await axios.post<TinybirdResponse<D>>(
    url.toString(),
    data,
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TINYBIRD_TOKEN}`,
      },
    },
  );

  return response.data;
};

export type TrafficSourceInput = {
  id: string;
  shop: string;
  updated_at: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  ad_platform_key: string;
  ad_external_id: string;
  ad_id: number | null;
  ad_set_id: number | null;
  ad_campaign_id: number | null;
  named_source_id: string | null;
  named_source_name: string | null;
  named_source_favicon: string | null;
};

export type AdInput = {
  id: number;
  shop: string;
  ad_set_id: number;
  ad_campaign_id: number;
  platform: string;
  name: string;
  status: string;
  website_url_valid: number;
  currency_code: string;
  is_hidden: 0 | 1;
  updated_at: string;
  _is_deleted?: 0 | 1;
};

export type AdSetInput = {
  id: number;
  shop: string;
  ad_campaign_id: number;
  platform: string;
  name: string;
  status: string;
  currency_code: string;
  updated_at: string;
  _is_deleted?: 0 | 1;
};

export type AdCampaignInput = {
  id: number;
  shop: string;
  platform: string;
  name: string;
  status: string;
  currency_code: string;
  updated_at: string;
  _is_deleted?: 0 | 1;
};

// all datasources (for regular inserts)
type TinybirdEventsParams =
  | { datasource: "traffic_sources"; rows: Array<TrafficSourceInput> }
  | { datasource: "ads"; rows: Array<AdInput> }
  | { datasource: "ad_sets"; rows: Array<AdSetInput> }
  | { datasource: "ad_campaigns"; rows: Array<AdCampaignInput> };

type EventsReponse = {
  successful_rows: number;
  quarantined_rows: number;
};

export const tinybirdEvents = async ({
  datasource,
  rows,
}: TinybirdEventsParams): Promise<EventsReponse> => {
  if (!TINYBIRD_TOKEN) {
    throw new Error("TINYBIRD_TOKEN is not set");
  }

  const url = new URL(`/${TINYBIRD_VERSION}/events?name=${datasource}`, TINYBIRD_HOST).toString();
  const ndjsonBody = rows.map((r) => JSON.stringify(r)).join("\n");

  const response = await axios.post<EventsReponse>(url, ndjsonBody, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Authorization": `Bearer ${TINYBIRD_TOKEN}`,
    },
  });

  return response.data;
};
