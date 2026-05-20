-- Production safety additions for large email verification jobs.

ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "syntaxInvalidCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "processedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "failedBatchCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "VerificationJob"
SET "processedCount" = COALESCE("processedCount", 0)
WHERE "processedCount" IS NULL;

CREATE TABLE IF NOT EXISTS "VerificationBatch" (
  "id" TEXT NOT NULL,
  "verificationJobId" TEXT NOT NULL,
  "batchIndex" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "emailStart" INTEGER NOT NULL,
  "emailEnd" INTEGER NOT NULL,
  "emailCount" INTEGER NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "validCount" INTEGER NOT NULL DEFAULT 0,
  "invalidCount" INTEGER NOT NULL DEFAULT 0,
  "riskyCount" INTEGER NOT NULL DEFAULT 0,
  "catchAllCount" INTEGER NOT NULL DEFAULT 0,
  "disposableCount" INTEGER NOT NULL DEFAULT 0,
  "unknownCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VerificationBatch_verificationJobId_batchIndex_key" ON "VerificationBatch"("verificationJobId", "batchIndex");
CREATE INDEX IF NOT EXISTS "VerificationBatch_verificationJobId_status_batchIndex_idx" ON "VerificationBatch"("verificationJobId", "status", "batchIndex");
CREATE INDEX IF NOT EXISTS "VerificationBatch_status_updatedAt_idx" ON "VerificationBatch"("status", "updatedAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VerificationBatch_verificationJobId_fkey') THEN
    ALTER TABLE "VerificationBatch" ADD CONSTRAINT "VerificationBatch_verificationJobId_fkey" FOREIGN KEY ("verificationJobId") REFERENCES "VerificationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DELETE FROM "VerificationEmailResult" newer
USING "VerificationEmailResult" older
WHERE newer."verificationJobId" = older."verificationJobId"
  AND newer."normalizedEmail" = older."normalizedEmail"
  AND (newer."createdAt", newer."id") > (older."createdAt", older."id");

WITH duplicate_jobs AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "userId", "providerRequestId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS duplicate_rank
  FROM "VerificationJob"
  WHERE "providerRequestId" IS NOT NULL
)
UPDATE "VerificationJob" job
SET "providerRequestId" = CONCAT(job."providerRequestId", ':legacy-duplicate:', job."id")
FROM duplicate_jobs
WHERE job."id" = duplicate_jobs."id"
  AND duplicate_jobs.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "VerificationEmailResult_verificationJobId_normalizedEmail_key" ON "VerificationEmailResult"("verificationJobId", "normalizedEmail");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationJob_userId_providerRequestId_key" ON "VerificationJob"("userId", "providerRequestId") WHERE "providerRequestId" IS NOT NULL;
