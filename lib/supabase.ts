import { createClient } from "@supabase/supabase-js";

import { Database } from "../types/database.types";

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL is not defined");
}

if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_ANON_KEY is not defined");
}

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Write client for admin mutations (feature flag toggles). Falls back to the
// anon key if SUPABASE_SERVICE_ROLE_KEY is not set, in which case writes may
// be rejected by RLS.
export const supabaseAdmin = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY
);

export const JSON_NO_ROWS_ERROR_CODE = "PGRST116";

export type ShopSettings = {
  conversions_api_active?: boolean;
  google_enhanced_conversions_active?: boolean;
  google_conversion_action_ids?: Record<string, string>;
};

export type ConnectedPlatformConnectionInformation = {
  access_token: string;
};
