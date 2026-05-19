import { prisma } from "@/lib/db";
import { creditPackages } from "@/config/pricing";
import { aiAdCreativeConfig, aiBackgroundReplacerConfig, objectRemoverConfig } from "@/config/ai-tools";
import { resolveToolEconomy } from "@/config/tool-economy";
import { ensureLaunchCreditPackageDefaults } from "@/lib/pricing/packages";
import { adminPerfNow, logAdminPerf, measureAdminQuery } from "@/lib/admin/perf";
import { getOperationalSettings } from "@/lib/settings/operations";
import { getMarketingTrackingSettings } from "@/lib/settings/marketing";
import { getBackupRecoveryData } from "@/lib/admin/backup";
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
  "object-remover",
  "ai-background-replacer",
  "ai-ad-creative-generator",
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
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const yesterdayStart = startOfDay(new Date(todayStart.getTime() - 86_400_000));
  const yesterdayEnd = endOfDay(yesterdayStart);
  const last7Start = startOfDay(new Date(todayStart.getTime() - 6 * 86_400_000));
  const last30Start = startOfDay(new Date(todayStart.getTime() - 29 * 86_400_000));
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const cardsStartedAt = adminPerfNow();

  const overviewPromise = Promise.all([
    measureAdminQuery("overview.users.count", prisma.user.count({ where: { deletedAt: null } })),
    measureAdminQuery(
      "overview.verificationJobs.statusGroup",
      prisma.verificationJob.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { _all: true }
      })
    ),
    measureAdminQuery(
      "overview.payments.today",
      prisma.payment.aggregate({
        where: { deletedAt: null, status: "PAID", createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true, creditsDelivered: true },
        _count: { _all: true }
      })
    ),
    measureAdminQuery(
      "overview.payments.yesterday",
      prisma.payment.aggregate({
        where: { deletedAt: null, status: "PAID", createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
        _sum: { amount: true, creditsDelivered: true },
        _count: { _all: true }
      })
    ),
    measureAdminQuery(
      "overview.payments.last7",
      prisma.payment.aggregate({
        where: { deletedAt: null, status: "PAID", createdAt: { gte: last7Start, lte: todayEnd } },
        _sum: { amount: true, creditsDelivered: true },
        _count: { _all: true }
      })
    ),
    measureAdminQuery(
      "overview.payments.last30",
      prisma.payment.aggregate({
        where: { deletedAt: null, status: "PAID", createdAt: { gte: last30Start, lte: todayEnd } },
        _sum: { amount: true, creditsDelivered: true },
        _count: { _all: true }
      })
    ),
    measureAdminQuery(
      "overview.payments.month",
      prisma.payment.aggregate({
        where: { deletedAt: null, status: "PAID", createdAt: { gte: monthStart, lte: todayEnd } },
        _sum: { amount: true, creditsDelivered: true },
        _count: { _all: true }
      })
    ),
    measureAdminQuery(
      "overview.verificationJobs.today",
      prisma.verificationJob.aggregate({
        where: { deletedAt: null, createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { creditsUsed: true, providerCostAtRun: true },
        _count: { _all: true }
      })
    ),
    measureAdminQuery("overview.verificationJobs.failedToday", prisma.verificationJob.count({ where: { deletedAt: null, status: "FAILED", createdAt: { gte: todayStart, lte: todayEnd } } })),
    measureAdminQuery("overview.verificationJobs.pending", prisma.verificationJob.count({ where: { deletedAt: null, status: { in: ["QUEUED", "PROCESSING"] } } })),
    measureAdminQuery("overview.tickets.open", prisma.ticket.count({ where: { deletedAt: null, status: "OPEN" } })),
    getAdminProvidersData(),
    getOperationalSettings()
  ]).then(([totalUsers, jobStatusCounts, todayPayments, yesterdayPayments, last7Payments, last30Payments, monthPayments, todayJobs, failedJobsToday, pendingJobs, openTickets, providers, operations]) => {
    const completedJobs = getStatusCount(jobStatusCounts, "COMPLETED");
    const failedJobs = getStatusCount(jobStatusCounts, "FAILED");
    const totalJobs = jobStatusCounts.reduce((sum, item) => sum + item._count._all, 0);
    const paymentSummary = (aggregate: {
      _sum: { amount: unknown; creditsDelivered: number | null };
      _count: { _all: number };
    }) => {
      const revenue = decimalToNumber(aggregate._sum.amount);
      const creditsSold = aggregate._sum.creditsDelivered ?? 0;
      return {
        revenue,
        paymentCount: aggregate._count._all,
        creditsSold,
        creditsUsed: 0,
        cleanExports: 0,
        providerCost: 0,
        manualExpenses: 0,
        netProfit: revenue
      };
    };
    const today = paymentSummary(todayPayments);
    today.creditsUsed = todayJobs._sum.creditsUsed ?? 0;
    today.cleanExports = todayJobs._count._all;
    today.providerCost = decimalToNumber(todayJobs._sum.providerCostAtRun);
    today.netProfit = today.revenue - today.providerCost;
    const missingActiveCostTargets = providers
      .filter((provider) => provider.status === "ACTIVE" && provider.providerKey === "millionverifier" && !provider.estimatedCostPerRun)
      .map((provider) => ({ name: provider.name, providerName: provider.providerKey }));
    const missingEnvProviders = providers.filter((provider) => provider.status === "ACTIVE" && !provider.configured);

    logAdminPerf("overview.cards", {
      duration: `${adminPerfNow() - cardsStartedAt}ms`,
      queryCount: 11,
      statusBuckets: jobStatusCounts.length,
      pendingJobs
    });

    return {
      totalUsers,
      totalJobs,
      completedJobs,
      failedJobs,
      failedJobsToday,
      pendingJobs,
      openTickets,
      today,
      yesterday: paymentSummary(yesterdayPayments),
      last7: paymentSummary(last7Payments),
      last30: paymentSummary(last30Payments),
      thisMonth: paymentSummary(monthPayments),
      missingActiveCostTargets,
      missingEnvProviders,
      operations
    };
  });
  const recentJobsPromise = measureAdminQuery(
    "overview.recentVerificationJobs",
    prisma.verificationJob.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        originalFilename: true,
        uniqueEmails: true,
        creditsUsed: true,
        creditsReserved: true,
        providerKey: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
        user: { select: { email: true } }
      }
    }),
    { take: 10 }
  );

  const [overview, recentJobs] = await Promise.all([
    overviewPromise,
    recentJobsPromise
  ]);
  logAdminPerf("admin.overview.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: 12,
    cacheHit: false,
    resultCount: recentJobs.length
  });

  return {
    metrics: {
      totalUsers: overview.totalUsers,
      totalJobs: overview.totalJobs,
      completedJobs: overview.completedJobs,
      failedJobs: overview.failedJobs,
      failedJobsToday: overview.failedJobsToday,
      openTickets: overview.openTickets,
      creditsUsed: overview.today.creditsUsed,
      recentExports: overview.today.cleanExports
    },
    cockpit: overview,
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
    ...(filter === "with-jobs" ? { verificationJobs: { some: { deletedAt: null } } } : {}),
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
              verificationJobs: true,
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
  await Promise.all([
    ensureAdminObjectRemoverTool(),
    ensureAdminGenerativeTool({
      slug: aiBackgroundReplacerConfig.slug,
      name: "AI Background Replacer",
      description: "Replace plain product backgrounds with premium studio, marble, skincare, and ecommerce lifestyle scenes.",
      model: aiBackgroundReplacerConfig.model,
      proModel: aiBackgroundReplacerConfig.proModel,
      maxRetries: aiBackgroundReplacerConfig.maxRetries,
      timeoutSeconds: aiBackgroundReplacerConfig.timeoutSeconds
    }),
    ensureAdminGenerativeTool({
      slug: aiAdCreativeConfig.slug,
      name: "AI Ad Creative Generator",
      description: "Generate ecommerce ad creatives for Instagram, Facebook, TikTok Shop, Shopify banners, sales campaigns, and product launches.",
      model: aiAdCreativeConfig.model,
      proModel: aiAdCreativeConfig.proModel,
      maxRetries: aiAdCreativeConfig.maxRetries,
      timeoutSeconds: aiAdCreativeConfig.timeoutSeconds
    })
  ]);
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
        publicName: true,
        internalKey: true,
        qualityTier: true,
        category: true,
        creditCost: true,
        status: true,
        providerKey: true,
        estimatedCostPerRun: true,
        estimatedCostCurrency: true,
        estimatedCostProvider: true,
        featured: true,
        recommended: true,
        displayOrder: true,
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

async function ensureAdminObjectRemoverTool() {
  const economy = resolveToolEconomy({
    toolSlug: objectRemoverConfig.slug,
    qualityMode: "standard",
    providerKey: objectRemoverConfig.providerKey
  });

  await prisma.aiTool.upsert({
    where: {
      slug_version: {
        slug: objectRemoverConfig.slug,
        version: 1
      }
    },
    update: {
      publicName: economy.publicName,
      internalKey: economy.internalKey,
      qualityTier: economy.qualityTier,
      estimatedCostPerRun: economy.estimatedProviderCost,
      estimatedCostCurrency: economy.providerCurrency,
      estimatedCostProvider: economy.providerKey,
      deletedAt: null
    },
    create: {
      slug: objectRemoverConfig.slug,
      version: 1,
      name: "Object Remover",
      publicName: economy.publicName,
      internalKey: economy.internalKey,
      qualityTier: economy.qualityTier,
      category: "Ecommerce",
      description: "Remove unwanted objects, cables, props, stains, dust, and distracting background items from product photos.",
      creditCost: economy.creditCost,
      status: "ACTIVE",
      inputRulesJson: {
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        maxFileSizeMb: 12,
        maxWidth: 6000,
        maxHeight: 6000
      },
      outputType: "image",
      providerKey: economy.providerKey,
      estimatedCostPerRun: economy.estimatedProviderCost,
      estimatedCostCurrency: economy.providerCurrency,
      estimatedCostProvider: economy.providerKey,
      providerConfigJson: {
        model: objectRemoverConfig.model,
        proModel: objectRemoverConfig.proModel,
        inputMode: "prompt",
        outputFormat: "png"
      },
      fallbackProviderKeysJson: [],
      retryPolicyJson: {
        maxRetries: objectRemoverConfig.maxRetries,
        timeoutSeconds: objectRemoverConfig.timeoutSeconds,
        retryDelaySeconds: 8,
        allowFallback: false
      },
      seoTitle: "Object Remover - Product Photo Cleanup",
      seoDescription: "Remove distracting objects, cables, props, stains, and background items from ecommerce product photos.",
      landingContentJson: {
        hero: "Remove unwanted objects from product photos.",
        faqs: []
      },
      exampleImagesJson: [],
      displayOrder: economy.displayOrder
    }
  });
}

async function ensureAdminGenerativeTool(input: {
  slug: string;
  name: string;
  description: string;
  model: string;
  proModel: string;
  maxRetries: number;
  timeoutSeconds: number;
}) {
  const economy = resolveToolEconomy({
    toolSlug: input.slug,
    qualityMode: "standard",
    providerKey: "replicate"
  });

  await prisma.aiTool.upsert({
    where: {
      slug_version: {
        slug: input.slug,
        version: 1
      }
    },
    update: {
      publicName: economy.publicName,
      internalKey: economy.internalKey,
      qualityTier: economy.qualityTier,
      estimatedCostPerRun: economy.estimatedProviderCost,
      estimatedCostCurrency: economy.providerCurrency,
      estimatedCostProvider: economy.providerKey,
      deletedAt: null
    },
    create: {
      slug: input.slug,
      version: 1,
      name: input.name,
      publicName: economy.publicName,
      internalKey: economy.internalKey,
      qualityTier: economy.qualityTier,
      category: "Ecommerce",
      description: input.description,
      creditCost: economy.creditCost,
      status: "ACTIVE",
      inputRulesJson: {
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        maxFileSizeMb: 12,
        maxWidth: 6000,
        maxHeight: 6000
      },
      outputType: "image",
      providerKey: economy.providerKey,
      estimatedCostPerRun: economy.estimatedProviderCost,
      estimatedCostCurrency: economy.providerCurrency,
      estimatedCostProvider: economy.providerKey,
      providerConfigJson: {
        model: input.model,
        proModel: input.proModel,
        inputMode: "image-prompt",
        outputFormat: "png"
      },
      fallbackProviderKeysJson: [],
      retryPolicyJson: {
        maxRetries: input.maxRetries,
        timeoutSeconds: input.timeoutSeconds,
        retryDelaySeconds: 8,
        allowFallback: false
      },
      seoTitle: `${input.name} - Ecommerce AI Tool`,
      seoDescription: input.description,
      landingContentJson: {
        hero: input.description,
        faqs: []
      },
      exampleImagesJson: [],
      displayOrder: economy.displayOrder
    }
  });
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
    queryCount: 2,
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

export async function getAdminPaymentDiagnosticsData() {
  const fallback = {
    stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    checkoutEndpointReady: true,
    webhookEndpointReady: true,
    idempotencyReady: true,
    duplicateSessionRisk: false,
    lastWebhook: null,
    webhookEvents: [],
    lastSuccessfulPayment: null,
    failedPaymentCount: 0,
    diagnosticsError: null as string | null
  };

  try {
    const [lastWebhook, webhookEvents, lastSuccessfulPayment, failedPaymentCount, duplicatePayments] = await Promise.all([
      measureAdminQuery(
        "payments.diagnostics.lastWebhook",
        prisma.webhookLog.findFirst({
          where: { source: "stripe" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            externalEventId: true,
            eventType: true,
            status: true,
            errorMessage: true,
            paymentId: true,
            userId: true,
            createdAt: true,
            processedAt: true
          }
        })
      ),
      measureAdminQuery(
        "payments.diagnostics.webhooks",
        prisma.webhookLog.findMany({
          where: { source: "stripe" },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            externalEventId: true,
            eventType: true,
            status: true,
            errorMessage: true,
            paymentId: true,
            userId: true,
            createdAt: true,
            processedAt: true
          }
        }),
        { take: 10 }
      ),
      measureAdminQuery(
        "payments.diagnostics.lastPaid",
        prisma.payment.findFirst({
          where: { deletedAt: null, status: "PAID" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            amount: true,
            currency: true,
            creditsDelivered: true,
            stripeCheckoutSessionId: true,
            createdAt: true,
            user: { select: { email: true } }
          }
        })
      ),
      measureAdminQuery(
        "payments.diagnostics.failedCount",
        prisma.payment.count({ where: { deletedAt: null, status: { in: ["FAILED", "CANCELLED"] } } })
      ),
      measureAdminQuery(
        "payments.diagnostics.duplicateSessions",
        prisma.payment.groupBy({
          by: ["stripeCheckoutSessionId"],
          where: { stripeCheckoutSessionId: { not: null } },
          _count: { _all: true },
          having: { stripeCheckoutSessionId: { _count: { gt: 1 } } },
          orderBy: { _count: { stripeCheckoutSessionId: "desc" } },
          take: 1
        })
      )
    ]);

    return {
      ...fallback,
      duplicateSessionRisk: duplicatePayments.length > 0,
      lastWebhook,
      webhookEvents,
      lastSuccessfulPayment,
      failedPaymentCount
    };
  } catch (error) {
    console.warn("[admin-payments-diagnostics-fallback]", error instanceof Error ? error.message : error);
    return {
      ...fallback,
      diagnosticsError: error instanceof Error ? error.message : "Payment diagnostics could not be loaded."
    };
  }
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
  const since = startOfDay(new Date(Date.now() - 29 * 86_400_000));
  const todayStart = startOfDay(new Date());
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
  const behaviorPromise = Promise.all([
    measureAdminQuery(
      "analytics.behavior.events",
      prisma.analyticsEvent.groupBy({
        by: ["event"],
        where: { createdAt: { gte: since } },
        _count: { _all: true }
      })
    ),
    measureAdminQuery(
      "analytics.behavior.todayVisitors",
      prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: todayStart } },
        orderBy: { createdAt: "desc" },
        take: 1000,
        select: { sessionId: true, anonymousId: true, userId: true }
      })
    ),
    measureAdminQuery(
      "analytics.behavior.breakdowns",
      prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 300,
        select: {
          event: true,
          sessionId: true,
          anonymousId: true,
          userId: true,
          page: true,
          country: true,
          device: true,
          metadataJson: true,
          createdAt: true
        }
      })
    ),
    measureAdminQuery(
      "analytics.behavior.daily",
      prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 1000,
        select: { event: true, createdAt: true, sessionId: true, anonymousId: true }
      })
    )
  ]).then(([eventGroups, todayVisitors, breakdownRows, dailyRows]) =>
    buildBehaviorAnalytics(eventGroups, todayVisitors, breakdownRows, dailyRows)
  );

  const [{ completedJobs, failedJobs, failureRate }, creditsUsed, providerSplit, topTools, behavior] = await Promise.all([
    failureRatePromise,
    creditsUsedPromise,
    providerSplitPromise,
    topToolsPromise,
    behaviorPromise
  ]);

  logAdminPerf("admin.analytics.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: 9,
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
    topTools,
    behavior
  };
}

