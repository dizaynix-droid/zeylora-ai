import type { Prisma, VerificationEmailStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPrivateObjectText, uploadPrivateObject } from "@/lib/storage/s3-client";
import { buildVerificationCsv, filterResultsForExport } from "@/lib/verification/csv";
import { parseEmailList } from "@/lib/verification/email-parser";
import { getVerificationProvider } from "@/lib/verification/providers";
import type { VerificationProviderResult } from "@/lib/verification/types";

const DEFAULT_WORKER_EMAILS_PER_RUN = 1000;
const DEFAULT_PROVIDER_BATCH_SIZE = 50;
const DEFAULT_WORKER_TIME_BUDGET_MS = 22_000;

export type VerificationWorkerResult = {
  ok: boolean;
  processedJobs: number;
  processedEmails: number;
  completedJobs: number;
  failedJobs: number;
  message?: string;
};

export async function processVerificationQueue(options: {
  jobId?: string | null;
  maxJobs?: number;
  maxEmails?: number;
  timeBudgetMs?: number;
} = {}): Promise<VerificationWorkerResult> {
  const startedAt = Date.now();
  const maxJobs = Math.max(1, options.maxJobs ?? Number(process.env.VERIFICATION_WORKER_MAX_JOBS || 1));
  const maxEmails = Math.max(1, options.maxEmails ?? Number(process.env.VERIFICATION_WORKER_EMAILS_PER_RUN || DEFAULT_WORKER_EMAILS_PER_RUN));
  const timeBudgetMs = Math.max(5_000, options.timeBudgetMs ?? Number(process.env.VERIFICATION_WORKER_TIME_BUDGET_MS || DEFAULT_WORKER_TIME_BUDGET_MS));
  let processedJobs = 0;
  let processedEmails = 0;
  let completedJobs = 0;
  let failedJobs = 0;

  while (processedJobs < maxJobs && Date.now() - startedAt < timeBudgetMs) {
    const job = await claimNextVerificationJob(options.jobId);
    if (!job) break;

    try {
      const result = await processVerificationJobChunk(job.id, {
        maxEmails: Math.max(1, maxEmails - processedEmails),
        timeBudgetMs: Math.max(2_500, timeBudgetMs - (Date.now() - startedAt))
      });
      processedJobs += 1;
      processedEmails += result.processedEmails;
      if (result.completed) completedJobs += 1;
      if (processedEmails >= maxEmails) break;
    } catch (error) {
      processedJobs += 1;
      failedJobs += 1;
      await failVerificationJob(job.id, error);
    }
  }

  return {
    ok: true,
    processedJobs,
    processedEmails,
    completedJobs,
    failedJobs,
    message: processedJobs === 0 ? "No queued verification jobs." : undefined
  };
}

