-- Email verification pivot: dedicated verification jobs and row-level results.

CREATE TYPE "VerificationJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "VerificationEmailStatus" AS ENUM ('VALID', 'INVALID', 'RISKY', 'CATCH_ALL', 'DISPOSABLE', 'UNKNOWN', 'DUPLICATE');

ALTER TABLE "CreditTransaction" ADD COLUMN "verificationJobId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "verificationJobId" TEXT;

CREATE TABLE "VerificationJob" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerificationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationEmailResult" (
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
);

CREATE INDEX "VerificationJob_userId_status_createdAt_idx" ON "VerificationJob"("userId", "status", "createdAt");
CREATE INDEX "VerificationJob_status_createdAt_idx" ON "VerificationJob"("status", "createdAt");
CREATE INDEX "VerificationJob_providerKey_status_createdAt_idx" ON "VerificationJob"("providerKey", "status", "createdAt");
CREATE INDEX "VerificationJob_completedAt_idx" ON "VerificationJob"("completedAt");
CREATE INDEX "VerificationEmailResult_verificationJobId_status_idx" ON "VerificationEmailResult"("verificationJobId", "status");
CREATE INDEX "VerificationEmailResult_normalizedEmail_idx" ON "VerificationEmailResult"("normalizedEmail");
CREATE INDEX "VerificationEmailResult_domain_idx" ON "VerificationEmailResult"("domain");
CREATE INDEX "CreditTransaction_verificationJobId_idx" ON "CreditTransaction"("verificationJobId");
CREATE INDEX "Ticket_verificationJobId_idx" ON "Ticket"("verificationJobId");

ALTER TABLE "VerificationJob" ADD CONSTRAINT "VerificationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VerificationEmailResult" ADD CONSTRAINT "VerificationEmailResult_verificationJobId_fkey" FOREIGN KEY ("verificationJobId") REFERENCES "VerificationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_verificationJobId_fkey" FOREIGN KEY ("verificationJobId") REFERENCES "VerificationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_verificationJobId_fkey" FOREIGN KEY ("verificationJobId") REFERENCES "VerificationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
