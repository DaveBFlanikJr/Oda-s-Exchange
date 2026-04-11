import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/config/env";

export function getAdminSupabaseClient() {
  if (!serverEnv.SUPABASE_URL || !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin credentials are missing.");
  }

  return createClient(serverEnv.SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });
}
