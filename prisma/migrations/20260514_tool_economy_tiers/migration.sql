ALTER TABLE public."AiTool"
  ADD COLUMN IF NOT EXISTS "publicName" TEXT,
  ADD COLUMN IF NOT EXISTS "internalKey" TEXT,
  ADD COLUMN IF NOT EXISTS "qualityTier" TEXT,
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recommended" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 100;

ALTER TABLE public."AiJob"
  ADD COLUMN IF NOT EXISTS "toolNameSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "toolInternalKeySnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "qualityTierSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "providerKeySnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "creditsChargedSnapshot" INTEGER;

CREATE INDEX IF NOT EXISTS "AiTool_internalKey_idx" ON public."AiTool"("internalKey");
CREATE INDEX IF NOT EXISTS "AiTool_qualityTier_providerKey_idx" ON public."AiTool"("qualityTier", "providerKey");
CREATE INDEX IF NOT EXISTS "AiTool_displayOrder_idx" ON public."AiTool"("displayOrder");
CREATE INDEX IF NOT EXISTS "AiJob_qualityTierSnapshot_providerKeySnapshot_idx" ON public."AiJob"("qualityTierSnapshot", "providerKeySnapshot");
CREATE INDEX IF NOT EXISTS "AiJob_completedAt_qualityTierSnapshot_idx" ON public."AiJob"("completedAt", "qualityTierSnapshot");
