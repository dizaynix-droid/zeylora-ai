import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { processVerificationQueue } from "@/lib/verification/processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const { jobId } = await params;
  const job = await prisma.verificationJob.findFirst({
    where: {
      id: jobId,
      userId: user.id,
      deletedAt: null
    },
    select: {
      id: true,
      status: true,
      uniqueEmails: true,
      processedCount: true
    }
  });

  if (!job) {
    return NextResponse.json({ ok: false, error: "Verification job not found." }, { status: 404 });
  }

  if (job.status !== "QUEUED" && job.status !== "PROCESSING") {
    return NextResponse.json({ ok: true, queued: false, status: job.status });
  }

  after(async () => {
    try {
      const result = await processVerificationQueue({
        jobId: job.id,
        maxJobs: 1,
        maxEmails: Math.max(1, Number(process.env.VERIFICATION_WORKER_EMAILS_PER_RUN || 1000)),
        timeBudgetMs: Math.max(5_000, Number(process.env.VERIFICATION_WORKER_TIME_BUDGET_MS || 22_000))
      });
      console.info("[verification-job-resume]", {
        jobId: job.id,
        userId: user.id,
        ...result
      });
    } catch (error) {
      console.error("[verification-job-resume-failed]", {
        jobId: job.id,
        userId: user.id,
        message: error instanceof Error ? error.message : "Resume failed",
        stack: error instanceof Error ? error.stack : null
      });
    }
  });

  return NextResponse.json({
    ok: true,
    queued: true,
    status: job.status,
    remainingEmails: Math.max(0, job.uniqueEmails - job.processedCount)
  }, { status: 202 });
}
