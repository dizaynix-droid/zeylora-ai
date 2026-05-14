ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "bonusCredits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "audience" TEXT;
ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "badgeText" TEXT;
ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "highlight" BOOLEAN NOT NULL DEFAULT false;

UPDATE "CreditPackage"
SET
  "credits" = 20,
  "bonusCredits" = 0,
  "price" = 19,
  "currency" = 'usd',
  "sortOrder" = 1,
  "featureFlagKey" = 'pricing_pack_starter',
  "description" = 'A focused pack for testing premium product previews and exporting your first clean assets.',
  "audience" = 'New sellers and first product batches',
  "badgeText" = NULL,
  "highlight" = false,
  "status" = 'ACTIVE'
WHERE "deletedAt" IS NULL AND ("name" = 'Starter' OR "featureFlagKey" = 'pricing_pack_starter');

UPDATE "CreditPackage"
SET
  "credits" = 45,
  "bonusCredits" = 5,
  "price" = 39,
  "currency" = 'usd',
  "sortOrder" = 2,
  "featureFlagKey" = 'pricing_pack_creator',
  "description" = 'A practical seller pack for recurring catalog edits, relights, crops, and clean exports.',
  "audience" = 'Shopify, Etsy, and TikTok Shop sellers',
  "badgeText" = 'Popular',
  "highlight" = true,
  "status" = 'ACTIVE'
WHERE "deletedAt" IS NULL AND ("name" = 'Creator' OR "featureFlagKey" = 'pricing_pack_creator');

UPDATE "CreditPackage"
SET
  "name" = 'Pro Seller',
  "credits" = 100,
  "bonusCredits" = 20,
  "price" = 79,
  "currency" = 'usd',
  "sortOrder" = 3,
  "featureFlagKey" = 'pricing_pack_pro_seller',
  "description" = 'Built for larger product batches, marketplace listing refreshes, and ad creative production.',
  "audience" = 'Growing ecommerce stores',
  "badgeText" = 'Best Value',
  "highlight" = false,
  "status" = 'ACTIVE'
WHERE "deletedAt" IS NULL AND ("name" IN ('Pro Seller', 'Studio') OR "featureFlagKey" = 'pricing_pack_pro_seller');

UPDATE "CreditPackage"
SET
  "credits" = 220,
  "bonusCredits" = 40,
  "price" = 149,
  "currency" = 'usd',
  "sortOrder" = 4,
  "featureFlagKey" = 'pricing_pack_business',
  "description" = 'For operators and teams producing clean product visuals across marketplaces and paid channels.',
  "audience" = 'Agencies, catalog teams, and high-volume sellers',
  "badgeText" = 'Scale',
  "highlight" = false,
  "status" = 'ACTIVE'
WHERE "deletedAt" IS NULL AND ("name" = 'Business' OR "featureFlagKey" = 'pricing_pack_business');
