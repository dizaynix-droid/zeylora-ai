import { prisma } from "@/lib/db";
import { creditPackages } from "@/config/pricing";
import { ensureLaunchCreditPackageDefaults } from "@/lib/pricing/packages";
import { adminPerfNow, logAdminPerf, measureAdminQuery } from "@/lib/admin/perf";

const ADMIN_PAGE_SIZE = 25;
const ADMIN_OVERVIEW_CACHE_TTL_MS = 15_000;
const ADMIN_ANALYTICS_CACHE_TTL_MS = 30_000;

let adminOverviewCache: AdminCacheEntry<AdminOverviewData> | null = null;
let adminAnalyticsCache: AdminCacheEntry<AdminAnalyticsData> | null = null;

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
  const cached = getAdminCache(adminOverviewCache);
  if (cached) {
    logAdminPerf("admin.overview.data", {
      duration: "0ms",
      cacheHit: true,
      resultCount: cached.recentJobs.length
    });
    return cached;
  }

  const result = await buildAdminOverviewData();
  adminOverviewCache = createAdminCacheEntry(result, ADMIN_OVERVIEW_CACHE_TTL_MS);
  return result;
}

async function buildAdminOverviewData() {
  const startedAt = adminPerfNow();
  const cardsStartedAt = adminPerfNow();
  const cardsPromise = Promise.all([
    measureAdminQuery("overview.cards.users.count", prisma.user.count({ where: { deletedAt: null } })),
    measureAdminQuery(
      "overview.cards.jobs.statusGroup",
      prisma.aiJob.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { _all: true }
      })
    ),
    measureAdminQuery(
      "overview.cards.credits.used",
      prisma.creditTransaction.aggregate({
        where: { type: "USE" },
        _sum: { amount: true }
      })
    )
  ]).then(([totalUsers, jobStatusCounts, creditsUsed]) => {
    const completedJobs = getStatusCount(jobStatusCounts, "COMPLETED");
    const failedJobs = getStatusCount(jobStatusCounts, "FAILED");
    const totalJobs = jobStatusCounts.reduce((sum, item) => sum + item._count._all, 0);

    logAdminPerf("overview.cards", {
      duration: `${adminPerfNow() - cardsStartedAt}ms`,
      queryCount: 3,
      statusBuckets: jobStatusCounts.length
    });

    return {
      totalUsers,
      totalJobs,
      completedJobs,
      failedJobs,
      creditsUsed
    };
  });
  const recentJobsPromise = measureAdminQuery(
    "overview.recentJobs",
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
    }),
    { take: 10 }
  );

  const [{ totalUsers, totalJobs, completedJobs, failedJobs, creditsUsed }, recentJobs] = await Promise.all([
    cardsPromise,
    recentJobsPromise
  ]);
  logAdminPerf("admin.overview.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: 4,
    cacheHit: false,
    resultCount: recentJobs.length
  });

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

type AdminOverviewData = Awaited<ReturnType<typeof buildAdminOverviewData>>;

export async function getAdminUsersData(input: {
  query?: string;
  filter?: "all" | "with-credits" | "with-jobs" | "recent";
  page?: number;
  pageSize?: number;
} = {}) {
  const startedAt = adminPerfNow();
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
    measureAdminQuery(
      "users.list",
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
      { page, take: pageSize, filter, hasQuery: Boolean(query) }
    ),
    measureAdminQuery("users.count", prisma.user.count({ where }), { filter, hasQuery: Boolean(query) })
  ]);
  logAdminPerf("admin.users.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: 2,
    page,
    take: pageSize,
    filter,
    hasQuery: Boolean(query),
    resultCount: items.length,
    total
  });

  return {
    items,
    pagination: createPagination({ page, pageSize, total })
  };
}

export async function getAdminToolsData() {
  const startedAt = adminPerfNow();
  const dbTools = await measureAdminQuery(
    "tools.list",
    prisma.aiTool.findMany({
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
    })
  );
  const tools = sortLaunchToolsFirst(dbTools.length ? dbTools : await getToolEconomics());
  logAdminPerf("admin.tools.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: dbTools.length ? 1 : 2,
    resultCount: tools.length,
    source: dbTools.length ? "db" : "fallback"
  });

  return tools;
}

