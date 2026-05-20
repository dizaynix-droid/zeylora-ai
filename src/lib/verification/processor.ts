import type { Prisma, VerificationEmailStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { getPrivateObjectText, uploadPrivateObject } from "@/lib/storage/s3-client";
import { buildVerificationCsv, filterResultsForExport } from "@/lib/verification/csv";
import { ensureVerificationDatabaseReady } from "@/lib/verification/db-readiness";
import { parseEmailList } from "@/lib/verification/email-parser";
import { getVerificationProvider } from "@/lib/verification/providers";
import type { ParsedEmailList, VerificationBulkInfoResult, VerificationProvider, VerificationProviderResult } from "@/lib/verification/types";

const DEFAULT_WORKER_EMAILS_PER_RUN = 1000;
const DEFAULT_PROVIDER_BATCH_SIZE = 500;
const DEFAULT_WORKER_TIME_BUDGET_MS = 22_000;
const DEFAULT_BATCH_MAX_RETRIES = 3;
const DEFAULT_BULK_EMAIL_THRESHOLD = 500;
const DEFAULT_BULK_POLL_INTERVAL_MS = 15_000;
const DEFAULT_WORKER_STALE_MS = 10 * 60 * 1000;

export type VerificationWorkerResult = {
  ok: boolean;
  processedJobs: number;
  processedEmails: number;
  completedJobs: number;
  failedJobs: number;
  message?: string;
};

export async function getVerificationJobProcessingState(jobId: string) {
  const job = await prisma.verificationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      uniqueEmails: true,
      processedCount: true,
      progressPercent: true,
      metadataJson: true
    }
  });

  if (!job) return null;
  const metadata = readJobMetadata(job.metadataJson);
  const isBulkJob = metadata.providerMode === "bulk";
  const remainingEmails = isBulkJob && (job.status === "QUEUED" || job.status === "PROCESSING")
    ? Math.max(1, job.uniqueEmails - job.processedCount)
    : Math.max(0, job.uniqueEmails - job.processedCount);
  const nextPollDelayMs = isBulkJob ? computeBulkPollDelayMs(metadata) : 0;

  return {
    id: job.id,
    status: job.status,
    uniqueEmails: job.uniqueEmails,
    processedCount: job.processedCount,
    progressPercent: job.progressPercent,
    remainingEmails,
    nextPollDelayMs,
    active: job.status === "QUEUED" || job.status === "PROCESSING"
  };
}

