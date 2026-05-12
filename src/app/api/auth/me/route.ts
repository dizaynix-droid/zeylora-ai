import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  if (!supabase) {
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
    return NextResponse.json(
      { authenticated: false },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
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