export async function getAdminPricingData() {
  const startedAt = adminPerfNow();
  await ensureLaunchCreditPackageDefaults();
  const packages = await measureAdminQuery(
    "pricing.packages.list",
    prisma.creditPackage.findMany({
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
    })
  );
  const result = dedupeCreditPackages(packages.length ? packages : getFallbackPackages());
  logAdminPerf("admin.pricing.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: 1,
    resultCount: result.length,
    source: packages.length ? "db" : "fallback"
  });

  return result;
}

export async function getAdminCreditsData(input: { page?: number; pageSize?: number } = {}) {
  const startedAt = adminPerfNow();
  const page = normalizeAdminPage(input.page);
  const pageSize = normalizeAdminPageSize(input.pageSize);

  const [transactions, totalTransactions, totals] = await Promise.all([
    measureAdminQuery(
      "credits.transactions.list",
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
      { page, take: pageSize }
    ),
    measureAdminQuery("credits.transactions.count", prisma.creditTransaction.count()),
    measureAdminQuery(
      "credits.transactions.totals",
      prisma.creditTransaction.groupBy({
        by: ["type"],
        _sum: { amount: true },
        _count: { _all: true }
      })
    )
  ]);
  logAdminPerf("admin.credits.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: 3,
    page,
    take: pageSize,
    resultCount: transactions.length,
    total: totalTransactions
  });

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
  const startedAt = adminPerfNow();
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
    measureAdminQuery(
      "jobs.list",
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
      { page, take: pageSize, status, hasTool: Boolean(tool), hasUser: Boolean(user) }
    ),
    measureAdminQuery("jobs.count", prisma.aiJob.count({ where }), { status, hasTool: Boolean(tool), hasUser: Boolean(user) })
  ]);
  logAdminPerf("admin.jobs.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: 2,
    page,
    take: pageSize,
    status,
    hasTool: Boolean(tool),
    hasUser: Boolean(user),
    resultCount: items.length,
    total
  });

  return {
    items,
    pagination: createPagination({ page, pageSize, total })
  };
}

export async function getAdminLogsData(input: { page?: number; pageSize?: number } = {}) {
  const startedAt = adminPerfNow();
  const page = normalizeAdminPage(input.page);
  const pageSize = normalizeAdminPageSize(input.pageSize);

  const [items, total] = await Promise.all([
    measureAdminQuery(
      "logs.list",
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
      { page, take: pageSize }
    ),
    measureAdminQuery("logs.count", prisma.adminLog.count())
  ]);
  logAdminPerf("admin.logs.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: 2,
    page,
    take: pageSize,
    resultCount: items.length,
    total
  });

  return {
    items,
    pagination: createPagination({ page, pageSize, total })
  };
}

export async function getAdminPaymentsData(input: { page?: number; pageSize?: number } = {}) {
  const startedAt = adminPerfNow();
  const page = normalizeAdminPage(input.page);
  const pageSize = normalizeAdminPageSize(input.pageSize);

  const [items, total] = await Promise.all([
    measureAdminQuery(
      "payments.list",
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
      { page, take: pageSize }
    ),
    measureAdminQuery("payments.count", prisma.payment.count({ where: { deletedAt: null } }))
  ]);
  logAdminPerf("admin.payments.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: 2,
    page,
    take: pageSize,
    resultCount: items.length,
    total
  });

  return {
    items,
    pagination: createPagination({ page, pageSize, total })
  };
}

export async function getAdminAnalyticsData() {
  const cached = getAdminCache(adminAnalyticsCache);
  if (cached) {
    logAdminPerf("admin.analytics.data", {
      duration: "0ms",
      cacheHit: true,
      resultCount: cached.topTools.length,
      providerCount: cached.providerSplit.length
    });
    return cached;
  }

  const result = await buildAdminAnalyticsData();
  adminAnalyticsCache = createAdminCacheEntry(result, ADMIN_ANALYTICS_CACHE_TTL_MS);
  return result;
}

