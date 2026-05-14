import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { sendTransactionalEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

export async function POST() {
  const admin = await requireAdmin();
  const result = await sendTransactionalEmail({
    templateKey: "welcome",
    to: admin.email,
    userId: admin.source === "role" ? admin.id : undefined,
    idempotencyKey: `admin-test:${admin.email}:${Date.now()}`,
    payload: {
      name: admin.email,
      actionUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://www.zeylora.ai"
    }
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Test email could not be sent." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eventId: result.eventId });
}
