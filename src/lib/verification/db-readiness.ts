import { prisma } from "@/lib/db";

let readinessPromise: Promise<void> | null = null;

const statements = [
  `DO $$ BEGIN
    CREATE TYPE "VerificationJobStatus" AS ENUM ('DRAFT','QUEUED','PROCESSING','COMPLETED','FAILED','PARTIAL_FAILED','CANCELED','CANCELLED');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `DO $$ BEGIN
    CREATE TYPE "VerificationEmailStatus" AS ENUM ('VALID','INVALID','RISKY','CATCH_ALL','DISPOSABLE','UNKNOWN','DUPLICATE');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  `ALTER TYPE "VerificationJobStatus" ADD VALUE IF NOT EXISTS 'DRAFT'`,
  `ALTER TYPE "VerificationJobStatus" ADD VALUE IF NOT EXISTS 'QUEUED'`,
  `ALTER TYPE "VerificationJobStatus" ADD VALUE IF NOT EXISTS 'PROCESSING'`,
  `ALTER TYPE "VerificationJobStatus" ADD VALUE IF NOT EXISTS 'COMPLETED'`,
  `ALTER TYPE "VerificationJobStatus" ADD VALUE IF NOT EXISTS 'FAILED'`,
  `ALTER TYPE "VerificationJobStatus" ADD VALUE IF NOT EXISTS 'PARTIAL_FAILED'`,
  `ALTER TYPE "VerificationJobStatus" ADD VALUE IF NOT EXISTS 'CANCELED'`,
  `ALTER TYPE "VerificationJobStatus" ADD VALUE IF NOT EXISTS 'CANCELLED'`,
  `ALTER TYPE "VerificationEmailStatus" ADD VALUE IF NOT EXISTS 'VALID'`,
  `ALTER TYPE "VerificationEmailStatus" ADD VALUE IF NOT EXISTS 'INVALID'`,
  `ALTER TYPE "VerificationEmailStatus" ADD VALUE IF NOT EXISTS 'RISKY'`,
  `ALTER TYPE "VerificationEmailStatus" ADD VALUE IF NOT EXISTS 'CATCH_ALL'`,
  `ALTER TYPE "VerificationEmailStatus" ADD VALUE IF NOT EXISTS 'DISPOSABLE'`,
  `ALTER TYPE "VerificationEmailStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN'`,
  `ALTER TYPE "VerificationEmailStatus" ADD VALUE IF NOT EXISTS 'DUPLICATE'`,
  `CREATE TABLE IF NOT EXISTS "VerificationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "VerificationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "sourceType" TEXT NOT NULL DEFAULT 'upload',
    "originalFilename" TEXT,
    "inputStorageKey" TEXT,
    "fullReportStorageKey" TEXT,
    "validExportStorageKey" TEXT,
    "invalidExportStorageKey" TEXT,
    "riskyExportStorageKey" TEXT,
    "providerKey" TEXT NOT NULL DEFAULT 'millionverifier',
    "providerRequestId" TEXT,
    "providerBatchCount" INTEGER NOT NULL DEFAULT 0,
    "totalEmails" INTEGER NOT NULL DEFAULT 0,
    "uniqueEmails" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "validCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "riskyCount" INTEGER NOT NULL DEFAULT 0,
    "catchAllCount" INTEGER NOT NULL DEFAULT 0,
    "disposableCount" INTEGER NOT NULL DEFAULT 0,
    "unknownCount" INTEGER NOT NULL DEFAULT 0,
    "creditsReserved" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditValueAtRun" DECIMAL(10,4),
    "costPerVerificationAtRun" DECIMAL(10,6),
    "providerCostAtRun" DECIMAL(10,4),
    "providerCostCurrency" TEXT DEFAULT 'usd',
    "estimatedRevenueAtRun" DECIMAL(10,4),
    "estimatedProfitAtRun" DECIMAL(10,4),
    "errorMessage" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "metadataJson" JSONB,
    "deletedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationJob_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "VerificationEmailResult" (
    "id" TEXT NOT NULL,
    "verificationJobId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "status" "VerificationEmailStatus" NOT NULL,
    "reason" TEXT,
    "domain" TEXT,
    "mxFound" BOOLEAN,
    "disposable" BOOLEAN,
    "roleBased" BOOLEAN,
    "freeProvider" BOOLEAN,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationEmailResult_pkey" PRIMARY KEY ("id")
  )`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT 'upload'`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "originalFilename" TEXT`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "inputStorageKey" TEXT`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "fullReportStorageKey" TEXT`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "validExportStorageKey" TEXT`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "invalidExportStorageKey" TEXT`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "riskyExportStorageKey" TEXT`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "providerKey" TEXT NOT NULL DEFAULT 'millionverifier'`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "providerRequestId" TEXT`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "providerBatchCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "totalEmails" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "uniqueEmails" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "duplicateCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "validCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "invalidCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "riskyCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "catchAllCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "disposableCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "unknownCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "creditsReserved" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "creditsUsed" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "creditValueAtRun" DECIMAL(10,4)`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "costPerVerificationAtRun" DECIMAL(10,6)`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "providerCostAtRun" DECIMAL(10,4)`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "providerCostCurrency" TEXT DEFAULT 'usd'`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "estimatedRevenueAtRun" DECIMAL(10,4)`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "estimatedProfitAtRun" DECIMAL(10,4)`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "progressPercent" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "metadataJson" JSONB`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3)`,
  `ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3)`,
  `ALTER TABLE "VerificationEmailResult" ADD COLUMN IF NOT EXISTS "reason" TEXT`,
  `ALTER TABLE "VerificationEmailResult" ADD COLUMN IF NOT EXISTS "domain" TEXT`,
  `ALTER TABLE "VerificationEmailResult" ADD COLUMN IF NOT EXISTS "mxFound" BOOLEAN`,
  `ALTER TABLE "VerificationEmailResult" ADD COLUMN IF NOT EXISTS "disposable" BOOLEAN`,
  `ALTER TABLE "VerificationEmailResult" ADD COLUMN IF NOT EXISTS "roleBased" BOOLEAN`,
  `ALTER TABLE "VerificationEmailResult" ADD COLUMN IF NOT EXISTS "freeProvider" BOOLEAN`,
  `ALTER TABLE "VerificationEmailResult" ADD COLUMN IF NOT EXISTS "rawJson" JSONB`,
  `ALTER TABLE "CreditTransaction" ADD COLUMN IF NOT EXISTS "verificationJobId" TEXT`,
  `DO $$ BEGIN
    IF to_regclass('"Ticket"') IS NOT NULL THEN
      ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "verificationJobId" TEXT;
    END IF;
  END $$`,
  `CREATE INDEX IF NOT EXISTS "VerificationJob_userId_status_createdAt_idx" ON "VerificationJob"("userId", "status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "VerificationJob_userId_createdAt_idx" ON "VerificationJob"("userId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "VerificationJob_status_createdAt_idx" ON "VerificationJob"("status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "VerificationJob_providerKey_status_createdAt_idx" ON "VerificationJob"("providerKey", "status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "VerificationJob_completedAt_idx" ON "VerificationJob"("completedAt")`,
  `CREATE INDEX IF NOT EXISTS "VerificationJob_createdAt_status_idx" ON "VerificationJob"("createdAt", "status")`,
  `CREATE INDEX IF NOT EXISTS "VerificationJob_userId_providerRequestId_idx" ON "VerificationJob"("userId", "providerRequestId")`,
  `CREATE INDEX IF NOT EXISTS "VerificationEmailResult_verificationJobId_status_idx" ON "VerificationEmailResult"("verificationJobId", "status")`,
  `CREATE INDEX IF NOT EXISTS "VerificationEmailResult_verificationJobId_createdAt_idx" ON "VerificationEmailResult"("verificationJobId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "VerificationEmailResult_verificationJobId_status_createdAt_idx" ON "VerificationEmailResult"("verificationJobId", "status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "VerificationEmailResult_normalizedEmail_idx" ON "VerificationEmailResult"("normalizedEmail")`,
  `CREATE INDEX IF NOT EXISTS "VerificationEmailResult_domain_idx" ON "VerificationEmailResult"("domain")`,
  `CREATE INDEX IF NOT EXISTS "CreditTransaction_verificationJobId_idx" ON "CreditTransaction"("verificationJobId")`,
  `DO $$ BEGIN
    IF to_regclass('"Ticket"') IS NOT NULL THEN
      CREATE INDEX IF NOT EXISTS "Ticket_verificationJobId_idx" ON "Ticket"("verificationJobId");
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VerificationJob_userId_fkey') THEN
      ALTER TABLE "VerificationJob" ADD CONSTRAINT "VerificationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VerificationEmailResult_verificationJobId_fkey') THEN
      ALTER TABLE "VerificationEmailResult" ADD CONSTRAINT "VerificationEmailResult_verificationJobId_fkey" FOREIGN KEY ("verificationJobId") REFERENCES "VerificationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditTransaction_verificationJobId_fkey') THEN
      ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_verificationJobId_fkey" FOREIGN KEY ("verificationJobId") REFERENCES "VerificationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF to_regclass('"Ticket"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Ticket_verificationJobId_fkey') THEN
      ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_verificationJobId_fkey" FOREIGN KEY ("verificationJobId") REFERENCES "VerificationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`
];

export async function ensureVerificationDatabaseReady(traceId = "system") {
  if (!readinessPromise) {
    readinessPromise = runReadiness(traceId).catch((error) => {
      readinessPromise = null;
      throw error;
    });
  }

  return readinessPromise;
}

async function runReadiness(traceId: string) {
  const startedAt = Date.now();
  const alreadyReady = await hasRequiredVerificationSchema().catch((error) => {
    console.warn("[verification-db-readiness-preflight-failed]", {
      traceId,
      message: error instanceof Error ? error.message : "Schema preflight failed"
    });
    return false;
  });

  if (alreadyReady) {
    console.info("[verification-db-ready]", {
      traceId,
      mode: "preflight",
      durationMs: Date.now() - startedAt
    });
    return;
  }

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.info("[verification-db-ready]", {
    traceId,
    mode: "repair",
    statementCount: statements.length,
    durationMs: Date.now() - startedAt
  });
}

async function hasRequiredVerificationSchema() {
  const requiredVerificationJobColumns = [
    "providerRequestId",
    "sourceType",
    "providerKey",
    "creditsReserved",
    "creditsUsed",
    "progressPercent",
    "metadataJson",
    "costPerVerificationAtRun"
  ];
  const requiredResultColumns = ["normalizedEmail", "status", "rawJson"];
  const rows = await prisma.$queryRawUnsafe<Array<{ ready: boolean }>>(
    `SELECT (
      to_regclass('"VerificationJob"') IS NOT NULL
      AND to_regclass('"VerificationEmailResult"') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'CreditTransaction'
          AND column_name = 'verificationJobId'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'VerificationJob'
          AND column_name = 'providerRequestId'
      )
      AND (
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'VerificationJob'
          AND column_name = ANY($1::text[])
      ) = $2
      AND (
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'VerificationEmailResult'
          AND column_name = ANY($3::text[])
      ) = $4
    ) AS ready`
    ,
    requiredVerificationJobColumns,
    requiredVerificationJobColumns.length,
    requiredResultColumns,
    requiredResultColumns.length
  );

  return Boolean(rows[0]?.ready);
}
