import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseBrowserEnv, isSupabaseAuthConfigured } from "./config";

export async function createClient() {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }

  const cookieStore = await cookies();
  const env = getSupabaseBrowserEnv();

  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; middleware refreshes sessions.
        }
      }
    }
  });
}