export async function processVerificationQueue(options: {
  jobId?: string | null;
  maxJobs?: number;
  maxEmails?: number;
  timeBudgetMs?: number;
} = {}): Promise<VerificationWorkerResult> {
  await ensureVerificationDatabaseReady(options.jobId ? `worker:${options.jobId}` : "worker:queue");
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
      console.info("[verification-worker-checkpoint]", {
        checkpoint: "claim_ready",
        jobId: job.id,
        maxEmails: Math.max(1, maxEmails - processedEmails),
        timeBudgetMs: Math.max(2_500, timeBudgetMs - (Date.now() - startedAt))
      });
      const result = await processVerificationJobChunk(job.id, {
        maxEmails: Math.max(1, maxEmails - processedEmails),
        timeBudgetMs: Math.max(2_500, timeBudgetMs - (Date.now() - startedAt))
      });
      processedJobs += 1;
      processedEmails += result.processedEmails;
      if (result.completed) completedJobs += 1;
      if (processedEmails >= maxEmails) break;
    } catch (error) {
      console.error("[verification-worker-error]", {
        checkpoint: "job_failed",
        jobId: job.id,
        message: error instanceof Error ? error.message : String(error || "Unknown worker error"),
        stack: error instanceof Error ? error.stack : null
      });
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
      status: true,
      userId: true,
      originalFilename: true,
      inputStorageKey: true,
      providerKey: true,
      uniqueEmails: true,
      processedCount: true,
      providerBatchCount: true,
      metadataJson: true
    }
  });

  if (!job) {
    throw new Error("Verification job was not found.");
  }

  console.info("[verification-worker-checkpoint]", {
    checkpoint: "job_loaded",
    jobId: job.id,
    providerKey: job.providerKey,
    uniqueEmails: job.uniqueEmails,
    hasInputStorageKey: Boolean(job.inputStorageKey)
  });

  const inputText = await readVerificationJobInput(job);
  const parsed = parseEmailList(inputText);
  const providerBatchSize = Math.max(1, Number(process.env.VERIFICATION_PROVIDER_BATCH_SIZE || DEFAULT_PROVIDER_BATCH_SIZE));
  const maxBatchRetries = Math.max(1, Number(process.env.VERIFICATION_BATCH_MAX_RETRIES || DEFAULT_BATCH_MAX_RETRIES));
  await ensureVerificationBatches(job.id, parsed.uniqueEmails.length, providerBatchSize);
  const processedCount = await prisma.verificationEmailResult.count({ where: { verificationJobId: job.id } });
  const remainingCount = Math.max(0, parsed.uniqueEmails.length - processedCount);

  console.info("[verification-worker-checkpoint]", {
    checkpoint: "input_parsed",
    jobId: job.id,
    parsedEmailCount: parsed.totalRows,
    uniqueEmailCount: parsed.uniqueEmails.length,
    syntaxInvalidCount: parsed.syntaxInvalidCount,
    alreadyProcessed: processedCount,
    remainingEmails: remainingCount,
    providerBatchSize,
    maxBatchRetries
  });

  if (remainingCount === 0) {
    await completeVerificationJob(job.id);
    return { processedEmails: 0, completed: true };
  }

  const providerSettings = await prisma.providerSetting
    .findUnique({
      where: { providerKey: job.providerKey },
      select: {
        apiKeyEncrypted: true,
        configJson: true,
        status: true
      }
    })
    .catch((error) => {
      console.warn("[verification-worker-provider-settings-fallback]", {
        jobId: job.id,
        providerKey: job.providerKey,
        message: error instanceof Error ? error.message : "ProviderSetting read failed",
        action: "continuing_with_env_provider_config"
      });
      return null;
    });

  console.info("[verification-worker-checkpoint]", {
    checkpoint: "provider_settings_loaded",
    jobId: job.id,
    providerKey: job.providerKey,
    dbStatus: providerSettings?.status ?? "no_db_row",
    dbApiKeyPresent: Boolean(providerSettings?.apiKeyEncrypted),
    envApiKeyPresent: Boolean(process.env.MILLIONVERIFIER_API_KEY)
  });

  if (providerSettings?.status === "SUSPENDED" || providerSettings?.status === "INACTIVE") {
    throw new Error("Verification provider is temporarily unavailable.");
  }

  const provider = getVerificationProvider(job.providerKey, {
    apiKey: providerSettings?.apiKeyEncrypted,
    baseUrl: readProviderBaseUrl(providerSettings?.configJson)
  });

  if (shouldUseBulkProvider(job.metadataJson, parsed.uniqueEmails.length, provider)) {
    return processBulkVerificationJob({
      job,
      parsed,
      provider,
      existingResultCount: processedCount
    });
  }

  let processedEmails = 0;
  let batchCount = 0;

  while (processedEmails < options.maxEmails) {
    if (Date.now() - startedAt > options.timeBudgetMs) break;
    const batchRow = await claimNextVerificationBatch(job.id, maxBatchRetries);
    if (!batchRow) break;
    const batch = parsed.uniqueEmails.slice(batchRow.emailStart, batchRow.emailEnd);

    console.info("[verification-provider-request-payload]", {
      jobId: job.id,
      batchId: batchRow.id,
      batchIndex: batchRow.batchIndex,
      attemptCount: batchRow.attemptCount + 1,
      providerKey: job.providerKey,
      batchSize: batch.length,
      domains: summarizeDomains(batch)
    });

    let providerResults: VerificationProviderResult[];
    try {
      providerResults = await provider.verifyBatch(batch);
    } catch (error) {
      console.error("[verification-provider-call-failed]", {
        jobId: job.id,
        batchId: batchRow.id,
        batchIndex: batchRow.batchIndex,
        providerKey: job.providerKey,
        batchSize: batch.length,
        domains: summarizeDomains(batch),
        message: error instanceof Error ? error.message : String(error || "Provider failed"),
        stack: error instanceof Error ? error.stack : null
      });
      const retryable = batchRow.attemptCount + 1 < maxBatchRetries;
      await markVerificationBatchFailed(batchRow.id, error, retryable);
      await prisma.verificationJob.update({
        where: { id: job.id },
        data: {
          status: retryable ? "QUEUED" : "PROCESSING",
          ...(!retryable ? { failedBatchCount: { increment: 1 } } : {}),
          errorMessage: retryable
            ? `Batch ${batchRow.batchIndex + 1} failed and will retry automatically.`
            : `Batch ${batchRow.batchIndex + 1} failed after ${maxBatchRetries} attempts.`,
          metadataJson: mergeJobMetadata(job.metadataJson, {
            worker: "chunked",
            lastBatchErrorAt: new Date().toISOString(),
            lastFailedBatchIndex: batchRow.batchIndex,
            lastBatchError: error instanceof Error ? error.message : String(error || "Provider failed")
          })
        }
      });
      if (retryable) {
        console.warn("[verification-batch-retry-queued]", {
          jobId: job.id,
          batchId: batchRow.id,
          batchIndex: batchRow.batchIndex,
          nextAttempt: batchRow.attemptCount + 2
        });
        break;
      }
      throw error;
    }

    console.info("[verification-provider-results-ready]", {
      jobId: job.id,
      batchId: batchRow.id,
      batchIndex: batchRow.batchIndex,
      providerKey: job.providerKey,
      resultCount: providerResults.length,
      statusCounts: countStatuses(providerResults.map((result) => result.status))
    });
    const dbResults = providerResults.map((result) => toDbResult(job.id, result));
    const counts = countStatuses(providerResults.map((result) => result.status));
    if (!(await isVerificationJobActive(job.id))) {
      console.info("[verification-worker-checkpoint]", {
        checkpoint: "job_no_longer_active_before_batch_write",
        jobId: job.id
      });
      break;
    }

    await prisma.$transaction([
      prisma.verificationEmailResult.createMany({ data: dbResults, skipDuplicates: true }),
      prisma.verificationBatch.update({
        where: { id: batchRow.id },
        data: {
          status: "COMPLETED",
          processedCount: providerResults.length,
          validCount: counts.VALID,
          invalidCount: counts.INVALID,
          riskyCount: counts.RISKY,
          catchAllCount: counts.CATCH_ALL,
          disposableCount: counts.DISPOSABLE,
          unknownCount: counts.UNKNOWN,
          errorMessage: null,
          completedAt: new Date()
        }
      }),
      prisma.verificationJob.update({
        where: { id: job.id },
        data: {
          status: "PROCESSING",
          providerBatchCount: { increment: 1 },
          processedCount: { increment: providerResults.length },
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
            lastCompletedBatchIndex: batchRow.batchIndex,
            processedEmails: processedCount + processedEmails + providerResults.length
          })
        }
      })
    ]);

    batchCount += 1;
    processedEmails += providerResults.length;
  }

  if (!(await isVerificationJobActive(job.id))) {
    return { processedEmails, completed: false };
  }

  const totalProcessed = await prisma.verificationEmailResult.count({ where: { verificationJobId: job.id } });
  const completed = totalProcessed >= parsed.uniqueEmails.length;
  if (completed) {
    await completeVerificationJob(job.id);
  } else if (processedEmails > 0) {
    await prisma.verificationJob.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        progressPercent: computeProgress(totalProcessed, parsed.uniqueEmails.length),
        metadataJson: mergeJobMetadata(job.metadataJson, {
          worker: "chunked",
          lastChunkEndedAt: new Date().toISOString(),
          processedEmails: totalProcessed
        })
      }
    });
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

