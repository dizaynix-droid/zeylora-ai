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
);

CREATE UNIQUE INDEX IF NOT EXISTS "FreeTrialClaim_userId_key" ON "FreeTrialClaim"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "FreeTrialClaim_emailIdentityHash_granted_key" ON "FreeTrialClaim"("emailIdentityHash") WHERE "status" = 'GRANTED';
CREATE INDEX IF NOT EXISTS "FreeTrialClaim_emailIdentityHash_idx" ON "FreeTrialClaim"("emailIdentityHash");
CREATE INDEX IF NOT EXISTS "FreeTrialClaim_ipHash_createdAt_idx" ON "FreeTrialClaim"("ipHash", "createdAt");
CREATE INDEX IF NOT EXISTS "FreeTrialClaim_deviceHash_createdAt_idx" ON "FreeTrialClaim"("deviceHash", "createdAt");
CREATE INDEX IF NOT EXISTS "FreeTrialClaim_ipUserAgentHash_createdAt_idx" ON "FreeTrialClaim"("ipUserAgentHash", "createdAt");
CREATE INDEX IF NOT EXISTS "FreeTrialClaim_status_createdAt_idx" ON "FreeTrialClaim"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FreeTrialClaim_userId_fkey') THEN
    ALTER TABLE "FreeTrialClaim"
      ADD CONSTRAINT "FreeTrialClaim_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
