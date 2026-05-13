import { randomUUID } from "node:crypto";
import {
  JobStatus,
  MediaProcessingStatus,
  MediaType,
  MediaVisibility,
  Prisma,
  ToolStatus
} from "@prisma/client";
import { inflateSync } from "node:zlib";
import { NextResponse } from "next/server";
import {
  backgroundRemoverConfig,
  getBackgroundRemovalAttempts,
  getBackgroundRemovalQualityFallbackAttempt,
  type BackgroundRemovalAttempt,
  type BackgroundRemovalProviderKey,
  type BackgroundRemovalQualityMode
} from "@/config/ai-tools";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
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
import {
  BackgroundRemovalProviderError,
  type BackgroundRemovalTarget
} from "@/lib/ai/background-removal/types";
import {
  createReplicateBackgroundRemovalInput,
  runBackgroundRemovalTarget
} from "@/lib/ai/background-removal/providers";
import {
  createReplicatePrediction,
  extractReplicateOutputUrl,
  ReplicateApiError,
  ReplicatePredictionError,
  waitForReplicatePrediction
} from "@/lib/ai/providers/replicate";
import {
  buildResultStorageKey,
  createPrivateReadUrl,
  uploadPrivateObject
} from "@/lib/storage/s3-client";
import { getCacheControl } from "@/lib/storage/policy";

export const runtime = "nodejs";

function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type JobRequest = {
  inputMediaId?: string;
  qualityMode?: BackgroundRemovalQualityMode;
};

type AttemptResult = {
  ok: true;
  providerKey: BackgroundRemovalProviderKey;
  providerRequestId: string;
  outputUrl?: string;
  outputBuffer?: Buffer;
  rawResponse: unknown;
  processingTimeMs: number;
  model: string;
  modelKey: string;
  qualityTier: BackgroundRemovalQualityMode;
  attemptNumber: number;
} | {
  ok: false;
  providerKey: BackgroundRemovalProviderKey;
  errorMessage: string;
  providerRequestId?: string;
  rawResponse?: unknown;
  providerStatusCode?: number | null;
  processingTimeMs: number;
  model: string;
  modelKey: string;
  qualityTier: BackgroundRemovalQualityMode;
  attemptNumber: number;
};