async function buildAdminAnalyticsData() {
  const startedAt = adminPerfNow();
  const failureRateStartedAt = adminPerfNow();
  const failureRatePromise = measureAdminQuery(
    "analytics.failureRate.statusGroup",
    prisma.aiJob.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true }
    })
  ).then((jobStatusCounts) => {
    const completedJobs = getStatusCount(jobStatusCounts, "COMPLETED");
    const failedJobs = getStatusCount(jobStatusCounts, "FAILED");
    const totalTerminalJobs = completedJobs + failedJobs;

    logAdminPerf("analytics.failureRate", {
      duration: `${adminPerfNow() - failureRateStartedAt}ms`,
      statusBuckets: jobStatusCounts.length
    });

    return {
      completedJobs,
      failedJobs,
      failureRate: totalTerminalJobs ? Math.round((failedJobs / totalTerminalJobs) * 100) : 0
    };
  });
  const creditsUsedPromise = measureAdminQuery(
    "analytics.credits.used",
    prisma.creditTransaction.aggregate({ where: { type: "USE" }, _sum: { amount: true } })
  );
  const providerSplitStartedAt = adminPerfNow();
  const providerSplitPromise = measureAdminQuery(
    "analytics.providerSplit",
    prisma.aiJob.groupBy({
      by: ["providerKey"],
      where: { deletedAt: null },
      _count: { _all: true }
    })
  ).then((providerSplit) => {
    logAdminPerf("analytics.providerSplit.total", {
      duration: `${adminPerfNow() - providerSplitStartedAt}ms`,
      resultCount: providerSplit.length
    });
    return providerSplit;
  });
  const topToolsStartedAt = adminPerfNow();
  const topToolsPromise = Promise.all([
    measureAdminQuery(
      "analytics.topTools.usage",
      prisma.aiJob.groupBy({
        by: ["toolId"],
        where: { deletedAt: null },
        _count: { _all: true },
        orderBy: { _count: { toolId: "desc" } },
        take: 5
      }),
      { take: 5 }
    ),
    measureAdminQuery(
      "analytics.topTools.tools",
      prisma.aiTool.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true, creditCost: true, providerKey: true, status: true }
      })
    )
  ]).then(([toolUsage, tools]) => {
    const toolNameById = new Map(tools.map((tool) => [tool.id, tool]));
    const topTools = toolUsage
      .map((item) => ({
        ...item,
        tool: toolNameById.get(item.toolId)
      }))
      .filter((item) => item.tool && item._count._all > 0);

    logAdminPerf("analytics.topTools", {
      duration: `${adminPerfNow() - topToolsStartedAt}ms`,
      queryCount: 2,
      resultCount: topTools.length
    });

    return topTools;
  });

  const [{ completedJobs, failedJobs, failureRate }, creditsUsed, providerSplit, topTools] = await Promise.all([
    failureRatePromise,
    creditsUsedPromise,
    providerSplitPromise,
    topToolsPromise
  ]);

  logAdminPerf("admin.analytics.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: 5,
    cacheHit: false,
    resultCount: topTools.length,
    providerCount: providerSplit.length
  });

  return {
    completedJobs,
    failedJobs,
    failureRate,
    creditsUsed: Math.abs(creditsUsed._sum.amount ?? 0),
    providerSplit,
    topTools
  };
}

type AdminAnalyticsData = Awaited<ReturnType<typeof buildAdminAnalyticsData>>;

export async function getToolEconomics() {
  const tools = await measureAdminQuery(
    "toolEconomics.list",
    prisma.aiTool.findMany({
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
    })
  );

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

type AdminCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

function getAdminCache<T>(entry: AdminCacheEntry<T> | null) {
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.value;
}

function createAdminCacheEntry<T>(value: T, ttlMs: number): AdminCacheEntry<T> {
  return {
    expiresAt: Date.now() + ttlMs,
    value
  };
}

function getStatusCount<T extends { status: string; _count: { _all: number } }>(items: T[], status: string) {
  return items.find((item) => item.status === status)?._count._all ?? 0;
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
