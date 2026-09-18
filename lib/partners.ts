import axios from "axios";

const PARTNERS_API_VERSION = "2026-07";
const PARTNERS_ORGANIZATION_ID = process.env.SHOPIFY_PARTNERS_ORGANIZATION_ID;
const PARTNERS_API_TOKEN = process.env.SHOPIFY_PARTNERS_API_TOKEN;
const PARTNERS_APP_ID = process.env.SHOPIFY_PARTNERS_APP_ID;

if (!PARTNERS_ORGANIZATION_ID || !PARTNERS_API_TOKEN || !PARTNERS_APP_ID) {
  throw new Error(
    "SHOPIFY_PARTNERS_ORGANIZATION_ID, SHOPIFY_PARTNERS_API_TOKEN or SHOPIFY_PARTNERS_APP_ID is not set",
  );
}

const PARTNERS_APP_GID = `gid://partners/App/${PARTNERS_APP_ID}`;
const PAGE_SIZE = 100;

// The Partner API allows 4 requests/second; stay comfortably under it.
const PAGE_DELAY_MS = 300;

const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

type PartnersQueryArgs = {
  query: string;
  variables?: Record<string, unknown>;
};

const partnersQuery = async <D>({ query, variables }: PartnersQueryArgs): Promise<D> => {
  const url = `https://partners.shopify.com/${PARTNERS_ORGANIZATION_ID}/api/${PARTNERS_API_VERSION}/graphql.json`;

  const response = await axios.post<{
    data?: D;
    errors?: Array<{ message: string }>;
  }>(
    url,
    { query, variables },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": PARTNERS_API_TOKEN,
      },
    },
  );

  if (response.data.errors && response.data.errors.length > 0) {
    throw new Error(
      `Partners API error: ${response.data.errors.map((e) => e.message).join("; ")}`,
    );
  }

  if (!response.data.data) {
    throw new Error("Partners API returned no data");
  }

  return response.data.data;
};

export type PartnersTransaction = {
  id: string;
  createdAt: string;
  type: "subscription" | "usage";
  shopDomain: string;
  chargeId: string | null;
  billingInterval: "EVERY_30_DAYS" | "ANNUAL" | null;
  grossAmount: number;
  currencyCode: string;
};

type TransactionNode = {
  id: string;
  createdAt: string;
  __typename: string;
  chargeId?: string | null;
  billingInterval?: "EVERY_30_DAYS" | "ANNUAL" | null;
  grossAmount?: { amount: string; currencyCode: string } | null;
  shop?: { myshopifyDomain: string } | null;
};

type TransactionsData = {
  transactions: {
    edges: Array<{ cursor: string; node: TransactionNode }>;
    pageInfo: { hasNextPage: boolean };
  };
};

