import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { FREE_TRIAL_DEVICE_COOKIE } from "@/config/free-trial";
import { prisma } from "@/lib/db";

const IP_RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const IP_USER_AGENT_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;
const DEVICE_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

type FreeTrialClaimRow = {
  id: string;
  userId: string;
  emailIdentityHash: string;
  ipHash: string | null;
  userAgentHash: string | null;
  deviceHash: string | null;
  ipUserAgentHash: string | null;
  status: string;
  grantAmount: number;
  createdAt: Date;
};

type HeaderReader = {
  get(name: string): string | null;
};

export type FreeTrialGrantContext = {
  request?: Request | null;
  headers?: HeaderReader | null;
  email?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
};

export type FreeTrialSignals = {
  emailIdentity: string;
  emailIdentityHash: string;
  ipAddress: string | null;
  ipHash: string | null;
  userAgentHash: string | null;
  deviceHash: string | null;
  ipUserAgentHash: string | null;
  country: string | null;
};

export type FreeTrialConflictReason =
  | "user_already_claimed"
  | "email_identity"
  | "device"
  | "ip_user_agent"
  | "ip_recent"
  | "claim_insert_conflict";

export type FreeTrialConflict = {
  reason: FreeTrialConflictReason;
  claimId: string | null;
  matchedUserId: string | null;
};

type TransactionClient = Prisma.TransactionClient;

let readinessPromise: Promise<void> | null = null;

export async function ensureFreeTrialClaimStoreReady() {
  readinessPromise ??= prepareFreeTrialClaimStore().catch((error) => {
    readinessPromise = null;
    throw error;
  });

  return readinessPromise;
}

export async function buildFreeTrialSignals(email: string, context: FreeTrialGrantContext = {}): Promise<FreeTrialSignals> {
  const requestHeaders = await resolveHeaders(context);
  const ipAddress = normalizeIp(context.ipAddress || getClientIp(requestHeaders));
  const userAgent = normalizeHeaderValue(context.userAgent || requestHeaders?.get("user-agent"));
  const deviceId = normalizeHeaderValue(context.deviceId || getCookieValue(requestHeaders?.get("cookie") || "", FREE_TRIAL_DEVICE_COOKIE));
  const country = normalizeHeaderValue(
    requestHeaders?.get("x-vercel-ip-country") ||
      requestHeaders?.get("cf-ipcountry") ||
      requestHeaders?.get("x-country-code")
  );
  const emailIdentity = normalizeEmailIdentity(email);
  const userAgentHash = userAgent ? hashSignal("ua", userAgent) : null;
  const ipHash = ipAddress ? hashSignal("ip", ipAddress) : null;
  const deviceHash = deviceId ? hashSignal("device", deviceId) : null;

  return {
    emailIdentity,
    emailIdentityHash: hashSignal("email", emailIdentity),
    ipAddress,
    ipHash,
    userAgentHash,
    deviceHash,
    ipUserAgentHash: ipAddress && userAgent ? hashSignal("ipua", `${ipAddress}|${userAgent}`) : null,
    country
  };
}

