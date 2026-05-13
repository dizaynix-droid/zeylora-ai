import { prisma } from "@/lib/db";
import { creditPackages } from "@/config/pricing";

const ADMIN_PAGE_SIZE = 25;

export const LAUNCH_TOOL_SLUGS = [
  "hd-upscale",
  "ai-relight",
  "ai-photo-enhancer",
  "photo-enhancer",
  "marketplace-crop",
  "background-remover",
  "product-shadow"
] as const;

export type AdminPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export async function getAdminOverviewData() {
  const [totalUsers, totalJobs, completedJobs, failedJobs, creditsUsed, recentJobs] = await Promise.all([
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
      take: 10,
      select: {
        id: true,
        status: true,
        creditCost: true,
        providerKey: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
        tool: { select: { name: true, slug: true } },
        user: { select: { email: true } }
      }
    })
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
    recentJobs
  };
}

export async function getAdminUsersData(input: {
  query?: string;
  filter?: "all" | "with-credits" | "with-jobs" | "recent";
  page?: number;
  pageSize?: number;
} = {}) {
  const query = input.query?.trim();
  const filter = input.filter || "all";
  const page = normalizeAdminPage(input.page);
  const pageSize = normalizeAdminPageSize(input.pageSize);
  const where = {
    deletedAt: null,
    ...(query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" as const } },
            { name: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(filter === "with-credits" ? { creditBalance: { gt: 0 } } : {}),
    ...(filter === "with-jobs" ? { jobs: { some: { deletedAt: null } } } : {}),
    ...(filter === "recent" ? { createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) } } : {})
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: getSkip(page, pageSize),
      take: pageSize,
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
        }
      }
    }),
    prisma.user.count({ where })
  ]);

  return {
    items,
    pagination: createPagination({ page, pageSize, total })
  };
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

  return sortLaunchToolsFirst(dbTools.length ? dbTools : await getToolEconomics());
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

  return dedupeCreditPackages(packages.length ? packages : getFallbackPackages());
}

export async function getAdminCreditsData(input: { page?: number; pageSize?: number } = {}) {
  const page = normalizeAdminPage(input.page);
  const pageSize = normalizeAdminPageSize(input.pageSize);

  const [transactions, totalTransactions, totals] = await Promise.all([
    prisma.creditTransaction.findMany({
      orderBy: { createdAt: "desc" },
      skip: getSkip(page, pageSize),
      take: pageSize,
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
    prisma.creditTransaction.count(),
    prisma.creditTransaction.groupBy({
      by: ["type"],
      _sum: { amount: true },
      _count: { _all: true }
    })
  ]);

  return {
    transactions,
    pagination: createPagination({ page, pageSize, total: totalTransactions }),
    totals,
    summary: {
      issued: totals
        .filter((item) => ["PURCHASE", "ADMIN_ADJUSTMENT", "REFUND", "REFERRAL_REWARD"].includes(item.type))
        .reduce((sum, item) => sum + Math.max(0, item._sum.amount ?? 0), 0),
      used: Math.abs(totals.find((item) => item.type === "USE")?._sum.amount ?? 0),
      manualAdjustments: totals.find((item) => item.type === "ADMIN_ADJUSTMENT")?._count._all ?? 0,
      purchases: totals.find((item) => item.type === "PURCHASE")?._count._all ?? 0
    }
  };
}

export async function getAdminJobsData(input: {
  status?: "all" | "completed" | "failed";
  tool?: string;
  user?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const status = input.status || "all";
  const page = normalizeAdminPage(input.page);
  const pageSize = normalizeAdminPageSize(input.pageSize);
  const user = input.user?.trim();
  const tool = input.tool?.trim();
  const where = {
    deletedAt: null,
    ...(status === "completed" ? { status: "COMPLETED" as const } : {}),
    ...(status === "failed" ? { status: "FAILED" as const } : {}),
    ...(tool ? { tool: { slug: tool } } : {}),
    ...(user ? { user: { email: { contains: user, mode: "insensitive" as const } } } : {})
  };

  const [items, total] = await Promise.all([
    prisma.aiJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: getSkip(page, pageSize),
      take: pageSize,
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
    }),
    prisma.aiJob.count({ where })
  ]);

  return {
    items,
    pagination: createPagination({ page, pageSize, total })
  };
}

export async function getAdminLogsData(input: { page?: number; pageSize?: number } = {}) {
  const page = normalizeAdminPage(input.page);
  const pageSize = normalizeAdminPageSize(input.pageSize);

  const [items, total] = await Promise.all([
    prisma.adminLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: getSkip(page, pageSize),
      take: pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadataJson: true,
        createdAt: true,
        adminUser: { select: { email: true } }
      }
    }),
    prisma.adminLog.count()
  ]);

  return {
    items,
    pagination: createPagination({ page, pageSize, total })
  };
}

