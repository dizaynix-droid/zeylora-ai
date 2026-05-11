import { NextResponse } from "next/server";
import { getCurrentSessionUser, getCurrentUserFromSessionWithTiming } from "@/lib/auth/current-user";
import { businessFoundation } from "@/config/business";
import { getDashboardCache, setDashboardCache } from "@/lib/dashboard/cache";

const CREDIT_CACHE_TTL_MS = 30_000;

type CreditCacheValue = {
  creditBalance: number;
  freeTrialClaimed: boolean;
  lowCreditThreshold: number;
};

export async function GET() {
  const startedAt = Date.now();
  const sessionStartedAt = Date.now();
  const sessionUser = await getCurrentSessionUser();
  const sessionMs = Date.now() - sessionStartedAt;

  if (!sessionUser) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const creditsStartedAt = Date.now();
  const cacheKey = `dashboard:credits:${sessionUser.id}`;
  const cachedCredits = getDashboardCache<CreditCacheValue>(cacheKey);
  const cacheHit = Boolean(cachedCredits);
  let creditData = cachedCredits;
  let prismaMs = 0;
  let userLookupMs = sessionMs;
  const source = cacheHit ? "memory" : "db";

  if (!creditData) {
    const { user, timing } = await getCurrentUserFromSessionWithTiming();
    prismaMs = timing.prismaMs;
    userLookupMs = timing.userLookupMs;

    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    creditData = {
      creditBalance: user.creditBalance,
      freeTrialClaimed: user.freeTrialClaimed,
      lowCreditThreshold: businessFoundation.credits.lowCreditThreshold
    };
    setDashboardCache(cacheKey, creditData, CREDIT_CACHE_TTL_MS);
  }

  const creditsMs = Date.now() - creditsStartedAt;
  const totalMs = Date.now() - startedAt;

  if (process.env.NODE_ENV === "development") {
    console.info("[credits-timing]", {
      sessionMs,
      userLookupMs,
      prismaMs,
      creditsMs,
      totalMs,
      cacheHit,
      source
    });
  }

  return NextResponse.json({
    ok: true,
    ...creditData,
    timing: {
      sessionMs,
      userLookupMs,
      prismaMs,
      creditsMs,
      totalMs,
      cacheHit: cacheHit ? 1 : 0
    }
  });
}