async function processBulkVerificationJob(input: {
  job: {
    id: string;
    userId: string;
    originalFilename: string | null;
    providerKey: string;
    uniqueEmails: number;
    processedCount: number;
    metadataJson: Prisma.JsonValue | null;
  };
  parsed: ParsedEmailList;
  provider: VerificationProvider;
  existingResultCount: number;
}) {
  if (!input.provider.uploadBulkFile || !input.provider.getBulkFileInfo || !input.provider.downloadBulkReport) {
    throw new Error(`${input.job.providerKey} does not support bulk verification.`);
  }

  const metadata = readJobMetadata(input.job.metadataJson);
  const providerFileId = metadata.millionVerifierFileId || metadata.providerFileId;
  const bulkEmails = providerFileId
    ? readBulkInputEmails(metadata, input.parsed.uniqueEmails)
    : await getRemainingEmailsForBulkUpload(input.job.id, input.parsed.uniqueEmails);

  if (!providerFileId) {
    if (metadata.bulkUploadStartedAt) {
      await prisma.verificationJob.update({
        where: { id: input.job.id },
        data: {
          status: "FAILED",
          errorMessage: "Provider upload was started, but no provider file id was recorded. Support must review this job before retrying to avoid duplicate provider charges.",
          completedAt: new Date(),
          metadataJson: mergeJobMetadata(input.job.metadataJson, {
            providerMode: "bulk",
            providerUploadReviewRequired: true,
            providerUploadReviewReason: "missing_provider_file_id_after_upload_start",
            providerUploadReviewAt: new Date().toISOString()
          })
        }
      });
      throw new Error("Provider upload state is uncertain. Support review is required before retrying.");
    }

    if (bulkEmails.length === 0) {
      await completeVerificationJob(input.job.id);
      return { processedEmails: 0, completed: true };
    }

    const bulkUploadStartedAt = new Date().toISOString();
    await prisma.verificationJob.update({
      where: { id: input.job.id },
      data: {
        status: "PROCESSING",
        errorMessage: null,
        metadataJson: mergeJobMetadata(input.job.metadataJson, {
          providerMode: "bulk",
          bulkUploadStartedAt,
          bulkUploadEmailCount: bulkEmails.length
        })
      }
    });

    let upload;
    try {
      upload = await input.provider.uploadBulkFile({
        fileName: input.job.originalFilename || `zeylora-${input.job.id}.csv`,
        emails: bulkEmails
      });
    } catch (error) {
      await prisma.verificationJob.update({
        where: { id: input.job.id },
        data: {
          errorMessage: "Provider upload failed before a file id was recorded. Support must review this job before retrying.",
          metadataJson: mergeJobMetadata(input.job.metadataJson, {
            providerMode: "bulk",
            bulkUploadStartedAt,
            bulkUploadFailedAt: new Date().toISOString(),
            bulkUploadError: error instanceof Error ? error.message : "Provider bulk upload failed",
            providerUploadReviewRequired: true
          })
        }
      });
      throw error;
    }

    await updateBulkJobProgress({
      jobId: input.job.id,
      currentMetadata: input.job.metadataJson,
      nextStatus: "QUEUED",
      info: {
        ...upload,
        ok: 0,
        catchAll: 0,
        disposable: 0,
        invalid: 0,
        unknown: 0,
        unverified: Math.max(0, upload.uniqueEmails - upload.verified)
      },
      extraMetadata: {
        providerMode: "bulk",
        providerFileId: upload.providerFileId,
        millionVerifierFileId: upload.providerFileId,
        bulkInputEmails: bulkEmails,
        bulkInputEmailCount: bulkEmails.length,
        preBulkProcessedCount: input.existingResultCount,
        bulkUploadStartedAt,
        bulkUploadedAt: new Date().toISOString(),
        providerUploadReviewRequired: false
      }
    });

    return { processedEmails: 0, completed: false };
  }

  let info: VerificationBulkInfoResult;
  try {
    info = await input.provider.getBulkFileInfo(providerFileId);
  } catch (error) {
    await prisma.verificationJob.update({
      where: { id: input.job.id },
      data: {
        status: "QUEUED",
        errorMessage: "Provider progress could not be refreshed yet. The job will retry automatically.",
        metadataJson: mergeJobMetadata(input.job.metadataJson, {
          providerMode: "bulk",
          providerFileId,
          millionVerifierFileId: providerFileId,
          lastProviderSyncAt: new Date().toISOString(),
          lastProviderSyncError: error instanceof Error ? error.message : "Provider progress refresh failed"
        })
      }
    });
    console.warn("[verification-bulk-info-retry]", {
      jobId: input.job.id,
      providerFileId,
      message: error instanceof Error ? error.message : "Provider progress refresh failed"
    });
    return { processedEmails: 0, completed: false };
  }

  await updateBulkJobProgress({
    jobId: input.job.id,
    currentMetadata: input.job.metadataJson,
    nextStatus: isBulkProviderComplete(info, bulkEmails.length) ? "PROCESSING" : "QUEUED",
    info,
    extraMetadata: {
      providerMode: "bulk",
      providerFileId,
      millionVerifierFileId: providerFileId
    }
  });

  if (isBulkProviderFailure(info)) {
    throw new Error(`MillionVerifier bulk job failed with status ${info.providerStatus}.`);
  }

  if (!isBulkProviderComplete(info, bulkEmails.length)) {
    return {
      processedEmails: Math.max(0, info.verified - input.existingResultCount),
      completed: false
    };
  }

  let providerResults: VerificationProviderResult[];
  try {
    providerResults = await input.provider.downloadBulkReport(providerFileId);
  } catch (error) {
    await prisma.verificationJob.update({
      where: { id: input.job.id },
      data: {
        status: "QUEUED",
        progressPercent: 95,
        errorMessage: "Provider finished verification; report download will retry automatically.",
        metadataJson: mergeJobMetadata(input.job.metadataJson, {
          providerMode: "bulk",
          providerFileId,
          millionVerifierFileId: providerFileId,
          providerStatus: info.providerStatus,
          providerPercent: info.percent,
          lastProviderSyncAt: new Date().toISOString(),
          lastProviderReportDownloadError: error instanceof Error ? error.message : "Provider report download failed"
        })
      }
    });
    console.warn("[verification-bulk-report-retry]", {
      jobId: input.job.id,
      providerFileId,
      message: error instanceof Error ? error.message : "Provider report download failed"
    });
    return { processedEmails: 0, completed: false };
  }

  const completeResults = fillMissingBulkResults(bulkEmails, providerResults);
  await createVerificationResultsInChunks(input.job.id, completeResults);
  await prisma.verificationBatch.updateMany({
    where: { verificationJobId: input.job.id, status: { not: "COMPLETED" } },
    data: {
      status: "COMPLETED",
      completedAt: new Date()
    }
  });
  await completeVerificationJob(input.job.id);

  return {
    processedEmails: Math.max(0, completeResults.length - input.existingResultCount),
    completed: true
  };
}

