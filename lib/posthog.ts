import axios from "axios";

const POSTHOG_HOST = process.env.POSTHOG_HOST;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;

if (!POSTHOG_HOST || !POSTHOG_PROJECT_ID || !POSTHOG_PERSONAL_API_KEY) {
  throw new Error("POSTHOG_HOST, POSTHOG_PROJECT_ID, or POSTHOG_PERSONAL_API_KEY is not set");
}

type PostHogQueryResponse<R extends Array<unknown>> = {
  results: R;
  columns: Array<string>;
  types: Array<string>;
  hasMore?: boolean;
};

type HogQLParams = {
  query: string;
};

export const posthogHogQLQuery = async <R extends Array<unknown>>({
  query,
}: HogQLParams): Promise<PostHogQueryResponse<R>> => {
  const url = new URL(
    `/api/projects/${POSTHOG_PROJECT_ID}/query/`,
    POSTHOG_HOST,
  ).toString();

  const response = await axios.post<PostHogQueryResponse<R>>(
    url,
    {
      query: {
        kind: "HogQLQuery",
        query,
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
      },
    },
  );

  return response.data;
};

type PaginatedHogQLParams = {
  query: string;
  pageSize?: number;
  maxPages?: number;
};

// Auto-paginates a HogQL query using LIMIT/OFFSET. The query MUST include a
// stable ORDER BY so rows do not shift between pages. PostHog's default page
// cap is 10,000, so pageSize defaults to that.
export const posthogHogQLQueryAll = async <Row>({
  query,
  pageSize = 10_000,
  maxPages = 100,
}: PaginatedHogQLParams): Promise<Array<Row>> => {
  const all: Array<Row> = [];
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const paged = `${query.trimEnd()}\nLIMIT ${pageSize} OFFSET ${offset}`;
    const response = await posthogHogQLQuery<Array<Row>>({ query: paged });
    all.push(...response.results);

    if (!response.hasMore || response.results.length < pageSize) {
      return all;
    }
    offset += pageSize;
  }

  console.warn(
    `[posthogHogQLQueryAll] hit maxPages=${maxPages} (pageSize=${pageSize}); results may be truncated`,
  );
  return all;
};
