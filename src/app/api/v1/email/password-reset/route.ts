import { NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

const recentResetRequests = new Map<string, number>();

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Valid email is required." }, { status: 400 });
  }

  const now = Date.now();
  const lastSentAt = recentResetRequests.get(email) || 0;
  if (now - lastSentAt < 10 * 60 * 1000) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  recentResetRequests.set(email, now);

  const result = await sendTransactionalEmail({
    templateKey: "password_reset",
    to: email,
    idempotencyKey: `password-reset:${email}:${new Date().toISOString().slice(0, 10)}`,
    payload: {}
  });

  return NextResponse.json({ ok: result.ok });
}
