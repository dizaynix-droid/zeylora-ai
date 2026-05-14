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
import { productShadowConfig, type ProductShadowPreset } from "@/config/ai-tools";
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
  createProductShadow,
  normalizeProductShadowPreset
} from "@/lib/image/product-shadow";
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
  shadowPreset?: ProductShadowPreset;
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
  const shadowPreset = normalizeProductShadowPreset(body?.shadowPreset);
  const economy = resolveToolEconomy({
    toolSlug: productShadowConfig.slug,
    preset: shadowPreset,
    providerKey: productShadowConfig.providerKey
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

  const tool = await ensureProductShadowTool();
  if (tool.status !== ToolStatus.ACTIVE) {
    return NextResponse.json({ ok: false, error: "Product Shadow is not active yet." }, { status: 409 });
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
      creditsChargedSnapshot: toolCreditCost,
      maxRetries: productShadowConfig.maxRetries,
      toolVersion: tool.version
    }
  });

  await createJobEvent(job.id, "job_created", "Product shadow job created.", {
    inputMediaId: inputMedia.id,
    toolKey: productShadowConfig.toolKey,
    shadowPreset,
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
      toolKey: productShadowConfig.toolKey,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: JobStatus.PROCESSING }
    });
    await createJobEvent(job.id, "job_processing", "Product shadow processing started.", {
      shadowPreset
    });

    const inputUrl = await createPrivateReadUrl(inputMedia.storageKey);
    const inputBuffer = await downloadInput(inputUrl);
    const shadowed = await createProductShadow(inputBuffer, shadowPreset);
    const exportOutput = await prepareExportBuffer(shadowed.buffer, creditPlan.exportMode);

    const resultMediaId = randomUUID();
    const resultFilename = `product-shadow-${getProductShadowFilenamePart(shadowPreset)}.png`;
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
      body: shadowed.buffer,
      contentType: "image/png",
      cacheControl,
      metadata: {
        userId: user.id,
        jobId: job.id,
        sourceProvider: productShadowConfig.providerKey,
        toolKey: productShadowConfig.toolKey,
        shadowPreset,
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
        sourceProvider: productShadowConfig.providerKey,
        toolKey: productShadowConfig.toolKey,
        shadowPreset,
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
        width: shadowed.width,
        height: shadowed.height,
        visibility: MediaVisibility.PRIVATE,
        processingStatus: MediaProcessingStatus.STORED,
        cacheControl,
        metadataJson: mergeCleanExportMetadata({
          source: "product_shadow",
          toolKey: productShadowConfig.toolKey,
          category: productShadowConfig.category,
          providerKey: productShadowConfig.providerKey,
          shadowPreset,
          shadowPresetLabel: shadowed.label,
          width: shadowed.width,
          height: shadowed.height,
          bestWithTransparentPng: true,
          inputHadAlpha: shadowed.hasInputAlpha,
          useCases: ["shopify", "amazon", "etsy", "catalog_pages", "ads"],
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
          fileSize: shadowed.buffer.length
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
      toolSlug: productShadowConfig.slug,
      preset: shadowPreset,
      providerKey: productShadowConfig.providerKey
    });
    const costSnapshot = await buildJobCostSnapshotUpdate(job.id, {
      providerKey: productShadowConfig.providerKey,
      qualityTier: completedEconomy.qualityTier,
      internalKey: completedEconomy.internalKey,
      publicName: completedEconomy.publicName,
      creditCost: toolCreditCost
    });
    const completedJob = await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        providerKey: productShadowConfig.providerKey,
        outputImageId: outputMedia.id,
        providerRequestId: `local-sharp:${shadowPreset}`,
        providerResponseJson: toPrismaJson({
          providerKey: productShadowConfig.providerKey,
          shadowPreset,
          width: shadowed.width,
          height: shadowed.height,
          inputHadAlpha: shadowed.hasInputAlpha,
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

    await createJobEvent(job.id, "job_completed", "Product shadow completed successfully.", {
      outputMediaId: outputMedia.id,
      shadowPreset,
      shadowPresetLabel: shadowed.label,
      width: shadowed.width,
      height: shadowed.height,
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
    const errorMessage = error instanceof Error ? error.message : "Unknown product shadow error.";
    await refundJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: productShadowConfig.toolKey,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        errorMessage
      }
    });
    await createJobEvent(job.id, "job_failed", "Product shadow failed.", {
      errorMessage,
      shadowPreset
    });

    return NextResponse.json(
      {
        ok: false,
        job: {
          id: job.id,
          status: JobStatus.FAILED,
          errorMessage: "We could not create this product shadow. Please try another image."
        },
        ...(process.env.NODE_ENV === "development"
          ? {
              debug: {
                provider: productShadowConfig.providerKey,
                shadowPreset,
                errorMessage
              }
            }
          : {})
      },
      { status: 500 }
    );
  }
}

async function ensureProductShadowTool() {
  return prisma.aiTool.upsert({
    where: {
      slug_version: {
        slug: productShadowConfig.slug,
        version: 1
      }
    },
    update: {
      deletedAt: null
    },
    create: {
      slug: productShadowConfig.slug,
      version: 1,
      name: "Product Shadow",
      category: "Ecommerce",
      description: "Add natural studio shadows and premium depth to product photos for Shopify, Amazon, Etsy, catalog pages, and ads.",
      creditCost: productShadowConfig.creditCost,
      status: ToolStatus.ACTIVE,
      inputRulesJson: {
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        maxFileSizeMb: 12,
        maxWidth: 6000,
        maxHeight: 6000
      },
      outputType: "image",
      providerKey: productShadowConfig.providerKey,
      providerConfigJson: {
        model: "sharp-local-shadow-composition",
        outputFormat: "png",
        presets: productShadowConfig.presets
      },
      fallbackProviderKeysJson: [],
      retryPolicyJson: {
        maxRetries: 0,
        timeoutSeconds: 20,
        retryDelaySeconds: 0,
        allowFallback: false
      },
      seoTitle: "Product Shadow - Ecommerce Studio Shadow Tool",
      seoDescription: "Add natural studio shadows and premium depth to product photos for Shopify, Amazon, Etsy, catalog pages, and ads.",
      landingContentJson: {
        hero: "Add natural shadows and depth to flat product photos.",
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

function getProductShadowFilenamePart(preset: ProductShadowPreset) {
  if (preset === "floating-shadow") return "floating";
  if (preset === "luxury-catalog") return "luxury";
  if (preset === "soft-floor") return "soft-floor";
  return "soft-studio";
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
