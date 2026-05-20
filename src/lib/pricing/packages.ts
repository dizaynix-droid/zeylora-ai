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
      const mappedDbPackages = dbPackages
        .filter((pack) => isEmailVerificationPackage(pack.name, pack.featureFlagKey))
        .map((pack) => {
        const fallback = findPackageConfig(pack.name, pack.featureFlagKey);
        const normalized = fallback && shouldUseLaunchPackageValues(pack, fallback) ? fallback : null;
        const baseCredits = normalized?.credits ?? Math.max(0, pack.credits);
        const bonusCredits = normalized?.bonusCredits ?? Math.max(0, pack.bonusCredits);

        return {
          id: pack.id,
          key: fallback?.key ?? slugify(pack.name),
          name: normalized?.name ?? (fallback ? fallback.name : pack.name),
          credits: baseCredits,
          bonusCredits,
          totalCredits: baseCredits + bonusCredits,
          price: normalized?.price ?? Number(pack.price),
          currency: (normalized?.currency ?? pack.currency).toUpperCase(),
          highlight: normalized?.highlight ?? (pack.highlight || Boolean(fallback?.highlight)),
          badgeText: normalized?.badgeText ?? pack.badgeText ?? fallback?.badgeText,
          description: normalized?.description ?? pack.description ?? fallback?.description ?? "Verification credits for bulk email list cleaning.",
          audience: normalized?.audience ?? pack.audience ?? fallback?.audience ?? "Marketers, agencies, sales teams, and SaaS GTM teams",
          stripePriceId: pack.stripePriceId,
          status: pack.status,
          sortOrder: normalized ? creditPackages.findIndex((item) => item.key === normalized.key) + 1 : pack.sortOrder
        };
      });
      if (mappedDbPackages.length === creditPackages.length) {
        return dedupePackages(mappedDbPackages);
      }
      const dbConfigKeys = new Set(
        dbPackages
          .filter((pack) => isEmailVerificationPackage(pack.name, pack.featureFlagKey))
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
  const activeFeatureFlagKeys = creditPackages.map((pack) => pack.featureFlagKey);
  const legacyFeatureFlagKeys = [
    "pricing_pack_starter_trial",
    "pricing_pack_creator",
    "pricing_pack_pro_seller",
    "pricing_pack_studio",
    "pricing_pack_trial"
  ];
  const legacyPackageNames = [
    "Starter Trial Pack",
    "Creator",
    "Pro Seller",
    "Studio",
    "Trial Pack"
  ];

  for (const [index, pack] of creditPackages.entries()) {
    const legacyNames = getPackageLegacyNames(pack.key, pack.name);
    const existingPackages = await prisma.creditPackage.findMany({
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
        status: true,
        createdAt: true
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

    if (existingPackages.length === 0) {
      await prisma.creditPackage.create({
        data: launchData
      });
      continue;
    }

    const existing =
      existingPackages.find((item) => item.featureFlagKey === pack.featureFlagKey && item.name === pack.name) ??
      existingPackages.find((item) => item.featureFlagKey === pack.featureFlagKey) ??
      existingPackages.find((item) => item.name === pack.name) ??
      existingPackages[0];

    if (shouldRepairLaunchPackage(existing, pack.name, pack.credits, pack.bonusCredits, pack.price, pack.featureFlagKey)) {
      await prisma.creditPackage.update({
        where: { id: existing.id },
        data: launchData
      });
    }

    const duplicateIds = existingPackages.filter((item) => item.id !== existing.id).map((item) => item.id);
    if (duplicateIds.length > 0) {
      await prisma.creditPackage.updateMany({
        where: {
          id: { in: duplicateIds },
          deletedAt: null
        },
        data: {
          status: "INACTIVE"
        }
      });
    }
  }

  await prisma.creditPackage.updateMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      OR: [
        { featureFlagKey: { in: legacyFeatureFlagKeys } },
        { name: { in: legacyPackageNames } },
        {
          AND: [
            { featureFlagKey: { not: null } },
            { NOT: { featureFlagKey: { in: activeFeatureFlagKeys } } }
          ]
        }
      ]
    },
    data: {
      status: "INACTIVE"
    }
  });
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
  const missingFeatureFlag = !pack.featureFlagKey;
  const sameLaunchPackage = pack.name === expectedName || pack.featureFlagKey === expectedFeatureFlagKey;

  if (missingFeatureFlag) return true;
  if (!sameLaunchPackage) return false;

  return (
    pack.name !== expectedName ||
    pack.credits !== expectedCredits ||
    pack.bonusCredits !== expectedBonusCredits ||
    price !== expectedPrice ||
    pack.featureFlagKey !== expectedFeatureFlagKey ||
    pack.status !== "ACTIVE"
  );
}

function isEmailVerificationPackage(name: string, featureFlagKey: string | null) {
  return Boolean(findPackageConfig(name, featureFlagKey));
}

function getPackageLegacyNames(key: string, name: string) {
  if (key === "starter") return [name, "Starter", "Starter Trial Pack", "Trial Pack", "Trial"];
  if (key === "growth") return [name];
  if (key === "scale") return [name, "Creator", "Pro Seller"];
  if (key === "business") return [name, "Studio"];
  return [name];
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function findPackageConfig(name: string, featureFlagKey: string | null) {
  if (featureFlagKey) {
    const byFeatureFlag = creditPackages.find((item) => item.featureFlagKey === featureFlagKey);
    if (byFeatureFlag) return byFeatureFlag;
  }

  const byName = creditPackages.find((item) => item.name === name);
  if (byName) return byName;

  return creditPackages.find((item) => getPackageLegacyNames(item.key, item.name).includes(name));
}

function shouldUseLaunchPackageValues(
  pack: {
    name: string;
    credits: number;
    bonusCredits: number;
    price: unknown;
    featureFlagKey: string | null;
    description: string | null;
    audience: string | null;
  },
  fallback: (typeof creditPackages)[number]
) {
  const legacyNames = getPackageLegacyNames(fallback.key, fallback.name).filter((name) => name !== fallback.name);
  const legacyCopy =
    (pack.description || "").toLowerCase().includes("product photo") ||
    (pack.description || "").toLowerCase().includes("marketplace-ready visuals") ||
    (pack.audience || "").toLowerCase().includes("product");

  return (
    pack.name !== fallback.name ||
    legacyNames.includes(pack.name) ||
    legacyCopy ||
    pack.credits !== fallback.credits ||
    pack.bonusCredits !== fallback.bonusCredits ||
    Number(pack.price) !== fallback.price
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
