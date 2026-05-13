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
import { hdUpscaleConfig, type HdUpscalePreset } from "@/config/ai-tools";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  PhotoEnhancementProviderError,
  runHdUpscale
} from "@/lib/ai/photo-enhancement/providers";
import { prisma } from "@/lib/db";
import {
  createJobCreditPlan,
  refundJobCredits,
  reserveJobCredits
} from "@/lib/jobs/credit-policy";
import {
  buildCleanExportStorageKey,
  createCleanExportMetadata,
  mergeCleanExportMetadata
} from "@/lib/jobs/clean-export";
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
  upscalePreset?: HdUpscalePreset;
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
    userId: user.id
  });

  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const body = (await request.json().catch(() => null)) as JobRequest | null;
  const upscalePreset = normalizeHdUpscalePreset(body?.upscalePreset);

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

  const tool = await ensureHdUpscaleTool();
  if (tool.status !== ToolStatus.ACTIVE) {
    return NextResponse.json({ ok: false, error: "HD Upscale is not active yet." }, { status: 409 });
  }
  const toolCreditCost = tool.creditCost ?? hdUpscaleConfig.creditCost;
  let creditPlan = createJobCreditPlan(user, toolCreditCost);

  const job = await prisma.aiJob.create({
    data: {
      userId: user.id,
      toolId: tool.id,
      providerKey: hdUpscaleConfig.providerKey,
      status: JobStatus.PENDING,
      inputImageId: inputMedia.id,
      creditCost: toolCreditCost,
      maxRetries: hdUpscaleConfig.maxRetries,
      toolVersion: tool.version
    }
  });

  await createJobEvent(job.id, "job_created", "HD upscale job created.", {
    inputMediaId: inputMedia.id,
    toolKey: hdUpscaleConfig.toolKey,
    upscalePreset,
    creditCost: toolCreditCost,
    creditEnforcementActive: true,
    exportMode: creditPlan.exportMode,
    creditBalanceBefore: creditPlan.balanceBefore
  });

  try {
    creditPlan = await reserveJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: hdUpscaleConfig.toolKey,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: JobStatus.PROCESSING }
    });
    await createJobEvent(job.id, "job_processing", "HD upscale processing started.", {
      upscalePreset
    });

    const inputUrl = await createPrivateReadUrl(inputMedia.storageKey);
    await createJobEvent(job.id, "provider_attempt_started", "Replicate HD upscale attempt started.", {
      providerKey: hdUpscaleConfig.providerKey,
      model: hdUpscaleConfig.model,
      upscalePreset,
      scale: hdUpscaleConfig.presets[upscalePreset].scale
    });

    const upscale = await runHdUpscale({ imageUrl: inputUrl, preset: upscalePreset });
    const outputBuffer = await downloadOutput(upscale.outputUrl);
    const exportOutput = await prepareExportBuffer(outputBuffer, creditPlan.exportMode);

    await prisma.providerLog.create({
      data: {
        aiJobId: job.id,
        providerKey: upscale.providerKey,
        requestJson: {
          toolKey: hdUpscaleConfig.toolKey,
          model: upscale.model,
          modelKey: upscale.modelKey,
          preset: upscale.preset,
          scale: upscale.scale,
          input: sanitizeInputUrl(inputUrl)
        },
        responseJson: toPrismaJson(upscale.rawResponse),
        attemptNumber: 1,
        timedOut: false
      }
    });

    const resultMediaId = randomUUID();
    const resultFilename = `hd-upscale-${getHdUpscaleFilenamePart(upscalePreset)}.png`;
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
      body: outputBuffer,
      contentType: "image/png",
      cacheControl,
      metadata: {
        userId: user.id,
        jobId: job.id,
        sourceProvider: upscale.providerKey,
        toolKey: hdUpscaleConfig.toolKey,
        model: upscale.model,
        upscalePreset,
        scale: String(upscale.scale),
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
        sourceProvider: upscale.providerKey,
        toolKey: hdUpscaleConfig.toolKey,
        model: upscale.model,
        upscalePreset,
        scale: String(upscale.scale),
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
        visibility: MediaVisibility.PRIVATE,
        processingStatus: MediaProcessingStatus.STORED,
        cacheControl,
        metadataJson: mergeCleanExportMetadata({
          source: "hd_upscale",
          toolKey: hdUpscaleConfig.toolKey,
          category: hdUpscaleConfig.category,
          providerKey: upscale.providerKey,
          model: upscale.model,
          modelKey: upscale.modelKey,
          upscalePreset,
          upscalePresetLabel: upscale.presetLabel,
          scale: upscale.scale,
          providerRequestId: upscale.providerRequestId,
          useCases: ["ecommerce_photos", "social_media_images", "low_resolution_product_photos"],
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
          fileSize: outputBuffer.length
        }))
      },
      select: {
        id: true,
        mimeType: true,
        fileSize: true,
        createdAt: true
      }
    });

    const completedJob = await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        outputImageId: outputMedia.id,
        providerRequestId: upscale.providerRequestId,
        providerResponseJson: toPrismaJson(upscale.rawResponse),
        processingTimeMs: upscale.processingTimeMs,
        retryCount: 0,
        completedAt: new Date()
      },
      select: {
        id: true,
        status: true,
        creditCost: true,
        processingTimeMs: true,
        completedAt: true
      }
    });

    await createJobEvent(job.id, "job_completed", "HD upscale completed successfully.", {
      outputMediaId: outputMedia.id,
      providerKey: upscale.providerKey,
      model: upscale.model,
      upscalePreset,
      upscalePresetLabel: upscale.presetLabel,
      scale: upscale.scale,
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
    const providerError = error instanceof PhotoEnhancementProviderError ? error : null;
    const errorMessage = error instanceof Error ? error.message : "Unknown HD upscale error.";

    await refundJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: hdUpscaleConfig.toolKey,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        errorMessage,
        providerResponseJson: toPrismaJson(providerError?.rawResponse),
        processingTimeMs: providerError?.processingTimeMs
      }
    });
    await createJobEvent(job.id, "job_failed", "HD upscale failed.", {
      errorMessage,
      providerKey: providerError?.providerKey,
      providerStatusCode: providerError?.statusCode,
      upscalePreset
    });

    if (providerError) {
      await prisma.providerLog.create({
        data: {
          aiJobId: job.id,
          providerKey: providerError.providerKey,
          requestJson: {
            toolKey: hdUpscaleConfig.toolKey,
            model: hdUpscaleConfig.model,
            upscalePreset
          },
          responseJson: toPrismaJson(providerError.rawResponse),
          errorMessage,
          statusCode: providerError.statusCode,
          attemptNumber: 1,
          timedOut: errorMessage.toLowerCase().includes("timed out")
        }
      });
    }

    return NextResponse.json(
      {
        ok: false,
        job: {
          id: job.id,
          status: JobStatus.FAILED,
          errorMessage: "We could not upscale this image. Please try another photo."
        },
        ...(process.env.NODE_ENV === "development"
          ? {
              debug: {
                provider: providerError?.providerKey || hdUpscaleConfig.providerKey,
                model: hdUpscaleConfig.model,
                upscalePreset,
                providerError: errorMessage,
                providerResponse: sanitizeForDebug(providerError?.rawResponse)
              }
            }
          : {})
      },
      { status: 502 }
    );
  }
}

