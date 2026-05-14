import { randomUUID } from "node:crypto";
import {
  JobStatus,
  MediaProcessingStatus,
  MediaType,
  MediaVisibility,
  Prisma,
  ToolStatus
} from "@prisma/client";
import { NextResponse } from "next/server";
import { marketplaceCropConfig, type MarketplaceCropFormat } from "@/config/ai-tools";
import { resolveToolEconomy } from "@/config/tool-economy";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import {
  createJobCreditPlan,
  refundJobCredits,
  reserveJobCredits
} from "@/lib/jobs/credit-policy";
import { buildJobCostSnapshotUpdate } from "@/lib/jobs/cost-snapshot";
import {
  buildCleanExportStorageKey,
  createCleanExportMetadata,
  mergeCleanExportMetadata
} from "@/lib/jobs/clean-export";
import {
  createMarketplaceCrop,
  normalizeMarketplaceCropFormat
} from "@/lib/image/marketplace-crop";
import { prepareExportBuffer } from "@/lib/media/watermark";
import { getCacheControl } from "@/lib/storage/policy";
import {
  buildResultStorageKey,
  createPrivateReadUrl,
  uploadPrivateObject
} from "@/lib/storage/s3-client";

export const runtime = "nodejs";

type JobRequest = {
  inputMediaId?: string;
  targetFormat?: MarketplaceCropFormat;
};

