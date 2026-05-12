import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  if (!supabase) {
    if (process.env.NODE_ENV === "development") {
      console.info("[api/auth/me]", {
        authenticated: false,
        reason: "supabase_not_configured"
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
        hasError: Boolean(error)
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
      email: user.email ?? null
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