export async function processVerificationJobChunk(jobId: string, options: { maxEmails: number; timeBudgetMs: number }) {
  const startedAt = Date.now();
  const job = await prisma.verificationJob.findFirst({
    where: {
      id: jobId,
      deletedAt: null,
      status: { in: ["QUEUED", "PROCESSING"] }
    },
    select: {
      id: true,
      inputStorageKey: true,
      providerKey: true,
      uniqueEmails: true,
      providerBatchCount: true,
      metadataJson: true
    }
  });

  if (!job?.inputStorageKey) {
    throw new Error("Verification job input file is missing.");
  }

  const inputText = await getPrivateObjectText(job.inputStorageKey);
  const parsed = parseEmailList(inputText);
  const processedCount = await prisma.verificationEmailResult.count({ where: { verificationJobId: job.id } });
  const remaining = parsed.uniqueEmails.slice(processedCount);

  if (remaining.length === 0) {
    await completeVerificationJob(job.id);
    return { processedEmails: 0, completed: true };
  }

  const providerSettings = await prisma.providerSetting.findUnique({
    where: { providerKey: job.providerKey },
    select: {
      apiKeyEncrypted: true,
      configJson: true,
      status: true
    }
  });

  if (providerSettings?.status === "SUSPENDED" || providerSettings?.status === "INACTIVE") {
    throw new Error("Verification provider is temporarily unavailable.");
  }

  const provider = getVerificationProvider(job.providerKey, {
    apiKey: providerSettings?.apiKeyEncrypted,
    baseUrl: readProviderBaseUrl(providerSettings?.configJson)
  });

  const providerBatchSize = Math.max(1, Number(process.env.VERIFICATION_PROVIDER_BATCH_SIZE || DEFAULT_PROVIDER_BATCH_SIZE));
  const targetEmails = remaining.slice(0, options.maxEmails);
  let processedEmails = 0;
  let batchCount = 0;

  for (let index = 0; index < targetEmails.length; index += providerBatchSize) {
    if (Date.now() - startedAt > options.timeBudgetMs) break;
    const batch = targetEmails.slice(index, index + providerBatchSize);
    const providerResults = await provider.verifyBatch(batch);
    const dbResults = providerResults.map((result) => toDbResult(job.id, result));
    const counts = countStatuses(providerResults.map((result) => result.status));

    await prisma.$transaction([
      prisma.verificationEmailResult.createMany({ data: dbResults }),
      prisma.verificationJob.update({
        where: { id: job.id },
        data: {
          status: "PROCESSING",
          providerBatchCount: { increment: 1 },
          validCount: { increment: counts.VALID },
          invalidCount: { increment: counts.INVALID },
          riskyCount: { increment: counts.RISKY },
          catchAllCount: { increment: counts.CATCH_ALL },
          disposableCount: { increment: counts.DISPOSABLE },
          unknownCount: { increment: counts.UNKNOWN },
          progressPercent: computeProgress(processedCount + processedEmails + providerResults.length, parsed.uniqueEmails.length),
          metadataJson: mergeJobMetadata(job.metadataJson, {
            worker: "chunked",
            lastProcessedAt: new Date().toISOString(),
            processedEmails: processedCount + processedEmails + providerResults.length
          })
        }
      })
    ]);

    batchCount += 1;
    processedEmails += providerResults.length;
  }

  const totalProcessed = processedCount + processedEmails;
  const completed = totalProcessed >= parsed.uniqueEmails.length;
  if (completed) {
    await completeVerificationJob(job.id);
  }

  console.info("[verification-worker]", {
    jobId: job.id,
    provider: job.providerKey,
    processedEmails,
    totalProcessed,
    totalEmails: parsed.uniqueEmails.length,
    batchCount,
    completed
  });

  return { processedEmails, completed };
}

async function claimNextVerificationJob(jobId?: string | null) {
  const staleBefore = new Date(Date.now() - Number(process.env.VERIFICATION_WORKER_STALE_MS || 60_000));
  const candidate = await prisma.verificationJob.findFirst({
    where: {
      deletedAt: null,
      ...(jobId ? { id: jobId } : {}),
      OR: [
        { status: "QUEUED" },
        { status: "PROCESSING", updatedAt: { lt: staleBefore } }
      ]
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      updatedAt: true
    }
  });

  if (!candidate) return null;

  const claimed = await prisma.verificationJob.updateMany({
    where: {
      id: candidate.id,
      updatedAt: candidate.updatedAt,
      status: candidate.status
    },
    data: {
      status: "PROCESSING",
      progressPercent: { increment: candidate.status === "QUEUED" ? 5 : 0 },
      startedAt: new Date()
    }
  });

  return claimed.count === 1 ? candidate : null;
}

async function completeVerificationJob(jobId: string) {
  const job = await prisma.verificationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      userId: true,
      uniqueEmails: true,
      metadataJson: true
    }
  });

  if (!job) return;

  const exportBase = `verification/${job.userId}/${job.id}`;
  const fullReportKey = `${exportBase}/full-report.csv`;
  const validExportKey = `${exportBase}/valid-emails.csv`;
  const invalidExportKey = `${exportBase}/invalid-emails.csv`;
  const riskyExportKey = `${exportBase}/risky-catch-all-disposable.csv`;
  const allResults = await readAllResultsForExport(job.id);

  await Promise.all([
    uploadCsv(fullReportKey, buildVerificationCsv(allResults)),
    uploadCsv(validExportKey, buildVerificationCsv(filterResultsForExport(allResults, "valid"))),
    uploadCsv(invalidExportKey, buildVerificationCsv(filterResultsForExport(allResults, "invalid"))),
    uploadCsv(riskyExportKey, buildVerificationCsv(filterResultsForExport(allResults, "risky")))
  ]);

  await prisma.verificationJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      progressPercent: 100,
      creditsUsed: job.uniqueEmails,
      fullReportStorageKey: fullReportKey,
      validExportStorageKey: validExportKey,
      invalidExportStorageKey: invalidExportKey,
      riskyExportStorageKey: riskyExportKey,
      completedAt: new Date(),
      metadataJson: mergeJobMetadata(job.metadataJson, {
        worker: "chunked",
        completedAt: new Date().toISOString(),
        exportRows: allResults.length
      })
    }
  });
}

