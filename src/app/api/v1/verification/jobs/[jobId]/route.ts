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
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(10, Number(url.searchParams.get("pageSize") || 50)));
  const skip = (page - 1) * pageSize;
  const where = {
    id: jobId,
    userId: user.id,
    deletedAt: null
  };
  const [job, totalResults] = await Promise.all([
    prisma.verificationJob.findFirst({
      where,
      include: {
        results: {
          orderBy: { createdAt: "asc" },
          skip,
          take: pageSize,
          select: {
            id: true,
            email: true,
            status: true,
            reason: true,
            domain: true
          }
        }
      }
    }),
    prisma.verificationEmailResult.count({ where: { verificationJobId: jobId } })
  ]);

  if (!job) {
    return NextResponse.json({ ok: false, error: "Verification job not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    job,
    pagination: {
      page,
      pageSize,
      total: totalResults,
      totalPages: Math.max(1, Math.ceil(totalResults / pageSize)),
      hasPrevious: page > 1,
      hasNext: page * pageSize < totalResults
    }
  });
}
