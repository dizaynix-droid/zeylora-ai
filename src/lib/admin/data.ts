import { prisma } from "@/lib/db";
import { creditPackages } from "@/config/pricing";
import { adminPerfNow, logAdminPerf, measureAdminQuery } from "@/lib/admin/perf";
import type { ExpenseCategory, Prisma } from "@prisma/client";

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
        estimatedCostPerRun: true,
        estimatedCostCurrency: true,
        estimatedCostProvider: true,
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
  const packages = await measureAdminQuery(
    "pricing.packages.list",
    prisma.creditPackage.findMany({
      where: { deletedAt: null },
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
        highlight: true,
        updatedAt: true
      }
    })
  );
  const sourcePackages: AdminCreditPackageRow[] = packages.length ? packages : getFallbackPackages();
  const result = dedupeCreditPackages(sourcePackages);
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

export type AdminReportRangeKey = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";
export type AdminReportGrouping = "daily" | "weekly" | "monthly";

const EXPENSE_CATEGORIES = ["ADS", "SEO", "PROVIDER", "SOFTWARE", "DESIGN", "DOMAIN", "HOSTING", "OTHER"] as const;

export async function getAdminReportsData(input: {
  range?: string;
  group?: string;
  from?: string;
  to?: string;
  expenseCategory?: string;
} = {}) {
  const startedAt = adminPerfNow();
  const range = normalizeReportRange(input.range);
  const grouping = normalizeReportGrouping(input.group);
  const dateRange = getReportDateRange(range, input.from, input.to);
  const expenseCategory = normalizeExpenseCategory(input.expenseCategory);
  const paymentWhere: Prisma.PaymentWhereInput = {
    deletedAt: null,
    createdAt: { gte: dateRange.start, lte: dateRange.end }
  };
  const paidPaymentWhere: Prisma.PaymentWhereInput = {
    ...paymentWhere,
    status: "PAID"
  };
  const refundedPaymentWhere: Prisma.PaymentWhereInput = {
    ...paymentWhere,
    status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] }
  };
  const completedJobWhere: Prisma.AiJobWhereInput = {
    deletedAt: null,
    status: "COMPLETED",
    createdAt: { gte: dateRange.start, lte: dateRange.end }
  };
  const failedJobWhere: Prisma.AiJobWhereInput = {
    deletedAt: null,
    status: "FAILED",
    createdAt: { gte: dateRange.start, lte: dateRange.end }
  };
  const creditWhere: Prisma.CreditTransactionWhereInput = {
    createdAt: { gte: dateRange.start, lte: dateRange.end }
  };
  const expenseWhere: Prisma.BusinessExpenseWhereInput = {
    deletedAt: null,
    expenseDate: { gte: dateRange.start, lte: dateRange.end },
    ...(expenseCategory ? { category: expenseCategory } : {})
  };

  const [
    paidPayments,
    paidPaymentAggregate,
    refundAggregate,
    creditUsage,
    completedJobs,
    failedJobs,
    expenses,
    topPaymentUsers
  ] = await Promise.all([
    measureAdminQuery(
      "reports.payments.paid.list",
      prisma.payment.findMany({
        where: paidPaymentWhere,
        orderBy: { createdAt: "desc" },
        take: 500,
        select: {
          id: true,
          amount: true,
          creditsDelivered: true,
          rawEventJson: true,
          createdAt: true,
          userId: true,
          user: { select: { email: true } }
        }
      }),
      { range, grouping }
    ),
    measureAdminQuery(
      "reports.payments.paid.aggregate",
      prisma.payment.aggregate({
        where: paidPaymentWhere,
        _sum: { amount: true, creditsDelivered: true },
        _count: { _all: true }
      }),
      { range }
    ),
    measureAdminQuery(
      "reports.payments.refunds.aggregate",
      prisma.payment.aggregate({
        where: refundedPaymentWhere,
        _sum: { amount: true },
        _count: { _all: true }
      }),
      { range }
    ),
    measureAdminQuery(
      "reports.credits.used.aggregate",
      prisma.creditTransaction.aggregate({
        where: { ...creditWhere, type: "USE" },
        _sum: { amount: true },
        _count: { _all: true }
      }),
      { range }
    ),
    measureAdminQuery(
      "reports.jobs.completed",
      prisma.aiJob.findMany({
        where: completedJobWhere,
        orderBy: { createdAt: "desc" },
        take: 1000,
        select: {
          id: true,
          providerKey: true,
          createdAt: true,
          tool: {
            select: {
              id: true,
              name: true,
              slug: true,
              creditCost: true,
              estimatedCostPerRun: true,
              estimatedCostCurrency: true,
              estimatedCostProvider: true
            }
          }
        }
      }),
      { range }
    ),
    measureAdminQuery(
      "reports.jobs.failed",
      prisma.aiJob.findMany({
        where: failedJobWhere,
        orderBy: { createdAt: "desc" },
        take: 500,
        select: {
          id: true,
          providerKey: true,
          createdAt: true,
          errorMessage: true,
          tool: { select: { name: true, slug: true } }
        }
      }),
      { range }
    ),
    measureAdminQuery(
      "reports.expenses.list",
      prisma.businessExpense.findMany({
        where: expenseWhere,
        orderBy: { expenseDate: "desc" },
        take: 100,
        select: {
          id: true,
          title: true,
          category: true,
          amount: true,
          currency: true,
          expenseDate: true,
          note: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { select: { email: true } }
        }
      }),
      { range, category: expenseCategory || "all" }
    ),
    measureAdminQuery(
      "reports.payments.topUsers",
      prisma.payment.groupBy({
        by: ["userId"],
        where: paidPaymentWhere,
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5
      }),
      { range, take: 5 }
    )
  ]);

  const topUserIds = topPaymentUsers.map((item) => item.userId).filter(Boolean) as string[];
  const topUsers = topUserIds.length
    ? await measureAdminQuery(
        "reports.payments.topUsers.users",
        prisma.user.findMany({
          where: { id: { in: topUserIds } },
          select: { id: true, email: true, name: true }
        }),
        { resultCount: topUserIds.length }
      )
    : [];
  const userById = new Map(topUsers.map((user) => [user.id, user]));

  const revenue = decimalToNumber(paidPaymentAggregate._sum.amount);
  const creditsSold = paidPaymentAggregate._sum.creditsDelivered ?? 0;
  const creditsUsed = Math.abs(creditUsage._sum.amount ?? 0);
  const providerCost = completedJobs.reduce((sum, job) => sum + decimalToNumber(job.tool?.estimatedCostPerRun), 0);
  const manualExpenses = expenses.reduce((sum, expense) => sum + decimalToNumber(expense.amount), 0);
  const refundAmount = decimalToNumber(refundAggregate._sum.amount);
  const grossProfit = revenue - providerCost;
  const netProfit = grossProfit - manualExpenses;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : null;
  const costPerCleanExport = creditUsage._count._all > 0 ? providerCost / creditUsage._count._all : null;
  const missingCostTools = Array.from(
    new Map(
      completedJobs
        .filter((job) => !job.tool?.estimatedCostPerRun || decimalToNumber(job.tool.estimatedCostPerRun) <= 0)
        .map((job) => [job.tool?.slug || "unknown", job.tool?.name || "Bilinmeyen araç"])
    ).entries()
  ).map(([slug, name]) => ({ slug, name }));

  const series = buildReportSeries({
    grouping,
    paidPayments,
    expenses,
    completedJobs
  });
  const toolUsage = buildToolUsageReport(completedJobs);
  const packageRevenue = buildPackageRevenueReport(paidPayments);
  const failedByTool = buildFailedJobsReport(failedJobs);

  logAdminPerf("admin.reports.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: topUserIds.length ? 9 : 8,
    range,
    grouping,
    completedJobs: completedJobs.length,
    failedJobs: failedJobs.length,
    expenses: expenses.length,
    payments: paidPayments.length
  });

  return {
    range,
    grouping,
    start: dateRange.start,
    end: dateRange.end,
    expenseCategory,
    summary: {
      revenue,
      paymentCount: paidPaymentAggregate._count._all,
      creditsSold,
      creditsUsed,
      providerCost,
      manualExpenses,
      grossProfit,
      netProfit,
      profitMargin,
      refundAmount,
      refundCount: refundAggregate._count._all,
      failedJobCount: failedJobs.length,
      costPerCleanExport,
      missingCostTools
    },
    series,
    toolUsage,
    packageRevenue,
    topUsers: topPaymentUsers.map((item) => ({
      userId: item.userId,
      email: userById.get(item.userId)?.email || "Bilinmeyen kullanıcı",
      name: userById.get(item.userId)?.name,
      paymentCount: item._count._all,
      amount: decimalToNumber(item._sum.amount)
    })),
    failedByTool,
    expenses
  };
}