function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ ok: false, error: "You must be logged in to create an AI job." }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request, {
    action: "job",
    userId: user.id,
    role: user.role
  });

  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const body = (await request.json().catch(() => null)) as JobRequest | null;
  const targetFormat = normalizeMarketplaceCropFormat(body?.targetFormat);
  const economy = resolveToolEconomy({
    toolSlug: marketplaceCropConfig.slug,
    preset: targetFormat,
    providerKey: marketplaceCropConfig.providerKey
  });

  if (!body?.inputMediaId) {
    return NextResponse.json({ ok: false, error: "inputMediaId is required." }, { status: 400 });
  }

  const inputMedia = await prisma.mediaAsset.findFirst({
    where: {
      id: body.inputMediaId,
      userId: user.id,
      type: MediaType.UPLOAD,
      visibility: MediaVisibility.PRIVATE,
      deletedAt: null
    }
  });

  if (!inputMedia) {
    return NextResponse.json({ ok: false, error: "Upload not found for this user." }, { status: 404 });
  }

  const tool = await ensureMarketplaceCropTool();
  if (tool.status !== ToolStatus.ACTIVE) {
    return NextResponse.json({ ok: false, error: "Marketplace Crop is not active yet." }, { status: 409 });
  }
  const toolCreditCost = economy.creditCost;
  let creditPlan = createJobCreditPlan(user, toolCreditCost);

  const job = await prisma.aiJob.create({
    data: {
      userId: user.id,
      toolId: tool.id,
      providerKey: economy.providerKey,
      status: JobStatus.PENDING,
      inputImageId: inputMedia.id,
      creditCost: toolCreditCost,
      toolNameSnapshot: economy.publicName,
      toolInternalKeySnapshot: economy.internalKey,
      qualityTierSnapshot: economy.qualityTier,
      providerKeySnapshot: economy.providerKey,
      creditsChargedSnapshot: 0,
      maxRetries: marketplaceCropConfig.maxRetries,
      toolVersion: tool.version
    }
  });

  await createJobEvent(job.id, "job_created", "Marketplace crop job created.", {
    inputMediaId: inputMedia.id,
    toolKey: marketplaceCropConfig.toolKey,
    targetFormat,
    creditCost: toolCreditCost,
    creditEnforcementActive: true,
    exportMode: creditPlan.exportMode,
    creditBalanceBefore: creditPlan.balanceBefore
  });

  try {
    const startedAt = Date.now();
    creditPlan = await reserveJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: marketplaceCropConfig.toolKey,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: JobStatus.PROCESSING }
    });
    await createJobEvent(job.id, "job_processing", "Marketplace crop processing started.", {
      targetFormat
    });

    const inputUrl = await createPrivateReadUrl(inputMedia.storageKey);
    const inputBuffer = await downloadInput(inputUrl);
    const cropped = await createMarketplaceCrop(inputBuffer, targetFormat);
    const exportOutput = await prepareExportBuffer(cropped.buffer, creditPlan.exportMode);

    const resultMediaId = randomUUID();
    const resultFilename = `marketplace-crop-${getMarketplaceCropFilenamePart(targetFormat)}.png`;
    const resultStorageKey = buildResultStorageKey({
      userId: user.id,
      jobId: job.id,
      filename: resultFilename
    });
    const cleanStorageKey = buildCleanExportStorageKey({
      userId: user.id,
      jobId: job.id,
      filename: resultFilename
    });
    const cacheControl = getCacheControl("private");

    await uploadPrivateObject({
      key: cleanStorageKey,
      body: cropped.buffer,
      contentType: "image/png",
      cacheControl,
      metadata: {
        userId: user.id,
        jobId: job.id,
        sourceProvider: marketplaceCropConfig.providerKey,
        toolKey: marketplaceCropConfig.toolKey,
        targetFormat,
        exportMode: "paid_clean",
        watermarkApplied: "false"
      }
    });

    await uploadPrivateObject({
      key: resultStorageKey,
      body: exportOutput.buffer,
      contentType: "image/png",
      cacheControl,
      metadata: {
        userId: user.id,
        jobId: job.id,
        sourceProvider: marketplaceCropConfig.providerKey,
        toolKey: marketplaceCropConfig.toolKey,
        targetFormat,
        exportMode: creditPlan.exportMode,
        watermarkApplied: String(exportOutput.applied)
      }
    });

    const outputMedia = await prisma.mediaAsset.create({
      data: {
        id: resultMediaId,
        userId: user.id,
        type: MediaType.RESULT,
        storageKey: resultStorageKey,
        originalFilename: resultFilename,
        mimeType: "image/png",
        fileSize: exportOutput.buffer.length,
        width: cropped.width,
        height: cropped.height,
        visibility: MediaVisibility.PRIVATE,
        processingStatus: MediaProcessingStatus.STORED,
        cacheControl,
        metadataJson: mergeCleanExportMetadata({
          source: "marketplace_crop",
          toolKey: marketplaceCropConfig.toolKey,
          category: marketplaceCropConfig.category,
          providerKey: marketplaceCropConfig.providerKey,
          targetFormat,
          targetLabel: cropped.label,
          width: cropped.width,
          height: cropped.height,
          preservedTransparency: cropped.preservedTransparency,
          useCases: ["shopify", "amazon", "etsy", "social_ads"],
          exportMode: creditPlan.exportMode,
          creditCharged: creditPlan.charged,
          creditCost: creditPlan.creditCost,
          watermark: {
            applied: exportOutput.applied,
            label: exportOutput.label,
            placement: exportOutput.placement,
            watermarkType: exportOutput.watermarkType
          }
        }, createCleanExportMetadata({
          storageKey: cleanStorageKey,
          filename: resultFilename,
          fileSize: cropped.buffer.length
        }))
      },
      select: {
        id: true,
        mimeType: true,
        fileSize: true,
        width: true,
        height: true,
        createdAt: true
      }
    });

    const completedEconomy = resolveToolEconomy({
      toolSlug: marketplaceCropConfig.slug,
      preset: targetFormat,
      providerKey: marketplaceCropConfig.providerKey
    });
    const costSnapshot = await buildJobCostSnapshotUpdate(job.id, {
      providerKey: marketplaceCropConfig.providerKey,
      qualityTier: completedEconomy.qualityTier,
      internalKey: completedEconomy.internalKey,
      publicName: completedEconomy.publicName,
      creditsCharged: creditPlan.charged ? toolCreditCost : 0
    });
    const completedJob = await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        providerKey: marketplaceCropConfig.providerKey,
        outputImageId: outputMedia.id,
        providerRequestId: `local-sharp:${targetFormat}`,
        providerResponseJson: toPrismaJson({
          providerKey: marketplaceCropConfig.providerKey,
          targetFormat,
          width: cropped.width,
          height: cropped.height,
          preservedTransparency: cropped.preservedTransparency,
          exportMode: creditPlan.exportMode,
          watermarkType: exportOutput.watermarkType,
          creditCharged: creditPlan.charged
        }),
        processingTimeMs: Date.now() - startedAt,
        retryCount: 0,
        completedAt: new Date(),
        ...costSnapshot
      },
      select: {
        id: true,
        status: true,
        creditCost: true,
        processingTimeMs: true,
        completedAt: true
      }
    });

    await createJobEvent(job.id, "job_completed", "Marketplace crop completed successfully.", {
      outputMediaId: outputMedia.id,
      targetFormat,
      width: cropped.width,
      height: cropped.height,
      exportMode: creditPlan.exportMode,
      creditCharged: creditPlan.charged,
      watermarkApplied: exportOutput.applied,
      watermarkType: exportOutput.watermarkType
    });

    const signedUrl = await createPrivateReadUrl(
      resultStorageKey,
      Number(process.env.RESULT_SIGNED_URL_TTL_SECONDS || 1800)
    );

    return NextResponse.json({
      ok: true,
      job: completedJob,
      outputMedia,
      preview: {
        signedUrl,
        expiresInSeconds: Number(process.env.RESULT_SIGNED_URL_TTL_SECONDS || 1800)
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown marketplace crop error.";
    await refundJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: marketplaceCropConfig.toolKey,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        errorMessage
      }
    });
    await createJobEvent(job.id, "job_failed", "Marketplace crop failed.", {
      errorMessage,
      targetFormat
    });

    return NextResponse.json(
      {
        ok: false,
        job: {
          id: job.id,
          status: JobStatus.FAILED,
          errorMessage: "We could not create this marketplace crop. Please try another image."
        },
        ...(process.env.NODE_ENV === "development"
          ? {
              debug: {
                provider: marketplaceCropConfig.providerKey,
                targetFormat,
                errorMessage
              }
            }
          : {})
      },
      { status: 500 }
    );
  }
}