export async function getAdminPaymentsData(input: { page?: number; pageSize?: number } = {}) {
  const page = normalizeAdminPage(input.page);
  const pageSize = normalizeAdminPageSize(input.pageSize);

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      skip: getSkip(page, pageSize),
      take: pageSize,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        stripeCheckoutSessionId: true,
        stripePaymentIntentId: true,
        creditsDelivered: true,
        couponCode: true,
        createdAt: true,
        user: { select: { email: true } }
      }
    }),
    prisma.payment.count({ where: { deletedAt: null } })
  ]);

  return {
    items,
    pagination: createPagination({ page, pageSize, total })
  };
}

export async function getAdminAnalyticsData() {
  const [completedJobs, failedJobs, creditsUsed, providerSplit, toolUsage, tools] = await Promise.all([
    prisma.aiJob.count({ where: { deletedAt: null, status: "COMPLETED" } }),
    prisma.aiJob.count({ where: { deletedAt: null, status: "FAILED" } }),
    prisma.creditTransaction.aggregate({ where: { type: "USE" }, _sum: { amount: true } }),
    prisma.aiJob.groupBy({
      by: ["providerKey"],
      where: { deletedAt: null },
      _count: { _all: true }
    }),
    prisma.aiJob.groupBy({
      by: ["toolId"],
      where: { deletedAt: null },
      _count: { _all: true }
    }),
    prisma.aiTool.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true, creditCost: true, providerKey: true, status: true }
    })
  ]);

  const toolNameById = new Map(tools.map((tool) => [tool.id, tool]));
  const topTools = toolUsage
    .map((item) => ({
      ...item,
      tool: toolNameById.get(item.toolId)
    }))
    .filter((item) => item.tool && item._count._all > 0)
    .sort((a, b) => b._count._all - a._count._all);
  const totalTerminalJobs = completedJobs + failedJobs;

  return {
    completedJobs,
    failedJobs,
    failureRate: totalTerminalJobs ? Math.round((failedJobs / totalTerminalJobs) * 100) : 0,
    creditsUsed: Math.abs(creditsUsed._sum.amount ?? 0),
    providerSplit,
    topTools
  };
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

  return sortLaunchToolsFirst(tools);
}

function getFallbackPackages() {
  return creditPackages.map((pack, index) => ({
    id: String(pack.key),
    name: pack.name,
    credits: pack.credits + pack.bonusCredits,
    price: { toString: () => String(pack.price) },
    currency: pack.currency.toLowerCase(),
    stripePriceId: pack.paymentProviderPriceIds.stripe ?? null,
    status: "ACTIVE" as "ACTIVE" | "INACTIVE" | "SUSPENDED",
    sortOrder: index,
    featureFlagKey: pack.featureFlagKey as string | null,
    updatedAt: new Date()
  }));
}

function sortLaunchToolsFirst<T extends { slug: string; status?: string }>(tools: T[]) {
  const rank = new Map<string, number>(LAUNCH_TOOL_SLUGS.map((slug, index) => [slug, index]));
  return [...tools].sort((a, b) => {
    const aRank = rank.get(a.slug) ?? 999;
    const bRank = rank.get(b.slug) ?? 999;
    if (aRank !== bRank) return aRank - bRank;
    return a.slug.localeCompare(b.slug);
  });
}

function dedupeCreditPackages<T extends { name: string; status?: string; sortOrder?: number; id: string }>(packages: T[]) {
  const byName = new Map<string, T>();

  for (const pack of packages) {
    const key = pack.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, pack);
      continue;
    }

    const existingActive = existing.status === "ACTIVE";
    const packActive = pack.status === "ACTIVE";
    if ((packActive && !existingActive) || ((pack.sortOrder ?? 999) < (existing.sortOrder ?? 999))) {
      byName.set(key, pack);
    }
  }

  return Array.from(byName.values()).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

export function normalizeAdminPage(value: unknown) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizeAdminPageSize(value: unknown) {
  const pageSize = Number(value || ADMIN_PAGE_SIZE);
  if (!Number.isInteger(pageSize) || pageSize <= 0) return ADMIN_PAGE_SIZE;
  return Math.min(pageSize, 100);
}

function getSkip(page: number, pageSize: number) {
  return (page - 1) * pageSize;
}

function createPagination(input: { page: number; pageSize: number; total: number }): AdminPagination {
  const totalPages = Math.max(1, Math.ceil(input.total / input.pageSize));
  const page = Math.min(input.page, totalPages);
  const from = input.total === 0 ? 0 : (page - 1) * input.pageSize + 1;
  const to = Math.min(input.total, page * input.pageSize);

  return {
    page,
    pageSize: input.pageSize,
    total: input.total,
    totalPages,
    from,
    to,
    hasPrevious: page > 1,
    hasNext: page < totalPages
  };
}