async function ensureVerificationBatches(jobId: string, uniqueEmailCount: number, batchSize: number) {
  const existingCount = await prisma.verificationBatch.count({ where: { verificationJobId: jobId } });
  if (existingCount > 0 || uniqueEmailCount <= 0) return;

  const batches = [];
  for (let index = 0, batchIndex = 0; index < uniqueEmailCount; index += batchSize, batchIndex += 1) {
    const emailEnd = Math.min(uniqueEmailCount, index + batchSize);
    batches.push({
      verificationJobId: jobId,
      batchIndex,
      status: "PENDING",
      emailStart: index,
      emailEnd,
      emailCount: emailEnd - index
    });
  }

  await prisma.verificationBatch.createMany({
    data: batches,
    skipDuplicates: true
  });

  console.info("[verification-batches-created]", {
    jobId,
    batchSize,
    batchCount: batches.length,
    uniqueEmailCount
  });
}

async function claimNextVerificationBatch(jobId: string, maxRetries: number) {
  const staleBefore = new Date(Date.now() - Number(process.env.VERIFICATION_BATCH_STALE_MS || 120_000));
  const batch = await prisma.verificationBatch.findFirst({
    where: {
      verificationJobId: jobId,
      OR: [
        { status: "PENDING" },
        { status: "FAILED", attemptCount: { lt: maxRetries } },
        { status: "PROCESSING", updatedAt: { lt: staleBefore }, attemptCount: { lt: maxRetries } }
      ]
    },
    orderBy: [{ batchIndex: "asc" }],
    select: {
      id: true,
      batchIndex: true,
      status: true,
      updatedAt: true,
      emailStart: true,
      emailEnd: true,
      emailCount: true,
      attemptCount: true
    }
  });

  if (!batch) return null;

  const claimed = await prisma.verificationBatch.updateMany({
    where: {
      id: batch.id,
      updatedAt: batch.updatedAt,
      status: batch.status
    },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
      startedAt: new Date(),
      errorMessage: null
    }
  });

  if (claimed.count !== 1) return null;

  console.info("[verification-batch-status]", {
    jobId,
    batchId: batch.id,
    batchIndex: batch.batchIndex,
    status: "PROCESSING",
    emailCount: batch.emailCount,
    attempt: batch.attemptCount + 1
  });

  return batch;
}

async function markVerificationBatchFailed(batchId: string, error: unknown, retryable: boolean) {
  await prisma.verificationBatch.update({
    where: { id: batchId },
    data: {
      status: retryable ? "FAILED" : "FAILED",
      errorMessage: error instanceof Error ? error.message : String(error || "Provider failed"),
      completedAt: retryable ? null : new Date()
    }
  });
}

