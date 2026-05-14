import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentSessionUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

const analyticsPayloadSchema = z.object({
  event: z.string().min(1).max(120),
  userId: z.string().nullable().optional(),
  sessionId: z.string().max(120).nullable().optional(),
  anonymousId: z.string().max(120).nullable().optional(),
  source: z.string().max(40).optional(),
  page: z.string().max(500).nullable().optional(),
  referrer: z.string().max(500).nullable().optional(),
  metadata: z.record(z.unknown()).optional()
});

export async function POST(request: Request) {
  const parsed = analyticsPayloadSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const sessionUser = await getCurrentSessionUser();
  const userId = sessionUser?.id ?? null;
  const userAgent = request.headers.get("user-agent") || "";
  const metadata = sanitizeMetadata({
    ...(parsed.data.metadata || {}),
    userAgent: undefined
  });

  await prisma.analyticsEvent.create({
    data: {
      event: parsed.data.event,
      userId,
      sessionId: parsed.data.sessionId || null,
      anonymousId: parsed.data.anonymousId || null,
      source: parsed.data.source || "client",
      page: parsed.data.page || null,
      referrer: parsed.data.referrer || null,
      country: getCountry(request),
      device: getDevice(userAgent),
      browser: getBrowser(userAgent),
      metadataJson: metadata as Prisma.InputJsonObject
    }
  });

  return NextResponse.json({ ok: true });
}

function getCountry(request: Request) {
  return (
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-country") ||
    null
  );
}

function getDevice(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  if (ua) return "desktop";
  return null;
}

function getBrowser(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("chrome/") && !ua.includes("chromium")) return "chrome";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "safari";
  if (ua.includes("firefox/")) return "firefox";
  return ua ? "other" : null;
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  const blockedKeys = new Set(["password", "token", "secret", "card", "authorization", "cookie"]);
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowered = key.toLowerCase();
    if (blockedKeys.has(lowered) || [...blockedKeys].some((blocked) => lowered.includes(blocked))) continue;
    if (typeof value === "string") {
      output[key] = value.slice(0, 500);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      output[key] = value;
    } else if (Array.isArray(value)) {
      output[key] = value.slice(0, 20);
    } else if (typeof value === "object" && value) {
      output[key] = JSON.parse(JSON.stringify(value)).toString?.() === "[object Object]" ? value : null;
    }
  }

  return output;
}