export async function POST(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "You must be logged in to create an AI job."
      },
      { status: 401 }
    );
  }

  const rateLimit = checkRateLimit(request, {
    action: "job",
    userId: user.id
  });

  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[tool-run-user]", {
      tool: backgroundRemoverConfig.slug,
      userId: user.id
    });
  }

  const body = (await request.json().catch(() => null)) as JobRequest | null;
  const qualityMode = normalizeQualityMode(body?.qualityMode);
  const activeProviderKey = getProviderForQualityMode(qualityMode);
  const effectiveQualityMode = activeProviderKey === "replicate" && qualityMode === "high" ? "standard" : qualityMode;

  if (!body?.inputMediaId) {
    return NextResponse.json(
      {
        ok: false,
        error: "inputMediaId is required."
      },
      { status: 400 }
    );
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
    return NextResponse.json(
      {
        ok: false,
        error: "Upload not found for this user."
      },
      { status: 404 }
    );
  }

  const tool = await prisma.aiTool.findFirst({
    where: {
      slug: backgroundRemoverConfig.slug,
      status: ToolStatus.ACTIVE,
      deletedAt: null
    },
    orderBy: {
      version: "desc"
    }
  });

  if (!tool) {
    return NextResponse.json(
      {
        ok: false,
        error: "Background Remover is not active yet."
      },
      { status: 409 }
    );
  }
  const toolCreditCost = tool.creditCost ?? backgroundRemoverConfig.creditCost;
  let creditPlan = createJobCreditPlan(user, toolCreditCost);

  const job = await prisma.aiJob.create({
    data: {
      userId: user.id,
      toolId: tool.id,
      providerKey: activeProviderKey,
      status: JobStatus.PENDING,
      inputImageId: inputMedia.id,
      creditCost: toolCreditCost,
      maxRetries: backgroundRemoverConfig.maxRetries,
      toolVersion: tool.version
    }
  });

  if (process.env.NODE_ENV === "development") {
    console.info("[tool-job-created]", {
      tool: backgroundRemoverConfig.slug,
      userId: user.id,
      jobId: job.id,
      inputMediaId: inputMedia.id,
      status: job.status
    });
  }

  await createJobEvent(job.id, "job_created", "Background remover job created.", {
    inputMediaId: inputMedia.id,
    creditCost: toolCreditCost,
    creditEnforcementActive: true,
    exportMode: creditPlan.exportMode,
    creditBalanceBefore: creditPlan.balanceBefore
  });

  try {
    creditPlan = await reserveJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: backgroundRemoverConfig.slug,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: JobStatus.PROCESSING }
    });
    await createJobEvent(job.id, "job_processing", "Background remover processing started.");

    const inputUrl = await createPrivateReadUrl(inputMedia.storageKey);
    if (qualityMode === "high" && activeProviderKey === "replicate") {
      await createJobEvent(job.id, "photoroom_key_missing_fallback", "PhotoRoom API key is missing; High Quality fell back to Replicate Standard for this environment.", {
        requestedQualityMode: qualityMode,
        effectiveQualityMode,
        providerKey: activeProviderKey
      });
    }

    let attempt = activeProviderKey === "replicate"
      ? await runWithFallback({
          jobId: job.id,
          imageUrl: inputUrl,
          qualityMode: effectiveQualityMode
        })
      : await runConfiguredProvider({
          jobId: job.id,
          imageUrl: inputUrl,
          providerKey: activeProviderKey,
          qualityMode: effectiveQualityMode,
          inputMedia: {
            mimeType: inputMedia.mimeType,
            filename: inputMedia.originalFilename || "input-image"
          }
        });

    if (!attempt.ok) {
      await refundJobCredits({
        userId: user.id,
        jobId: job.id,
        toolKey: backgroundRemoverConfig.slug,
        plan: creditPlan
      });

      await prisma.aiJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          errorMessage: attempt.errorMessage,
          processingTimeMs: attempt.processingTimeMs,
          providerRequestId: attempt.providerRequestId,
          providerResponseJson: toPrismaJson(attempt.rawResponse),
          retryCount: attempt.attemptNumber - 1
        }
      });
      await createJobEvent(job.id, "job_failed", "Background remover failed after all attempts.", {
        errorMessage: attempt.errorMessage
      });

      return NextResponse.json(
        {
          ok: false,
          job: {
            id: job.id,
            status: JobStatus.FAILED,
            errorMessage: "We could not remove the background from this image. Please try another image."
          },
          ...(isDevelopment()
            ? {
                debug: {
                  provider: attempt.providerKey,
                  model: attempt.model,
                  attemptNumber: attempt.attemptNumber,
                  providerRequestId: attempt.providerRequestId,
                  providerError: attempt.errorMessage,
                  providerResponse: sanitizeForDebug(attempt.rawResponse)
                }
              }
            : {})
        },
        { status: 502 }
      );
    }

    let outputBuffer = attempt.outputBuffer ?? await downloadOutput(attempt.outputUrl);
    let qualityReport = inspectBackgroundRemovalQuality(outputBuffer);

    if (shouldRetryWithQualityFallback(qualityReport, attempt)) {
      await createJobEvent(job.id, "quality_fallback_started", "Result quality looked weak; trying a higher quality segmentation model.", {
        originalModel: attempt.model,
        originalQualityTier: attempt.qualityTier,
        qualityReport,
        refinementHooks: getRefinementHookPlan()
      });

      const qualityAttempt = process.env.PHOTOROOM_API_KEY
        ? await runConfiguredProvider({
            jobId: job.id,
            imageUrl: inputUrl,
            providerKey: "photoroom",
            qualityMode: "high",
            inputMedia: {
              mimeType: inputMedia.mimeType,
              filename: inputMedia.originalFilename || "input-image"
            },
            attemptNumber: attempt.attemptNumber + 1
          })
        : await runAttempt({
            jobId: job.id,
            imageUrl: inputUrl,
            attempt: getBackgroundRemovalQualityFallbackAttempt(),
            attemptNumber: attempt.attemptNumber + 1
          });

      if (qualityAttempt.ok) {
        const qualityOutputBuffer = qualityAttempt.outputBuffer ?? await downloadOutput(qualityAttempt.outputUrl);
        const qualityFallbackReport = inspectBackgroundRemovalQuality(qualityOutputBuffer);

        if (!qualityFallbackReport.shouldReject) {
          attempt = qualityAttempt;
          outputBuffer = qualityOutputBuffer;
          qualityReport = qualityFallbackReport;
          await createJobEvent(job.id, "quality_fallback_used", "Higher quality segmentation result selected.", {
            model: qualityAttempt.model,
            qualityReport
          });
        }
      } else {
        await createJobEvent(job.id, "quality_fallback_failed", "Higher quality fallback failed; keeping original successful result.", {
          model: qualityAttempt.model,
          errorMessage: qualityAttempt.errorMessage
        });
      }
    }

    const exportOutput = await prepareExportBuffer(outputBuffer, creditPlan.exportMode);
    const resultMediaId = randomUUID();
    const resultFilename = "background-remover.png";
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
        sourceProvider: attempt.providerKey,
        backgroundRemovalProvider: attempt.providerKey,
        model: attempt.model,
        qualityTier: attempt.qualityTier,
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
        sourceProvider: attempt.providerKey,
        backgroundRemovalProvider: attempt.providerKey,
        model: attempt.model,
        qualityTier: attempt.qualityTier,
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
          source: "background_remover",
          providerKey: attempt.providerKey,
          model: attempt.model,
          modelKey: attempt.modelKey,
          requestedQualityMode: qualityMode,
          qualityTier: attempt.qualityTier,
          providerRequestId: attempt.providerRequestId,
          qualityReport,
          refinementHooks: getRefinementHookPlan(),
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
        providerRequestId: attempt.providerRequestId,
        providerResponseJson: toPrismaJson(attempt.rawResponse),
        processingTimeMs: attempt.processingTimeMs,
        retryCount: attempt.attemptNumber - 1,
        fallbackAttempted: attempt.providerKey !== "replicate" || attempt.model !== backgroundRemoverConfig.primaryModel,
        fallbackProviderKey:
          attempt.providerKey !== "replicate" || attempt.model !== backgroundRemoverConfig.primaryModel
            ? `${attempt.providerKey}:${attempt.model}`
            : null,
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

    if (process.env.NODE_ENV === "development") {
      console.info("[tool-job-completed]", {
        tool: backgroundRemoverConfig.slug,
        userId: user.id,
        jobId: completedJob.id,
        outputMediaId: outputMedia.id,
        status: completedJob.status
      });
    }

    await createJobEvent(job.id, "job_completed", "Background removed successfully.", {
      outputMediaId: outputMedia.id,
      model: attempt.model,
      providerKey: attempt.providerKey,
      qualityTier: attempt.qualityTier,
      qualityReport,
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
    const errorMessage = error instanceof Error ? error.message : "Unknown background remover error.";
    await refundJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: backgroundRemoverConfig.slug,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        errorMessage
      }
    });
    await createJobEvent(job.id, "job_failed", "Background remover failed unexpectedly.", {
      errorMessage
    });

    return NextResponse.json(
      {
        ok: false,
        job: {
          id: job.id,
          status: JobStatus.FAILED,
          errorMessage: "We could not remove the background from this image. Please try again."
        }
      },
      { status: 500 }
    );
  }
}