async function claimNextVerificationJob(jobId?: string | null) {
  const staleBefore = new Date(Date.now() - Number(process.env.VERIFICATION_WORKER_STALE_MS || DEFAULT_WORKER_STALE_MS));
  const activeCondition = [
    { status: "QUEUED" as const },
    { status: "PROCESSING" as const, updatedAt: { lt: staleBefore } }
  ];
  const candidate = await prisma.verificationJob.findFirst({
    where: {
      deletedAt: null,
      ...(jobId ? { id: jobId } : {}),
      OR: activeCondition
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
      status: true,
      userId: true,
      originalFilename: true,
      uniqueEmails: true,
      metadataJson: true,
      user: {
        select: {
          email: true
        }
      }
    }
  });

  if (!job) return;
  if (job.status === "CANCELED" || job.status === "CANCELLED") return;

  const exportBase = `verification/${job.userId}/${job.id}`;
  let fullReportKey: string | null = `${exportBase}/full-report.csv`;
  let validExportKey: string | null = `${exportBase}/valid-emails.csv`;
  let invalidExportKey: string | null = `${exportBase}/invalid-emails.csv`;
  let riskyExportKey: string | null = `${exportBase}/risky-catch-all-disposable.csv`;
  let exportStorageError: string | null = null;
  const allResults = await readAllResultsForExport(job.id);

  try {
    await Promise.all([
      uploadCsv(fullReportKey, buildVerificationCsv(allResults)),
      uploadCsv(validExportKey, buildVerificationCsv(filterResultsForExport(allResults, "valid"))),
      uploadCsv(invalidExportKey, buildVerificationCsv(filterResultsForExport(allResults, "invalid"))),
      uploadCsv(riskyExportKey, buildVerificationCsv(filterResultsForExport(allResults, "risky")))
    ]);
  } catch (error) {
    exportStorageError = error instanceof Error ? error.message : "CSV export storage failed.";
    fullReportKey = null;
    validExportKey = null;
    invalidExportKey = null;
    riskyExportKey = null;
    console.error("[verification-export-storage-failed]", {
      jobId: job.id,
      userId: job.userId,
      message: exportStorageError
    });
  }

  const resultCounts = countStatuses(allResults.map((result) => result.status));
  await prisma.verificationJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      progressPercent: 100,
      processedCount: job.uniqueEmails,
      creditsUsed: job.uniqueEmails,
      validCount: resultCounts.VALID,
      invalidCount: resultCounts.INVALID,
      riskyCount: resultCounts.RISKY,
      catchAllCount: resultCounts.CATCH_ALL,
      disposableCount: resultCounts.DISPOSABLE,
      unknownCount: resultCounts.UNKNOWN,
      fullReportStorageKey: fullReportKey,
      validExportStorageKey: validExportKey,
      invalidExportStorageKey: invalidExportKey,
      riskyExportStorageKey: riskyExportKey,
      completedAt: new Date(),
      metadataJson: mergeJobMetadata(job.metadataJson, {
        worker: "chunked",
        completedAt: new Date().toISOString(),
        exportRows: allResults.length,
        ...(exportStorageError ? { exportStorageError } : {})
      })
    }
  });

  await safeSendVerificationLifecycleEmail({
    templateKey: "verification_job_completed",
    userId: job.userId,
    email: job.user.email,
    jobId: job.id,
    payload: {
      jobId: job.id,
      fileName: job.originalFilename || "Email list",
      uniqueEmails: job.uniqueEmails,
      validCount: resultCounts.VALID,
      invalidCount: resultCounts.INVALID,
      riskyCount: resultCounts.RISKY + resultCounts.CATCH_ALL + resultCounts.DISPOSABLE
    }
  });
}

async function readVerificationJobInput(job: {
  id: string;
  inputStorageKey: string | null;
  metadataJson: Prisma.JsonValue | null;
}) {
  if (job.inputStorageKey) {
    return getPrivateObjectText(job.inputStorageKey);
  }

  const inlineEmails = readInlineEmails(job.metadataJson);
  if (inlineEmails.length > 0) {
    return inlineEmails.join("\n");
  }

  throw new Error("Verification job input is missing.");
}

async function failVerificationJob(jobId: string, error: unknown) {
  const job = await prisma.verificationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      userId: true,
      originalFilename: true,
      creditsReserved: true,
      creditsUsed: true,
      uniqueEmails: true,
      providerKey: true,
      user: {
        select: {
          email: true
        }
      }
    }
  });

  if (!job) return;
  const processedCount = await prisma.verificationEmailResult.count({ where: { verificationJobId: job.id } });
  const chargeableCount = Math.max(processedCount, job.creditsUsed);
  const finalStatus = chargeableCount > 0 ? "PARTIAL_FAILED" : "FAILED";
  const requestedRefundAmount = Math.max(0, job.creditsReserved - chargeableCount);

  await prisma.verificationJob.update({
    where: { id: job.id },
    data: {
      status: finalStatus,
      processedCount,
      creditsUsed: chargeableCount,
      progressPercent: computeProgress(chargeableCount, job.uniqueEmails),
      errorMessage:
        chargeableCount > 0
          ? `${error instanceof Error ? error.message : "Verification failed."} ${chargeableCount.toLocaleString()} verification attempts were already processed; unprocessed credits were refunded.`
          : error instanceof Error ? error.message : "Verification failed.",
      completedAt: new Date()
    }
  });

  const refundResult = requestedRefundAmount > 0
    ? await refundVerificationCredits({
        userId: job.userId,
        jobId: job.id,
        amount: requestedRefundAmount,
        note: "Verification job failed refund"
      })
    : { refundedCredits: 0 };

  console.error("[verification-worker-failed]", {
    jobId: job.id,
    provider: job.providerKey,
    status: finalStatus,
    processedCount,
    chargeableCount,
    refundedCredits: refundResult.refundedCredits,
    message: error instanceof Error ? error.message : "Verification failed."
  });

  await safeSendVerificationLifecycleEmail({
    templateKey: "verification_job_failed",
    userId: job.userId,
    email: job.user.email,
    jobId: job.id,
    payload: {
      jobId: job.id,
      fileName: job.originalFilename || "Email list",
      uniqueEmails: job.uniqueEmails,
      refundedCredits: refundResult.refundedCredits,
      errorMessage:
        chargeableCount > 0
          ? `Verification stopped after ${chargeableCount.toLocaleString("en-US")} verification attempts.`
          : error instanceof Error ? error.message : "Verification failed before processing started."
    }
  });
}