async function ensureMarketplaceCropTool() {
  return prisma.aiTool.upsert({
    where: {
      slug_version: {
        slug: marketplaceCropConfig.slug,
        version: 1
      }
    },
    update: {
      deletedAt: null
    },
    create: {
      slug: marketplaceCropConfig.slug,
      version: 1,
      name: "Marketplace Crop",
      category: "Ecommerce",
      description: "Resize and frame product photos for Shopify, Amazon, Etsy, and social ads.",
      creditCost: marketplaceCropConfig.creditCost,
      status: ToolStatus.ACTIVE,
      inputRulesJson: {
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        maxFileSizeMb: 12,
        maxWidth: 6000,
        maxHeight: 6000
      },
      outputType: "image",
      providerKey: marketplaceCropConfig.providerKey,
      providerConfigJson: {
        model: "sharp-local-transform",
        outputFormat: "png",
        formats: marketplaceCropConfig.formats
      },
      fallbackProviderKeysJson: [],
      retryPolicyJson: {
        maxRetries: 0,
        timeoutSeconds: 20,
        retryDelaySeconds: 0,
        allowFallback: false
      },
      seoTitle: "Marketplace Crop - Ecommerce Image Resizer",
      seoDescription: "Resize and frame product photos for Shopify, Amazon, Etsy, and social ads.",
      landingContentJson: {
        hero: "Resize and frame product photos for marketplace-ready formats.",
        faqs: []
      },
      exampleImagesJson: []
    },
    select: {
      id: true,
      version: true,
      status: true,
      creditCost: true
    }
  });
}

async function downloadInput(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download uploaded image: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function getMarketplaceCropFilenamePart(format: MarketplaceCropFormat) {
  if (format === "portrait") return "4x5";
  if (format === "story") return "9x16";
  if (format === "horizontal") return "16x9";
  if (format === "marketplace-white") return "white";
  return "square";
}

async function createJobEvent(
  aiJobId: string,
  type: string,
  message: string,
  metadataJson?: Record<string, unknown>
) {
  try {
    await prisma.jobEvent.create({
      data: {
        aiJobId,
        type,
        message,
        metadataJson: toPrismaJson(metadataJson)
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2021", "P2022"].includes(error.code)) {
      console.warn("JobEvent table is not available yet. Run database/supabase/phase_2b_job_events.sql.");
      return;
    }

    throw error;
  }
}
