import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { cancelVerificationJob } from "@/lib/verification/processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const { jobId } = await params;
  const result = await cancelVerificationJob({
    userId: user.id,
    jobId,
    reason: "Verification job was canceled by the customer. Unused credits were refunded automatically."
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.cancelBlocked ? 409 : 404 });
  }

  return NextResponse.json(result);
}