async function runWithFallback(input: {
  jobId: string;
  imageUrl: string;
  qualityMode: BackgroundRemovalQualityMode;
}): Promise<AttemptResult> {
  const attempts = getBackgroundRemovalAttempts(input.qualityMode).filter((attempt) => attempt.model);
  let finalFailure: AttemptResult | null = null;
  let attemptNumber = 1;

  for (const attempt of attempts) {
    let result = await runAttempt({
      jobId: input.jobId,
      imageUrl: input.imageUrl,
      attempt,
      attemptNumber
    });

    if (!result.ok && result.providerStatusCode === 429) {
      const retryAfterSeconds = getRetryAfterSeconds(result.rawResponse);
      if (retryAfterSeconds > 0 && retryAfterSeconds <= 10) {
        await createJobEvent(input.jobId, "provider_rate_limited_retry", "Replicate rate limited this attempt; retrying after a short wait.", {
          model: attempt.model,
          modelKey: attempt.key,
          attemptNumber,
          retryAfterSeconds
        });
        await sleep((retryAfterSeconds + 1) * 1000);
        attemptNumber += 1;
        result = await runAttempt({
          jobId: input.jobId,
          imageUrl: input.imageUrl,
          attempt,
          attemptNumber
        });
      }
    }

    if (result.ok) {
      return result;
    }

    finalFailure = result;

    if (isAccountLevelProviderFailure(result.providerStatusCode)) {
      await createJobEvent(input.jobId, "provider_fallback_skipped", "Fallback skipped because Replicate account/token cannot create predictions.", {
        model: attempt.model,
        attemptNumber,
        providerStatusCode: result.providerStatusCode
      });
      break;
    }

    attemptNumber += 1;
  }

  return finalFailure ?? {
    ok: false,
    errorMessage: "No background remover models were configured.",
    processingTimeMs: 0,
    model: "none",
    modelKey: "none",
    providerKey: "replicate",
    qualityTier: input.qualityMode,
    attemptNumber: 0
  };
}

