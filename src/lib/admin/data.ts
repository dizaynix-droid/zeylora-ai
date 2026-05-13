import { prisma } from "@/lib/db";
import { creditPackages } from "@/config/pricing";

export async function getAdminOverviewData() {
  const [
    totalUsers,
    totalJobs,
    completedJobs,
    failedJobs,
    creditsUsed,
    recentJobs,
    recentUsers,
    packages,
    toolEconomics
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.aiJob.count({ where: { deletedAt: null } }),
    prisma.aiJob.count({ where: { deletedAt: null, status: "COMPLETED" } }),
    prisma.aiJob.count({ where: { deletedAt: null, status: "FAILED" } }),
    prisma.creditTransaction.aggregate({
      where: { type: "USE" },
      _sum: { amount: true }
    }),
    prisma.aiJob.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        status: true,
        creditCost: true,
        providerKey: true,
        createdAt: true,
        completedAt: true,
        tool: { select: { name: true, slug: true } },
        user: { select: { email: true } }
      }
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        email: true,
        creditBalance: true,
        role: true,
        status: true,
        createdAt: true
      }
    }),
    prisma.creditPackage.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        credits: true,
        price: true,
        currency: true,
        status: true,
        sortOrder: true
      }
    }),
    getToolEconomics()
  ]);

  return {
    metrics: {
      totalUsers,
      totalJobs,
      completedJobs,
      failedJobs,
      creditsUsed: Math.abs(creditsUsed._sum.amount ?? 0),
      recentExports: completedJobs
    },
    recentJobs,
    recentUsers,
    packages: packages.length ? packages : getFallbackPackages(),
    toolEconomics
  };
}

export async function getAdminUsersData() {
  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      creditBalance: true,
      createdAt: true,
      _count: {
        select: {
          jobs: true,
          creditTransactions: true,
          payments: true
        }
      },
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          status: true,
          createdAt: true,
          tool: { select: { name: true } }
        }
      }
    }
  });
}

export async function getAdminToolsData() {
  const dbTools = await prisma.aiTool.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      version: true,
      name: true,
      category: true,
      creditCost: true,
      status: true,
      providerKey: true,
      updatedAt: true,
      _count: { select: { jobs: true } }
    }
  });

  return dbTools.length ? dbTools : getToolEconomics();
}

export async function getAdminPricingData() {
  const packages = await prisma.creditPackage.findMany({
    where: { deletedAt: null },
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
      featureFlagKey: true,
      updatedAt: true
    }
  });

  return packages.length ? packages : getFallbackPackages();
}

export async function getAdminCreditsData() {
  const [transactions, totals] = await Promise.all([
    prisma.creditTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        note: true,
        createdAt: true,
        user: { select: { email: true } },
        aiJob: { select: { id: true, tool: { select: { name: true } } } }
      }
    }),
    prisma.creditTransaction.groupBy({
      by: ["type"],
      _sum: { amount: true },
      _count: { _all: true }
    })
  ]);

  return { transactions, totals };
}

export async function getAdminJobsData() {
  return prisma.aiJob.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      status: true,
      providerKey: true,
      creditCost: true,
      errorMessage: true,
      processingTimeMs: true,
      createdAt: true,
      completedAt: true,
      tool: { select: { name: true, slug: true } },
      user: { select: { email: true } }
    }
  });
}

export async function getAdminLogsData() {
  return prisma.adminLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadataJson: true,
      createdAt: true,
      adminUser: { select: { email: true } }
    }
  });
}

export async function getToolEconomics() {
  const tools = await prisma.aiTool.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      version: true,
      name: true,
      category: true,
      creditCost: true,
      status: true,
      providerKey: true,
      updatedAt: true,
      _count: { select: { jobs: true } }
    }
  });

  return tools;
}

function getFallbackPackages() {
  return creditPackages.map((pack, index) => ({
    id: pack.key,
    name: pack.name,
    credits: pack.credits + pack.bonusCredits,
    price: { toString: () => String(pack.price) },
    currency: pack.currency.toLowerCase(),
    stripePriceId: pack.paymentProviderPriceIds.stripe ?? null,
    status: "ACTIVE" as const,
    sortOrder: index,
    featureFlagKey: pack.featureFlagKey,
    updatedAt: new Date()
  }));
}
