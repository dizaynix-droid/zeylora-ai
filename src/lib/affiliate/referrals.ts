import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import type { Prisma, User } from "@prisma/client";
import { trackingEvents } from "@/config/tracking";
import { prisma } from "@/lib/db";
import { trackServerEvent } from "@/lib/analytics/server";

export const REFERRAL_COOKIE = "zeylora_ref";
export const REFERRAL_CLICK_COOKIE = "zeylora_ref_click";
const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 60;

type RequestLike = {
  headers?: Headers;
  url?: string;
};

export function getReferralUrl(code: string) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.zeylora.ai").replace(/\/+$/, "");
  return `${siteUrl}/?ref=${encodeURIComponent(code)}`;
}

export async function ensureAffiliateProfile(user: Pick<User, "id" | "email" | "name" | "affiliateCode">) {
  const existing = await prisma.affiliateProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, referralCode: true }
  });

  if (existing) {
    if (!user.affiliateCode || user.affiliateCode !== existing.referralCode) {
      await prisma.user.update({
        where: { id: user.id },
        data: { affiliateCode: existing.referralCode }
      }).catch(() => null);
    }
    return existing;
  }

  const referralCode = await createUniqueReferralCode(user.email, user.name);
  return prisma.$transaction(async (tx) => {
    const profile = await tx.affiliateProfile.create({
      data: {
        userId: user.id,
        referralCode,
        publicSlug: referralCode
      },
      select: { id: true, referralCode: true }
    });

    await tx.user.update({
      where: { id: user.id },
      data: { affiliateCode: referralCode }
    });

    return profile;
  });
}

export async function recordReferralClick(input: {
  referralCode: string;
  anonymousId?: string | null;
  sessionId?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
  utm?: Record<string, string>;
  request?: RequestLike;
}) {
  const referralCode = normalizeReferralCode(input.referralCode);
  if (!referralCode) return null;

  const profile = await prisma.affiliateProfile.findUnique({
    where: { referralCode },
    select: { id: true, userId: true, status: true }
  });
  const requestHeaders = input.request?.headers;
  const click = await prisma.referralClick.create({
    data: {
      affiliateProfileId: profile?.id || null,
      referralCode,
      anonymousId: cleanOptional(input.anonymousId),
      sessionId: cleanOptional(input.sessionId),
      landingPage: cleanOptional(input.landingPage),
      referrer: cleanOptional(input.referrer),
      utmJson: toJson(input.utm || {}),
      ipHash: hashValue(getIpAddress(requestHeaders)),
      userAgentHash: hashValue(requestHeaders?.get("user-agent") || null)
    },
    select: { id: true, referralCode: true, affiliateProfileId: true }
  });

  if (profile?.id) {
    await prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: { totalClicks: { increment: 1 } }
    }).catch(() => null);
  }

  trackServerEvent(trackingEvents.referralClick, {
    referralCode,
    affiliateProfileId: profile?.id || null,
    clickId: click.id,
    page: input.landingPage || null
  });

  return click;
}

export async function applyPendingReferralForUser(userId: string) {
  const cookieStore = await getCookieStore();
  const requestHeaders = await getHeaderStore();
  const referralCode = normalizeReferralCode(cookieStore?.get(REFERRAL_COOKIE)?.value || "");
  if (!referralCode) return null;

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, referredByUserId: true }
    }),
    prisma.affiliateProfile.findUnique({
      where: { referralCode },
      select: { id: true, userId: true, status: true, suspicious: true }
    })
  ]);

  if (!user || !profile) return null;
  if (user.referredByUserId) return null;
  if (profile.userId === userId) return null;
  if (profile.status !== "ACTIVE") return null;

  const latestClick = await prisma.referralClick.findFirst({
    where: { referralCode },
    orderBy: { createdAt: "desc" },
    select: { id: true, ipHash: true, userAgentHash: true }
  });
  const ipHash = hashValue(getIpAddress(requestHeaders));
  const userAgentHash = hashValue(requestHeaders?.get("user-agent") || null);
  const suspicious = Boolean(profile.suspicious || (latestClick?.ipHash && latestClick.ipHash === ipHash && latestClick.userAgentHash === userAgentHash));

  const signup = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { referredByUserId: profile.userId }
    });

    const created = await tx.referralSignup.upsert({
      where: { referredUserId: userId },
      update: {},
      create: {
        affiliateProfileId: profile.id,
        referredUserId: userId,
        referralCode,
        referralClickId: latestClick?.id || null,
        ipHash,
        userAgentHash,
        suspicious,
        fraudReason: suspicious ? "Similar device/session signal or suspicious affiliate flag." : null
      },
      select: { id: true }
    });

    await tx.affiliateProfile.update({
      where: { id: profile.id },
      data: { totalSignups: { increment: 1 } }
    });

    await tx.referral.create({
      data: {
        referrerUserId: profile.userId,
        referredUserId: userId,
        referralCode,
        status: "PENDING",
        rewardCredits: 0
      }
    }).catch(() => null);

    return created;
  });

  trackServerEvent(trackingEvents.referralSignup, {
    userId,
    affiliateUserId: profile.userId,
    referralCode,
    signupId: signup.id,
    suspicious
  });

  return signup;
}

export function setReferralCookies(response: NextResponse, referralCode: string, clickId?: string | null) {
  const normalized = normalizeReferralCode(referralCode);
  if (!normalized || !("cookies" in response) || !response.cookies) return;
  const options = {
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
  response.cookies.set(REFERRAL_COOKIE, normalized, options);
  if (clickId) response.cookies.set(REFERRAL_CLICK_COOKIE, clickId, options);
}

export function normalizeReferralCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
}

function cleanOptional(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, 500) : null;
}

async function createUniqueReferralCode(email: string, name?: string | null) {
  const localPart = (name || email.split("@")[0] || "creator")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 18) || "creator";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${randomBytes(2).toString("hex")}`;
    const code = normalizeReferralCode(`${localPart}${suffix}`);
    const exists = await prisma.affiliateProfile.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!exists) return code;
  }

  return `creator-${randomBytes(5).toString("hex")}`;
}

function getIpAddress(headersList?: Headers | null) {
  return headersList?.get("cf-connecting-ip") || headersList?.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

function hashValue(value?: string | null) {
  if (!value) return null;
  const salt = process.env.AFFILIATE_HASH_SALT || process.env.NEXT_PUBLIC_SITE_URL || "zeylora";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

async function getCookieStore() {
  try {
    return await cookies();
  } catch {
    return null;
  }
}

async function getHeaderStore() {
  try {
    return await headers();
  } catch {
    return null;
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value || {})) as Prisma.InputJsonValue;
}