function buildBehaviorAnalytics(
  eventGroups: Array<{ event: string; _count: { _all: number } }>,
  todayVisitors: Array<{ sessionId: string | null; anonymousId: string | null; userId: string | null }>,
  breakdownRows: Array<{
    event: string;
    sessionId: string | null;
    anonymousId: string | null;
    userId: string | null;
    page: string | null;
    country: string | null;
    device: string | null;
    metadataJson: Prisma.JsonValue | null;
    createdAt: Date;
  }>,
  dailyRows: Array<{ event: string; createdAt: Date; sessionId: string | null; anonymousId: string | null }>
) {
  const eventCounts = new Map(eventGroups.map((row) => [row.event, row._count._all]));
  const visitorKey = (row: { sessionId: string | null; anonymousId: string | null; userId: string | null }) =>
    row.userId || row.sessionId || row.anonymousId || "unknown";
  const dailyVisitors = new Set(todayVisitors.map(visitorKey)).size;
  const funnelSteps = [
    { key: "landing_view", label: "Landing" },
    { key: "upload_click", label: "Upload intent" },
    { key: "auth_required", label: "Login wall" },
    { key: "signup_completed", label: "Signup" },
    { key: "trial_pack_view", label: "Trial pack" },
    { key: "checkout_started", label: "Checkout" },
    { key: "checkout_completed", label: "Payment" },
    { key: "first_clean_export", label: "First export" }
  ].map((step, index, steps) => {
    const count = eventCounts.get(step.key) ?? 0;
    const previousCount = index === 0 ? count : eventCounts.get(steps[index - 1].key) ?? 0;
    return {
      ...step,
      count,
      conversionFromPrevious: index === 0 || previousCount === 0 ? 100 : Math.round((count / previousCount) * 100)
    };
  });

  return {
    dailyVisitors,
    uploads: eventCounts.get("upload_click") ?? eventCounts.get("upload_started") ?? 0,
    previews: eventCounts.get("preview_generated") ?? 0,
    checkoutStarts: eventCounts.get("checkout_started") ?? 0,
    payments: eventCounts.get("checkout_completed") ?? 0,
    landingToUploadRate: percent(eventCounts.get("upload_click") ?? eventCounts.get("upload_started") ?? 0, eventCounts.get("landing_view") ?? 0),
    uploadToPreviewRate: percent(eventCounts.get("preview_generated") ?? 0, eventCounts.get("upload_click") ?? eventCounts.get("upload_started") ?? 0),
    checkoutToPaymentRate: percent(eventCounts.get("checkout_completed") ?? 0, eventCounts.get("checkout_started") ?? 0),
    funnelSteps,
    topCountries: topBreakdown(breakdownRows.map((row) => row.country || "unknown")),
    deviceBreakdown: topBreakdown(breakdownRows.map((row) => row.device || "unknown")),
    topTrafficSources: topBreakdown(
      breakdownRows.map((row) => {
        const metadata = asRecord(row.metadataJson);
        return typeof metadata.trafficSource === "string" ? metadata.trafficSource : "unknown";
      })
    ),
    topTools: topBreakdown(
      breakdownRows
        .map((row) => {
          const metadata = asRecord(row.metadataJson);
          return typeof metadata.tool === "string" ? metadata.tool : "";
        })
        .filter(Boolean)
    ),
    dailyTrend: buildDailyTrend(dailyRows),
    recentSessions: buildRecentSessions(breakdownRows)
  };
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function topBreakdown(values: string[], limit = 6) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function buildDailyTrend(rows: Array<{ event: string; createdAt: Date; sessionId: string | null; anonymousId: string | null }>) {
  const byDay = new Map<string, { date: string; visitors: Set<string>; uploads: number; previews: number; checkouts: number; payments: number }>();
  for (const row of rows) {
    const date = row.createdAt.toISOString().slice(0, 10);
    const current = byDay.get(date) ?? { date, visitors: new Set<string>(), uploads: 0, previews: 0, checkouts: 0, payments: 0 };
    current.visitors.add(row.sessionId || row.anonymousId || "unknown");
    if (row.event === "upload_click" || row.event === "upload_started") current.uploads += 1;
    if (row.event === "preview_generated") current.previews += 1;
    if (row.event === "checkout_started") current.checkouts += 1;
    if (row.event === "checkout_completed") current.payments += 1;
    byDay.set(date, current);
  }

  return Array.from(byDay.values()).map((row) => ({
    date: row.date,
    visitors: row.visitors.size,
    uploads: row.uploads,
    previews: row.previews,
    checkouts: row.checkouts,
    payments: row.payments
  }));
}

function buildRecentSessions(rows: Array<{
  event: string;
  sessionId: string | null;
  anonymousId: string | null;
  userId: string | null;
  page: string | null;
  country: string | null;
  device: string | null;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
}>) {
  const sessions = new Map<string, {
    id: string;
    userId: string | null;
    anonymousId: string | null;
    country: string | null;
    device: string | null;
    firstSeen: Date;
    lastSeen: Date;
    events: Array<{ event: string; page: string | null; createdAt: Date; tool?: string }>;
  }>();

  for (const row of rows) {
    const id = row.sessionId || row.anonymousId || row.userId || "unknown";
    const current = sessions.get(id) ?? {
      id,
      userId: row.userId,
      anonymousId: row.anonymousId,
      country: row.country,
      device: row.device,
      firstSeen: row.createdAt,
      lastSeen: row.createdAt,
      events: []
    };
    const metadata = asRecord(row.metadataJson);
    current.userId ||= row.userId;
    current.country ||= row.country;
    current.device ||= row.device;
    current.firstSeen = row.createdAt < current.firstSeen ? row.createdAt : current.firstSeen;
    current.lastSeen = row.createdAt > current.lastSeen ? row.createdAt : current.lastSeen;
    current.events.push({
      event: row.event,
      page: row.page,
      createdAt: row.createdAt,
      tool: typeof metadata.tool === "string" ? metadata.tool : undefined
    });
    sessions.set(id, current);
  }

  return Array.from(sessions.values())
    .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
    .slice(0, 12)
    .map((session) => ({
      ...session,
      events: session.events
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(-10)
    }));
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

type AdminAnalyticsData = Awaited<ReturnType<typeof buildAdminAnalyticsData>>;

export type AdminReportRangeKey = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";
export type AdminReportGrouping = "daily" | "weekly" | "monthly";

const EXPENSE_CATEGORIES = ["ADS", "SEO", "PROVIDER", "SOFTWARE", "DESIGN", "DOMAIN", "HOSTING", "OTHER"] as const;
const PROVIDER_RUNTIME_DEFAULTS = [
  { providerKey: "millionverifier", name: "MillionVerifier", providerType: "email-verification", envKeyName: "MILLIONVERIFIER_API_KEY", priority: 5, defaultStatus: "ACTIVE" },
  { providerKey: "replicate", name: "Replicate", providerType: "replicate", envKeyName: "REPLICATE_API_TOKEN", priority: 10, defaultStatus: "ACTIVE" },
  { providerKey: "photoroom", name: "PhotoRoom", providerType: "photoroom", envKeyName: "PHOTOROOM_API_KEY", priority: 20, defaultStatus: "ACTIVE" },
  { providerKey: "removebg", name: "remove.bg", providerType: "removebg", envKeyName: "REMOVEBG_API_KEY", priority: 30, defaultStatus: "INACTIVE" },
  { providerKey: "local-sharp", name: "Local Sharp", providerType: "local-sharp", envKeyName: "", priority: 40, defaultStatus: "ACTIVE" }
] as const;

export async function getAdminProvidersData() {
  const startedAt = adminPerfNow();
  const dbProviders = await measureAdminQuery(
    "providers.settings.list",
    prisma.providerSetting.findMany({
      orderBy: [{ priority: "asc" }, { providerKey: "asc" }],
      select: {
        id: true,
        providerKey: true,
        name: true,
        providerType: true,
        envKeyName: true,
        status: true,
        dailyBudgetLimit: true,
        monthlyBudgetLimit: true,
        monthlyBudgetUsed: true,
        estimatedCostPerRun: true,
        estimatedCostCurrency: true,
        budgetEnforcementMode: true,
        priority: true,
        notes: true,
        updatedAt: true
      }
    })
  );
  const byKey = new Map(dbProviders.map((provider) => [provider.providerKey, provider]));
  const providers = [
    ...PROVIDER_RUNTIME_DEFAULTS.map((runtime) => {
      const db = byKey.get(runtime.providerKey);
      return {
        id: db?.id || "",
        providerKey: runtime.providerKey,
        name: db?.name || runtime.name,
        providerType: db?.providerType || runtime.providerType,
        envKeyName: db?.envKeyName ?? runtime.envKeyName,
        configured: runtime.envKeyName ? Boolean(process.env[runtime.envKeyName]) : true,
        status: db?.status || runtime.defaultStatus,
        dbBacked: Boolean(db),
        dailyBudgetLimit: db?.dailyBudgetLimit || null,
        monthlyBudgetLimit: db?.monthlyBudgetLimit || null,
        monthlyBudgetUsed: db?.monthlyBudgetUsed || 0,
        estimatedCostPerRun: db?.estimatedCostPerRun || null,
        estimatedCostCurrency: db?.estimatedCostCurrency || "usd",
        budgetEnforcementMode: db?.budgetEnforcementMode || "NOTIFY_ONLY",
        priority: db?.priority ?? runtime.priority,
        notes: db?.notes || "",
        updatedAt: db?.updatedAt || null,
        source: db ? "db" : "runtime"
      };
    }),
    ...dbProviders
      .filter((provider) => !PROVIDER_RUNTIME_DEFAULTS.some((runtime) => runtime.providerKey === provider.providerKey))
      .map((provider) => ({
        ...provider,
        configured: provider.envKeyName ? Boolean(process.env[provider.envKeyName]) : false,
        dbBacked: true,
        source: "db" as const
      }))
  ].sort((a, b) => a.priority - b.priority || a.providerKey.localeCompare(b.providerKey));

  logAdminPerf("admin.providers.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: 1,
    resultCount: providers.length,
    dbCount: dbProviders.length
  });

  return providers;
}

export type AdminProvidersData = Awaited<ReturnType<typeof getAdminProvidersData>>;

export async function getAdminProviderMonitoringData() {
  const todayStart = startOfDay(new Date());
  const [providers, jobGroups] = await Promise.all([
    getAdminProvidersData(),
    measureAdminQuery(
      "providers.monitoring.todayJobs",
      prisma.aiJob.groupBy({
        by: ["providerKey", "status"],
        where: { deletedAt: null, createdAt: { gte: todayStart } },
        _count: { _all: true },
        _sum: { estimatedCostAtRun: true }
      })
    )
  ]);

  return providers.map((provider) => {
    const rows = jobGroups.filter((row) => row.providerKey === provider.providerKey);
    const completed = rows.find((row) => row.status === "COMPLETED")?._count._all ?? 0;
    const failed = rows.find((row) => row.status === "FAILED")?._count._all ?? 0;
    const total = rows.reduce((sum, row) => sum + row._count._all, 0);
    const estimatedCostToday = rows.reduce((sum, row) => sum + decimalToNumber(row._sum.estimatedCostAtRun), 0);
    const failureRate = total > 0 ? failed / total : 0;
    const health = provider.status !== "ACTIVE" ? "DISABLED" : !provider.configured || failureRate >= 0.25 ? "DEGRADED" : "HEALTHY";

    return {
      ...provider,
      jobsToday: total,
      completedToday: completed,
      failedToday: failed,
      estimatedCostToday,
      failureRate,
      health
    };
  });
}

export async function getAdminSystemData() {
  const [operations, providers, recentAdminActions, recentSecurityEvents, lastSuccessfulEmail, lastFailedEmail, failedEmailCount, backup] = await Promise.all([
    getOperationalSettings({ bypassCache: true }),
    getAdminProviderMonitoringData(),
    measureAdminQuery(
      "system.recentAdminActions",
      prisma.adminLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, action: true, entityType: true, createdAt: true, adminUser: { select: { email: true } } }
      })
    ),
    measureAdminQuery(
      "system.recentSecurityEvents",
      prisma.adminLog.findMany({
        where: {
          OR: [
            { action: { startsWith: "analytics.rate_limited" } },
            { action: { startsWith: "analytics.abuse_blocked" } },
            { action: { startsWith: "security." } }
          ]
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, action: true, metadataJson: true, createdAt: true }
      })
    ),
    measureAdminQuery(
      "system.email.lastSuccessful",
      prisma.emailEvent.findFirst({
        where: { status: "SENT" },
        orderBy: { sentAt: "desc" },
        select: { id: true, templateKey: true, recipientEmail: true, provider: true, sentAt: true, createdAt: true }
      })
    ),
    measureAdminQuery(
      "system.email.lastFailed",
      prisma.emailEvent.findFirst({
        where: { status: "FAILED" },
        orderBy: { updatedAt: "desc" },
        select: { id: true, templateKey: true, recipientEmail: true, provider: true, errorMessage: true, updatedAt: true, createdAt: true }
      })
    ),
    measureAdminQuery(
      "system.email.failedCount",
      prisma.emailEvent.count({ where: { status: "FAILED" } })
    ),
    getBackupRecoveryData()
  ]);

  return {
    operations,
    providers,
    recentAdminActions,
    recentSecurityEvents,
    email: {
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
      fromConfigured: Boolean(process.env.EMAIL_FROM),
      supportEmail: process.env.SUPPORT_EMAIL || "support@zeylora.ai",
      lastSuccessfulEmail,
      lastFailedEmail,
      failedEmailCount
    },
    backup,
    env: {
      nodeEnv: process.env.NODE_ENV || "development",
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
      database: Boolean(process.env.DATABASE_URL),
      directUrl: Boolean(process.env.DIRECT_URL),
      r2: Boolean(process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY),
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      resend: Boolean(process.env.RESEND_API_KEY),
      postmark: Boolean(process.env.POSTMARK_SERVER_TOKEN),
      smtp: Boolean(process.env.SMTP_HOST)
    },
    deployment: {
      vercelEnv: process.env.VERCEL_ENV || "local",
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || "",
      deployTimestamp: process.env.NEXT_PUBLIC_DEPLOY_TIMESTAMP || ""
    }
  };
}