export async function reserveVerificationCredits(input: { userId: string; jobId: string; amount: number }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "VerificationJob" WHERE id = ${input.jobId} FOR UPDATE`;
    const job = await tx.verificationJob.findFirst({
      where: {
        id: input.jobId,
        userId: input.userId
      },
      select: {
        creditsReserved: true,
        creditsUsed: true
      }
    });
    if (!job) {
      return { ok: false as const, reason: "job_not_found" as const };
    }
    const existingUse = await tx.creditTransaction.aggregate({
      where: {
        userId: input.userId,
        verificationJobId: input.jobId,
        type: "USE"
      },
      _sum: { amount: true }
    });
    const alreadyReserved = Math.abs(Math.min(0, existingUse._sum.amount ?? 0));
    if (alreadyReserved >= input.amount) {
      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: { creditBalance: true }
      });
      return { ok: true as const, balanceAfter: user?.creditBalance ?? 0, alreadyReserved: true as const };
    }
    const amountToReserve = input.amount - alreadyReserved;
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { creditBalance: true }
    });
    if (!user || user.creditBalance < amountToReserve) {
      return { ok: false as const };
    }
    const balanceAfter = user.creditBalance - amountToReserve;
    await tx.user.update({
      where: { id: input.userId },
      data: { creditBalance: balanceAfter }
    });
    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        type: "USE",
        amount: -amountToReserve,
        balanceAfter,
        verificationJobId: input.jobId,
        note: "Email verification credits reserved"
      }
    });
    return { ok: true as const, balanceAfter };
  });
}

export async function refundVerificationCredits(input: { userId: string; jobId: string; amount: number; note: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "VerificationJob" WHERE id = ${input.jobId} FOR UPDATE`;
    const job = await tx.verificationJob.findFirst({
      where: {
        id: input.jobId,
        userId: input.userId
      },
      select: {
        creditsReserved: true,
        creditsUsed: true
      }
    });
    if (!job) return { refundedCredits: 0, balanceAfter: null as number | null };
    const existingRefund = await tx.creditTransaction.aggregate({
      where: {
        userId: input.userId,
        verificationJobId: input.jobId,
        type: "REFUND"
      },
      _sum: { amount: true }
    });
    const alreadyRefunded = Math.max(0, existingRefund._sum.amount ?? 0);
    const refundableCredits = Math.max(0, job.creditsReserved - job.creditsUsed - alreadyRefunded);
    const refundAmount = Math.max(0, Math.min(input.amount, refundableCredits));
    if (refundAmount <= 0) {
      console.warn("[verification-credit-refund-skipped]", {
        userId: input.userId,
        jobId: input.jobId,
        requestedAmount: input.amount,
        creditsReserved: job.creditsReserved,
        creditsUsed: job.creditsUsed,
        alreadyRefunded
      });
      return { refundedCredits: 0, balanceAfter: null as number | null };
    }
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { creditBalance: true }
    });
    if (!user) return { refundedCredits: 0, balanceAfter: null as number | null };
    const balanceAfter = user.creditBalance + refundAmount;
    await tx.user.update({
      where: { id: input.userId },
      data: { creditBalance: balanceAfter }
    });
    await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        type: "REFUND",
        amount: refundAmount,
        balanceAfter,
        verificationJobId: input.jobId,
        note: input.note
      }
    });
    return { refundedCredits: refundAmount, balanceAfter };
  });
}

export async function cancelVerificationJob(input: { userId: string; jobId: string; reason?: string }) {
  await ensureVerificationDatabaseReady(`cancel:${input.jobId}`);
  const job = await prisma.verificationJob.findFirst({
    where: {
      id: input.jobId,
      userId: input.userId,
      deletedAt: null
    },
    select: {
      id: true,
      userId: true,
      status: true,
      uniqueEmails: true,
      creditsReserved: true,
      creditsUsed: true,
      providerKey: true,
      metadataJson: true
    }
  });

  if (!job) {
    return { ok: false as const, error: "Verification job was not found." };
  }

  if (["COMPLETED", "FAILED", "PARTIAL_FAILED", "CANCELED", "CANCELLED"].includes(job.status)) {
    return { ok: true as const, alreadyFinal: true as const, refundedCredits: 0, processedCount: job.creditsUsed };
  }

  if (job.status === "PROCESSING") {
    console.warn("[verification-cancel-blocked-processing]", {
      jobId: job.id,
      providerKey: job.providerKey
    });
    return {
      ok: false as const,
      cancelBlocked: true as const,
      error: "This verification is already processing and cannot be canceled safely. Please contact support if you need help with this job."
    };
  }

  const metadata = readJobMetadata(job.metadataJson);
  const providerFileId = metadata.providerFileId || metadata.millionVerifierFileId;
  if (providerFileId) {
    console.warn("[verification-cancel-blocked-provider-started]", {
      jobId: job.id,
      providerFileId,
      providerKey: job.providerKey
    });
    return {
      ok: false as const,
      cancelBlocked: true as const,
      error: "This verification is already running at the provider and cannot be canceled safely. Please contact support if you need help with this job."
    };
  }

  const allResults = await readAllResultsForExport(job.id);
  const processedCount = allResults.length;
  const chargeableCount = Math.max(processedCount, job.creditsUsed);
  const resultCounts = countStatuses(allResults.map((result) => result.status));
  const exportFiles = await createVerificationExportFiles({
    jobId: job.id,
    userId: job.userId,
    allResults,
    label: "partial-canceled"
  });
  const requestedRefundAmount = Math.max(0, job.creditsReserved - chargeableCount);

  await prisma.verificationJob.update({
    where: { id: job.id },
    data: {
      status: "CANCELED",
      processedCount,
      creditsUsed: chargeableCount,
      validCount: resultCounts.VALID,
      invalidCount: resultCounts.INVALID,
      riskyCount: resultCounts.RISKY,
      catchAllCount: resultCounts.CATCH_ALL,
      disposableCount: resultCounts.DISPOSABLE,
      unknownCount: resultCounts.UNKNOWN,
      progressPercent: computeProgress(chargeableCount, job.uniqueEmails),
      errorMessage: input.reason || "Verification job was canceled. Unused credits were refunded automatically.",
      fullReportStorageKey: exportFiles.fullReportKey,
      validExportStorageKey: exportFiles.validExportKey,
      invalidExportStorageKey: exportFiles.invalidExportKey,
      riskyExportStorageKey: exportFiles.riskyExportKey,
      completedAt: new Date(),
      metadataJson: mergeJobMetadata(job.metadataJson, {
        canceledAt: new Date().toISOString(),
        exportRows: allResults.length,
        ...(exportFiles.exportStorageError ? { exportStorageError: exportFiles.exportStorageError } : {})
      })
    }
  });
  const refundResult = requestedRefundAmount > 0
    ? await refundVerificationCredits({
        userId: job.userId,
        jobId: job.id,
        amount: requestedRefundAmount,
        note: "Verification job canceled refund"
      })
    : { refundedCredits: 0 };
  await prisma.verificationJob.update({
    where: { id: job.id },
    data: {
      errorMessage: input.reason || `Verification job was canceled. ${refundResult.refundedCredits.toLocaleString("en-US")} unused credits were refunded automatically.`,
      metadataJson: mergeJobMetadata(job.metadataJson, {
        canceledAt: new Date().toISOString(),
        refundedCredits: refundResult.refundedCredits,
        exportRows: allResults.length,
        ...(exportFiles.exportStorageError ? { exportStorageError: exportFiles.exportStorageError } : {})
      })
    }
  });

  console.info("[verification-job-canceled]", {
    jobId: job.id,
    userId: job.userId,
    processedCount,
    chargeableCount,
    refundedCredits: refundResult.refundedCredits
  });

  return { ok: true as const, refundedCredits: refundResult.refundedCredits, processedCount };
}