const TRANSACTIONS_QUERY = `
  query Transactions($appId: ID!, $createdAtMin: DateTime, $after: String) {
    transactions(
      appId: $appId
      types: [APP_SUBSCRIPTION_SALE, APP_USAGE_SALE]
      createdAtMin: $createdAtMin
      first: ${PAGE_SIZE}
      after: $after
    ) {
      edges {
        cursor
        node {
          id
          createdAt
          __typename
          ... on AppSubscriptionSale {
            chargeId
            billingInterval
            grossAmount {
              amount
              currencyCode
            }
            shop {
              myshopifyDomain
            }
          }
          ... on AppUsageSale {
            chargeId
            grossAmount {
              amount
              currencyCode
            }
            shop {
              myshopifyDomain
            }
          }
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

export const fetchTransactions = async ({
  createdAtMin,
}: {
  createdAtMin: string;
}): Promise<Array<PartnersTransaction>> => {
  const transactions: Array<PartnersTransaction> = [];
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: TransactionsData = await partnersQuery<TransactionsData>({
      query: TRANSACTIONS_QUERY,
      variables: { appId: PARTNERS_APP_GID, createdAtMin, after },
    });

    for (const edge of data.transactions.edges) {
      const node = edge.node;
      if (!node.shop || !node.grossAmount) {
        continue;
      }

      transactions.push({
        id: node.id,
        createdAt: node.createdAt,
        type: node.__typename === "AppUsageSale" ? "usage" : "subscription",
        shopDomain: node.shop.myshopifyDomain,
        chargeId: node.chargeId ?? null,
        billingInterval: node.billingInterval ?? null,
        grossAmount: Number(node.grossAmount.amount),
        currencyCode: node.grossAmount.currencyCode,
      });
    }

    hasNextPage = data.transactions.pageInfo.hasNextPage;
    after = data.transactions.edges.at(-1)?.cursor ?? null;

    if (hasNextPage) {
      await sleep(PAGE_DELAY_MS);
    }
  }

  return transactions;
};

export type PartnersAppEventType =
  | "SUBSCRIPTION_CHARGE_ACTIVATED"
  | "SUBSCRIPTION_CHARGE_CANCELED"
  | "SUBSCRIPTION_CHARGE_FROZEN"
  | "SUBSCRIPTION_CHARGE_UNFROZEN";

export type PartnersAppEvent = {
  type: PartnersAppEventType;
  occurredAt: string;
  shopDomain: string;
  chargeId: string;
  chargeName: string;
  chargeAmount: number;
  test: boolean;
  billingOn: string | null;
};

type AppEventNode = {
  type: PartnersAppEventType;
  occurredAt: string;
  shop?: { myshopifyDomain: string } | null;
  charge?: {
    id: string;
    name: string;
    test: boolean;
    amount: { amount: string };
    billingOn: string | null;
  } | null;
};

type AppEventsData = {
  app: {
    events: {
      edges: Array<{ cursor: string; node: AppEventNode }>;
      pageInfo: { hasNextPage: boolean };
    };
  } | null;
};

const APP_EVENTS_QUERY = `
  query AppEvents($appId: ID!, $occurredAtMin: DateTime, $after: String) {
    app(id: $appId) {
      events(
        types: [
          SUBSCRIPTION_CHARGE_ACTIVATED
          SUBSCRIPTION_CHARGE_CANCELED
          SUBSCRIPTION_CHARGE_FROZEN
          SUBSCRIPTION_CHARGE_UNFROZEN
        ]
        occurredAtMin: $occurredAtMin
        first: ${PAGE_SIZE}
        after: $after
      ) {
        edges {
          cursor
          node {
            type
            occurredAt
            shop {
              myshopifyDomain
            }
            ... on SubscriptionChargeActivated {
              charge {
                id
                name
                test
                amount {
                  amount
                }
                billingOn
              }
            }
            ... on SubscriptionChargeCanceled {
              charge {
                id
                name
                test
                amount {
                  amount
                }
                billingOn
              }
            }
            ... on SubscriptionChargeFrozen {
              charge {
                id
                name
                test
                amount {
                  amount
                }
                billingOn
              }
            }
            ... on SubscriptionChargeUnfrozen {
              charge {
                id
                name
                test
                amount {
                  amount
                }
                billingOn
              }
            }
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  }
`;

export const fetchAppEvents = async ({
  occurredAtMin,
}: {
  occurredAtMin: string;
}): Promise<Array<PartnersAppEvent>> => {
  const events: Array<PartnersAppEvent> = [];
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: AppEventsData = await partnersQuery<AppEventsData>({
      query: APP_EVENTS_QUERY,
      variables: { appId: PARTNERS_APP_GID, occurredAtMin, after },
    });

    if (!data.app) {
      throw new Error(`Partners API: app ${PARTNERS_APP_GID} not found`);
    }

    for (const edge of data.app.events.edges) {
      const node = edge.node;
      if (!node.shop || !node.charge) {
        continue;
      }

      events.push({
        type: node.type,
        occurredAt: node.occurredAt,
        shopDomain: node.shop.myshopifyDomain,
        chargeId: node.charge.id,
        chargeName: node.charge.name,
        chargeAmount: Number(node.charge.amount.amount),
        test: node.charge.test,
        billingOn: node.charge.billingOn ?? null,
      });
    }

    hasNextPage = data.app.events.pageInfo.hasNextPage;
    after = data.app.events.edges.at(-1)?.cursor ?? null;

    if (hasNextPage) {
      await sleep(PAGE_DELAY_MS);
    }
  }

  return events;
};
