import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { VerificationEmailStatus } from "@prisma/client";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { uploadPrivateObject } from "@/lib/storage/s3-client";
import { buildVerificationCsv, filterResultsForExport } from "@/lib/verification/csv";
import { parseEmailList, looksLikeSupportedListFile } from "@/lib/verification/email-parser";
import { getVerificationEconomicsSnapshot } from "@/lib/verification/economics";
import { getVerificationProvider } from "@/lib/verification/providers";
import type { VerificationProviderResult } from "@/lib/verification/types";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const BATCH_SIZE = 50;

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
        creditsUsed: true,
        providerKey: true,
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
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in before verifying a list.", code: "unauthenticated" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request, {
    action: "job",
    userId: user.id,
    role: user.role
  });

  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const pasted = String(formData.get("emails") || "");
  let sourceText = pasted;
  let originalFilename: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "Upload limit is 10MB." }, { status: 413 });
    }
    if (!looksLikeSupportedListFile(file)) {
      return NextResponse.json({ ok: false, error: "Please upload a CSV or TXT file." }, { status: 400 });
    }
    originalFilename = file.name;
    sourceText = await file.text();
  }

  const parsed = parseEmailList(sourceText);

  if (parsed.uniqueEmails.length === 0) {
    return NextResponse.json({ ok: false, error: "No valid email addresses were found." }, { status: 400 });
  }

  if (user.creditBalance < parsed.uniqueEmails.length) {
    return NextResponse.json(
      {
        ok: false,
        code: "insufficient_credits",
        error: `This list has ${parsed.uniqueEmails.length} unique emails. You need ${parsed.uniqueEmails.length} credits.`,
        requiredCredits: parsed.uniqueEmails.length,
        creditBalance: user.creditBalance
      },
      { status: 402 }
    );
  }

  const economics = await getVerificationEconomicsSnapshot(parsed.uniqueEmails.length);
  const providerSettings = await prisma.providerSetting.findUnique({
    where: { providerKey: economics.providerKey },
    select: {
      apiKeyEncrypted: true,
      configJson: true,
      status: true
    }
  });

  if (providerSettings?.status === "SUSPENDED" || providerSettings?.status === "INACTIVE") {
    return NextResponse.json(
      {
        ok: false,
        error: "Verification provider is temporarily unavailable. Please try again later.",
        code: "provider_unavailable"
      },
      { status: 503 }
    );
  }

  const provider = getVerificationProvider(economics.providerKey, {
    apiKey: providerSettings?.apiKeyEncrypted,
    baseUrl: readProviderBaseUrl(providerSettings?.configJson)
  });
  const inputKey = `verification/${user.id}/${crypto.randomUUID()}/input.txt`;
  const job = await prisma.verificationJob.create({
    data: {
      userId: user.id,
      status: "QUEUED",
      sourceType: file instanceof File ? "upload" : "paste",
      originalFilename,
      inputStorageKey: inputKey,
      providerKey: provider.key,
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
      progressPercent: 5,
      startedAt: new Date(),
      metadataJson: {
        parser: "regex_email_extractor",
        duplicateEmails: parsed.duplicateEmails.slice(0, 100)
      }
    },
    select: { id: true }
  });

  const reservation = await reserveVerificationCredits({
    userId: user.id,
    jobId: job.id,
    amount: parsed.uniqueEmails.length
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
    return NextResponse.json({ ok: false, error: "Insufficient credits.", code: "insufficient_credits" }, { status: 402 });
  }

  try {
    await uploadPrivateObject({
      key: inputKey,
      body: Buffer.from(sourceText),
      contentType: "text/plain; charset=utf-8",
      cacheControl: "private, max-age=0"
    });

    await prisma.verificationJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING", progressPercent: 15 }
    });

    const providerResults = await verifyInBatches(provider.verifyBatch.bind(provider), parsed.uniqueEmails, async (progress) => {
      await prisma.verificationJob.update({
        where: { id: job.id },
        data: { progressPercent: progress }
      });
    });
    const dbResults = providerResults.map((result) => toDbResult(job.id, result));
    await prisma.verificationEmailResult.createMany({
      data: dbResults
    });

    const counts = countStatuses(providerResults.map((result) => result.status));
    const csvResults = dbResults.map((result) => ({
      email: result.email,
      normalizedEmail: result.normalizedEmail,
      status: result.status,
      reason: result.reason,
      domain: result.domain,
      mxFound: result.mxFound,
      disposable: result.disposable,
      roleBased: result.roleBased,
      freeProvider: result.freeProvider
    }));
    const exportBase = `verification/${user.id}/${job.id}`;
    const fullReportKey = `${exportBase}/full-report.csv`;
    const validExportKey = `${exportBase}/valid-emails.csv`;
    const invalidExportKey = `${exportBase}/invalid-emails.csv`;
    const riskyExportKey = `${exportBase}/risky-catch-all-disposable.csv`;

    await Promise.all([
      uploadCsv(fullReportKey, buildVerificationCsv(csvResults)),
      uploadCsv(validExportKey, buildVerificationCsv(filterResultsForExport(csvResults, "valid"))),
      uploadCsv(invalidExportKey, buildVerificationCsv(filterResultsForExport(csvResults, "invalid"))),
      uploadCsv(riskyExportKey, buildVerificationCsv(filterResultsForExport(csvResults, "risky")))
    ]);

    const completed = await prisma.verificationJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        progressPercent: 100,
        providerBatchCount: Math.ceil(parsed.uniqueEmails.length / BATCH_SIZE),
        validCount: counts.VALID,
        invalidCount: counts.INVALID,
        riskyCount: counts.RISKY,
        catchAllCount: counts.CATCH_ALL,
        disposableCount: counts.DISPOSABLE,
        unknownCount: counts.UNKNOWN,
        creditsUsed: parsed.uniqueEmails.length,
        fullReportStorageKey: fullReportKey,
        validExportStorageKey: validExportKey,
        invalidExportStorageKey: invalidExportKey,
        riskyExportStorageKey: riskyExportKey,
        completedAt: new Date(),
        metadataJson: {
          processingTimeMs: Date.now() - startedAt,
          duplicateEmails: parsed.duplicateEmails.slice(0, 100)
        }
      },
      select: {
        id: true,
        status: true,
        uniqueEmails: true,
        validCount: true,
        invalidCount: true,
        riskyCount: true,
        catchAllCount: true,
        disposableCount: true,
        unknownCount: true,
        creditsUsed: true
      }
    });

    return NextResponse.json({
      ok: true,
      job: completed
    });
  } catch (error) {
    await refundVerificationCredits({
      userId: user.id,
      jobId: job.id,
      amount: parsed.uniqueEmails.length,
      note: "Verification job failed refund"
    });
    await prisma.verificationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Verification failed.",
        completedAt: new Date()
      }
    });

    console.error("[verification-job-failed]", {
      jobId: job.id,
      provider: economics.providerKey,
      emails: parsed.uniqueEmails.length,
      message: error instanceof Error ? error.message : "Verification failed."
    });

    return NextResponse.json(
      {
        ok: false,
        error: "We could not verify this list. Credits were refunded automatically.",
        jobId: job.id
      },
      { status: 500 }
    );
  }
}

async function verifyInBatches(
  verifyBatch: (emails: string[]) => Promise<VerificationProviderResult[]>,
  emails: string[],
  onProgress: (progress: number) => Promise<void>
) {
  const results: VerificationProviderResult[] = [];
  for (let index = 0; index < emails.length; index += BATCH_SIZE) {
    const batch = emails.slice(index, index + BATCH_SIZE);
    results.push(...(await verifyBatch(batch)));
    const progress = Math.min(92, 15 + Math.round(((index + batch.length) / emails.length) * 75));
    await onProgress(progress);
  }
  return results;
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

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
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

function readProviderBaseUrl(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as { apiBaseUrl?: unknown }).apiBaseUrl;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

async function uploadCsv(key: string, csv: string) {
  await uploadPrivateObject({
    key,
    body: Buffer.from(csv),
    contentType: "text/csv; charset=utf-8",
    cacheControl: "private, max-age=0"
  });
}

async function reserveVerificationCredits(input: { userId: string; jobId: string; amount: number }) {
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

async function refundVerificationCredits(input: { userId: string; jobId: string; amount: number; note: string }) {
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