async function updateBulkJobProgress(input: {
  jobId: string;
  currentMetadata: Prisma.JsonValue | null;
  info: VerificationBulkInfoResult;
  nextStatus?: "QUEUED" | "PROCESSING";
  extraMetadata?: Record<string, unknown>;
}) {
  await prisma.verificationJob.updateMany({
    where: {
      id: input.jobId,
      status: { in: ["QUEUED", "PROCESSING"] }
    },
    data: {
      status: input.nextStatus || "PROCESSING",
      processedCount: input.info.verified,
      creditsUsed: Math.max(0, Math.min(input.info.verified, input.info.uniqueEmails || input.info.totalRows || input.info.verified)),
      validCount: input.info.ok,
      invalidCount: input.info.invalid,
      riskyCount: 0,
      catchAllCount: input.info.catchAll,
      disposableCount: input.info.disposable,
      unknownCount: input.info.unknown,
      progressPercent: computeBulkProgress(input.info),
      errorMessage: null,
      metadataJson: mergeJobMetadata(input.currentMetadata, {
        ...(input.extraMetadata || {}),
        providerStatus: input.info.providerStatus,
        providerPercent: input.info.percent,
        providerVerified: input.info.verified,
        providerUnverified: input.info.unverified,
        providerEstimatedTimeSec: input.info.estimatedTimeSec ?? null,
        lastProviderSyncAt: new Date().toISOString()
      })
    }
  });
}

async function createVerificationResultsInChunks(jobId: string, results: VerificationProviderResult[]) {
  const chunkSize = 5_000;
  for (let index = 0; index < results.length; index += chunkSize) {
    await prisma.verificationEmailResult.createMany({
      data: results.slice(index, index + chunkSize).map((result) => toDbResult(jobId, result)),
      skipDuplicates: true
    });
  }
}

