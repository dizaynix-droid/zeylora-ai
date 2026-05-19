import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { uploadPrivateObject } from "@/lib/storage/s3-client";
import { parseEmailList, looksLikeSupportedListFile } from "@/lib/verification/email-parser";
import { getVerificationEconomicsSnapshot } from "@/lib/verification/economics";
import { refundVerificationCredits, reserveVerificationCredits } from "@/lib/verification/processor";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_VERIFICATION_UPLOAD_BYTES || 25 * 1024 * 1024);

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
      return NextResponse.json(
        {
          ok: false,
          error: `Upload limit is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB. Split larger lists or contact support for bulk verification.`
        },
        { status: 413 }
      );
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

  const inputKey = `verification/${user.id}/${crypto.randomUUID()}/input.txt`;
  const job = await prisma.verificationJob.create({
    data: {
      userId: user.id,
      status: "QUEUED",
      sourceType: file instanceof File ? "upload" : "paste",
      originalFilename,
      inputStorageKey: inputKey,
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
        queueMode: "chunked_worker"
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

    const queuedJob = await prisma.verificationJob.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        progressPercent: 5
      },
      select: {
        id: true,
        status: true,
        uniqueEmails: true,
        creditsReserved: true,
        progressPercent: true
      }
    });

    console.info("[verification-job-queued]", {
      jobId: queuedJob.id,
      provider: economics.providerKey,
      emails: parsed.uniqueEmails.length,
      totalMs: Date.now() - startedAt
    });

    return NextResponse.json(
      {
        ok: true,
        queued: true,
        job: queuedJob,
        message: "Verification job queued. Large lists are processed safely in chunks."
      },
      { status: 202 }
    );
  } catch (error) {
    await refundVerificationCredits({
      userId: user.id,
      jobId: job.id,
      amount: parsed.uniqueEmails.length,
      note: "Verification job setup failed refund"
    });
    await prisma.verificationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Verification setup failed.",
        completedAt: new Date()
      }
    });

    console.error("[verification-job-queue-failed]", {
      jobId: job.id,
      provider: economics.providerKey,
      emails: parsed.uniqueEmails.length,
      message: error instanceof Error ? error.message : "Verification setup failed."
    });

    return NextResponse.json(
      {
        ok: false,
        error: "We could not queue this verification job. Credits were refunded automatically.",
        jobId: job.id
      },
      { status: 500 }
    );
  }
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
