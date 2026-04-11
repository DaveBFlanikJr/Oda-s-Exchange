import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/config/env";

export function getPublicSupabaseClient() {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false
      }
    }
  );
}

export function getRequiredPublicSupabaseClient() {
  const supabase = getPublicSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase public credentials are missing.");
  }

  return supabase;
}
