import { createClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "@/lib/config/env";

type SupabaseCredentialPair = {
  url: string;
  key: string;
};

function getSupabaseCredentialPair(): SupabaseCredentialPair | null {
  if (serverEnv.SUPABASE_URL && serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      url: serverEnv.SUPABASE_URL,
      key: serverEnv.SUPABASE_SERVICE_ROLE_KEY
    };
  }

  if (publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      url: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      key: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    };
  }

  return null;
}

export function getServerSupabaseClient() {
  const credentials = getSupabaseCredentialPair();

  if (!credentials) {
    throw new Error("Supabase server credentials are missing.");
  }

  return createClient(credentials.url, credentials.key, {
    auth: {
      persistSession: false
    }
  });
}
