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
      const mappedDbPackages = dbPackages.map((pack) => {
        const fallback = findPackageConfig(pack.name, pack.featureFlagKey);
        const bonusCredits = Math.max(0, pack.bonusCredits);

        return {
          id: pack.id,
          key: fallback?.key ?? slugify(pack.name),
          name: pack.name === "Studio" && fallback ? fallback.name : pack.name,
          credits: Math.max(0, pack.credits),
          bonusCredits,
          totalCredits: Math.max(0, pack.credits) + bonusCredits,
          price: Number(pack.price),
          currency: pack.currency.toUpperCase(),
          highlight: pack.highlight || Boolean(fallback?.highlight),
          badgeText: pack.badgeText || fallback?.badgeText,
          description: pack.description || fallback?.description || "Verification credits for bulk email list cleaning.",
          audience: pack.audience || fallback?.audience || "Marketers, agencies, ecommerce, and SaaS teams",
          stripePriceId: pack.stripePriceId,
          status: pack.status,
          sortOrder: pack.sortOrder
        };
      });
      const dbConfigKeys = new Set(
        dbPackages
          .map((pack) => findPackageConfig(pack.name, pack.featureFlagKey)?.key)
          .filter((key): key is (typeof creditPackages)[number]["key"] => Boolean(key))
      );
      const missingConfigPackages = getFallbackCreditPackages().filter(
        (pack) => !dbConfigKeys.has(pack.key as (typeof creditPackages)[number]["key"])
      );

      return dedupePackages([...mappedDbPackages, ...missingConfigPackages]);
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
    const legacyNames = [pack.name];
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
    (pack.name === "Starter Trial Pack" && pack.credits <= 100 && price <= 9) ||
    (pack.name === "Starter" && pack.credits < 1000) ||
    (pack.name === "Creator" && price <= 49) ||
    (pack.name === "Studio" && price <= 149) ||
    (pack.name === "Pro Seller" && price <= 149);
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

function findPackageConfig(name: string, featureFlagKey: string | null) {
  return creditPackages.find(
    (item) =>
      item.name === name ||
      item.featureFlagKey === featureFlagKey ||
      (item.key === "growth" && name === "Creator") ||
      (item.key === "pro" && (name === "Pro Seller" || name === "Studio")) ||
      (item.key === "trial" && name === "Starter Trial Pack")
  );
}

function dedupePackages(packages: PublicCreditPackage[]) {
  const seen = new Map<string, PublicCreditPackage>();
  for (const pack of packages) {
    const key = pack.key.toLowerCase();
    const existing = seen.get(key);
    if (!existing || pack.sortOrder < existing.sortOrder) {
      seen.set(key, pack);
    }
  }
  return Array.from(seen.values()).sort((a, b) => {
    const aRank = getLaunchPackageRank(a.key);
    const bRank = getLaunchPackageRank(b.key);
    if (aRank !== bRank) return aRank - bRank;
    return a.sortOrder - b.sortOrder;
  });
}

function getLaunchPackageRank(key: string) {
  const rank = creditPackages.findIndex((pack) => pack.key === key);
  return rank === -1 ? 999 : rank;
}
