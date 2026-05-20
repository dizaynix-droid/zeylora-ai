import { after, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { getStorageConfig, uploadPrivateObject } from "@/lib/storage/s3-client";
import { ensureVerificationDatabaseReady } from "@/lib/verification/db-readiness";
import { parseEmailList, looksLikeSupportedListFile } from "@/lib/verification/email-parser";
import { getVerificationEconomicsSnapshot } from "@/lib/verification/economics";
import { getVerificationJobProcessingState, processVerificationQueue, refundVerificationCredits, reserveVerificationCredits } from "@/lib/verification/processor";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = Number(process.env.MAX_VERIFICATION_UPLOAD_BYTES || 25 * 1024 * 1024);
const INLINE_INPUT_EMAIL_LIMIT = Number(process.env.VERIFICATION_INLINE_INPUT_EMAIL_LIMIT || 5_000);
const INLINE_INPUT_BYTES_LIMIT = Number(process.env.VERIFICATION_INLINE_INPUT_BYTES_LIMIT || 750_000);
const MAX_PASTE_EMAILS = Number(process.env.MAX_VERIFICATION_PASTE_EMAILS || 5_000);
const MAX_EMAILS_PER_JOB = Number(process.env.MAX_VERIFICATION_EMAILS_PER_JOB || 50_000);
const STARTER_WORKER_EMAIL_LIMIT = Number(process.env.VERIFICATION_STARTER_WORKER_EMAIL_LIMIT || 1_000);
const STARTER_WORKER_TIME_BUDGET_MS = Number(process.env.VERIFICATION_STARTER_WORKER_TIME_BUDGET_MS || 25_000);
const LIST_FINGERPRINT_REUSE_MS = Number(process.env.VERIFICATION_LIST_FINGERPRINT_REUSE_MS || 24 * 60 * 60 * 1000);
const MAX_ACTIVE_JOBS_PER_USER = Number(process.env.MAX_ACTIVE_VERIFICATION_JOBS_PER_USER || 3);
const MAX_ACTIVE_JOBS_GLOBAL = Number(process.env.MAX_ACTIVE_VERIFICATION_JOBS_GLOBAL || 20);

export async function GET(request: Request) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  await ensureVerificationDatabaseReady("jobs-list").catch((error) => {
    console.error("[verification-db-readiness-failed]", {
      scope: "jobs-list",
      message: error instanceof Error ? error.message : String(error || "Unknown readiness error"),
      stack: error instanceof Error ? error.stack : null
    });
    throw error;
  });

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(25, Math.max(5, Number(url.searchParams.get("pageSize") || 10)));
  const status = url.searchParams.get("status");
  const where = {
    userId: user.id,
    deletedAt: null,
    ...(status && status !== "all" ? { status: status as never } : {})
  };
  const [jobs, total] = await Promise.all([
    prisma.verificationJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        originalFilename: true,
        totalEmails: true,
        uniqueEmails: true,
        syntaxInvalidCount: true,
        processedCount: true,
        failedBatchCount: true,
        validCount: true,
        invalidCount: true,
        riskyCount: true,
        catchAllCount: true,
        disposableCount: true,
        unknownCount: true,
        creditsReserved: true,
        creditsUsed: true,
        providerKey: true,
        progressPercent: true,
        createdAt: true,
        completedAt: true,
        errorMessage: true,
        validExportStorageKey: true,
        invalidExportStorageKey: true,
        riskyExportStorageKey: true,
        fullReportStorageKey: true
      }
    }),
    prisma.verificationJob.count({ where })
  ]);
  const totalMs = Date.now() - startedAt;

  if (process.env.NODE_ENV === "development" || process.env.ADMIN_PERF_LOGS === "true") {
    console.info("[dashboard-perf] verification.jobs.list", {
      totalMs,
      page,
      pageSize,
      resultCount: jobs.length,
      total,
      status: status || "all"
    });
  }

  return NextResponse.json({
    ok: true,
    jobs,
    pagination: createPagination(page, pageSize, total),
    timing: { totalMs }
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const traceId = crypto.randomUUID();
  verificationStartLog(traceId, "request_received", {
    contentType: request.headers.get("content-type") || "unknown"
  });

  const user = await getCurrentUser(request).catch((error) => {
    verificationStartError(traceId, "auth_lookup_failed", error);
    throw error;
  });

  verificationStartLog(traceId, "auth_checked", {
    authenticated: Boolean(user),
    userId: user?.id ?? null,
    email: maskEmail(user?.email),
    role: user?.role ?? null,
    creditBalance: user?.creditBalance ?? null
  });

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please sign in to start verification. Your list has been saved and will be restored after login.",
        code: "unauthenticated",
        traceId
      },
      { status: 401 }
    );
  }

  try {
    verificationStartLog(traceId, "database_readiness_attempt", { userId: user.id });
    await ensureVerificationDatabaseReady(traceId);
    verificationStartLog(traceId, "database_readiness_ready", { userId: user.id });
  } catch (error) {
    verificationStartError(traceId, "database_readiness_failed", error, { userId: user.id });
    return NextResponse.json(
      {
        ok: false,
        code: "database_not_ready",
        error: "Verification database is not ready yet. Please contact support.",
        traceId
      },
      { status: 503 }
    );
  }

  const rateLimit = checkRateLimit(request, {
    action: "job",
    userId: user.id,
    role: user.role
  });

  if (!rateLimit.ok) {
    verificationStartLog(traceId, "rate_limit_blocked", {
      userId: user.id,
      action: "job"
    });
    return rateLimitResponse(rateLimit);
  }

  const [activeJobsForUser, activeJobsGlobal] = await Promise.all([
    prisma.verificationJob.count({
      where: {
        userId: user.id,
        deletedAt: null,
        status: { in: ["QUEUED", "PROCESSING"] }
      }
    }),
    prisma.verificationJob.count({
      where: {
        deletedAt: null,
        status: { in: ["QUEUED", "PROCESSING"] }
      }
    })
  ]);

  if (activeJobsForUser >= MAX_ACTIVE_JOBS_PER_USER) {
    return NextResponse.json(
      {
        ok: false,
        code: "too_many_active_jobs",
        error: `You already have ${activeJobsForUser.toLocaleString("en-US")} verification jobs running. Please wait for one to finish before starting another list.`,
        traceId
      },
      { status: 429 }
    );
  }

  if (activeJobsGlobal >= MAX_ACTIVE_JOBS_GLOBAL) {
    return NextResponse.json(
      {
        ok: false,
        code: "verification_queue_busy",
        error: "Verification is busy right now. Please try again in a few minutes; your credits were not charged.",
        traceId
      },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const pasted = String(formData.get("emails") || "");
  const clientIdempotencyKey = String(formData.get("idempotencyKey") || request.headers.get("x-idempotency-key") || "").trim();
  let sourceText = pasted;
  let originalFilename: string | null = null;
  const sourceType = file instanceof File && file.size > 0 ? "upload" : "paste";

  if (file instanceof File && file.size > 0) {
    verificationStartLog(traceId, "file_received", {
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || "unknown"
    });
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          code: "file_too_large",
          error: `This file is too large. Maximum upload size is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB. Please split your list into smaller files and try again.`,
          traceId
        },
        { status: 413 }
      );
    }
    if (!looksLikeSupportedListFile(file)) {
      return NextResponse.json(
        {
          ok: false,
          code: "invalid_file_format",
          error: "We could not read this file. Please upload a CSV or TXT file with one email per row.",
          traceId
        },
        { status: 400 }
      );
    }
    originalFilename = file.name;
    sourceText = await file.text();
  }

  const parsed = parseEmailList(sourceText);
  verificationStartLog(traceId, "emails_parsed", {
    userId: user.id,
    sourceType,
    parsedEmailCount: parsed.totalRows,
    uniqueEmailCount: parsed.uniqueEmails.length,
    duplicateEmailCount: parsed.duplicateEmails.length,
    syntaxInvalidCount: parsed.syntaxInvalidCount,
    sourceBytes: Buffer.byteLength(sourceText, "utf8")
  });

  if (parsed.uniqueEmails.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "no_valid_emails",
        error: "We could not find valid email addresses in this list. Please check your file and try again.",
        traceId
      },
      { status: 400 }
    );
  }

  if (sourceType === "paste" && parsed.uniqueEmails.length > MAX_PASTE_EMAILS) {
    return NextResponse.json(
      {
        ok: false,
        code: "paste_limit_exceeded",
        error: `Paste verification supports up to ${MAX_PASTE_EMAILS.toLocaleString("en-US")} emails at once. Please upload a CSV/TXT file for larger lists.`,
        maxPasteEmails: MAX_PASTE_EMAILS,
        uniqueEmails: parsed.uniqueEmails.length,
        traceId
      },
      { status: 413 }
    );
  }

  if (parsed.uniqueEmails.length > MAX_EMAILS_PER_JOB) {
    return NextResponse.json(
      {
        ok: false,
        code: "job_email_limit_exceeded",
        error: `This list contains more emails than the current job limit. Please upload up to ${MAX_EMAILS_PER_JOB.toLocaleString("en-US")} emails per job or contact support for larger volume.`,
        maxEmailsPerJob: MAX_EMAILS_PER_JOB,
        uniqueEmails: parsed.uniqueEmails.length,
        traceId
      },
      { status: 413 }
    );
  }

  verificationStartLog(traceId, "credits_checked", {
    userId: user.id,
    creditBalance: user.creditBalance,
    requiredCredits: parsed.uniqueEmails.length
  });

  if (user.creditBalance < parsed.uniqueEmails.length) {
    return NextResponse.json(
      {
        ok: false,
        code: "insufficient_credits",
        error: `You need ${parsed.uniqueEmails.length.toLocaleString("en-US")} verification credits for this list. Please buy more credits to continue.`,
        requiredCredits: parsed.uniqueEmails.length,
        creditBalance: user.creditBalance,
        traceId
      },
      { status: 402 }
    );
  }

  const inputKey = `verification/${user.id}/${crypto.randomUUID()}/input.txt`;
  const idempotencyKey = buildIdempotencyKey(user.id, parsed.uniqueEmails, clientIdempotencyKey);
  const providerRequestId = `start:${idempotencyKey}`;
  const inlineInputAllowed =
    parsed.uniqueEmails.length <= INLINE_INPUT_EMAIL_LIMIT &&
    Buffer.byteLength(sourceText, "utf8") <= INLINE_INPUT_BYTES_LIMIT;
  let job: { id: string; status: string; uniqueEmails: number; creditsReserved: number; progressPercent: number } | null = null;
  let creditsReserved = false;
  let providerKey = "millionverifier";

  try {
    verificationStartLog(traceId, "economics_snapshot_attempt", {
      userId: user.id,
      uniqueEmailCount: parsed.uniqueEmails.length,
      idempotencyKey: idempotencyKey.slice(0, 12)
    });

    console.info("[verification-job-start]", {
      traceId,
      userId: user.id,
      sourceType: file instanceof File ? "upload" : "paste",
      originalFilename,
      totalRows: parsed.totalRows,
      uniqueEmails: parsed.uniqueEmails.length,
      duplicateEmails: parsed.duplicateEmails.length,
      syntaxInvalidCount: parsed.syntaxInvalidCount,
      inlineInputAllowed
    });

    const existingJob = await prisma.verificationJob.findFirst({
      where: {
        userId: user.id,
        providerRequestId,
        deletedAt: null,
        createdAt: { gte: new Date(Date.now() - LIST_FINGERPRINT_REUSE_MS) },
        status: { not: "FAILED" }
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        uniqueEmails: true,
        creditsReserved: true,
        progressPercent: true
      }
    });

    if (existingJob) {
      verificationStartLog(traceId, "idempotent_job_reused", {
        userId: user.id,
        jobId: existingJob.id,
        status: existingJob.status,
        idempotencyKey: idempotencyKey.slice(0, 12)
      });
      return NextResponse.json(
        {
          ok: true,
          traceId,
          queued: true,
          reused: true,
          job: existingJob,
          message: "Verification job is already queued for this list."
        },
        { status: 202 }
      );
    }

    const economics = await getVerificationEconomicsSnapshot(parsed.uniqueEmails.length);
    providerKey = economics.providerKey;
    verificationStartLog(traceId, "economics_snapshot_ready", {
      providerKey: economics.providerKey,
      requiredCredits: parsed.uniqueEmails.length,
      creditValue: economics.creditValue,
      costPerVerification: economics.costPerVerification,
      providerCost: economics.providerCost,
      estimatedRevenue: economics.estimatedRevenue,
      estimatedProfit: economics.estimatedProfit
    });

    const providerSettings = await prisma.providerSetting
      .findUnique({
        where: { providerKey: economics.providerKey },
        select: {
          status: true,
          envKeyName: true,
          apiKeyEncrypted: true
        }
      })
      .catch((error) => {
        verificationStartError(traceId, "provider_settings_optional_read_failed", error, {
          providerKey: economics.providerKey,
          action: "continuing_with_env_provider_config"
        });
        return null;
      });

    verificationStartLog(traceId, "provider_settings_checked", {
      providerKey: economics.providerKey,
      dbStatus: providerSettings?.status ?? "no_db_row",
      envKeyName: providerSettings?.envKeyName ?? "MILLIONVERIFIER_API_KEY",
      dbApiKeyPresent: Boolean(providerSettings?.apiKeyEncrypted),
      envApiKeyPresent: Boolean(process.env.MILLIONVERIFIER_API_KEY)
    });

    if (providerSettings?.status === "SUSPENDED" || providerSettings?.status === "INACTIVE") {
      verificationStartLog(traceId, "provider_preflight_blocked", {
        providerKey: economics.providerKey,
        dbStatus: providerSettings.status
      });
      return NextResponse.json(
        {
          ok: false,
          code: "provider_not_ready",
          error: "Verification could not start right now because the verification provider is not active. Your credits were not charged. Please try again or contact support.",
          traceId
        },
        { status: 503 }
      );
    }

    if (!providerSettings?.apiKeyEncrypted && !process.env.MILLIONVERIFIER_API_KEY) {
      verificationStartLog(traceId, "provider_preflight_blocked", {
        providerKey: economics.providerKey,
        reason: "missing_api_key"
      });
      return NextResponse.json(
        {
          ok: false,
          code: "provider_not_ready",
          error: "Verification could not start right now because the verification provider is not configured. Your credits were not charged. Please contact support.",
          traceId
        },
        { status: 503 }
      );
    }

    verificationStartLog(traceId, "job_creation_attempt", {
      userId: user.id,
      providerKey: economics.providerKey,
      uniqueEmailCount: parsed.uniqueEmails.length,
      inlineInputAllowed,
      idempotencyKey: idempotencyKey.slice(0, 12)
    });

    job = await prisma.verificationJob.create({
      data: {
        userId: user.id,
        status: "QUEUED",
        sourceType,
        originalFilename,
        inputStorageKey: null,
        providerKey: economics.providerKey,
        providerRequestId,
        totalEmails: parsed.totalRows,
        uniqueEmails: parsed.uniqueEmails.length,
        duplicateCount: parsed.duplicateEmails.length,
        syntaxInvalidCount: parsed.syntaxInvalidCount,
        processedCount: 0,
        failedBatchCount: 0,
        creditsReserved: parsed.uniqueEmails.length,
        creditsUsed: 0,
        creditValueAtRun: economics.creditValue,
        costPerVerificationAtRun: economics.costPerVerification,
        providerCostAtRun: economics.providerCost,
        providerCostCurrency: economics.providerCostCurrency,
        estimatedRevenueAtRun: economics.estimatedRevenue,
        estimatedProfitAtRun: economics.estimatedProfit,
        progressPercent: 2,
        metadataJson: {
          parser: "regex_email_extractor",
          duplicateEmails: parsed.duplicateEmails.slice(0, 100),
          invalidSyntaxSamples: parsed.invalidSyntaxSamples,
          queuedAt: new Date().toISOString(),
          queueMode: "chunked_worker",
          batchSize: Number(process.env.VERIFICATION_PROVIDER_BATCH_SIZE || 500),
          inputMode: inlineInputAllowed ? "inline_pending_storage" : "storage_required",
          idempotencyKey,
          limits: {
            maxPasteEmails: MAX_PASTE_EMAILS,
            maxUploadBytes: MAX_UPLOAD_BYTES,
            maxEmailsPerJob: MAX_EMAILS_PER_JOB
          },
          ...(inlineInputAllowed ? { inlineEmails: parsed.uniqueEmails } : {})
        }
      },
      select: {
        id: true,
        status: true,
        uniqueEmails: true,
        creditsReserved: true,
        progressPercent: true
      }
    });

    console.info("[verification-job-created]", {
      traceId,
      jobId: job.id,
      userId: user.id,
      provider: economics.providerKey,
      emails: parsed.uniqueEmails.length,
      creditsReserved: parsed.uniqueEmails.length
    });

    verificationStartLog(traceId, "credit_reserve_attempt", {
      userId: user.id,
      jobId: job.id,
      requiredCredits: parsed.uniqueEmails.length
    });

    const reservation = await reserveVerificationCredits({
      userId: user.id,
      jobId: job.id,
      amount: parsed.uniqueEmails.length
    });

    verificationStartLog(traceId, "credit_reserve_result", {
      userId: user.id,
      jobId: job.id,
      ok: reservation.ok,
      balanceAfter: reservation.ok ? reservation.balanceAfter : null
    });

    if (!reservation.ok) {
      await prisma.verificationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: "Insufficient credits during reservation.",
          completedAt: new Date()
        }
      });
      return NextResponse.json({ ok: false, error: "Insufficient credits.", code: "insufficient_credits", traceId }, { status: 402 });
    }
    creditsReserved = true;

    let storageReady = false;
    let storageWarning: string | null = null;

    try {
      verificationStartLog(traceId, "storage_upload_attempt", {
        jobId: job.id,
        inputKey,
        inputBytes: Buffer.byteLength(sourceText, "utf8"),
        inlineInputAllowed
      });
      getStorageConfig();
      await uploadPrivateObject({
        key: inputKey,
        body: Buffer.from(sourceText),
        contentType: "text/plain; charset=utf-8",
        cacheControl: "private, max-age=0"
      });
      storageReady = true;
      verificationStartLog(traceId, "storage_upload_success", {
        jobId: job.id,
        inputKey
      });
    } catch (storageError) {
      storageWarning = storageError instanceof Error ? storageError.message : "Input storage failed.";
      if (!inlineInputAllowed) {
        verificationStartError(traceId, "storage_upload_failed", storageError, {
          jobId: job.id,
          inlineInputAllowed
        });
        throw storageError;
      }
      console.warn("[verification-input-storage-fallback]", {
        traceId,
        jobId: job.id,
        userId: user.id,
        emails: parsed.uniqueEmails.length,
        message: storageWarning
      });
    }

    verificationStartLog(traceId, "job_queue_update_attempt", {
      jobId: job.id,
      inputMode: storageReady ? "storage" : "inline_fallback"
    });

    const queuedJob = await prisma.verificationJob.update({
      where: { id: job.id },
      data: {
        inputStorageKey: storageReady ? inputKey : null,
        status: "QUEUED",
        progressPercent: 5,
        metadataJson: {
          parser: "regex_email_extractor",
          duplicateEmails: parsed.duplicateEmails.slice(0, 100),
          invalidSyntaxSamples: parsed.invalidSyntaxSamples,
          queuedAt: new Date().toISOString(),
          queueMode: "chunked_worker",
          batchSize: Number(process.env.VERIFICATION_PROVIDER_BATCH_SIZE || 500),
          inputMode: storageReady ? "storage" : "inline_fallback",
          idempotencyKey,
          limits: {
            maxPasteEmails: MAX_PASTE_EMAILS,
            maxUploadBytes: MAX_UPLOAD_BYTES,
            maxEmailsPerJob: MAX_EMAILS_PER_JOB
          },
          ...(inlineInputAllowed ? { inlineEmails: parsed.uniqueEmails } : {}),
          ...(storageWarning ? { storageWarning } : {})
        }
      },
      select: {
        id: true,
        status: true,
        uniqueEmails: true,
        creditsReserved: true,
        progressPercent: true
      }
    });

    verificationStartLog(traceId, "queue_worker_start_attempt", {
      jobId: queuedJob.id,
      maxEmails: Math.max(1, Math.min(STARTER_WORKER_EMAIL_LIMIT, parsed.uniqueEmails.length)),
      timeBudgetMs: STARTER_WORKER_TIME_BUDGET_MS
    });

    after(async () => {
      const backgroundStartedAt = Date.now();
      try {
        const queuedEmail = safeSendVerificationStartEmail({
          traceId,
          userId: user.id,
          email: user.email,
          jobId: queuedJob.id,
          fileName: originalFilename || "Pasted email list",
          uniqueEmails: parsed.uniqueEmails.length
        });

        const result = await processVerificationQueue({
          jobId: queuedJob.id,
          maxJobs: 1,
          maxEmails: Math.max(1, Math.min(STARTER_WORKER_EMAIL_LIMIT, parsed.uniqueEmails.length)),
          timeBudgetMs: STARTER_WORKER_TIME_BUDGET_MS
        });
        console.info("[verification-job-background-worker]", {
          traceId,
          jobId: queuedJob.id,
          userId: user.id,
          processedJobs: result.processedJobs,
          failedJobs: result.failedJobs,
          processedEmails: result.processedEmails,
          durationMs: Date.now() - backgroundStartedAt
        });
        await scheduleWorkerContinuationIfNeeded({
          traceId,
          requestUrl: request.url,
          jobId: queuedJob.id,
          chainDepth: 1,
          maxEmails: Math.max(1, Math.min(STARTER_WORKER_EMAIL_LIMIT, parsed.uniqueEmails.length)),
          timeBudgetMs: STARTER_WORKER_TIME_BUDGET_MS
        });
        await queuedEmail;
      } catch (backgroundError) {
        console.error("[verification-job-background-worker-failed]", {
          traceId,
          jobId: queuedJob.id,
          userId: user.id,
          message: backgroundError instanceof Error ? backgroundError.message : "Background worker failed.",
          stack: backgroundError instanceof Error ? backgroundError.stack : null
        });
      }
    });

    console.info("[verification-job-queued]", {
      traceId,
      jobId: queuedJob.id,
      provider: economics.providerKey,
      emails: parsed.uniqueEmails.length,
      backgroundWorkerScheduled: true,
      inputMode: storageReady ? "storage" : "inline_fallback",
      totalMs: Date.now() - startedAt
    });

    return NextResponse.json(
      {
        ok: true,
        traceId,
        queued: true,
        processedNow: false,
        job: queuedJob,
        message: "Verification job started. Your list is being processed safely in chunks."
      },
      { status: 202 }
    );
  } catch (error) {
    if (!job && isPrismaUniqueConstraintError(error)) {
      const existingJob = await prisma.verificationJob.findFirst({
        where: {
          userId: user.id,
          providerRequestId,
          deletedAt: null
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          uniqueEmails: true,
          creditsReserved: true,
          progressPercent: true
        }
      });

      if (existingJob) {
        verificationStartLog(traceId, "idempotent_race_reused", {
          userId: user.id,
          jobId: existingJob.id,
          status: existingJob.status,
          idempotencyKey: idempotencyKey.slice(0, 12)
        });
        return NextResponse.json(
          {
            ok: true,
            traceId,
            queued: true,
            reused: true,
            job: existingJob,
            message: "Verification job is already queued for this list."
          },
          { status: 202 }
        );
      }
    }

    if (job && creditsReserved) {
      await refundVerificationCredits({
        userId: user.id,
        jobId: job.id,
        amount: parsed.uniqueEmails.length,
        note: "Verification job setup failed refund"
      }).catch((refundError) => {
        console.error("[verification-job-refund-failed]", {
          traceId,
          jobId: job?.id,
          userId: user.id,
          message: refundError instanceof Error ? refundError.message : "Refund failed.",
          stack: refundError instanceof Error ? refundError.stack : null
        });
      });
    }

    if (job) {
      await prisma.verificationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Verification setup failed.",
          completedAt: new Date()
        }
      }).catch((updateError) => {
        console.error("[verification-job-fail-update-failed]", {
          traceId,
          jobId: job?.id,
          userId: user.id,
          message: updateError instanceof Error ? updateError.message : "Job failed update failed.",
          stack: updateError instanceof Error ? updateError.stack : null
        });
      });
    }

    const classified = classifyVerificationStartError(error);

    console.error("[verification-job-queue-failed]", {
      traceId,
      jobId: job?.id ?? null,
      provider: providerKey,
      emails: parsed.uniqueEmails.length,
      code: classified.code,
      message: error instanceof Error ? error.message : "Verification setup failed.",
      stack: error instanceof Error ? error.stack : null
    });

    return NextResponse.json(
      {
        ok: false,
        code: classified.code,
        error: classified.error,
        safeReason: classified.safeReason,
        jobId: job?.id ?? null,
        traceId
      },
      { status: classified.status }
    );
  }
}

