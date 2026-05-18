import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
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
    include: {
      results: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          email: true,
          status: true,
          reason: true,
          domain: true
        }
      }
    }
  });

  if (!job) {
    return NextResponse.json({ ok: false, error: "Verification job not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, job });
}