async function ensureHdUpscaleTool() {
  return prisma.aiTool.upsert({
    where: {
      slug_version: {
        slug: hdUpscaleConfig.slug,
        version: 1
      }
    },
    update: {
      deletedAt: null
    },
    create: {
      slug: hdUpscaleConfig.slug,
      version: 1,
      name: "HD Upscale",
      category: "Enhancement",
      description: "Upscale blurry or low-resolution images into sharper, cleaner, ecommerce-ready visuals.",
      creditCost: hdUpscaleConfig.creditCost,
      status: ToolStatus.ACTIVE,
      inputRulesJson: {
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        maxFileSizeMb: 12,
        maxWidth: 6000,
        maxHeight: 6000
      },
      outputType: "image",
      providerKey: hdUpscaleConfig.providerKey,
      providerConfigJson: {
        model: hdUpscaleConfig.model,
        outputFormat: "png",
        presets: hdUpscaleConfig.presets
      },
      fallbackProviderKeysJson: [],
      retryPolicyJson: {
        maxRetries: hdUpscaleConfig.maxRetries,
        timeoutSeconds: hdUpscaleConfig.timeoutSeconds,
        retryDelaySeconds: 8,
        allowFallback: false
      },
      seoTitle: "HD Upscale - AI Product Image Upscaler",
      seoDescription: "Upscale blurry or low-resolution product images into sharper, cleaner ecommerce-ready visuals.",
      landingContentJson: {
        hero: "Turn low-resolution product images into sharper HD visuals.",
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

async function downloadOutput(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download provider output: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
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

function normalizeHdUpscalePreset(value?: string): HdUpscalePreset {
  if (value === "4x-ultra" || value === "sharp-catalog" || value === "social-cleanup") {
    return value;
  }

  return "2x-hd";
}

function getHdUpscaleFilenamePart(preset: HdUpscalePreset) {
  if (preset === "4x-ultra") return "4x-ultra";
  if (preset === "sharp-catalog") return "sharp-catalog";
  if (preset === "social-cleanup") return "social-cleanup";
  return "2x-hd";
}

function sanitizeInputUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      host: parsed.host,
      pathname: parsed.pathname,
      hasQuery: parsed.search.length > 0,
      expires: parsed.searchParams.get("X-Amz-Expires")
    };
  } catch {
    return { invalid: true };
  }
}

function sanitizeForDebug(value: unknown) {
  if (!value) return value;
  return JSON.parse(JSON.stringify(value, (_key, nestedValue) => {
    if (typeof nestedValue === "string" && nestedValue.startsWith("http")) {
      return sanitizeInputUrl(nestedValue);
    }

    return nestedValue;
  })) as unknown;
}