export type AdminReportsData = Awaited<ReturnType<typeof getAdminReportsData>>;

export const expenseCategoryLabels: Record<(typeof EXPENSE_CATEGORIES)[number], string> = {
  ADS: "Reklam",
  SEO: "SEO",
  PROVIDER: "Sağlayıcı",
  SOFTWARE: "Yazılım",
  DESIGN: "Tasarım",
  DOMAIN: "Domain",
  HOSTING: "Hosting",
  OTHER: "Diğer"
};

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
        estimatedCostPerRun: true,
        estimatedCostCurrency: true,
        estimatedCostProvider: true,
        updatedAt: true,
        _count: { select: { jobs: true } }
      }
    })
  );

  return sortLaunchToolsFirst(tools);
}

type AdminCreditPackageRow = {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  price: unknown;
  currency: string;
  stripePriceId: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  sortOrder: number;
  featureFlagKey: string | null;
  description: string | null;
  audience: string | null;
  badgeText: string | null;
  highlight: boolean;
  updatedAt: Date;
};

function getFallbackPackages(): AdminCreditPackageRow[] {
  return creditPackages.map((pack, index) => ({
    id: String(pack.key),
    name: pack.name,
    credits: pack.credits,
    bonusCredits: pack.bonusCredits,
    price: { toString: () => String(pack.price) },
    currency: pack.currency.toLowerCase(),
    stripePriceId: pack.paymentProviderPriceIds.stripe ?? null,
    status: "ACTIVE" as "ACTIVE" | "INACTIVE" | "SUSPENDED",
    sortOrder: index,
    featureFlagKey: pack.featureFlagKey as string | null,
    description: pack.description,
    audience: pack.audience,
    badgeText: pack.badgeText ?? null,
    highlight: pack.highlight,
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

function normalizeReportRange(value: unknown): AdminReportRangeKey {
  const range = String(value || "last30");
  if (["today", "yesterday", "last7", "last30", "thisMonth", "lastMonth", "custom"].includes(range)) {
    return range as AdminReportRangeKey;
  }
  return "last30";
}

function normalizeReportGrouping(value: unknown): AdminReportGrouping {
  const grouping = String(value || "daily");
  if (["daily", "weekly", "monthly"].includes(grouping)) return grouping as AdminReportGrouping;
  return "daily";
}

function normalizeExpenseCategory(value: unknown): ExpenseCategory | undefined {
  const category = String(value || "").toUpperCase();
  if (EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number])) {
    return category as ExpenseCategory;
  }
  return undefined;
}

function getReportDateRange(range: AdminReportRangeKey, from?: string, to?: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (range === "custom") {
    const start = from ? startOfDay(new Date(from)) : new Date(todayStart.getTime() - 29 * 86_400_000);
    const end = to ? endOfDay(new Date(to)) : todayEnd;
    return { start, end };
  }

  if (range === "today") return { start: todayStart, end: todayEnd };
  if (range === "yesterday") {
    const yesterday = new Date(todayStart.getTime() - 86_400_000);
    return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
  }
  if (range === "last7") return { start: startOfDay(new Date(todayStart.getTime() - 6 * 86_400_000)), end: todayEnd };
  if (range === "thisMonth") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: todayEnd };
  if (range === "lastMonth") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
    return { start, end };
  }
  return { start: startOfDay(new Date(todayStart.getTime() - 29 * 86_400_000)), end: todayEnd };
}

