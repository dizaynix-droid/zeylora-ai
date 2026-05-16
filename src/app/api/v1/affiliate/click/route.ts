import { NextResponse } from "next/server";
import { recordReferralClick, setReferralCookies, normalizeReferralCode } from "@/lib/affiliate/referrals";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const referralCode = normalizeReferralCode(String(payload.ref || payload.referralCode || ""));
  if (!referralCode) {
    return NextResponse.json({ ok: false, error: "missing_referral" }, { status: 400 });
  }

  const click = await recordReferralClick({
    referralCode,
    landingPage: typeof payload.page === "string" ? payload.page : null,
    referrer: typeof payload.referrer === "string" ? payload.referrer : null,
    utm: isRecord(payload.utm) ? Object.fromEntries(Object.entries(payload.utm).map(([key, value]) => [key, String(value)])) : {},
    request
  });
  const response = NextResponse.json({ ok: true, clickId: click?.id || null });
  setReferralCookies(response, referralCode, click?.id || null);
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
