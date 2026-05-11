import { JobStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { createResultDownloadUrl } from "@/lib/media/signed-url";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ ok: false, error: "You must be logged in to download this result." }, { status: 401 });
  }

  const { jobId } = await context.params;
  const job = await prisma.aiJob.findFirst({
    where: {
      id: jobId,
      userId: user.id,
      status: JobStatus.COMPLETED,
      deletedAt: null
    },
    include: {
      outputImage: true
    }
  });

  if (!job?.outputImage?.storageKey) {
    return NextResponse.json({ ok: false, error: "Completed result not found." }, { status: 404 });
  }

  const filename = job.outputImage.originalFilename || "zeylora-background-remover.png";
  const downloadUrl = await createResultDownloadUrl(job.outputImage.storageKey, filename);
  if (!downloadUrl) {
    return NextResponse.json({ ok: false, error: "Could not create a secure download URL." }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const wantsJson =
    requestUrl.searchParams.get("format") === "json" ||
    request.headers.get("accept")?.includes("application/json");

  if (wantsJson) {
    return NextResponse.json({
      ok: true,
      downloadUrl,
      filename
    });
  }

  return NextResponse.redirect(downloadUrl);
}
