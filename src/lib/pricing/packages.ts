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
  description: string;
  audience: string;
  stripePriceId?: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  sortOrder: number;
};

export async function getCreditPackagesForDisplay(): Promise<PublicCreditPackage[]> {
  try {
    const dbPackages = await prisma.creditPackage.findMany({
      where: {
        deletedAt: null
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        credits: true,
        price: true,
        currency: true,
        stripePriceId: true,
        status: true,
        sortOrder: true,
        featureFlagKey: true
      }
    });

    if (dbPackages.length > 0) {
      return dbPackages.map((pack) => {
        const fallback = creditPackages.find((item) => item.name === pack.name || item.featureFlagKey === pack.featureFlagKey);
        const bonusCredits = getBonusCredits(pack.name, pack.credits);

        return {
          id: pack.id,
          key: fallback?.key ?? slugify(pack.name),
          name: pack.name,
          credits: Math.max(0, pack.credits - bonusCredits),
          bonusCredits,
          totalCredits: pack.credits,
          price: Number(pack.price),
          currency: pack.currency.toUpperCase(),
          highlight: Boolean(fallback?.highlight),
          description: fallback?.description ?? "Credit pack for clean watermark-free exports.",
          audience: fallback?.audience ?? "Product sellers and creators",
          stripePriceId: pack.stripePriceId,
          status: pack.status,
          sortOrder: pack.sortOrder
        };
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[pricing-db-fallback]", error instanceof Error ? error.message : error);
    }
  }

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
    description: pack.description,
    audience: pack.audience,
    stripePriceId: pack.paymentProviderPriceIds.stripe ?? null,
    status: "ACTIVE",
    sortOrder: index
  }));
}

function getBonusCredits(name: string, totalCredits: number) {
  const fallback = creditPackages.find((pack) => pack.name === name);
  if (!fallback) return 0;
  return Math.max(0, totalCredits - fallback.credits);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
