import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { sendTransactionalEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const result = await sendTransactionalEmail({
    templateKey: "mfa_enabled",
    to: user.email,
    userId: user.id,
    idempotencyKey: `mfa-enabled:${user.id}:${new Date().toISOString().slice(0, 10)}`,
    payload: {}
  });

  return NextResponse.json({ ok: result.ok });
}
