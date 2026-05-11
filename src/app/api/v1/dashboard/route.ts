import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth/current-user";

export async function GET() {
  const startedAt = Date.now();
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const totalMs = Date.now() - startedAt;

  if (process.env.NODE_ENV === "development") {
    console.info("[dashboard-bootstrap-timing]", {
      totalMs
    });
  }

  return NextResponse.json({
    ok: true,
    user: {
      email: user.email
    },
    timing: {
      totalMs
    }
  });
}