async function runConfiguredProvider(input: {
  jobId: string;
  imageUrl: string;
  providerKey: Extract<BackgroundRemovalProviderKey, "photoroom">;
  qualityMode: BackgroundRemovalQualityMode;
  attemptNumber?: number;
  inputMedia: {
    mimeType: string;
    filename: string;
  };
}): Promise<AttemptResult> {
  const startedAt = Date.now();
  const target: BackgroundRemovalTarget = {
    providerKey: input.providerKey,
    key: `${input.providerKey}-configured-background-removal`,
    label: input.providerKey === "photoroom" ? "PhotoRoom Remove Background API" : "remove.bg API",
    qualityTier: input.qualityMode
  };

  try {
    await createJobEvent(input.jobId, "provider_attempt_started", "Background removal provider attempt started.", {
      providerKey: input.providerKey,
      targetKey: target.key,
      qualityTier: input.qualityMode,
      attemptNumber: input.attemptNumber ?? 1
    });

    const result = await runBackgroundRemovalTarget({
      imageUrl: input.imageUrl,
      mimeType: input.inputMedia.mimeType,
      filename: input.inputMedia.filename,
      target
    });

    await prisma.providerLog.create({
      data: {
        aiJobId: input.jobId,
        providerKey: result.providerKey,
        requestJson: {
          providerKey: result.providerKey,
          targetKey: result.targetKey,
          qualityTier: result.qualityTier,
          input: sanitizeInputUrl(input.imageUrl)
        },
        responseJson: toPrismaJson(result.rawResponse),
        attemptNumber: input.attemptNumber ?? 1,
        timedOut: false
      }
    });

    await createJobEvent(input.jobId, "provider_attempt_succeeded", "Background removal provider attempt succeeded.", {
      providerKey: result.providerKey,
      targetKey: result.targetKey,
      qualityTier: result.qualityTier,
      attemptNumber: input.attemptNumber ?? 1
    });

    return {
      ok: true,
      providerKey: result.providerKey,
      providerRequestId: result.providerRequestId || `${result.providerKey}:${Date.now()}`,
      outputBuffer: result.outputBuffer,
      rawResponse: result.rawResponse,
      processingTimeMs: result.processingTimeMs,
      model: result.label,
      modelKey: result.targetKey,
      qualityTier: result.qualityTier,
      attemptNumber: input.attemptNumber ?? 1
    };
  } catch (error) {
    const providerError = error instanceof BackgroundRemovalProviderError ? error : null;
    const errorMessage = error instanceof Error ? error.message : "Unknown provider error.";
    const processingTimeMs = providerError?.processingTimeMs ?? Date.now() - startedAt;

    logProviderFailure({
      jobId: input.jobId,
      model: target.label,
      attemptNumber: input.attemptNumber ?? 1,
      providerStatusCode: providerError?.statusCode ?? null,
      errorMessage,
      rawResponse: providerError?.rawResponse,
      inputUrl: input.imageUrl
    });

    await prisma.providerLog.create({
      data: {
        aiJobId: input.jobId,
        providerKey: input.providerKey,
        requestJson: {
          providerKey: input.providerKey,
          targetKey: target.key,
          qualityTier: input.qualityMode,
          input: sanitizeInputUrl(input.imageUrl)
        },
        responseJson: toPrismaJson(providerError?.rawResponse),
        errorMessage,
        statusCode: providerError?.statusCode,
        attemptNumber: input.attemptNumber ?? 1,
        timedOut: errorMessage.toLowerCase().includes("timed out")
      }
    });

    await createJobEvent(input.jobId, "provider_attempt_failed", "Background removal provider attempt failed.", {
      providerKey: input.providerKey,
      targetKey: target.key,
      qualityTier: input.qualityMode,
      attemptNumber: input.attemptNumber ?? 1,
      errorMessage
    });

    return {
      ok: false,
      providerKey: input.providerKey,
      errorMessage,
      rawResponse: providerError?.rawResponse,
      providerStatusCode: providerError?.statusCode,
      processingTimeMs,
      model: target.label,
      modelKey: target.key,
      qualityTier: input.qualityMode,
      attemptNumber: input.attemptNumber ?? 1
    };
  }
}

