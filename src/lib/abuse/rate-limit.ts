import { NextResponse } from "next/server";
import { businessFoundation } from "@/config/business";
import { trackServerEvent } from "@/lib/analytics/server";
import { trackingEvents } from "@/config/tracking";

type RateLimitAction = "upload" | "job";

type Bucket = {
  count: number;
  resetAt: number;
  lastHitAt: number;
};

type RateLimitOptions = {
  action: RateLimitAction;
  userId?: string | null;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true }
  | {
      ok: false;
      status: 429 | 403;
      error: string;
      retryAfterSeconds: number;
      reason: "rate_limited" | "cooldown" | "bot_guard";
    };

export function checkRateLimit(request: Request, options: RateLimitOptions): RateLimitResult {
  if (!businessFoundation.abuseProtection.enabled) {
    return { ok: true };
  }

  const userAgent = request.headers.get("user-agent")?.trim();
  if (businessFoundation.abuseProtection.blockEmptyUserAgent && !userAgent) {
    trackServerEvent(trackingEvents.abuseBlocked, {
      action: options.action,
      reason: "empty_user_agent"
    });

    return {
      ok: false,
      status: 403,
      error: "We could not verify this request. Please try again from your browser.",
      retryAfterSeconds: 60,
      reason: "bot_guard"
    };
  }

  const now = Date.now();
  const ip = getClientIp(request);
  const identity = options.userId ? `user:${options.userId}` : `ip:${ip}`;
  const windowMs = options.action === "upload"
    ? businessFoundation.abuseProtection.uploadWindowMs
    : businessFoundation.abuseProtection.jobWindowMs;
  const maxRequests = options.action === "upload"
    ? businessFoundation.abuseProtection.uploadMaxRequests
    : businessFoundation.abuseProtection.jobMaxRequests;
  const cooldownMs = options.action === "job" ? businessFoundation.abuseProtection.cooldownMs : 0;
  const key = `${options.action}:${identity}`;
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
      lastHitAt: now
    });
    cleanupBuckets(now);
    return { ok: true };
  }

  if (cooldownMs > 0 && now - bucket.lastHitAt < cooldownMs) {
    trackServerEvent(trackingEvents.rateLimited, {
      action: options.action,
      reason: "cooldown",
      identity
    });

    return {
      ok: false,
      status: 429,
      error: "Please wait a few seconds before starting another edit.",
      retryAfterSeconds: Math.max(1, Math.ceil((cooldownMs - (now - bucket.lastHitAt)) / 1000)),
      reason: "cooldown"
    };
  }

  bucket.count += 1;
  bucket.lastHitAt = now;

  if (bucket.count > maxRequests) {
    trackServerEvent(trackingEvents.rateLimited, {
      action: options.action,
      reason: "window_limit",
      identity,
      count: bucket.count,
      maxRequests
    });

    return {
      ok: false,
      status: 429,
      error: "Too many requests. Please slow down and try again shortly.",
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      reason: "rate_limited"
    };
  }

  return { ok: true };
}

export function rateLimitResponse(result: Exclude<RateLimitResult, { ok: true }>) {
  return NextResponse.json(
    {
      ok: false,
      error: result.error,
      code: result.reason,
      retryAfterSeconds: result.retryAfterSeconds
    },
    {
      status: result.status,
      headers: {
        "Retry-After": String(result.retryAfterSeconds)
      }
    }
  );
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "unknown";
}

function cleanupBuckets(now: number) {
  if (buckets.size < 500) return;

  for (const [key, bucket] of buckets.entries()) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}