export async function getAdminQaData() {
  const [operations, providers, tracking, recentEvents] = await Promise.all([
    getOperationalSettings({ bypassCache: true }),
    getAdminProviderMonitoringData(),
    getMarketingTrackingSettings({ bypassCache: true }),
    measureAdminQuery(
      "qa.recentAnalyticsEvents",
      prisma.adminLog.findMany({
        where: { entityType: "AnalyticsEvent" },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, action: true, metadataJson: true, createdAt: true }
      })
    )
  ]);

  return {
    operations,
    providers,
    tracking,
    recentEvents
  };
}

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
    topPaymentUsers,
    providerSettings,
    activeTools,
    operations
  ] = await Promise.all([
    measureAdminQuery(
      "reports.payments.paid.list",
      prisma.payment.findMany({
        where: paidPaymentWhere,
        orderBy: { createdAt: "desc" },
        take: 50,
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
        take: 50,
        select: {
          id: true,
          providerKey: true,
          providerKeySnapshot: true,
          qualityTierSnapshot: true,
          toolInternalKeySnapshot: true,
          toolNameSnapshot: true,
          creditsChargedSnapshot: true,
          createdAt: true,
          creditCost: true,
          estimatedCostAtRun: true,
          estimatedCostCurrency: true,
          estimatedCostProvider: true,
          estimatedCostSource: true,
          estimatedRevenueAtRun: true,
          estimatedProfitAtRun: true,
          creditTransactions: {
            where: { type: "USE" },
            select: { amount: true },
            take: 5
          },
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
        take: 50,
        select: {
          id: true,
          providerKey: true,
          providerKeySnapshot: true,
          qualityTierSnapshot: true,
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
        take: 50,
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
    ),
    measureAdminQuery(
      "reports.providers.costDefaults",
      prisma.providerSetting.findMany({
        select: {
          providerKey: true,
          name: true,
          status: true,
          monthlyBudgetLimit: true,
          monthlyBudgetUsed: true,
          dailyBudgetLimit: true,
          estimatedCostPerRun: true,
          estimatedCostCurrency: true,
          budgetEnforcementMode: true
        }
      }),
      { range }
    ),
    measureAdminQuery(
      "reports.tools.activeCostWarnings",
      prisma.aiTool.findMany({
        where: { deletedAt: null, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          slug: true,
          providerKey: true,
          estimatedCostPerRun: true
        }
      }),
      { range }
    ),
    getOperationalSettings()
  ]);
  const providerDefaults = new Map(providerSettings.map((provider) => [provider.providerKey, provider]));

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
  const providerCost = completedJobs.reduce((sum, job) => sum + getJobEstimatedCost(job, providerDefaults), 0);
  const snapshotProviderCost = completedJobs.reduce((sum, job) => sum + decimalToNumber(job.estimatedCostAtRun), 0);
  const estimatedRevenue = completedJobs.reduce((sum, job) => sum + getJobEstimatedRevenue(job, operations.estimatedCreditUsdValue), 0);
  const estimatedProfit = completedJobs.reduce((sum, job) => sum + getJobEstimatedProfit(job, providerDefaults, operations.estimatedCreditUsdValue), 0);
  const manualExpenses = expenses.reduce((sum, expense) => sum + decimalToNumber(expense.amount), 0);
  const refundAmount = decimalToNumber(refundAggregate._sum.amount);
  const grossProfit = revenue - providerCost;
  const netProfit = grossProfit - manualExpenses;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : null;
  const estimatedExportCount = completedJobs.length;
  const costPerCleanExport = creditUsage._count._all > 0 ? providerCost / creditUsage._count._all : null;
  const averageProfitPerExport = estimatedExportCount > 0 ? estimatedProfit / estimatedExportCount : null;
  const averageProviderCostPerTool = toolUsageAverageProviderCost(completedJobs, providerDefaults);
  const averageRevenuePerExport = estimatedExportCount > 0 ? estimatedRevenue / estimatedExportCount : null;
  const missingCostTools = Array.from(
    new Map(
      completedJobs
        .filter((job) => getJobEstimatedCost(job, providerDefaults) <= 0)
        .map((job) => [job.tool?.slug || "unknown", job.tool?.name || "Bilinmeyen araç"])
    ).entries()
  ).map(([slug, name]) => ({ slug, name }));
  const missingActiveCostTargets = buildMissingActiveCostWarnings(activeTools, providerDefaults);

  const series = buildReportSeries({
    grouping,
    paidPayments,
    expenses,
    completedJobs,
    providerDefaults
  });
  const toolUsage = buildToolUsageReport(completedJobs, providerDefaults, operations.estimatedCreditUsdValue);
  const providerUsage = buildProviderUsageReport(completedJobs, failedJobs, providerDefaults);
  const packageRevenue = buildPackageRevenueReport(paidPayments);
  const failedByTool = buildFailedJobsReport(failedJobs);

  logAdminPerf("admin.reports.data", {
    duration: `${adminPerfNow() - startedAt}ms`,
    queryCount: topUserIds.length ? 12 : 11,
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
      snapshotProviderCost,
      estimatedRevenue,
      estimatedProfit,
      averageProfitPerExport,
      averageProviderCostPerTool,
      averageRevenuePerExport,
      missingCostTools,
      missingActiveCostTargets
    },
    series,
    toolUsage,
    providerUsage,
    providerSettings,
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

function dedupeCreditPackages<T extends { name: string; featureFlagKey?: string | null; status?: string; sortOrder?: number; id: string }>(packages: T[]) {
  const byName = new Map<string, T>();

  for (const pack of packages) {
    const key = getAdminCreditPackageKey(pack);
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

  return Array.from(byName.values()).sort((a, b) => {
    const aRank = getAdminCreditPackageRank(a);
    const bRank = getAdminCreditPackageRank(b);
    if (aRank !== bRank) return aRank - bRank;
    return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
  });
}

function getAdminCreditPackageKey(pack: { name: string; featureFlagKey?: string | null }) {
  const config = findAdminCreditPackageConfig(pack);
  return config?.key ?? pack.name.toLowerCase();
}

function getAdminCreditPackageRank(pack: { name: string; featureFlagKey?: string | null }) {
  const config = findAdminCreditPackageConfig(pack);
  if (!config) return 999;
  const rank = creditPackages.findIndex((item) => item.key === config.key);
  return rank === -1 ? 999 : rank;
}

function findAdminCreditPackageConfig(pack: { name: string; featureFlagKey?: string | null }) {
  return creditPackages.find(
    (item) =>
      item.name === pack.name ||
      item.featureFlagKey === pack.featureFlagKey ||
      (item.key === "growth" && pack.name === "Creator") ||
      (item.key === "pro" && (pack.name === "Pro Seller" || pack.name === "Studio")) ||
      (item.key === "trial" && pack.name === "Starter Trial Pack")
  );
}

type AdminCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type CostedJob = {
  providerKey: string | null;
  providerKeySnapshot?: string | null;
  qualityTierSnapshot?: string | null;
  toolInternalKeySnapshot?: string | null;
  toolNameSnapshot?: string | null;
  creditsChargedSnapshot?: number | null;
  creditCost?: number;
  creditTransactions?: Array<{ amount: number }>;
  estimatedCostAtRun?: unknown;
  estimatedRevenueAtRun?: unknown;
  estimatedProfitAtRun?: unknown;
  tool: { estimatedCostPerRun: unknown; creditCost?: number } | null;
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
  completedJobs: Array<CostedJob & { createdAt: Date }>;
  providerDefaults: Map<string, { estimatedCostPerRun: unknown }>;
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
  for (const job of input.completedJobs) ensureBucket(job.createdAt).providerCost += getJobEstimatedCost(job, input.providerDefaults);

  return Array.from(buckets.values())
    .map((bucket) => ({ ...bucket, netProfit: bucket.revenue - bucket.providerCost - bucket.expenses }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function buildToolUsageReport(
  completedJobs: Array<{
    providerKey: string | null;
    providerKeySnapshot?: string | null;
    qualityTierSnapshot?: string | null;
    toolInternalKeySnapshot?: string | null;
    toolNameSnapshot?: string | null;
    creditsChargedSnapshot?: number | null;
    creditCost?: number;
    estimatedCostAtRun?: unknown;
    estimatedRevenueAtRun?: unknown;
    estimatedProfitAtRun?: unknown;
    tool: {
      name: string;
      slug: string;
      creditCost: number;
      estimatedCostPerRun: unknown;
      estimatedCostProvider: string | null;
    } | null;
  }>,
  providerDefaults: Map<string, { estimatedCostPerRun: unknown }>,
  estimatedCreditUsdValue: number
) {
  const byTool = new Map<
    string,
    { slug: string; name: string; qualityTier: string; provider: string; runs: number; credits: number; costPerRun: number; estimatedCost: number; estimatedRevenue: number; estimatedProfit: number; averageProfit: number; marginPercent: number | null; missingCost: boolean }
  >();

  for (const job of completedJobs) {
    const slug = job.toolInternalKeySnapshot || job.tool?.slug || "unknown";
    const existing =
      byTool.get(slug) ||
      {
        slug,
        name: job.toolNameSnapshot || job.tool?.name || "Bilinmeyen araç",
        qualityTier: getQualityTierLabel(job.qualityTierSnapshot),
        provider: job.tool?.estimatedCostProvider || job.providerKeySnapshot || job.providerKey || "-",
        runs: 0,
        credits: 0,
        costPerRun: getJobEstimatedCost(job, providerDefaults),
        estimatedCost: 0,
        estimatedRevenue: 0,
        estimatedProfit: 0,
        averageProfit: 0,
        marginPercent: null,
        missingCost: false
      };
    const cost = getJobEstimatedCost(job, providerDefaults);
    const revenue = getJobEstimatedRevenue(job, estimatedCreditUsdValue);
    const profit = getJobEstimatedProfit(job, providerDefaults, estimatedCreditUsdValue);
    existing.runs += 1;
    existing.credits += getJobCreditsCharged(job);
    existing.costPerRun = cost;
    existing.estimatedCost += cost;
    existing.estimatedRevenue += revenue;
    existing.estimatedProfit += profit;
    existing.averageProfit = existing.runs > 0 ? existing.estimatedProfit / existing.runs : 0;
    existing.marginPercent = existing.estimatedRevenue > 0 ? (existing.estimatedProfit / existing.estimatedRevenue) * 100 : null;
    existing.missingCost ||= cost <= 0;
    byTool.set(slug, existing);
  }

  return Array.from(byTool.values()).sort((a, b) => b.runs - a.runs);
}

function buildProviderUsageReport(
  completedJobs: Array<CostedJob>,
  failedJobs: Array<{ providerKey: string | null; providerKeySnapshot?: string | null }>,
  providerDefaults: Map<string, { name?: string; estimatedCostPerRun: unknown; monthlyBudgetLimit?: unknown; dailyBudgetLimit?: unknown; monthlyBudgetUsed?: unknown; budgetEnforcementMode?: string }>
) {
  const byProvider = new Map<
    string,
    { provider: string; completedJobs: number; failedJobs: number; estimatedCost: number; defaultCostPerRun: number; monthlyBudget: number; dailyBudget: number; usedAmount: number; budgetMode: string; missingCost: boolean }
  >();
  const ensureProvider = (providerKey: string) => {
    const defaults = providerDefaults.get(providerKey);
    const existing =
      byProvider.get(providerKey) ||
      {
        provider: defaults?.name || providerKey,
        completedJobs: 0,
        failedJobs: 0,
        estimatedCost: 0,
        defaultCostPerRun: decimalToNumber(defaults?.estimatedCostPerRun),
        monthlyBudget: decimalToNumber(defaults?.monthlyBudgetLimit),
        dailyBudget: decimalToNumber(defaults?.dailyBudgetLimit),
        usedAmount: decimalToNumber(defaults?.monthlyBudgetUsed),
        budgetMode: defaults?.budgetEnforcementMode || "NOTIFY_ONLY",
        missingCost: false
      };
    byProvider.set(providerKey, existing);
    return existing;
  };

  for (const job of completedJobs) {
    const provider = ensureProvider(job.providerKeySnapshot || job.providerKey || "unknown");
    const cost = getJobEstimatedCost(job, providerDefaults);
    provider.completedJobs += 1;
    provider.estimatedCost += cost;
    provider.missingCost ||= cost <= 0;
  }
  for (const job of failedJobs) {
    ensureProvider(job.providerKeySnapshot || job.providerKey || "unknown").failedJobs += 1;
  }

  return Array.from(byProvider.values()).sort((a, b) => b.estimatedCost - a.estimatedCost || b.completedJobs - a.completedJobs);
}

function buildMissingActiveCostWarnings(
  activeTools: Array<{ name: string; slug: string; providerKey: string; estimatedCostPerRun: unknown }>,
  providerDefaults: Map<string, { estimatedCostPerRun: unknown; name?: string; status?: string }>
) {
  return activeTools
    .filter((tool) => {
      const toolCost = decimalToNumber(tool.estimatedCostPerRun);
      const providerCost = decimalToNumber(providerDefaults.get(tool.providerKey)?.estimatedCostPerRun);
      return toolCost <= 0 && providerCost <= 0;
    })
    .map((tool) => ({
      slug: tool.slug,
      name: tool.name,
      providerKey: tool.providerKey,
      providerName: providerDefaults.get(tool.providerKey)?.name || tool.providerKey
    }));
}

function getJobEstimatedCost(
  job: CostedJob,
  providerDefaults: Map<string, { estimatedCostPerRun: unknown }>
) {
  if (job.estimatedCostAtRun !== null && job.estimatedCostAtRun !== undefined) {
    return decimalToNumber(job.estimatedCostAtRun);
  }
  const toolCost = decimalToNumber(job.tool?.estimatedCostPerRun);
  if (toolCost > 0) return toolCost;
  return decimalToNumber(providerDefaults.get(job.providerKeySnapshot || job.providerKey || "")?.estimatedCostPerRun);
}

function getJobEstimatedRevenue(job: CostedJob, estimatedCreditUsdValue: number) {
  const actualCredits = getJobCreditsCharged(job);
  if (actualCredits <= 0) return 0;
  if (job.estimatedRevenueAtRun !== null && job.estimatedRevenueAtRun !== undefined) {
    return decimalToNumber(job.estimatedRevenueAtRun);
  }
  return actualCredits * estimatedCreditUsdValue;
}

function getJobEstimatedProfit(
  job: CostedJob,
  providerDefaults: Map<string, { estimatedCostPerRun: unknown }>,
  estimatedCreditUsdValue: number
) {
  if (getJobCreditsCharged(job) > 0 && job.estimatedProfitAtRun !== null && job.estimatedProfitAtRun !== undefined) {
    return decimalToNumber(job.estimatedProfitAtRun);
  }
  return getJobEstimatedRevenue(job, estimatedCreditUsdValue) - getJobEstimatedCost(job, providerDefaults);
}

function getJobCreditsCharged(job: CostedJob) {
  const transactionCredits = Math.abs(job.creditTransactions?.reduce((sum, transaction) => sum + transaction.amount, 0) ?? 0);
  if (transactionCredits > 0) return transactionCredits;
  return 0;
}

function toolUsageAverageProviderCost(
  completedJobs: CostedJob[],
  providerDefaults: Map<string, { estimatedCostPerRun: unknown }>
) {
  if (!completedJobs.length) return null;
  return completedJobs.reduce((sum, job) => sum + getJobEstimatedCost(job, providerDefaults), 0) / completedJobs.length;
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

function getQualityTierLabel(tier?: string | null) {
  if (tier === "hq") return "High Quality";
  if (tier === "pro") return "Pro";
  if (tier === "creative") return "Creative";
  if (tier === "standard") return "Standard";
  return "Eski kayıt";
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
