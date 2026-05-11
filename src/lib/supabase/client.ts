import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "./config";

export function createClient() {
  const env = getSupabaseBrowserEnv();

  return createBrowserClient(env.url, env.publishableKey);
}