async function runAttempt(input: {
  jobId: string;
  imageUrl: string;
  attempt: BackgroundRemovalAttempt;
  attemptNumber: number;
}): Promise<AttemptResult> {
  const startedAt = Date.now();
  let providerRequestId: string | undefined;
  let rawResponse: unknown;
  let providerStatusCode: number | null = null;

  try {
    await createJobEvent(input.jobId, "provider_attempt_started", "Replicate attempt started.", {
      model: input.attempt.model,
      modelKey: input.attempt.key,
      qualityTier: input.attempt.qualityTier,
      attemptNumber: input.attemptNumber
    });

    const prediction = await createReplicatePrediction({
      model: input.attempt.model,
      imageUrl: input.imageUrl,
      input: createReplicateBackgroundRemovalInput(input.attempt.inputType, input.imageUrl)
    });
    providerRequestId = prediction.id;
    rawResponse = prediction;

    const completed = await waitForReplicatePrediction({
      prediction,
      timeoutSeconds: backgroundRemoverConfig.timeoutSeconds,
      pollIntervalSeconds: backgroundRemoverConfig.pollIntervalSeconds
    });
    rawResponse = completed;

    const outputUrl = extractReplicateOutputUrl(completed);
    if (!outputUrl) {
      throw new Error("Replicate output URL is missing.");
    }

    const processingTimeMs = Date.now() - startedAt;

    await prisma.providerLog.create({
      data: {
        aiJobId: input.jobId,
        providerKey: "replicate",
        requestJson: {
          model: input.attempt.model,
          modelKey: input.attempt.key,
          qualityTier: input.attempt.qualityTier,
          input: sanitizeInputUrl(input.imageUrl)
        },
        responseJson: toPrismaJson(completed),
        attemptNumber: input.attemptNumber,
        timedOut: false
      }
    });

    await createJobEvent(input.jobId, "provider_attempt_succeeded", "Replicate attempt succeeded.", {
      model: input.attempt.model,
      modelKey: input.attempt.key,
      qualityTier: input.attempt.qualityTier,
      attemptNumber: input.attemptNumber,
      providerRequestId
    });

    return {
      ok: true,
      providerKey: "replicate",
      providerRequestId,
      outputUrl,
      rawResponse: completed,
      processingTimeMs,
      model: input.attempt.model,
      modelKey: input.attempt.key,
      qualityTier: input.attempt.qualityTier,
      attemptNumber: input.attemptNumber
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown Replicate attempt error.";
    const processingTimeMs = Date.now() - startedAt;
    const timedOut = errorMessage.toLowerCase().includes("timed out");
    if (error instanceof ReplicateApiError) {
      rawResponse = error.responseJson ?? error.responseBody;
      providerStatusCode = error.status;
    } else if (error instanceof ReplicatePredictionError) {
      rawResponse = error.prediction;
      providerRequestId = providerRequestId ?? error.prediction.id;
    }

    logProviderFailure({
      jobId: input.jobId,
      model: input.attempt.model,
      attemptNumber: input.attemptNumber,
      providerRequestId,
      providerStatusCode,
      errorMessage,
      rawResponse,
      inputUrl: input.imageUrl
    });

    await prisma.providerLog.create({
      data: {
        aiJobId: input.jobId,
        providerKey: "replicate",
        requestJson: {
          model: input.attempt.model,
          modelKey: input.attempt.key,
          qualityTier: input.attempt.qualityTier,
          input: sanitizeInputUrl(input.imageUrl)
        },
        responseJson: toPrismaJson(rawResponse),
        errorMessage,
        statusCode: providerStatusCode,
        attemptNumber: input.attemptNumber,
        timedOut
      }
    });

    await createJobEvent(input.jobId, "provider_attempt_failed", "Replicate attempt failed.", {
      model: input.attempt.model,
      modelKey: input.attempt.key,
      qualityTier: input.attempt.qualityTier,
      attemptNumber: input.attemptNumber,
      providerRequestId,
      errorMessage
    });

    return {
      ok: false,
      providerKey: "replicate",
      errorMessage,
      providerRequestId,
      rawResponse,
      providerStatusCode,
      processingTimeMs,
      model: input.attempt.model,
      modelKey: input.attempt.key,
      qualityTier: input.attempt.qualityTier,
      attemptNumber: input.attemptNumber
    };
  }
}

async function downloadOutput(url?: string) {
  if (!url) {
    throw new Error("Provider output URL is missing.");
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not download provider output: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

type QualityReport = {
  inspected: boolean;
  reason: string;
  width?: number;
  height?: number;
  transparentRatio?: number;
  foregroundRatio?: number;
  borderForegroundRatio?: number;
  shouldRetryHighQuality: boolean;
  shouldReject: boolean;
};

function inspectBackgroundRemovalQuality(buffer: Buffer): QualityReport {
  const alphaStats = readPngAlphaStats(buffer);
  if (!alphaStats) {
    return {
      inspected: false,
      reason: "Output is not an inspectable RGBA PNG.",
      shouldRetryHighQuality: false,
      shouldReject: false
    };
  }

  const transparentRatio = alphaStats.transparentPixels / alphaStats.totalPixels;
  const foregroundRatio = alphaStats.foregroundPixels / alphaStats.totalPixels;
  const borderForegroundRatio = alphaStats.borderForegroundPixels / Math.max(alphaStats.borderPixels, 1);
  const tooLittleForeground = foregroundRatio < 0.04;
  const tooLittleTransparency = transparentRatio < 0.03;
  const likelyUnremovedBackground = foregroundRatio > 0.96 && transparentRatio < 0.02;

  return {
    inspected: true,
    reason: tooLittleForeground
      ? "Foreground is extremely small; body parts may have been over-removed."
      : tooLittleTransparency || likelyUnremovedBackground
        ? "Output has very little transparency; background may not have been removed."
        : "Alpha channel looks plausible.",
    width: alphaStats.width,
    height: alphaStats.height,
    transparentRatio,
    foregroundRatio,
    borderForegroundRatio,
    shouldRetryHighQuality: tooLittleForeground || tooLittleTransparency || likelyUnremovedBackground,
    shouldReject: tooLittleForeground
  };
}

function shouldRetryWithQualityFallback(report: QualityReport, attempt: AttemptResult) {
  return attempt.ok && attempt.qualityTier !== "high" && report.shouldRetryHighQuality;
}

function getRefinementHookPlan() {
  return {
    edgeCleanup: "placeholder_not_enabled",
    alphaMatting: "placeholder_not_enabled",
    refinementPass: "placeholder_not_enabled",
    strategy: "Prefer preserving full human body/limbs over aggressive background cleanup."
  };
}

function readPngAlphaStats(buffer: Buffer) {
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    }

    if (type === "IDAT") {
      idatChunks.push(data);
    }

    if (type === "IEND") break;
    offset = dataEnd + 4;
  }

  if (!width || !height || bitDepth !== 8 || colorType !== 6 || idatChunks.length === 0) {
    return null;
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rows: Buffer[] = [];
  let readOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[readOffset];
    const scanline = Buffer.from(inflated.subarray(readOffset + 1, readOffset + 1 + stride));
    const row = unfilterPngScanline(scanline, previous, filter, bytesPerPixel);
    rows.push(row);
    previous = row;
    readOffset += 1 + stride;
  }

  let transparentPixels = 0;
  let foregroundPixels = 0;
  let borderForegroundPixels = 0;
  let borderPixels = 0;
  const alphaThreshold = 24;

  for (let y = 0; y < height; y += 1) {
    const row = rows[y];
    for (let x = 0; x < width; x += 1) {
      const alpha = row[x * bytesPerPixel + 3];
      const isForeground = alpha > alphaThreshold;
      if (alpha <= alphaThreshold) transparentPixels += 1;
      if (isForeground) foregroundPixels += 1;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        borderPixels += 1;
        if (isForeground) borderForegroundPixels += 1;
      }
    }
  }

  return {
    width,
    height,
    totalPixels: width * height,
    transparentPixels,
    foregroundPixels,
    borderPixels,
    borderForegroundPixels
  };
}

