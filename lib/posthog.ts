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
