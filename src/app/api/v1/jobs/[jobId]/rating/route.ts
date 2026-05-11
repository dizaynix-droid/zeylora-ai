import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

type RatingRequest = {
  rating?: "looks_good" | "needs_improvement";
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ ok: false, error: "You must be logged in to rate this result." }, { status: 401 });
  }

  const { jobId } = await context.params;
  const body = (await request.json().catch(() => null)) as RatingRequest | null;

  if (body?.rating !== "looks_good" && body?.rating !== "needs_improvement") {
    return NextResponse.json({ ok: false, error: "Invalid rating." }, { status: 400 });
  }

  const job = await prisma.aiJob.findFirst({
    where: {
      id: jobId,
      userId: user.id,
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  }

  try {
    await prisma.jobEvent.create({
      data: {
        aiJobId: job.id,
        type: "result_rating",
        message: body.rating === "looks_good" ? "User rated result as looks good." : "User rated result as needs improvement.",
        metadataJson: {
          rating: body.rating,
          source: "homepage_result_screen"
        }
      }
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && ["P2021", "P2022"].includes(error.code))) {
      throw error;
    }
  }

  return NextResponse.json({ ok: true });
}
