import { prisma } from "@/lib/db";
import { createResultPreviewUrl } from "@/lib/media/signed-url";

export type DashboardFilter = "all" | "completed" | "failed" | "clean-export" | "preview-only";

export type DashboardJobsInput = {
  filter: DashboardFilter;
  page?: number;
  pageSize?: number;
  tool?: string | null;
  q?: string | null;
};

export async function loadDashboardData(userId: string, filter: DashboardFilter) {
  const startedAt = Date.now();
  const jobsStartedAt = Date.now();
  const jobsPromise = getRecentJobs(userId, { filter });
  const creditsStartedAt = Date.now();
  const creditPromise = prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditBalance: true
    }
  });
  const transactionsStartedAt = Date.now();
  const transactionsPromise = prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      note: true,
      createdAt: true
    }
  });

  const [jobsResult, creditSummary, creditTransactions] = await Promise.all([
    jobsPromise,
    creditPromise,
    transactionsPromise
  ]);

  return {
    creditBalance: creditSummary?.creditBalance ?? 0,
    lowCreditThreshold: 5,
    jobs: jobsResult.jobs,
    creditTransactions: creditTransactions.map((transaction) => ({
      ...transaction,
      createdAt: transaction.createdAt.toISOString()
    })),
    timing: {
      jobsMs: jobsResult.jobsMs,
      creditsMs: Date.now() - creditsStartedAt,
      transactionsMs: Date.now() - transactionsStartedAt,
      signedUrlsMs: jobsResult.signedUrlsMs,
      dashboardDataMs: Date.now() - startedAt,
      jobsStartedOffsetMs: jobsStartedAt - startedAt
    }
  };
}

export async function loadDashboardJobs(userId: string, input: DashboardFilter | DashboardJobsInput) {
  const normalized = typeof input === "string" ? { filter: input } : input;
  return getRecentJobs(userId, normalized);
}

export async function loadDashboardCreditTransactions(userId: string, input: number | { page?: number; pageSize?: number } = 6) {
  const page = typeof input === "number" ? 1 : normalizePositiveInt(input.page, 1);
  const pageSize = typeof input === "number" ? input : normalizePageSize(input.pageSize, 10);
  const take = typeof input === "number" ? input : pageSize;
  const skip = typeof input === "number" ? 0 : (page - 1) * pageSize;
  const transactionsStartedAt = Date.now();
  const where = { userId };
  const [creditTransactions, total] = await Promise.all([
    prisma.creditTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        note: true,
        createdAt: true
      }
    }),
    typeof input === "number" ? Promise.resolve(0) : prisma.creditTransaction.count({ where })
  ]);

  return {
    creditTransactions: creditTransactions.map((transaction) => ({
      ...transaction,
      createdAt: transaction.createdAt.toISOString()
    })),
    pagination: typeof input === "number" ? null : buildPagination(page, pageSize, total),
    transactionsMs: Date.now() - transactionsStartedAt
  };
}

export async function loadDashboardOverview(userId: string) {
  const startedAt = Date.now();
  const [user, totalJobs, completedJobs, failedJobs, cleanExportsUnlocked, openTickets] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        creditBalance: true,
        createdAt: true
      }
    }),
    prisma.aiJob.count({ where: { userId, deletedAt: null } }),
    prisma.aiJob.count({ where: { userId, deletedAt: null, status: "COMPLETED" } }),
    prisma.aiJob.count({ where: { userId, deletedAt: null, status: "FAILED" } }),
    prisma.creditTransaction.count({ where: { userId, type: "USE" } }),
    prisma.ticket.count({ where: { userId, deletedAt: null, status: { in: ["OPEN", "ANSWERED"] } } })
  ]);

  return {
    user: {
      email: user?.email ?? "",
      name: user?.name ?? null,
      createdAt: user?.createdAt.toISOString() ?? null,
      creditBalance: user?.creditBalance ?? 0
    },
    metrics: {
      totalJobs,
      completedJobs,
      failedJobs,
      cleanExportsUnlocked,
      openTickets
    },
    timing: {
      overviewMs: Date.now() - startedAt
    }
  };
}