export async function findFreeTrialConflict(
  tx: TransactionClient,
  input: {
    userId: string;
    signals: FreeTrialSignals;
  }
): Promise<FreeTrialConflict | null> {
  const now = Date.now();
  const deviceCutoff = new Date(now - DEVICE_WINDOW_MS);
  const ipUserAgentCutoff = new Date(now - IP_USER_AGENT_WINDOW_MS);
  const ipCutoff = new Date(now - IP_RECENT_WINDOW_MS);
  const conditions = [
    Prisma.sql`("userId" = ${input.userId})`,
    Prisma.sql`("emailIdentityHash" = ${input.signals.emailIdentityHash} AND "status" = 'GRANTED')`
  ];

  if (input.signals.deviceHash) {
    conditions.push(Prisma.sql`("deviceHash" = ${input.signals.deviceHash} AND "status" = 'GRANTED' AND "createdAt" >= ${deviceCutoff})`);
  }

  if (input.signals.ipUserAgentHash) {
    conditions.push(Prisma.sql`("ipUserAgentHash" = ${input.signals.ipUserAgentHash} AND "status" = 'GRANTED' AND "createdAt" >= ${ipUserAgentCutoff})`);
  }

  if (input.signals.ipHash) {
    conditions.push(Prisma.sql`("ipHash" = ${input.signals.ipHash} AND "status" = 'GRANTED' AND "createdAt" >= ${ipCutoff})`);
  }

  const rows = await tx.$queryRaw<FreeTrialClaimRow[]>(Prisma.sql`
    SELECT
      "id",
      "userId",
      "emailIdentityHash",
      "ipHash",
      "userAgentHash",
      "deviceHash",
      "ipUserAgentHash",
      "status",
      "grantAmount",
      "createdAt"
    FROM "FreeTrialClaim"
    WHERE ${Prisma.join(conditions, " OR ")}
    ORDER BY "createdAt" DESC
    LIMIT 20
  `);

  for (const row of rows) {
    const reason = getConflictReason(row, input);
    if (reason) {
      return {
        reason,
        claimId: row.id,
        matchedUserId: row.userId
      };
    }
  }

  return null;
}

export async function insertFreeTrialGrantClaim(
  tx: TransactionClient,
  input: {
    userId: string;
    amount: number;
    signals: FreeTrialSignals;
  }
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "FreeTrialClaim" (
      "id",
      "userId",
      "emailIdentityHash",
      "ipHash",
      "userAgentHash",
      "deviceHash",
      "ipUserAgentHash",
      "status",
      "grantAmount",
      "metadataJson",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${createClaimId()},
      ${input.userId},
      ${input.signals.emailIdentityHash},
      ${input.signals.ipHash},
      ${input.signals.userAgentHash},
      ${input.signals.deviceHash},
      ${input.signals.ipUserAgentHash},
      'GRANTED',
      ${input.amount},
      CAST(${JSON.stringify(buildClaimMetadata(input.signals))} AS JSONB),
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING "id"
  `);

  return rows[0]?.id ?? null;
}

export async function recordBlockedFreeTrialClaim(
  tx: TransactionClient,
  input: {
    userId: string;
    reason: FreeTrialConflictReason;
    signals: FreeTrialSignals;
    matchedClaimId?: string | null;
    matchedUserId?: string | null;
  }
) {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "FreeTrialClaim" (
      "id",
      "userId",
      "emailIdentityHash",
      "ipHash",
      "userAgentHash",
      "deviceHash",
      "ipUserAgentHash",
      "status",
      "blockReason",
      "grantAmount",
      "metadataJson",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${createClaimId()},
      ${input.userId},
      ${input.signals.emailIdentityHash},
      ${input.signals.ipHash},
      ${input.signals.userAgentHash},
      ${input.signals.deviceHash},
      ${input.signals.ipUserAgentHash},
      'BLOCKED',
      ${input.reason},
      0,
      CAST(${JSON.stringify(buildClaimMetadata(input.signals, {
        reason: input.reason,
        matchedClaimId: input.matchedClaimId ?? null,
        matchedUserId: input.matchedUserId ?? null
      }))} AS JSONB),
      NOW(),
      NOW()
    )
    ON CONFLICT ("userId") DO UPDATE SET
      "status" = 'BLOCKED',
      "blockReason" = EXCLUDED."blockReason",
      "metadataJson" = EXCLUDED."metadataJson",
      "updatedAt" = NOW()
    WHERE "FreeTrialClaim"."status" != 'GRANTED'
  `);
}

