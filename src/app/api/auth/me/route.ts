import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const authCookieNames = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith("sb-") || name.includes("auth-token"));

  if (!supabase) {
    if (process.env.NODE_ENV === "development") {
      console.info("[api/auth/me]", {
        authenticated: false,
        reason: "supabase_not_configured",
        authCookieNames
      });
    }

    return NextResponse.json(
      { authenticated: false },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    if (process.env.NODE_ENV === "development") {
      console.info("[api/auth/me]", {
        authenticated: false,
        hasError: Boolean(error),
        authCookieNames
      });
    }

    return NextResponse.json(
      { authenticated: false },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[api/auth/me]", {
      authenticated: true,
      email: user.email ?? null,
      authCookieNames
    });
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        email: user.email ?? null
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
