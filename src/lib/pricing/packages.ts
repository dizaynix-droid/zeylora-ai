import { prisma } from "@/lib/db";
import { creditPackages } from "@/config/pricing";

export type PublicCreditPackage = {
  id: string;
  key: string;
  name: string;
  credits: number;
  bonusCredits: number;
  totalCredits: number;
  price: number;
  currency: string;
  highlight: boolean;
  badgeText?: string;
  description: string;
  audience: string;
  stripePriceId?: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  sortOrder: number;
};

export async function getCreditPackagesForDisplay(): Promise<PublicCreditPackage[]> {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return getFallbackCreditPackages();
  }

  try {
    const dbPackages = await prisma.creditPackage.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE"
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        credits: true,
        bonusCredits: true,
        price: true,
        currency: true,
        stripePriceId: true,
        status: true,
        sortOrder: true,
        featureFlagKey: true,
        description: true,
        audience: true,
        badgeText: true,
        highlight: true
      }
    });

    if (dbPackages.length > 0) {
      return dedupePackages(dbPackages.map((pack) => {
        const fallback = creditPackages.find((item) => item.name === pack.name || item.featureFlagKey === pack.featureFlagKey);
        const bonusCredits = Math.max(0, pack.bonusCredits);

        return {
          id: pack.id,
          key: fallback?.key ?? slugify(pack.name),
          name: pack.name,
          credits: Math.max(0, pack.credits),
          bonusCredits,
          totalCredits: Math.max(0, pack.credits) + bonusCredits,
          price: Number(pack.price),
          currency: pack.currency.toUpperCase(),
          highlight: pack.highlight || Boolean(fallback?.highlight),
          badgeText: pack.badgeText || fallback?.badgeText,
          description: pack.description || fallback?.description || "Credit pack for clean watermark-free exports.",
          audience: pack.audience || fallback?.audience || "Product sellers and creators",
          stripePriceId: pack.stripePriceId,
          status: pack.status,
          sortOrder: pack.sortOrder
        };
      }));
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[pricing-db-fallback]", error instanceof Error ? error.message : error);
    }
  }

  return getFallbackCreditPackages();
}

function getFallbackCreditPackages(): PublicCreditPackage[] {
  return creditPackages.map((pack, index) => ({
    id: pack.key,
    key: pack.key,
    name: pack.name,
    credits: pack.credits,
    bonusCredits: pack.bonusCredits,
    totalCredits: pack.credits + pack.bonusCredits,
    price: pack.price,
    currency: pack.currency,
    highlight: pack.highlight,
    badgeText: pack.badgeText,
    description: pack.description,
    audience: pack.audience,
    stripePriceId: pack.paymentProviderPriceIds.stripe ?? null,
    status: "ACTIVE" as const,
    sortOrder: index
  }));
}

export async function ensureLaunchCreditPackageDefaults() {
  for (const [index, pack] of creditPackages.entries()) {
    const legacyNames = pack.key === "pro-seller" ? ["Pro Seller", "Studio"] : [pack.name];
    const existing = await prisma.creditPackage.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { featureFlagKey: pack.featureFlagKey },
          {
            name: {
              in: legacyNames
            }
          }
        ]
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        credits: true,
        bonusCredits: true,
        price: true,
        currency: true,
        sortOrder: true,
        featureFlagKey: true,
        status: true
      }
    });

    const launchData = {
      name: pack.name,
      credits: pack.credits,
      bonusCredits: pack.bonusCredits,
      price: pack.price,
      currency: pack.currency.toLowerCase(),
      sortOrder: index + 1,
      featureFlagKey: pack.featureFlagKey,
      description: pack.description,
      audience: pack.audience,
      badgeText: pack.badgeText ?? null,
      highlight: pack.highlight,
      status: "ACTIVE" as const
    };

    if (!existing) {
      await prisma.creditPackage.create({
        data: launchData
      });
      continue;
    }

    if (shouldRepairLaunchPackage(existing, pack.name, pack.credits, pack.bonusCredits, pack.price, pack.featureFlagKey)) {
      await prisma.creditPackage.update({
        where: { id: existing.id },
        data: launchData
      });
    }
  }
}

function shouldRepairLaunchPackage(
  pack: {
    name: string;
    credits: number;
    bonusCredits: number;
    price: unknown;
    featureFlagKey: string | null;
    status: string;
  },
  expectedName: string,
  expectedCredits: number,
  expectedBonusCredits: number,
  expectedPrice: number,
  expectedFeatureFlagKey: string
) {
  const price = Number(pack.price);
  const legacyRecord =
    (pack.name === "Starter" && pack.credits === 40 && price === 9) ||
    (pack.name === "Creator" && pack.credits === 120 && price === 19) ||
    (pack.name === "Studio" && pack.credits === 320 && price === 39) ||
    (pack.name === "Pro Seller" && pack.credits === 320 && price === 39);
  const missingFeatureFlag = !pack.featureFlagKey;

  if (legacyRecord || missingFeatureFlag) return true;
  return (
    pack.name === expectedName &&
    pack.credits === expectedCredits &&
    pack.bonusCredits === expectedBonusCredits &&
    price === expectedPrice &&
    pack.featureFlagKey !== expectedFeatureFlagKey
  );
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function dedupePackages(packages: PublicCreditPackage[]) {
  const seen = new Map<string, PublicCreditPackage>();
  for (const pack of packages) {
    const key = pack.name.toLowerCase();
    const existing = seen.get(key);
    if (!existing || pack.sortOrder < existing.sortOrder) {
      seen.set(key, pack);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}
