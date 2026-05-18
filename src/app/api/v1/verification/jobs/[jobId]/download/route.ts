import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { createPrivateDownloadUrl } from "@/lib/storage/s3-client";

export const runtime = "nodejs";

const EXPORTS = {
  valid: {
    field: "validExportStorageKey",
    filename: "zeylora-valid-emails.csv"
  },
  invalid: {
    field: "invalidExportStorageKey",
    filename: "zeylora-invalid-emails.csv"
  },
  risky: {
    field: "riskyExportStorageKey",
    filename: "zeylora-risky-catch-all-emails.csv"
  },
  full: {
    field: "fullReportStorageKey",
    filename: "zeylora-full-verification-report.csv"
  }
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "full";
  const exportConfig = EXPORTS[type as keyof typeof EXPORTS] ?? EXPORTS.full;
  const { jobId } = await params;
  const job = await prisma.verificationJob.findFirst({
    where: {
      id: jobId,
      userId: user.id,
      deletedAt: null,
      status: "COMPLETED"
    },
    select: {
      validExportStorageKey: true,
      invalidExportStorageKey: true,
      riskyExportStorageKey: true,
      fullReportStorageKey: true
    }
  });

  if (!job) {
    return NextResponse.json({ ok: false, error: "Completed verification job not found." }, { status: 404 });
  }

  const storageKey = job[exportConfig.field as keyof typeof job];
  if (!storageKey) {
    return NextResponse.json({ ok: false, error: "Export is not ready yet." }, { status: 404 });
  }

  const downloadUrl = await createPrivateDownloadUrl(storageKey, exportConfig.filename, 900);
  return NextResponse.json({ ok: true, url: downloadUrl });
}
