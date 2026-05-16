-- Zeylora Creator Program: affiliate/referral architecture.
-- Safe SQL Editor fallback for Supabase environments where Prisma migrate is not available locally.

DO $$ BEGIN
  ALTER TYPE "EmailEventType" ADD VALUE IF NOT EXISTS 'REFERRAL_REWARD';
EXCEPTION WHEN undefined_object THEN
  CREATE TYPE "EmailEventType" AS ENUM ('PAYMENT_SUCCESSFUL','CREDITS_ADDED','JOB_COMPLETED','JOB_FAILED_REFUNDED','LOW_CREDITS','WELCOME','PASSWORD_RESET','MFA_ENABLED','TICKET_REPLY','FAILED_PAYMENT','REFERRAL_REWARD');
END $$;

DO $$ BEGIN
  CREATE TYPE "AffiliateStatus" AS ENUM ('ACTIVE','DISABLED','FROZEN','SUSPICIOUS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AffiliateRewardStatus" AS ENUM ('PENDING','APPROVED','DELIVERED','REVOKED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AffiliateRewardScope" AS ENUM ('FIRST_PAYMENT_ONLY','ALL_PAYMENTS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByUserId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "affiliateCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_affiliateCode_key" ON "User"("affiliateCode");
CREATE INDEX IF NOT EXISTS "User_affiliateCode_idx" ON "User"("affiliateCode");
CREATE INDEX IF NOT EXISTS "User_referredByUserId_idx" ON "User"("referredByUserId");

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AffiliateProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "referralCode" TEXT NOT NULL,
  "publicSlug" TEXT,
  "status" "AffiliateStatus" NOT NULL DEFAULT 'ACTIVE',
  "tierKey" TEXT NOT NULL DEFAULT 'starter',
  "customRewardPercent" DECIMAL(5,2),
  "customMonthlyCapCredits" INTEGER,
  "freezeRewards" BOOLEAN NOT NULL DEFAULT false,
  "trusted" BOOLEAN NOT NULL DEFAULT false,
  "suspicious" BOOLEAN NOT NULL DEFAULT false,
  "fraudNotes" TEXT,
  "totalClicks" INTEGER NOT NULL DEFAULT 0,
  "totalSignups" INTEGER NOT NULL DEFAULT 0,
  "totalPaidReferrals" INTEGER NOT NULL DEFAULT 0,
  "totalReferredRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalRewardCredits" INTEGER NOT NULL DEFAULT 0,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateProfile_userId_key" ON "AffiliateProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateProfile_referralCode_key" ON "AffiliateProfile"("referralCode");
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateProfile_publicSlug_key" ON "AffiliateProfile"("publicSlug");
CREATE INDEX IF NOT EXISTS "AffiliateProfile_status_tierKey_idx" ON "AffiliateProfile"("status", "tierKey");
CREATE INDEX IF NOT EXISTS "AffiliateProfile_suspicious_trusted_idx" ON "AffiliateProfile"("suspicious", "trusted");

DO $$ BEGIN
  ALTER TABLE "AffiliateProfile" ADD CONSTRAINT "AffiliateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ReferralClick" (
  "id" TEXT NOT NULL,
  "affiliateProfileId" TEXT,
  "referralCode" TEXT NOT NULL,
  "anonymousId" TEXT,
  "sessionId" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "landingPage" TEXT,
  "referrer" TEXT,
  "utmJson" JSONB,
  "matchedUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReferralClick_referralCode_createdAt_idx" ON "ReferralClick"("referralCode", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralClick_affiliateProfileId_createdAt_idx" ON "ReferralClick"("affiliateProfileId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralClick_anonymousId_createdAt_idx" ON "ReferralClick"("anonymousId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralClick_sessionId_createdAt_idx" ON "ReferralClick"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralClick_ipHash_createdAt_idx" ON "ReferralClick"("ipHash", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_affiliateProfileId_fkey" FOREIGN KEY ("affiliateProfileId") REFERENCES "AffiliateProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_matchedUserId_fkey" FOREIGN KEY ("matchedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ReferralSignup" (
  "id" TEXT NOT NULL,
  "affiliateProfileId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "referralCode" TEXT NOT NULL,
  "referralClickId" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "suspicious" BOOLEAN NOT NULL DEFAULT false,
  "fraudReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralSignup_referredUserId_key" ON "ReferralSignup"("referredUserId");
CREATE INDEX IF NOT EXISTS "ReferralSignup_affiliateProfileId_createdAt_idx" ON "ReferralSignup"("affiliateProfileId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralSignup_referralCode_createdAt_idx" ON "ReferralSignup"("referralCode", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralSignup_suspicious_createdAt_idx" ON "ReferralSignup"("suspicious", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ReferralSignup" ADD CONSTRAINT "ReferralSignup_affiliateProfileId_fkey" FOREIGN KEY ("affiliateProfileId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ReferralSignup" ADD CONSTRAINT "ReferralSignup_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ReferralReward" (
  "id" TEXT NOT NULL,
  "affiliateProfileId" TEXT NOT NULL,
  "affiliateUserId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "status" "AffiliateRewardStatus" NOT NULL DEFAULT 'PENDING',
  "paymentAmount" DECIMAL(10,2) NOT NULL,
  "paymentCurrency" TEXT NOT NULL DEFAULT 'usd',
  "rewardPercentSnapshot" DECIMAL(5,2) NOT NULL,
  "rewardUsdValueSnapshot" DECIMAL(10,2) NOT NULL,
  "creditUsdValueSnapshot" DECIMAL(10,4) NOT NULL,
  "rewardCredits" INTEGER NOT NULL,
  "tierKeySnapshot" TEXT NOT NULL,
  "tierNameSnapshot" TEXT NOT NULL,
  "ruleSnapshotJson" JSONB,
  "fraudFlagsJson" JSONB,
  "deliveredTransactionId" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralReward_paymentId_affiliateUserId_key" ON "ReferralReward"("paymentId", "affiliateUserId");
CREATE INDEX IF NOT EXISTS "ReferralReward_affiliateProfileId_status_createdAt_idx" ON "ReferralReward"("affiliateProfileId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralReward_affiliateUserId_createdAt_idx" ON "ReferralReward"("affiliateUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralReward_referredUserId_createdAt_idx" ON "ReferralReward"("referredUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralReward_status_createdAt_idx" ON "ReferralReward"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_affiliateProfileId_fkey" FOREIGN KEY ("affiliateProfileId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_affiliateUserId_fkey" FOREIGN KEY ("affiliateUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AffiliatePayoutSnapshot" (
  "id" TEXT NOT NULL,
  "affiliateUserId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREPARED',
  "earnedCredits" INTEGER NOT NULL DEFAULT 0,
  "deliveredCredits" INTEGER NOT NULL DEFAULT 0,
  "paymentRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliatePayoutSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AffiliatePayoutSnapshot_affiliateUserId_periodStart_periodEnd_idx" ON "AffiliatePayoutSnapshot"("affiliateUserId", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "AffiliatePayoutSnapshot_status_createdAt_idx" ON "AffiliatePayoutSnapshot"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "AffiliatePayoutSnapshot" ADD CONSTRAINT "AffiliatePayoutSnapshot_affiliateUserId_fkey" FOREIGN KEY ("affiliateUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