function verificationStartLog(traceId: string, checkpoint: string, data: Record<string, unknown> = {}) {
  console.info("[verification-start-checkpoint]", {
    traceId,
    checkpoint,
    ...data
  });
}

function verificationStartError(traceId: string, checkpoint: string, error: unknown, data: Record<string, unknown> = {}) {
  console.error("[verification-start-error]", {
    traceId,
    checkpoint,
    ...data,
    message: error instanceof Error ? error.message : String(error || "Unknown error"),
    stack: error instanceof Error ? error.stack : null
  });
}

function maskEmail(email?: string | null) {
  if (!email || !email.includes("@")) return null;
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function createPagination(page: number, pageSize: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    from: total === 0 ? 0 : (page - 1) * pageSize + 1,
    to: Math.min(total, page * pageSize)
  };
}

function classifyVerificationStartError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();

  if (
    lower.includes("storage is not configured") ||
    lower.includes("r2") ||
    lower.includes("s3") ||
    lower.includes("bucket") ||
    lower.includes("accessdenied") ||
    lower.includes("invalidaccesskey") ||
    lower.includes("signature") ||
    lower.includes("putobject")
  ) {
    return {
      code: "storage_not_configured",
      status: 503,
      error: "Verification could not start right now due to a storage issue. Your credits were not charged. Please try again or contact support.",
      safeReason: "storage_setup_failed"
    };
  }

  if (
    lower.includes("millionverifier") ||
    lower.includes("verification provider") ||
    lower.includes("api key") ||
    lower.includes("provider failed") ||
    lower.includes("http")
  ) {
    return {
      code: "provider_not_ready",
      status: 503,
      error: "Verification could not start right now due to a processing issue. Your credits were not charged. Please try again or contact support.",
      safeReason: "provider_setup_failed"
    };
  }

  if (
    lower.includes("verificationjob") ||
    lower.includes("credittransaction") ||
    lower.includes("providersetting") ||
    lower.includes("does not exist") ||
    lower.includes("table") ||
    lower.includes("column") ||
    lower.includes("relation") ||
    lower.includes("p2021") ||
    lower.includes("p2022")
  ) {
    return {
      code: "database_not_ready",
      status: 503,
      error: "Verification database is not ready yet. Please contact support.",
      safeReason: "database_schema_missing"
    };
  }

  return {
    code: "verification_queue_failed",
    status: 500,
    error: "Verification could not start right now due to a processing issue. Your credits were not charged. Please try again or contact support.",
    safeReason: "unknown_queue_failure"
  };
}

