import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { syncSupabaseUserProfile } from "@/lib/auth/profile";
import { getSupabaseBrowserEnv, isSupabaseAuthConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl;
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const providerError = requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error");

  if (process.env.NODE_ENV === "development") {
    console.info("[auth/callback-route] received", {
      hasCode: Boolean(code),
      nextPath,
      hasProviderError: Boolean(providerError)
    });
  }

  if (providerError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[auth/callback-route] provider error", providerError);
    }

    return redirectToSignIn(requestUrl, nextPath, providerError);
  }

  if (!code) {
    if (process.env.NODE_ENV === "development") {
      console.error("[auth/callback-route] missing code");
    }

    return redirectToSignIn(requestUrl, nextPath, "Missing authentication code.");
  }

  if (!isSupabaseAuthConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.error("[auth/callback-route] Supabase Auth is not configured");
    }

    return redirectToSignIn(requestUrl, nextPath, "Supabase Auth is not configured.");
  }

  const redirectResponse = NextResponse.redirect(new URL(nextPath, requestUrl.origin), { status: 303 });
  const cookieNames: string[] = [];
  const env = getSupabaseBrowserEnv();
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookieNames.push(...cookiesToSet.map((cookie) => cookie.name));
        cookiesToSet.forEach(({ name, value, options }) => {
          redirectResponse.cookies.set(name, value, options);
        });
      }
    }
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[auth/callback-route] exchange failed", error.message);
    }

    return redirectToSignIn(requestUrl, nextPath, error.message);
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (user?.email) {
    await syncSupabaseUserProfile(user).catch((profileError) => {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[auth/callback-route] profile sync failed",
          profileError instanceof Error ? profileError.message : profileError
        );
      }
    });
  } else if (process.env.NODE_ENV === "development" && userError) {
    console.error("[auth/callback-route] user fetch after exchange failed", userError.message);
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[auth/callback-route] exchange succeeded", {
      nextPath,
      cookiesWritten: cookieNames.length,
      cookieNames
    });
  }

  return redirectResponse;
}

function redirectToSignIn(requestUrl: URL, nextPath: string, errorMessage: string) {
  const signInUrl = new URL("/auth/sign-in", requestUrl.origin);
  signInUrl.searchParams.set("next", nextPath);
  signInUrl.searchParams.set("authStatus", "retry");
  signInUrl.searchParams.set("authError", errorMessage);

  return NextResponse.redirect(signInUrl, { status: 303 });
}

function getSafeNextPath(next: string | null) {
  if (!next?.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}
