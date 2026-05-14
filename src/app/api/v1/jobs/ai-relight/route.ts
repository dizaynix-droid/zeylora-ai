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
import { aiRelightConfig, type AiRelightPreset } from "@/config/ai-tools";
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
  createAiRelight,
  normalizeAiRelightPreset
} from "@/lib/image/ai-relight";
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
  relightPreset?: AiRelightPreset;
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
  const relightPreset = normalizeAiRelightPreset(body?.relightPreset);

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

  const tool = await ensureAiRelightTool();
  if (tool.status !== ToolStatus.ACTIVE) {
    return NextResponse.json({ ok: false, error: "AI Relight is not active yet." }, { status: 409 });
  }
  const toolCreditCost = tool.creditCost ?? aiRelightConfig.creditCost;
  let creditPlan = createJobCreditPlan(user, toolCreditCost);

  const job = await prisma.aiJob.create({
    data: {
      userId: user.id,
      toolId: tool.id,
      providerKey: aiRelightConfig.providerKey,
      status: JobStatus.PENDING,
      inputImageId: inputMedia.id,
      creditCost: toolCreditCost,
      maxRetries: aiRelightConfig.maxRetries,
      toolVersion: tool.version
    }
  });

  await createJobEvent(job.id, "job_created", "AI relight job created.", {
    inputMediaId: inputMedia.id,
    toolKey: aiRelightConfig.toolKey,
    relightPreset,
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
      toolKey: aiRelightConfig.toolKey,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: JobStatus.PROCESSING }
    });
    await createJobEvent(job.id, "job_processing", "AI relight processing started.", {
      relightPreset
    });

    const inputUrl = await createPrivateReadUrl(inputMedia.storageKey);
    const inputBuffer = await downloadInput(inputUrl);
    let effectivePreset = relightPreset;
    let relit;
    try {
      relit = await createAiRelight(inputBuffer, relightPreset);
    } catch (presetError) {
      const errorMessage = presetError instanceof Error ? presetError.message : "Unknown preset processing error.";
      logAiRelightTiming({
        preset: relightPreset,
        processingStage: "relight_transform",
        width: inputMedia.width ?? null,
        height: inputMedia.height ?? null,
        errorMessage
      });

      if (relightPreset === "soft-studio-light") {
        throw presetError;
      }

      effectivePreset = "soft-studio-light";
      await createJobEvent(job.id, "preset_fallback_used", "AI relight preset failed; safe Soft Studio Light fallback was used.", {
        requestedPreset: relightPreset,
        fallbackPreset: effectivePreset,
        errorMessage
      });
      relit = await createAiRelight(inputBuffer, effectivePreset);
    }
    const exportOutput = await prepareExportBuffer(relit.buffer, creditPlan.exportMode);

    const resultMediaId = randomUUID();
    const resultFilename = `ai-relight-${getAiRelightFilenamePart(effectivePreset)}.png`;
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
      body: relit.buffer,
      contentType: "image/png",
      cacheControl,
      metadata: {
        userId: user.id,
        jobId: job.id,
        sourceProvider: aiRelightConfig.providerKey,
        toolKey: aiRelightConfig.toolKey,
        relightPreset: effectivePreset,
        requestedPreset: relightPreset,
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
        sourceProvider: aiRelightConfig.providerKey,
        toolKey: aiRelightConfig.toolKey,
        relightPreset: effectivePreset,
        requestedPreset: relightPreset,
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
        width: relit.width,
        height: relit.height,
        visibility: MediaVisibility.PRIVATE,
        processingStatus: MediaProcessingStatus.STORED,
        cacheControl,
        metadataJson: mergeCleanExportMetadata({
          source: "ai_relight",
          toolKey: aiRelightConfig.toolKey,
          category: aiRelightConfig.category,
          providerKey: aiRelightConfig.providerKey,
          relightPreset: effectivePreset,
          requestedPreset: relightPreset,
          relightPresetLabel: relit.label,
          width: relit.width,
          height: relit.height,
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
          fileSize: relit.buffer.length
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

    const costSnapshot = await buildJobCostSnapshotUpdate(job.id);
    const completedJob = await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        outputImageId: outputMedia.id,
        providerRequestId: `local-sharp:${effectivePreset}`,
        providerResponseJson: toPrismaJson({
          providerKey: aiRelightConfig.providerKey,
          relightPreset: effectivePreset,
          requestedPreset: relightPreset,
          width: relit.width,
          height: relit.height,
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

    await createJobEvent(job.id, "job_completed", "AI relight completed successfully.", {
      outputMediaId: outputMedia.id,
      relightPreset: effectivePreset,
      requestedPreset: relightPreset,
      relightPresetLabel: relit.label,
      width: relit.width,
      height: relit.height,
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
    const errorMessage = error instanceof Error ? error.message : "Unknown AI relight error.";
    await refundJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: aiRelightConfig.toolKey,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        errorMessage
      }
    });
    await createJobEvent(job.id, "job_failed", "AI relight failed.", {
      errorMessage,
      relightPreset
    });
    logAiRelightTiming({
      preset: relightPreset,
      processingStage: "job_failed",
      width: inputMedia.width ?? null,
      height: inputMedia.height ?? null,
      errorMessage
    });

    return NextResponse.json(
      {
        ok: false,
        job: {
          id: job.id,
          status: JobStatus.FAILED,
          errorMessage: "We could not relight this product photo. Please try another image."
        },
        ...(process.env.NODE_ENV === "development"
          ? {
              debug: {
                provider: aiRelightConfig.providerKey,
                relightPreset,
                errorMessage
              }
            }
          : {})
      },
      { status: 500 }
    );
  }
}

async function ensureAiRelightTool() {
  return prisma.aiTool.upsert({
    where: {
      slug_version: {
        slug: aiRelightConfig.slug,
        version: 1
      }
    },
    update: {
      deletedAt: null
    },
    create: {
      slug: aiRelightConfig.slug,
      version: 1,
      name: "AI Relight",
      category: "Ecommerce",
      description: "Transform dull product photos into brighter, cleaner, premium studio-style visuals for Shopify, Amazon, Etsy, ads, and catalog pages.",
      creditCost: aiRelightConfig.creditCost,
      status: ToolStatus.ACTIVE,
      inputRulesJson: {
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        maxFileSizeMb: 12,
        maxWidth: 6000,
        maxHeight: 6000
      },
      outputType: "image",
      providerKey: aiRelightConfig.providerKey,
      providerConfigJson: {
        model: "sharp-local-relight-composition",
        outputFormat: "png",
        presets: aiRelightConfig.presets
      },
      fallbackProviderKeysJson: [],
      retryPolicyJson: {
        maxRetries: 0,
        timeoutSeconds: 20,
        retryDelaySeconds: 0,
        allowFallback: false
      },
      seoTitle: "AI Relight - Ecommerce Studio Lighting Tool",
      seoDescription: "Transform dull product photos into brighter, cleaner, premium studio-style visuals for Shopify, Amazon, Etsy, ads, and catalog pages.",
      landingContentJson: {
        hero: "Turn flat product lighting into a premium studio-lit look.",
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

function getAiRelightFilenamePart(preset: AiRelightPreset) {
  if (preset === "luxury-glow") return "luxury-glow";
  if (preset === "bright-catalog") return "bright-catalog";
  if (preset === "dramatic-product-light") return "dramatic";
  return "soft-studio-light";
}

function logAiRelightTiming(input: {
  preset: AiRelightPreset;
  processingStage: string;
  width: number | null;
  height: number | null;
  errorMessage: string;
}) {
  if (process.env.NODE_ENV !== "development") return;

  console.error("[ai-relight-timing]", JSON.stringify(input));
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
