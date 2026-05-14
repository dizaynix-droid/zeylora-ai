DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseCategory') THEN
    CREATE TYPE "ExpenseCategory" AS ENUM ('ADS', 'SEO', 'PROVIDER', 'SOFTWARE', 'DESIGN', 'DOMAIN', 'HOSTING', 'OTHER');
  END IF;
END $$;

ALTER TABLE "AiTool" ADD COLUMN IF NOT EXISTS "estimatedCostPerRun" DECIMAL(10,4);
ALTER TABLE "AiTool" ADD COLUMN IF NOT EXISTS "estimatedCostCurrency" TEXT NOT NULL DEFAULT 'usd';
ALTER TABLE "AiTool" ADD COLUMN IF NOT EXISTS "estimatedCostProvider" TEXT;

CREATE TABLE IF NOT EXISTS "BusinessExpense" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdByUserId" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessExpense_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BusinessExpense_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "BusinessExpense"
      ADD CONSTRAINT "BusinessExpense_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BusinessExpense_expenseDate_category_deletedAt_idx" ON "BusinessExpense"("expenseDate", "category", "deletedAt");
CREATE INDEX IF NOT EXISTS "BusinessExpense_category_idx" ON "BusinessExpense"("category");
CREATE INDEX IF NOT EXISTS "BusinessExpense_createdByUserId_idx" ON "BusinessExpense"("createdByUserId");
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AiJob_createdAt_status_toolId_providerKey_idx" ON "AiJob"("createdAt", "status", "toolId", "providerKey");
CREATE INDEX IF NOT EXISTS "CreditTransaction_createdAt_type_idx" ON "CreditTransaction"("createdAt", "type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'PAUSE_PROVIDER'
      AND enumtypid = '"ProviderBudgetMode"'::regtype
  ) THEN
    ALTER TYPE "ProviderBudgetMode" ADD VALUE 'PAUSE_PROVIDER';
  END IF;
END $$;

ALTER TABLE "ProviderSetting" ADD COLUMN IF NOT EXISTS "providerType" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "ProviderSetting" ADD COLUMN IF NOT EXISTS "envKeyName" TEXT;
ALTER TABLE "ProviderSetting" ALTER COLUMN "configJson" SET DEFAULT '{}';
ALTER TABLE "ProviderSetting" ADD COLUMN IF NOT EXISTS "dailyBudgetLimit" DECIMAL(10,2);
ALTER TABLE "ProviderSetting" ADD COLUMN IF NOT EXISTS "estimatedCostPerRun" DECIMAL(10,4);
ALTER TABLE "ProviderSetting" ADD COLUMN IF NOT EXISTS "estimatedCostCurrency" TEXT NOT NULL DEFAULT 'usd';
ALTER TABLE "ProviderSetting" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "ProviderSetting" ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE INDEX IF NOT EXISTS "ProviderSetting_providerKey_status_idx" ON "ProviderSetting"("providerKey", "status");
CREATE INDEX IF NOT EXISTS "ProviderSetting_status_priority_idx" ON "ProviderSetting"("status", "priority");
