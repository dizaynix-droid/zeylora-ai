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
import { photoEnhancerConfig } from "@/config/ai-tools";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  PhotoEnhancementProviderError,
  runPhotoEnhancement
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

  const tool = await prisma.aiTool.findFirst({
    where: {
      slug: photoEnhancerConfig.slug,
      status: ToolStatus.ACTIVE,
      deletedAt: null
    },
    orderBy: {
      version: "desc"
    }
  });

  if (!tool) {
    return NextResponse.json({ ok: false, error: "Photo Enhancer is not active yet." }, { status: 409 });
  }
  let creditPlan = createJobCreditPlan(user, photoEnhancerConfig.creditCost);

  const job = await prisma.aiJob.create({
    data: {
      userId: user.id,
      toolId: tool.id,
      providerKey: photoEnhancerConfig.providerKey,
      status: JobStatus.PENDING,
      inputImageId: inputMedia.id,
      creditCost: photoEnhancerConfig.creditCost,
      maxRetries: photoEnhancerConfig.maxRetries,
      toolVersion: tool.version
    }
  });

  await createJobEvent(job.id, "job_created", "Photo enhancer job created.", {
    inputMediaId: inputMedia.id,
    toolKey: photoEnhancerConfig.toolKey,
    creditCost: photoEnhancerConfig.creditCost,
    creditEnforcementActive: true,
    exportMode: creditPlan.exportMode,
    creditBalanceBefore: creditPlan.balanceBefore
  });

  try {
    creditPlan = await reserveJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: photoEnhancerConfig.toolKey,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: JobStatus.PROCESSING }
    });
    await createJobEvent(job.id, "job_processing", "Photo enhancer processing started.");

    const inputUrl = await createPrivateReadUrl(inputMedia.storageKey);
    await createJobEvent(job.id, "provider_attempt_started", "Replicate photo enhancement attempt started.", {
      providerKey: photoEnhancerConfig.providerKey,
      model: photoEnhancerConfig.model,
      scale: photoEnhancerConfig.scale,
      faceEnhance: photoEnhancerConfig.faceEnhance
    });

    const enhancement = await runPhotoEnhancement({ imageUrl: inputUrl });
    const outputBuffer = await downloadOutput(enhancement.outputUrl);
    const exportOutput = await prepareExportBuffer(outputBuffer, creditPlan.exportMode);

    await prisma.providerLog.create({
      data: {
        aiJobId: job.id,
        providerKey: enhancement.providerKey,
        requestJson: {
          toolKey: photoEnhancerConfig.toolKey,
          model: enhancement.model,
          modelKey: enhancement.modelKey,
          scale: photoEnhancerConfig.scale,
          faceEnhance: photoEnhancerConfig.faceEnhance,
          input: sanitizeInputUrl(inputUrl)
        },
        responseJson: toPrismaJson(enhancement.rawResponse),
        attemptNumber: 1,
        timedOut: false
      }
    });

    const resultMediaId = randomUUID();
    const resultFilename = "photo-enhancer.png";
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
        sourceProvider: enhancement.providerKey,
        toolKey: photoEnhancerConfig.toolKey,
        model: enhancement.model,
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
        sourceProvider: enhancement.providerKey,
        toolKey: photoEnhancerConfig.toolKey,
        model: enhancement.model,
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
          source: "photo_enhancer",
          toolKey: photoEnhancerConfig.toolKey,
          category: photoEnhancerConfig.category,
          providerKey: enhancement.providerKey,
          model: enhancement.model,
          modelKey: enhancement.modelKey,
          scale: photoEnhancerConfig.scale,
          faceEnhance: photoEnhancerConfig.faceEnhance,
          providerRequestId: enhancement.providerRequestId,
          useCases: ["ecommerce_photos", "portraits", "social_media_images", "low_resolution_photos"],
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
        providerRequestId: enhancement.providerRequestId,
        providerResponseJson: toPrismaJson(enhancement.rawResponse),
        processingTimeMs: enhancement.processingTimeMs,
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

    await createJobEvent(job.id, "job_completed", "Photo enhanced successfully.", {
      outputMediaId: outputMedia.id,
      providerKey: enhancement.providerKey,
      model: enhancement.model,
      scale: photoEnhancerConfig.scale,
      exportMode: creditPlan.exportMode,
      creditCharged: creditPlan.charged,
      watermarkApplied: exportOutput.applied,
      watermarkPlacement: exportOutput.placement,
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
    const errorMessage = error instanceof Error ? error.message : "Unknown photo enhancer error.";
    await refundJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: photoEnhancerConfig.toolKey,
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

    await createJobEvent(job.id, "job_failed", "Photo enhancer failed.", {
      errorMessage,
      providerKey: providerError?.providerKey,
      providerStatusCode: providerError?.statusCode
    });

    if (providerError) {
      await prisma.providerLog.create({
        data: {
          aiJobId: job.id,
          providerKey: providerError.providerKey,
          requestJson: {
            toolKey: photoEnhancerConfig.toolKey,
            model: photoEnhancerConfig.model
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
          errorMessage: "We could not enhance this image. Please try another photo."
        },
        ...(process.env.NODE_ENV === "development"
          ? {
              debug: {
                provider: providerError?.providerKey || photoEnhancerConfig.providerKey,
                model: photoEnhancerConfig.model,
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