function buildIdempotencyKey(userId: string, emails: string[], clientKey: string) {
  void clientKey;
  return createHash("sha256")
    .update(`${userId}:${emails.join("\n")}`)
    .digest("hex");
}

async function safeSendVerificationStartEmail(input: {
  traceId: string;
  userId: string;
  email: string;
  jobId: string;
  fileName: string;
  uniqueEmails: number;
}) {
  await sendTransactionalEmail({
    templateKey: "verification_job_queued",
    to: input.email,
    userId: input.userId,
    idempotencyKey: `verification-job-queued:${input.jobId}`,
    payload: {
      jobId: input.jobId,
      fileName: input.fileName,
      uniqueEmails: input.uniqueEmails
    }
  }).catch((error) => {
    console.warn("[verification-email-failed]", {
      traceId: input.traceId,
      jobId: input.jobId,
      userId: input.userId,
      templateKey: "verification_job_queued",
      message: error instanceof Error ? error.message : "Verification queued email failed"
    });
  });
}

function isPrismaUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}

async function scheduleWorkerContinuationIfNeeded(input: {
  traceId: string;
  requestUrl: string;
  jobId: string;
  chainDepth: number;
  maxEmails: number;
  timeBudgetMs: number;
}) {
  const maxChainDepth = Math.max(0, Number(process.env.VERIFICATION_WORKER_CHAIN_MAX_DEPTH || 20));
  if (input.chainDepth > maxChainDepth) return;

  const state = await getVerificationJobProcessingState(input.jobId).catch(() => null);
  if (!state?.active || state.remainingEmails <= 0) return;

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.warn("[verification-worker-continuation-skipped]", {
      traceId: input.traceId,
      jobId: input.jobId,
      reason: "CRON_SECRET is not configured",
      remainingEmails: state.remainingEmails
    });
    return;
  }

  const url = new URL("/api/v1/verification/worker", input.requestUrl);
  url.searchParams.set("jobId", input.jobId);
  url.searchParams.set("maxJobs", "1");
  url.searchParams.set("maxEmails", String(input.maxEmails));
  url.searchParams.set("timeBudgetMs", String(input.timeBudgetMs));
  url.searchParams.set("chainDepth", String(input.chainDepth));

  console.info("[verification-worker-continuation-scheduled]", {
    traceId: input.traceId,
    jobId: input.jobId,
    remainingEmails: state.remainingEmails,
    delayMs: state.nextPollDelayMs,
    chainDepth: input.chainDepth
  });

  if (state.nextPollDelayMs > 0) {
    await delay(state.nextPollDelayMs);
  }

  void fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "x-verification-worker-chain": "1"
    },
    cache: "no-store"
  }).catch((error) => {
    console.error("[verification-worker-continuation-failed]", {
      traceId: input.traceId,
      jobId: input.jobId,
      message: error instanceof Error ? error.message : "Worker continuation request failed"
    });
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
