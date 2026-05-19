import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { processVerificationQueue } from "@/lib/verification/processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runWorker(request);
}

export async function POST(request: Request) {
  return runWorker(request);
}

async function runWorker(request: Request) {
  const authorized = await isAuthorizedWorkerRequest(request);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized worker request." }, { status: 401 });
  }

  const url = new URL(request.url);
  const startedAt = Date.now();
  const jobId = url.searchParams.get("jobId");
  const maxJobs = readPositiveInt(url.searchParams.get("maxJobs"), Number(process.env.VERIFICATION_WORKER_MAX_JOBS || 1));
  const maxEmails = readPositiveInt(url.searchParams.get("maxEmails"), Number(process.env.VERIFICATION_WORKER_EMAILS_PER_RUN || 1000));
  const timeBudgetMs = readPositiveInt(url.searchParams.get("timeBudgetMs"), Number(process.env.VERIFICATION_WORKER_TIME_BUDGET_MS || 22_000));

  try {
    const result = await processVerificationQueue({
      jobId,
      maxJobs,
      maxEmails,
      timeBudgetMs
    });

    console.info("[verification-worker-route]", {
      totalMs: Date.now() - startedAt,
      jobId: jobId || "next",
      ...result
    });

    return NextResponse.json({
      ...result,
      timing: {
        totalMs: Date.now() - startedAt
      }
    });
  } catch (error) {
    console.error("[verification-worker-route-failed]", {
      jobId: jobId || "next",
      message: error instanceof Error ? error.message : "Worker failed."
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Verification worker failed. Check server logs for details."
      },
      { status: 500 }
    );
  }
}

async function isAuthorizedWorkerRequest(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  if (request.headers.get("x-vercel-cron") === "1") {
    return true;
  }

  if (process.env.NODE_ENV !== "production" && !cronSecret) {
    return true;
  }

  const user = await getCurrentUser(request);
  return user?.role === "ADMIN";
}

function readPositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