async function createVerificationExportFiles(input: {
  jobId: string;
  userId: string;
  allResults: Awaited<ReturnType<typeof readAllResultsForExport>>;
  label: string;
}) {
  const exportBase = `verification/${input.userId}/${input.jobId}`;
  let fullReportKey: string | null = `${exportBase}/${input.label}-full-report.csv`;
  let validExportKey: string | null = `${exportBase}/${input.label}-valid-emails.csv`;
  let invalidExportKey: string | null = `${exportBase}/${input.label}-invalid-emails.csv`;
  let riskyExportKey: string | null = `${exportBase}/${input.label}-risky-catch-all-disposable.csv`;
  let exportStorageError: string | null = null;

  if (input.allResults.length === 0) {
    return {
      fullReportKey: null,
      validExportKey: null,
      invalidExportKey: null,
      riskyExportKey: null,
      exportStorageError: null
    };
  }

  try {
    await Promise.all([
      uploadCsv(fullReportKey, buildVerificationCsv(input.allResults)),
      uploadCsv(validExportKey, buildVerificationCsv(filterResultsForExport(input.allResults, "valid"))),
      uploadCsv(invalidExportKey, buildVerificationCsv(filterResultsForExport(input.allResults, "invalid"))),
      uploadCsv(riskyExportKey, buildVerificationCsv(filterResultsForExport(input.allResults, "risky")))
    ]);
  } catch (error) {
    exportStorageError = error instanceof Error ? error.message : "CSV export storage failed.";
    fullReportKey = null;
    validExportKey = null;
    invalidExportKey = null;
    riskyExportKey = null;
    console.error("[verification-export-storage-failed]", {
      jobId: input.jobId,
      userId: input.userId,
      label: input.label,
      message: exportStorageError
    });
  }

  return {
    fullReportKey,
    validExportKey,
    invalidExportKey,
    riskyExportKey,
    exportStorageError
  };
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

function summarizeDomains(emails: string[]) {
  const counts = new Map<string, number>();
  for (const email of emails) {
    const domain = email.includes("@") ? email.split("@").pop()?.toLowerCase() || "unknown" : "unknown";
    counts.set(domain, (counts.get(domain) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));
}

function computeProgress(processed: number, total: number) {
  if (total <= 0) return 10;
  if (processed <= 0) return 5;
  return Math.min(95, Math.max(15, Math.round((processed / total) * 90)));
}

function computeBulkProgress(info: VerificationBulkInfoResult) {
  if (info.percent > 0) return Math.min(95, Math.max(10, Math.round(info.percent * 0.95)));
  const providerTotal = info.uniqueEmails || info.totalRows;
  if (providerTotal > 0 && info.verified > 0) return computeProgress(info.verified, providerTotal);
  return 10;
}

function shouldUseBulkProvider(metadataJson: unknown, uniqueEmailCount: number, provider: VerificationProvider) {
  if (!provider.uploadBulkFile || !provider.getBulkFileInfo || !provider.downloadBulkReport) return false;
  const metadata = readJobMetadata(metadataJson);
  if (metadata.providerMode === "single") return false;
  if (metadata.providerMode === "bulk" || metadata.providerFileId || metadata.millionVerifierFileId) return true;
  const threshold = Math.max(1, Number(process.env.VERIFICATION_BULK_EMAIL_THRESHOLD || DEFAULT_BULK_EMAIL_THRESHOLD));
  return uniqueEmailCount >= threshold;
}

function isBulkProviderComplete(info: VerificationBulkInfoResult, fallbackTotal: number) {
  const status = info.providerStatus.toLowerCase();
  if (["completed", "complete", "finished", "done"].includes(status)) return true;
  const expectedTotal = info.uniqueEmails || info.totalRows || fallbackTotal;
  return info.percent >= 100 || (expectedTotal > 0 && info.verified >= expectedTotal && info.unverified === 0);
}

function isBulkProviderFailure(info: VerificationBulkInfoResult) {
  const status = info.providerStatus.toLowerCase();
  return ["failed", "failure", "error", "cancelled", "canceled"].includes(status);
}

async function isVerificationJobActive(jobId: string) {
  const job = await prisma.verificationJob.findUnique({
    where: { id: jobId },
    select: { status: true }
  });
  return job?.status === "QUEUED" || job?.status === "PROCESSING";
}

function fillMissingBulkResults(emails: string[], providerResults: VerificationProviderResult[]) {
  const byEmail = new Map(providerResults.map((result) => [result.email.toLowerCase(), result]));
  for (const email of emails) {
    const normalized = email.toLowerCase();
    if (!byEmail.has(normalized)) {
      byEmail.set(normalized, {
        email,
        status: "UNKNOWN",
        reason: "Provider report did not include this email.",
        raw: { source: "zeylora_missing_bulk_report_row" }
      });
    }
  }
  return emails.map((email) => byEmail.get(email.toLowerCase())!);
}

async function getRemainingEmailsForBulkUpload(jobId: string, emails: string[]) {
  const processed = await readProcessedEmailSet(jobId);
  return emails.filter((email) => !processed.has(email.toLowerCase()));
}

async function readProcessedEmailSet(jobId: string) {
  const processed = new Set<string>();
  const pageSize = 5_000;
  for (let skip = 0; ; skip += pageSize) {
    const rows = await prisma.verificationEmailResult.findMany({
      where: { verificationJobId: jobId },
      select: { normalizedEmail: true },
      skip,
      take: pageSize
    });
    for (const row of rows) {
      processed.add(row.normalizedEmail.toLowerCase());
    }
    if (rows.length < pageSize) break;
  }
  return processed;
}

function readBulkInputEmails(metadata: Record<string, string>, fallbackEmails: string[]) {
  const candidate = (metadata as { bulkInputEmails?: unknown }).bulkInputEmails;
  if (!Array.isArray(candidate)) return fallbackEmails;
  const emails = candidate.filter((email): email is string => typeof email === "string" && email.includes("@"));
  return emails.length > 0 ? emails : fallbackEmails;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readProviderBaseUrl(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as { apiBaseUrl?: unknown }).apiBaseUrl;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function readInlineEmails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const candidate = (value as { inlineEmails?: unknown }).inlineEmails;
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((email): email is string => typeof email === "string" && email.includes("@"));
}

function readJobMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }
  return value as Record<string, string>;
}

function computeBulkPollDelayMs(metadata: Record<string, string>) {
  const lastSyncAt = metadata.lastProviderSyncAt ? Date.parse(metadata.lastProviderSyncAt) : 0;
  if (!lastSyncAt || Number.isNaN(lastSyncAt)) return 0;
  const pollIntervalMs = Math.max(5_000, Number(process.env.VERIFICATION_BULK_POLL_INTERVAL_MS || DEFAULT_BULK_POLL_INTERVAL_MS));
  return Math.max(0, pollIntervalMs - (Date.now() - lastSyncAt));
}

function mergeJobMetadata(current: unknown, next: Record<string, unknown>) {
  return {
    ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}),
    ...next
  } as Prisma.InputJsonValue;
}

async function safeSendVerificationLifecycleEmail(input: {
  templateKey: "verification_job_completed" | "verification_job_failed";
  userId: string;
  email: string;
  jobId: string;
  payload: Record<string, unknown>;
}) {
  await sendTransactionalEmail({
    templateKey: input.templateKey,
    to: input.email,
    userId: input.userId,
    idempotencyKey: `${input.templateKey}:${input.jobId}`,
    payload: input.payload
  }).catch((error) => {
    console.warn("[verification-email-failed]", {
      jobId: input.jobId,
      userId: input.userId,
      templateKey: input.templateKey,
      message: error instanceof Error ? error.message : "Verification lifecycle email failed"
    });
  });
}

async function uploadCsv(key: string, csv: string) {
  await uploadPrivateObject({
    key,
    body: Buffer.from(csv),
    contentType: "text/csv; charset=utf-8",
    cacheControl: "private, max-age=0"
  });
}