function buildReportSeries(input: {
  grouping: AdminReportGrouping;
  paidPayments: Array<{ amount: unknown; createdAt: Date }>;
  expenses: Array<{ amount: unknown; expenseDate: Date }>;
  completedJobs: Array<{ createdAt: Date; tool: { estimatedCostPerRun: unknown } | null }>;
}) {
  const buckets = new Map<string, { period: string; revenue: number; providerCost: number; expenses: number; netProfit: number }>();
  const ensureBucket = (date: Date) => {
    const period = getBucketKey(date, input.grouping);
    const existing = buckets.get(period) || { period, revenue: 0, providerCost: 0, expenses: 0, netProfit: 0 };
    buckets.set(period, existing);
    return existing;
  };

  for (const payment of input.paidPayments) ensureBucket(payment.createdAt).revenue += decimalToNumber(payment.amount);
  for (const expense of input.expenses) ensureBucket(expense.expenseDate).expenses += decimalToNumber(expense.amount);
  for (const job of input.completedJobs) ensureBucket(job.createdAt).providerCost += decimalToNumber(job.tool?.estimatedCostPerRun);

  return Array.from(buckets.values())
    .map((bucket) => ({ ...bucket, netProfit: bucket.revenue - bucket.providerCost - bucket.expenses }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function buildToolUsageReport(
  completedJobs: Array<{
    providerKey: string | null;
    tool: {
      name: string;
      slug: string;
      creditCost: number;
      estimatedCostPerRun: unknown;
      estimatedCostProvider: string | null;
    } | null;
  }>
) {
  const byTool = new Map<
    string,
    { slug: string; name: string; provider: string; runs: number; credits: number; estimatedCost: number; missingCost: boolean }
  >();

  for (const job of completedJobs) {
    const slug = job.tool?.slug || "unknown";
    const existing =
      byTool.get(slug) ||
      {
        slug,
        name: job.tool?.name || "Bilinmeyen araç",
        provider: job.tool?.estimatedCostProvider || job.providerKey || "-",
        runs: 0,
        credits: 0,
        estimatedCost: 0,
        missingCost: false
      };
    const cost = decimalToNumber(job.tool?.estimatedCostPerRun);
    existing.runs += 1;
    existing.credits += job.tool?.creditCost || 0;
    existing.estimatedCost += cost;
    existing.missingCost ||= cost <= 0;
    byTool.set(slug, existing);
  }

  return Array.from(byTool.values()).sort((a, b) => b.runs - a.runs);
}

function buildPackageRevenueReport(payments: Array<{ amount: unknown; creditsDelivered: number; rawEventJson: unknown }>) {
  const byPackage = new Map<string, { packageName: string; payments: number; revenue: number; credits: number }>();

  for (const payment of payments) {
    const metadata = parsePaymentMetadata(payment.rawEventJson);
    const packageName = metadata.packageName || metadata.packageId || "Bilinmeyen paket";
    const existing = byPackage.get(packageName) || { packageName, payments: 0, revenue: 0, credits: 0 };
    existing.payments += 1;
    existing.revenue += decimalToNumber(payment.amount);
    existing.credits += payment.creditsDelivered || 0;
    byPackage.set(packageName, existing);
  }

  return Array.from(byPackage.values()).sort((a, b) => b.revenue - a.revenue);
}

function buildFailedJobsReport(
  failedJobs: Array<{ providerKey: string | null; tool: { name: string; slug: string } | null; errorMessage: string | null }>
) {
  const byKey = new Map<string, { tool: string; provider: string; count: number; lastError: string | null }>();

  for (const job of failedJobs) {
    const tool = job.tool?.name || "Bilinmeyen araç";
    const provider = job.providerKey || "-";
    const key = `${tool}:${provider}`;
    const existing = byKey.get(key) || { tool, provider, count: 0, lastError: null };
    existing.count += 1;
    existing.lastError = job.errorMessage || existing.lastError;
    byKey.set(key, existing);
  }

  return Array.from(byKey.values()).sort((a, b) => b.count - a.count);
}

function parsePaymentMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const objectValue = value as { metadata?: unknown; data?: { object?: { metadata?: unknown } } };
  const metadata = objectValue.metadata || objectValue.data?.object?.metadata;
  if (!metadata || typeof metadata !== "object") return {};
  return metadata as Record<string, string>;
}

function getBucketKey(date: Date, grouping: AdminReportGrouping) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (grouping === "monthly") return `${year}-${month}`;
  if (grouping === "weekly") {
    const weekStart = startOfDay(new Date(date));
    weekStart.setDate(date.getDate() - date.getDay() + 1);
    return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
  }
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function decimalToNumber(value: unknown) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (typeof value === "object" && "toString" in value) return Number(value.toString()) || 0;
  return 0;
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