async function getRecentJobs(userId: string, input: DashboardJobsInput) {
  const page = normalizePositiveInt(input.page, 1);
  const pageSize = normalizePageSize(input.pageSize, 10);
  const skip = (page - 1) * pageSize;
  const where = buildJobsWhere(userId, input);
  const jobsStartedAt = Date.now();
  const [jobs, total, tools] = await Promise.all([
    prisma.aiJob.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      },
      skip,
      take: pageSize,
      include: {
        tool: {
          select: {
            name: true,
            slug: true
          }
        },
        inputImage: {
          select: {
            storageKey: true
          }
        },
        outputImage: {
          select: {
            storageKey: true,
            metadataJson: true
          }
        },
        creditTransactions: {
          where: {
            userId,
            type: "USE"
          },
          select: {
            id: true
          },
          take: 1
        },
        tickets: {
          where: {
            userId,
            deletedAt: null
          },
          select: {
            id: true,
            status: true
          },
          take: 1
        }
      }
    }),
    prisma.aiJob.count({ where }),
    prisma.aiTool.findMany({
      where: {
        jobs: {
          some: {
            userId,
            deletedAt: null
          }
        }
      },
      orderBy: { name: "asc" },
      select: { name: true, slug: true }
    })
  ]);
  const jobsMs = Date.now() - jobsStartedAt;

  const signedUrlsStartedAt = Date.now();
  const mappedJobs = await Promise.all(
    jobs.map(async (job) => {
      const [inputPreviewUrl, outputPreviewUrl] = await Promise.all([
        createResultPreviewUrl(job.inputImage?.storageKey),
        createResultPreviewUrl(job.outputImage?.storageKey)
      ]);
      const cleanExportUnlocked = job.creditTransactions.length > 0;

      return {
        id: job.id,
        status: job.status,
        toolName: job.tool.name,
        toolSlug: job.tool.slug,
        creditCost: job.creditCost,
        createdAt: job.createdAt.toISOString(),
        statusLabel: getStatusLabel(job.status),
        summary: getJobSummary(job.status, job.tool.name, cleanExportUnlocked),
        inputPreviewUrl,
        outputPreviewUrl,
        downloadUrl: null,
        cleanExportAvailable: false,
        cleanExportUnlocked,
        relatedTicketId: job.tickets[0]?.id ?? null
      };
    })
  );

  return {
    jobs: mappedJobs,
    pagination: buildPagination(page, pageSize, total),
    tools,
    jobsMs,
    signedUrlsMs: Date.now() - signedUrlsStartedAt
  };
}

function buildJobsWhere(userId: string, input: DashboardJobsInput) {
  const where: Record<string, unknown> = {
    userId,
    deletedAt: null
  };

  if (input.filter === "completed") {
    where.status = "COMPLETED";
  } else if (input.filter === "failed") {
    where.status = "FAILED";
  } else {
    where.status = { in: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] };
  }

  if (input.tool) {
    where.tool = { slug: input.tool };
  }

  const q = input.q?.trim();
  if (q) {
    const or: Array<Record<string, unknown>> = [
      { id: { contains: q } },
      { tool: { name: { contains: q, mode: "insensitive" } } }
    ];
    const date = parseDateSearch(q);
    if (date) {
      or.push({ createdAt: { gte: date.start, lt: date.end } });
    }
    where.OR = or;
  }

  if (input.filter === "clean-export") {
    where.creditTransactions = {
      some: {
        userId,
        type: "USE"
      }
    };
  }

  if (input.filter === "preview-only") {
    where.status = "COMPLETED";
    where.creditTransactions = {
      none: {
        userId,
        type: "USE"
      }
    };
  }

  return where;
}

function getStatusLabel(status: string) {
  if (status === "COMPLETED") return "Ready to download";
  if (status === "PROCESSING") return "Processing";
  if (status === "PENDING") return "Queued";
  if (status === "FAILED") return "Needs retry";
  return status.toLowerCase();
}

function getJobSummary(status: string, toolName: string, cleanExportUnlocked: boolean) {
  if (status === "FAILED") return `${toolName} failed. You can open a support ticket with this job attached.`;
  if (status !== "COMPLETED") return `${toolName} is still being prepared.`;
  if (cleanExportUnlocked) return `${toolName} export is unlocked. Re-downloads do not spend credits again.`;
  return `${toolName} result is ready.`;
}

function normalizePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function normalizePageSize(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(20, Math.max(5, parsed));
}

function buildPagination(page: number, pageSize: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    from,
    to
  };
}

function parseDateSearch(value: string) {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const start = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
