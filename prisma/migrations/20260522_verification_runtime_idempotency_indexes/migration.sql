-- Keep runtime verification startup idempotent on production databases that
-- already contain partial verification rows from earlier deploys.

ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "VerificationJob" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "VerificationEmailResult" ADD COLUMN IF NOT EXISTS "email" TEXT NOT NULL DEFAULT '';
ALTER TABLE "VerificationEmailResult" ADD COLUMN IF NOT EXISTS "normalizedEmail" TEXT NOT NULL DEFAULT '';
ALTER TABLE "VerificationEmailResult" ADD COLUMN IF NOT EXISTS "status" "VerificationEmailStatus" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "VerificationEmailResult" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "verificationJobId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "batchIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "emailStart" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "emailEnd" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "emailCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "processedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "validCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "invalidCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "riskyCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "catchAllCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "disposableCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "unknownCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "VerificationBatch" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DELETE FROM "VerificationEmailResult" newer
USING "VerificationEmailResult" older
WHERE newer."verificationJobId" = older."verificationJobId"
  AND newer."normalizedEmail" = older."normalizedEmail"
  AND (newer."createdAt", newer."id") > (older."createdAt", older."id");

DELETE FROM "VerificationBatch" newer
USING "VerificationBatch" older
WHERE newer."verificationJobId" = older."verificationJobId"
  AND newer."batchIndex" = older."batchIndex"
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
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationBatch_verificationJobId_batchIndex_key" ON "VerificationBatch"("verificationJobId", "batchIndex");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationJob_userId_providerRequestId_key" ON "VerificationJob"("userId", "providerRequestId") WHERE "providerRequestId" IS NOT NULL;
