import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserEnv } from "./config";

let browserClient: SupabaseClient | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  const env = getSupabaseBrowserEnv();

  browserClient = createBrowserClient(env.url, env.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce"
    }
  });

  return browserClient;
}
