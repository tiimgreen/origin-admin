"use server";

import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "@/lib/supabase";

type SetFeatureFlagArgs = {
  shop: string;
  subscriptionId: number;
  name: string;
  active: boolean;
};

export const setFeatureFlag = async ({
  shop,
  subscriptionId,
  name,
  active,
}: SetFeatureFlagArgs): Promise<{ success: boolean; error?: string }> => {
  const { data: records, error: recordsError } = await supabaseAdmin
    .from("feature_flag_records")
    .select(`
      id,
      name,
      active
    `)
    .eq("subscription_id", subscriptionId)
    .eq("name", name);

  if (recordsError) {
    console.error("Error fetching feature flag record", recordsError);
    return { success: false, error: "Error fetching feature flag record" };
  }

  if (records.length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from("feature_flag_records")
      .update({ active })
      .eq("id", records[0].id);

    if (updateError) {
      console.error("Error updating feature flag record", updateError);
      return { success: false, error: "Error updating feature flag record" };
    }
  } else {
    const { error: insertError } = await supabaseAdmin
      .from("feature_flag_records")
      .insert({
        subscription_id: subscriptionId,
        name,
        active,
      });

    if (insertError) {
      console.error("Error inserting feature flag record", insertError);
      return { success: false, error: "Error inserting feature flag record" };
    }
  }

  revalidatePath(`/shops/${shop}`);

  return { success: true };
};

const GET_APP_NAME = `#graphql
  query GetAppName($id: ID!) {
    app(id: $id) {
      id
      title
    }
  }
`;

const SHOPIFY_API_VERSION = "2025-10";

type LookupAppNameArgs = {
  shop: string;
  appId: string;
};

export const lookupAppName = async ({
  shop,
  appId,
}: LookupAppNameArgs): Promise<{
  success: boolean;
  title?: string | null;
  error?: string;
}> => {
  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("shopify_sessions")
    .select("accessToken")
    .eq("shop", shop)
    .eq("isOnline", false)
    .not("accessToken", "is", null);

  if (sessionsError) {
    console.error("Error fetching shopify session", sessionsError);
    return { success: false, error: "Error fetching shopify session" };
  }

  const accessToken = sessions[0]?.accessToken;

  if (!accessToken) {
    return { success: false, error: "No offline access token for this shop" };
  }

  try {
    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: GET_APP_NAME,
          variables: {
            id: `gid://shopify/App/${appId}`,
          },
        }),
      },
    );

    if (!response.ok) {
      console.error("Shopify GraphQL request failed", response.status);
      return {
        success: false,
        error: `Shopify request failed (${response.status})`,
      };
    }

    const body: { data?: { app?: { title?: string | null } | null } } =
      await response.json();

    return { success: true, title: body.data?.app?.title ?? null };
  } catch (error) {
    console.error("Error fetching app name", error);
    return { success: false, error: "Error fetching app name" };
  }
};