function getConflictReason(
  row: FreeTrialClaimRow,
  input: {
    userId: string;
    signals: FreeTrialSignals;
  }
): FreeTrialConflictReason | null {
  const createdAt = row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime();
  const age = Date.now() - createdAt;

  if (row.userId === input.userId) return "user_already_claimed";
  if (row.status === "GRANTED" && row.emailIdentityHash === input.signals.emailIdentityHash) return "email_identity";
  if (input.signals.deviceHash && row.status === "GRANTED" && row.deviceHash === input.signals.deviceHash && age <= DEVICE_WINDOW_MS) return "device";
  if (input.signals.ipUserAgentHash && row.status === "GRANTED" && row.ipUserAgentHash === input.signals.ipUserAgentHash && age <= IP_USER_AGENT_WINDOW_MS) {
    return "ip_user_agent";
  }
  if (input.signals.ipHash && row.status === "GRANTED" && row.ipHash === input.signals.ipHash && age <= IP_RECENT_WINDOW_MS) return "ip_recent";

  return null;
}

async function prepareFreeTrialClaimStore() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FreeTrialClaim" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "emailIdentityHash" TEXT NOT NULL,
      "ipHash" TEXT,
      "userAgentHash" TEXT,
      "deviceHash" TEXT,
      "ipUserAgentHash" TEXT,
      "status" TEXT NOT NULL DEFAULT 'GRANTED',
      "blockReason" TEXT,
      "grantAmount" INTEGER NOT NULL DEFAULT 0,
      "metadataJson" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "FreeTrialClaim_userId_key" ON "FreeTrialClaim"("userId")`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "FreeTrialClaim_emailIdentityHash_granted_key" ON "FreeTrialClaim"("emailIdentityHash") WHERE "status" = 'GRANTED'`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FreeTrialClaim_emailIdentityHash_idx" ON "FreeTrialClaim"("emailIdentityHash")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FreeTrialClaim_ipHash_createdAt_idx" ON "FreeTrialClaim"("ipHash", "createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FreeTrialClaim_deviceHash_createdAt_idx" ON "FreeTrialClaim"("deviceHash", "createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FreeTrialClaim_ipUserAgentHash_createdAt_idx" ON "FreeTrialClaim"("ipUserAgentHash", "createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FreeTrialClaim_status_createdAt_idx" ON "FreeTrialClaim"("status", "createdAt")`);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FreeTrialClaim_userId_fkey') THEN
        ALTER TABLE "FreeTrialClaim"
          ADD CONSTRAINT "FreeTrialClaim_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
}

async function resolveHeaders(context: FreeTrialGrantContext) {
  if (context.headers) return context.headers;
  if (context.request) return context.request.headers;

  try {
    return await headers();
  } catch {
    return null;
  }
}

function getClientIp(requestHeaders: HeaderReader | null) {
  if (!requestHeaders) return null;

  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    requestHeaders.get("cf-connecting-ip") ||
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    forwardedFor ||
    null
  );
}

function normalizeEmailIdentity(email: string) {
  const lower = email.trim().toLowerCase();
  const [rawLocal, rawDomain] = lower.split("@");
  if (!rawLocal || !rawDomain) return lower;

  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  let local = rawLocal.split("+")[0] || rawLocal;

  if (domain === "gmail.com") {
    local = local.replace(/\./g, "");
  }

  return `${local}@${domain}`;
}

function normalizeIp(value: string | null | undefined) {
  const first = value?.split(",")[0]?.trim().toLowerCase();
  if (!first || first === "unknown") return null;
  return first.slice(0, 120);
}

function normalizeHeaderValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 500) : null;
}

function getCookieValue(cookieHeader: string, name: string) {
  const target = `${name}=`;
  const cookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(target));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(target.length));
  } catch {
    return cookie.slice(target.length);
  }
}

function hashSignal(label: string, value: string) {
  const secret = process.env.FREE_TRIAL_ABUSE_HASH_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "zeylora-free-trial";
  return createHash("sha256").update(`${secret}:${label}:${value}`).digest("hex");
}

function buildClaimMetadata(signals: FreeTrialSignals, extra?: Record<string, unknown>) {
  return {
    country: signals.country,
    hasIp: Boolean(signals.ipHash),
    hasUserAgent: Boolean(signals.userAgentHash),
    hasDevice: Boolean(signals.deviceHash),
    hasIpUserAgent: Boolean(signals.ipUserAgentHash),
    ...extra
  };
}

function createClaimId() {
  return `ftc_${randomUUID().replace(/-/g, "")}`;
}
