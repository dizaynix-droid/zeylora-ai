import { after, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { getStorageConfig, uploadPrivateObject } from "@/lib/storage/s3-client";
import { parseEmailList, looksLikeSupportedListFile } from "@/lib/verification/email-parser";
import { getVerificationEconomicsSnapshot } from "@/lib/verification/economics";
import { processVerificationQueue, refundVerificationCredits, reserveVerificationCredits } from "@/lib/verification/processor";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_VERIFICATION_UPLOAD_BYTES || 25 * 1024 * 1024);
const INLINE_INPUT_EMAIL_LIMIT = Number(process.env.VERIFICATION_INLINE_INPUT_EMAIL_LIMIT || 5_000);
const INLINE_INPUT_BYTES_LIMIT = Number(process.env.VERIFICATION_INLINE_INPUT_BYTES_LIMIT || 750_000);
const STARTER_WORKER_EMAIL_LIMIT = Number(process.env.VERIFICATION_STARTER_WORKER_EMAIL_LIMIT || 1_000);
const STARTER_WORKER_TIME_BUDGET_MS = Number(process.env.VERIFICATION_STARTER_WORKER_TIME_BUDGET_MS || 25_000);

export async function GET(request: Request) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

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
        errorMessage: true
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
    return NextResponse.json({ ok: false, error: "Sign in before verifying a list.", code: "unauthenticated", traceId }, { status: 401 });
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

  const formData = await request.formData();
  const file = formData.get("file");
  const pasted = String(formData.get("emails") || "");
  let sourceText = pasted;
  let originalFilename: string | null = null;

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
          error: `Upload limit is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB. Split larger lists or contact support for bulk verification.`,
          traceId
        },
        { status: 413 }
      );
    }
    if (!looksLikeSupportedListFile(file)) {
      return NextResponse.json({ ok: false, error: "Please upload a CSV or TXT file.", traceId }, { status: 400 });
    }
    originalFilename = file.name;
    sourceText = await file.text();
  }

  const parsed = parseEmailList(sourceText);
  verificationStartLog(traceId, "emails_parsed", {
    userId: user.id,
    sourceType: file instanceof File ? "upload" : "paste",
    parsedEmailCount: parsed.totalRows,
    uniqueEmailCount: parsed.uniqueEmails.length,
    duplicateEmailCount: parsed.duplicateEmails.length,
    sourceBytes: Buffer.byteLength(sourceText, "utf8")
  });

  if (parsed.uniqueEmails.length === 0) {
    return NextResponse.json({ ok: false, error: "No valid email addresses were found.", traceId }, { status: 400 });
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
        error: `This list has ${parsed.uniqueEmails.length} unique emails. You need ${parsed.uniqueEmails.length} credits.`,
        requiredCredits: parsed.uniqueEmails.length,
        creditBalance: user.creditBalance,
        traceId
      },
      { status: 402 }
    );
  }

  const inputKey = `verification/${user.id}/${crypto.randomUUID()}/input.txt`;
  const inlineInputAllowed =
    parsed.uniqueEmails.length <= INLINE_INPUT_EMAIL_LIMIT &&
    Buffer.byteLength(sourceText, "utf8") <= INLINE_INPUT_BYTES_LIMIT;
  let job: { id: string; status: string; uniqueEmails: number; creditsReserved: number; progressPercent: number } | null = null;
  let creditsReserved = false;
  let providerKey = "millionverifier";

  try {
    verificationStartLog(traceId, "economics_snapshot_attempt", {
      userId: user.id,
      uniqueEmailCount: parsed.uniqueEmails.length
    });

    console.info("[verification-job-start]", {
      traceId,
      userId: user.id,
      sourceType: file instanceof File ? "upload" : "paste",
      originalFilename,
      totalRows: parsed.totalRows,
      uniqueEmails: parsed.uniqueEmails.length,
      duplicateEmails: parsed.duplicateEmails.length,
      inlineInputAllowed
    });

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

    const providerSettings = await prisma.providerSetting.findUnique({
      where: { providerKey: economics.providerKey },
      select: {
        status: true,
        envKeyName: true,
        apiKeyEncrypted: true
      }
    });

    verificationStartLog(traceId, "provider_settings_checked", {
      providerKey: economics.providerKey,
      dbStatus: providerSettings?.status ?? "no_db_row",
      envKeyName: providerSettings?.envKeyName ?? "MILLIONVERIFIER_API_KEY",
      dbApiKeyPresent: Boolean(providerSettings?.apiKeyEncrypted),
      envApiKeyPresent: Boolean(process.env.MILLIONVERIFIER_API_KEY)
    });

    if (providerSettings?.status === "SUSPENDED" || providerSettings?.status === "INACTIVE") {
      verificationStartLog(traceId, "provider_preflight_warning", {
        providerKey: economics.providerKey,
        dbStatus: providerSettings.status,
        action: "job_will_be_created_and_worker_will_mark_failed_if_provider_remains_unavailable"
      });
    }

    verificationStartLog(traceId, "job_creation_attempt", {
      userId: user.id,
      providerKey: economics.providerKey,
      uniqueEmailCount: parsed.uniqueEmails.length,
      inlineInputAllowed
    });

    job = await prisma.verificationJob.create({
      data: {
        userId: user.id,
        status: "QUEUED",
        sourceType: file instanceof File ? "upload" : "paste",
        originalFilename,
        inputStorageKey: null,
        providerKey: economics.providerKey,
        totalEmails: parsed.totalRows,
        uniqueEmails: parsed.uniqueEmails.length,
        duplicateCount: parsed.duplicateEmails.length,
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
          queuedAt: new Date().toISOString(),
          queueMode: "chunked_worker",
          inputMode: inlineInputAllowed ? "inline_pending_storage" : "storage_required",
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
          queuedAt: new Date().toISOString(),
          queueMode: "chunked_worker",
          inputMode: storageReady ? "storage" : "inline_fallback",
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
      error: "Verification storage is not configured yet. Please contact support before starting verification."
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
      error: "Verification provider is not ready right now. Please check provider settings or try again shortly."
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
      error: "Verification database is not ready yet. Please contact support."
    };
  }

  return {
    code: "verification_queue_failed",
    status: 500,
    error: "Verification could not be started. Please try again or contact support."
  };
}
