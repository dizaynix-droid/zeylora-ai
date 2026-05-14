-- Historical job economics snapshots.
-- These fields are written once when a job completes so old reports do not
-- change when admin/provider/tool cost settings are edited later.

ALTER TABLE "AiJob"
  ADD COLUMN IF NOT EXISTS "estimatedCostAtRun" DECIMAL(10, 4),
  ADD COLUMN IF NOT EXISTS "estimatedCostCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedCostProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedCostSource" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedRevenueAtRun" DECIMAL(10, 4),
  ADD COLUMN IF NOT EXISTS "estimatedProfitAtRun" DECIMAL(10, 4);

CREATE INDEX IF NOT EXISTS "AiJob_completedAt_estimatedCostSource_idx"
  ON "AiJob"("completedAt", "estimatedCostSource");
