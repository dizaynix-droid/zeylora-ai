import { JobStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { trackingEvents } from "@/config/tracking";
import { trackServerEvent } from "@/lib/analytics/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { CLEAN_EXPORT_UNLOCK_NOTE, getCleanExportMetadata } from "@/lib/jobs/clean-export";
import { deleteDashboardCache } from "@/lib/dashboard/cache";
import { prisma } from "@/lib/db";
import { createResultDownloadUrl } from "@/lib/media/signed-url";
import { getOperationalSettings } from "@/lib/settings/operations";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const operations = await getOperationalSettings();
  if (!operations.cleanExportsEnabled || operations.maintenanceMode) {
    return NextResponse.json(
      { ok: false, error: operations.maintenanceMode ? "Clean exports are paused during maintenance." : "Clean exports are temporarily paused." },
      { status: 503 }
    );
  }

  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ ok: false, error: "You must be logged in to export a clean file." }, { status: 401 });
  }

  const { jobId } = await context.params;
  const job = await prisma.aiJob.findFirst({
    where: {
      id: jobId,
      userId: user.id,
      status: JobStatus.COMPLETED,
      deletedAt: null
    },
    select: {
      id: true,
      creditCost: true,
      estimatedCostAtRun: true,
      outputImage: {
        select: {
          storageKey: true,
          originalFilename: true,
          metadataJson: true
        }
      },
      tool: {
        select: {
          slug: true,
          name: true
        }
      }
    }
  });

  if (!job?.outputImage) {
    return NextResponse.json({ ok: false, error: "Completed result not found." }, { status: 404 });
  }

  const cleanExport = getCleanExportMetadata(job.outputImage.metadataJson);
  const legacyCleanExportMode = getLegacyExportMode(job.outputImage.metadataJson) === "paid_clean";
  const cleanStorageKey = cleanExport?.storageKey || (legacyCleanExportMode ? job.outputImage.storageKey : null);
  const filename = cleanExport?.filename || job.outputImage.originalFilename || `${job.tool.slug}.png`;

  if (!cleanStorageKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "This preview was created before clean exports were enabled. Please run the edit again, then export clean."
      },
      { status: 409 }
    );
  }

  const existingUnlock = await prisma.creditTransaction.findFirst({
    where: {
      userId: user.id,
      aiJobId: job.id,
      type: "USE"
    },
    select: {
      id: true
    }
  });

  if (!existingUnlock) {
    const requiredCredits = Math.max(0, job.creditCost);
    const charge = await prisma.$transaction(async (tx) => {
      const account = await tx.user.findUnique({
        where: { id: user.id },
        select: { creditBalance: true }
      });

      if (!account) {
        throw new Error("User not found for clean export.");
      }

      if (account.creditBalance < requiredCredits) {
        return {
          ok: false as const,
          balance: account.creditBalance,
          required: requiredCredits
        };
      }

      const balanceAfter = account.creditBalance - requiredCredits;
      await tx.user.update({
        where: { id: user.id },
        data: { creditBalance: balanceAfter }
      });
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          aiJobId: job.id,
          type: "USE",
          amount: -requiredCredits,
          balanceAfter,
          note: `${CLEAN_EXPORT_UNLOCK_NOTE}: ${job.tool.slug}`
        }
      });
      await tx.aiJob.update({
        where: { id: job.id },
        data: {
          creditsChargedSnapshot: requiredCredits,
          estimatedRevenueAtRun: roundMoney(requiredCredits * operations.estimatedCreditUsdValue),
          estimatedProfitAtRun: roundMoney((requiredCredits * operations.estimatedCreditUsdValue) - decimalToNumber(job.estimatedCostAtRun))
        }
      });

      return {
        ok: true as const,
        balanceAfter
      };
    });

    if (!charge.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: "insufficient_credits",
          error: "You need more credits to export a clean watermark-free image.",
          requiredCredits: charge.required,
          creditBalance: charge.balance
        },
        { status: 402 }
      );
    }

    deleteDashboardCache(`dashboard:credits:${user.id}`);
    deleteDashboardCache(`dashboard:transactions:${user.id}`);
    trackServerEvent(trackingEvents.creditsSpent, {
      tool: job.tool.slug,
      jobId: job.id,
      credits: requiredCredits
    });
    trackServerEvent(trackingEvents.watermarkFreeExport, {
      tool: job.tool.slug,
      jobId: job.id,
      credits: requiredCredits
    });
    trackServerEvent(trackingEvents.firstCleanExport, {
      userId: user.id,
      tool: job.tool.slug,
      jobId: job.id,
      credits: requiredCredits
    });
  }

  const downloadUrl = await createResultDownloadUrl(cleanStorageKey, filename);

  if (!downloadUrl) {
    return NextResponse.json({ ok: false, error: "Could not create a secure clean export URL." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    exportMode: "paid_clean",
    alreadyUnlocked: Boolean(existingUnlock),
    requiredCredits: job.creditCost,
    filename,
    downloadUrl
  });
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toString" in value) return Number(value.toString()) || 0;
  return Number(value) || 0;
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}

function getLegacyExportMode(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).exportMode;
  return typeof value === "string" ? value : null;
}