function unfilterPngScanline(scanline: Buffer, previous: Buffer, filter: number, bytesPerPixel: number) {
  const row = Buffer.alloc(scanline.length);

  for (let index = 0; index < scanline.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
    const value = scanline[index];

    if (filter === 0) row[index] = value;
    else if (filter === 1) row[index] = (value + left) & 0xff;
    else if (filter === 2) row[index] = (value + up) & 0xff;
    else if (filter === 3) row[index] = (value + Math.floor((left + up) / 2)) & 0xff;
    else if (filter === 4) row[index] = (value + paethPredictor(left, up, upLeft)) & 0xff;
    else row[index] = value;
  }

  return row;
}

function paethPredictor(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
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
    if (isMissingJobEventTable(error)) {
      console.warn("JobEvent table is not available yet. Run database/supabase/phase_2b_job_events.sql.");
      return;
    }

    throw error;
  }
}

function isMissingJobEventTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && ["P2021", "P2022"].includes(error.code);
}

function isAccountLevelProviderFailure(statusCode?: number | null) {
  return statusCode === 401 || statusCode === 402 || statusCode === 403;
}

function getRetryAfterSeconds(rawResponse: unknown) {
  if (!rawResponse || typeof rawResponse !== "object") return 0;
  const value = (rawResponse as { retry_after?: unknown; retryAfter?: unknown }).retry_after ??
    (rawResponse as { retry_after?: unknown; retryAfter?: unknown }).retryAfter;
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.ceil(numericValue) : 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeQualityMode(mode?: BackgroundRemovalQualityMode) {
  if (mode === "fast" || mode === "standard" || mode === "high") return mode;
  return backgroundRemoverConfig.qualityMode;
}

function getProviderForQualityMode(mode: BackgroundRemovalQualityMode): Extract<BackgroundRemovalProviderKey, "replicate" | "photoroom"> {
  return mode === "high" && process.env.PHOTOROOM_API_KEY ? "photoroom" : "replicate";
}

function isDevelopment() {
  return process.env.NODE_ENV === "development";
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
    return {
      invalid: true
    };
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

function logProviderFailure(input: {
  jobId: string;
  model: string;
  attemptNumber: number;
  providerRequestId?: string;
  providerStatusCode: number | null;
  errorMessage: string;
  rawResponse: unknown;
  inputUrl: string;
}) {
  if (!isDevelopment()) return;

  console.error("background-remover provider failure", JSON.stringify({
    jobId: input.jobId,
    provider: "replicate",
    model: input.model,
    attemptNumber: input.attemptNumber,
    providerRequestId: input.providerRequestId,
    providerStatusCode: input.providerStatusCode,
    errorMessage: input.errorMessage,
    inputUrl: sanitizeInputUrl(input.inputUrl),
    providerResponse: sanitizeForDebug(input.rawResponse)
  }, null, 2));
}
