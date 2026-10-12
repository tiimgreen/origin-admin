import axios from "axios";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is not set");
}

const CLOUDFLARE_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

type GraphQLResponse<D> = {
  data: D | null;
  errors: Array<{ message: string }> | null;
};

type CloudflareGraphQLParams = {
  query: string;
  variables?: Record<string, string | number>;
};

// Queries the GraphQL Analytics API. `$accountTag` is always supplied, so
// queries can filter `accounts(filter: { accountTag: $accountTag })`.
export const cloudflareGraphQL = async <D>({
  query,
  variables,
}: CloudflareGraphQLParams): Promise<D> => {
  const response = await axios.post<GraphQLResponse<D>>(
    CLOUDFLARE_GRAPHQL_URL,
    {
      query,
      variables: {
        ...variables,
        accountTag: CLOUDFLARE_ACCOUNT_ID,
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    },
  );

  const { data, errors } = response.data;

  if (errors && errors.length > 0) {
    throw new Error(`Cloudflare GraphQL error: ${errors.map((e) => e.message).join("; ")}`);
  }

  if (!data) {
    throw new Error("Cloudflare GraphQL returned no data");
  }

  return data;
};