async function failVerificationJob(jobId: string, error: unknown) {
  const job = await prisma.verificationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      userId: true,
      creditsReserved: true,
      creditsUsed: true,
      providerKey: true
    }
  });

  if (!job) return;
  const refundAmount = Math.max(0, job.creditsReserved - job.creditsUsed);
  if (refundAmount > 0) {
    await refundVerificationCredits({
      userId: job.userId,
      jobId: job.id,
      amount: refundAmount,
      note: "Verification job failed refund"
    });
  }

  await prisma.verificationJob.update({
    where: { id: job.id },
    data: {
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message : "Verification failed.",
      completedAt: new Date()
    }
  });

  console.error("[verification-worker-failed]", {
    jobId: job.id,
    provider: job.providerKey,
    message: error instanceof Error ? error.message : "Verification failed."
  });
}

export async function reserveVerificationCredits(input: { userId: string; jobId: string; amount: number }) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { creditBalance: true }
    });
    if (!user || user.creditBalance < input.amount) {
      return { ok: false as const };
    }
    const balanceAfter = user.creditBalance - input.amount;
    await tx.user.update({
      where: { id: input.userId },
      data: { creditBalance: balanceAfter }
    });
    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        type: "USE",
        amount: -input.amount,
        balanceAfter,
        verificationJobId: input.jobId,
        note: "Email verification credits reserved"
      }
    });
    return { ok: true as const, balanceAfter };
  });
}

export async function refundVerificationCredits(input: { userId: string; jobId: string; amount: number; note: string }) {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { creditBalance: true }
    });
    if (!user) return;
    const balanceAfter = user.creditBalance + input.amount;
    await tx.user.update({
      where: { id: input.userId },
      data: { creditBalance: balanceAfter }
    });
    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        type: "REFUND",
        amount: input.amount,
        balanceAfter,
        verificationJobId: input.jobId,
        note: input.note
      }
    });
  });
}

async function readAllResultsForExport(jobId: string) {
  const pageSize = 5_000;
  const rows = [];
  for (let skip = 0; ; skip += pageSize) {
    const page = await prisma.verificationEmailResult.findMany({
      where: { verificationJobId: jobId },
      orderBy: { createdAt: "asc" },
      skip,
      take: pageSize,
      select: {
        email: true,
        normalizedEmail: true,
        status: true,
        reason: true,
        domain: true,
        mxFound: true,
        disposable: true,
        roleBased: true,
        freeProvider: true
      }
    });
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function toDbResult(verificationJobId: string, result: VerificationProviderResult) {
  const normalizedEmail = result.email.toLowerCase();
  const domain = normalizedEmail.split("@")[1] || null;
  const raw = result.raw || {};
  return {
    verificationJobId,
    email: result.email,
    normalizedEmail,
    status: result.status,
    reason: result.reason || null,
    domain,
    mxFound: readBoolean(raw.mx),
    disposable: result.status === "DISPOSABLE" || readBoolean(raw.disposable),
    roleBased: readBoolean(raw.role),
    freeProvider: readBoolean(raw.free),
    rawJson: raw as Prisma.InputJsonValue
  };
}

function countStatuses(statuses: VerificationEmailStatus[]) {
  return statuses.reduce<Record<VerificationEmailStatus, number>>(
    (acc, status) => {
      acc[status] += 1;
      return acc;
    },
    {
      VALID: 0,
      INVALID: 0,
      RISKY: 0,
      CATCH_ALL: 0,
      DISPOSABLE: 0,
      UNKNOWN: 0,
      DUPLICATE: 0
    }
  );
}

function computeProgress(processed: number, total: number) {
  if (total <= 0) return 10;
  return Math.min(95, Math.max(15, Math.round((processed / total) * 90)));
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readProviderBaseUrl(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as { apiBaseUrl?: unknown }).apiBaseUrl;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function mergeJobMetadata(current: unknown, next: Record<string, unknown>) {
  return {
    ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}),
    ...next
  } as Prisma.InputJsonValue;
}

async function uploadCsv(key: string, csv: string) {
  await uploadPrivateObject({
    key,
    body: Buffer.from(csv),
    contentType: "text/csv; charset=utf-8",
    cacheControl: "private, max-age=0"
  });
}
