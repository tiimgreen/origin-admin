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
