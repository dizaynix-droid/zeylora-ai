import { prisma } from "@/lib/db";
import { createResultPreviewUrl } from "@/lib/media/signed-url";

export type DashboardFilter = "all" | "completed" | "failed";

export async function loadDashboardData(userId: string, filter: DashboardFilter) {
  const startedAt = Date.now();
  const jobsStartedAt = Date.now();
  const jobsPromise = getRecentJobs(userId, filter);
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

export async function loadDashboardJobs(userId: string, filter: DashboardFilter) {
  return getRecentJobs(userId, filter);
}

export async function loadDashboardCreditTransactions(userId: string, take = 6) {
  const transactionsStartedAt = Date.now();
  const creditTransactions = await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      note: true,
      createdAt: true
    }
  });

  return {
    creditTransactions: creditTransactions.map((transaction) => ({
      ...transaction,
      createdAt: transaction.createdAt.toISOString()
    })),
    transactionsMs: Date.now() - transactionsStartedAt
  };
}

async function getRecentJobs(userId: string, filter: DashboardFilter) {
  const jobsStartedAt = Date.now();
  const jobs = await prisma.aiJob.findMany({
    where: {
      userId,
      deletedAt: null,
      status: {
        in: filter === "completed"
          ? ["COMPLETED"]
          : filter === "failed"
            ? ["FAILED"]
            : ["PENDING", "PROCESSING", "COMPLETED", "FAILED"]
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: filter === "all" ? 10 : 12,
    include: {
      tool: {
        select: {
          name: true
        }
      },
      inputImage: {
        select: {
          storageKey: true
        }
      },
      outputImage: {
        select: {
          storageKey: true
        }
      }
    }
  });
  const jobsMs = Date.now() - jobsStartedAt;
  const visibleJobs = filter === "all" ? limitDefaultFailedJobs(sortCompletedFirst(jobs)) : sortCompletedFirst(jobs);

  const signedUrlsStartedAt = Date.now();
  const mappedJobs = await Promise.all(
    visibleJobs.map(async (job) => {
      const [inputPreviewUrl, outputPreviewUrl] = await Promise.all([
        createResultPreviewUrl(job.inputImage?.storageKey),
        createResultPreviewUrl(job.outputImage?.storageKey)
      ]);

      return {
        id: job.id,
        status: job.status,
        toolName: job.tool.name,
        creditCost: job.creditCost,
        createdAt: job.createdAt.toISOString(),
        statusLabel: getStatusLabel(job.status),
        summary: `${job.tool.name} result. Free exports include subtle Zeylora branding; paid credit exports are watermark-free.`,
        inputPreviewUrl,
        outputPreviewUrl,
        downloadUrl: job.outputImage?.storageKey ? `/api/v1/jobs/${job.id}/download` : null
      };
    })
  );

  return {
    jobs: mappedJobs,
    jobsMs,
    signedUrlsMs: Date.now() - signedUrlsStartedAt
  };
}

function sortCompletedFirst<T extends { status: string; createdAt: Date }>(jobs: T[]) {
  return [...jobs].sort((a, b) => {
    const statusScore = (job: T) => {
      if (job.status === "COMPLETED") return 0;
      if (job.status === "PROCESSING" || job.status === "PENDING") return 1;
      return 2;
    };
    const scoreDiff = statusScore(a) - statusScore(b);
    if (scoreDiff !== 0) return scoreDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function limitDefaultFailedJobs<T extends { status: string }>(jobs: T[]) {
  let failedCount = 0;
  return jobs.filter((job) => {
    if (job.status !== "FAILED") return true;
    failedCount += 1;
    return failedCount <= 2;
  }).slice(0, 6);
}

function getStatusLabel(status: string) {
  if (status === "COMPLETED") return "Ready to download";
  if (status === "PROCESSING") return "Processing";
  if (status === "PENDING") return "Queued";
  if (status === "FAILED") return "Needs retry";
  return status.toLowerCase();
}
