import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseBrowserEnv, isSupabaseAuthConfigured } from "./config";

export async function updateSession(request: NextRequest) {
  const startedAt = Date.now();
  let response = NextResponse.next({ request });

  if (!isSupabaseAuthConfigured()) {
    return response;
  }

  const env = getSupabaseBrowserEnv();
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const hasAuthCookie = request.cookies.getAll().some((cookie) => cookie.name.includes("auth-token"));

  if (hasAuthCookie) {
    await supabase.auth.getSession();
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[auth-middleware-timing]", {
      path: request.nextUrl.pathname,
      hasAuthCookie,
      middlewareMs: Date.now() - startedAt
    });
  }

  return response;
}
