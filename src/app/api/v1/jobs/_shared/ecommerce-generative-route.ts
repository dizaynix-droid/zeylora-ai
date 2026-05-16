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
import { resolveToolEconomy, type ToolEconomyTier } from "@/config/tool-economy";
import type { TrackingEvent } from "@/config/tracking";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import {
  EcommerceGenerationProviderError,
  runEcommerceGeneration,
  type EcommerceGenerationTool
} from "@/lib/ai/ecommerce-generation/providers";
import { preparePhotoEnhancementProviderInput } from "@/lib/ai/photo-enhancement/provider-input";
import { trackServerEvent } from "@/lib/analytics/server";
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
import { buildJobCostSnapshotUpdate } from "@/lib/jobs/cost-snapshot";
import { prepareExportBuffer } from "@/lib/media/watermark";
import { getCacheControl } from "@/lib/storage/policy";
import {
  buildResultStorageKey,
  createPrivateReadUrl,
  uploadPrivateObject
} from "@/lib/storage/s3-client";

export type EcommerceGenerativeRouteConfig = {
  toolKey: EcommerceGenerationTool;
  slug: string;
  publicName: string;
  category: string;
  description: string;
  providerKey: string;
  model: string;
  proModel: string;
  maxRetries: number;
  timeoutSeconds: number;
  creditCost: number;
  proCreditCost: number;
  promptMaxLength: number;
  inputModeDescription: string;
  outputFilenamePrefix: string;
  startedEvent: TrackingEvent;
  completedEvent: TrackingEvent;
  failedEvent: TrackingEvent;
  useCases: string[];
  buildPrompt: (body: Record<string, unknown>) => {
    prompt: string;
    qualityMode: "standard" | "pro";
    aspectRatio?: string;
    metadata: Record<string, unknown>;
  };
};

function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function handleEcommerceGenerativeJob(request: Request, config: EcommerceGenerativeRouteConfig) {
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

  const body = (await request.json().catch(() => null)) as (Record<string, unknown> & { inputMediaId?: string }) | null;

  if (!body?.inputMediaId) {
    return NextResponse.json({ ok: false, error: "inputMediaId is required." }, { status: 400 });
  }

  const promptPlan = config.buildPrompt(body);
  const prompt = promptPlan.prompt.replace(/\s+/g, " ").trim().slice(0, config.promptMaxLength);

  if (!prompt) {
    return NextResponse.json({ ok: false, error: "Prompt is required." }, { status: 400 });
  }

  if (isUnsafePrompt(prompt)) {
    return NextResponse.json(
      { ok: false, error: "This request is not supported for safety reasons." },
      { status: 400 }
    );
  }

  const economy = resolveToolEconomy({
    toolSlug: config.slug,
    qualityMode: promptPlan.qualityMode,
    providerKey: config.providerKey
  });

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

  const tool = await ensureGenerativeTool(config, economy);
  if (tool.status !== ToolStatus.ACTIVE) {
    return NextResponse.json({ ok: false, error: `${config.publicName} is not active yet.` }, { status: 409 });
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
      maxRetries: config.maxRetries,
      toolVersion: tool.version
    }
  });

  await createJobEvent(job.id, "job_created", `${config.publicName} job created.`, {
    inputMediaId: inputMedia.id,
    toolKey: config.toolKey,
    qualityMode: promptPlan.qualityMode,
    prompt,
    creditCost: toolCreditCost,
    creditEnforcementActive: true,
    exportMode: creditPlan.exportMode,
    creditBalanceBefore: creditPlan.balanceBefore,
    ...promptPlan.metadata
  });

  try {
    creditPlan = await reserveJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: config.toolKey,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: JobStatus.PROCESSING }
    });
    await createJobEvent(job.id, "job_processing", `${config.publicName} processing started.`, {
      qualityMode: promptPlan.qualityMode,
      ...promptPlan.metadata
    });
    trackServerEvent(config.startedEvent, {
      userId: user.id,
      tool: config.toolKey,
      jobId: job.id,
      qualityMode: promptPlan.qualityMode
    });

    const inputUrl = await createPrivateReadUrl(inputMedia.storageKey);
    const providerInput = await preparePhotoEnhancementProviderInput({
      inputUrl,
      inputStorageKey: inputMedia.storageKey,
      userId: user.id,
      jobId: job.id,
      toolKey: config.toolKey
    });
    const model = resolveToolModel(tool.providerConfigJson, promptPlan.qualityMode, config);

    await createJobEvent(job.id, "provider_attempt_started", `Replicate ${config.publicName} attempt started.`, {
      providerKey: config.providerKey,
      model,
      qualityMode: promptPlan.qualityMode,
      prompt,
      providerInputResized: providerInput.resized,
      input: sanitizeInputUrl(providerInput.url),
      ...promptPlan.metadata
    });

    const generation = await runEcommerceGeneration({
      toolKey: config.toolKey,
      imageUrl: providerInput.url,
      prompt,
      qualityMode: promptPlan.qualityMode,
      aspectRatio: promptPlan.aspectRatio,
      modelOverride: model
    });
    const outputBuffer = await downloadOutput(generation.outputUrl);
    const exportOutput = await prepareExportBuffer(outputBuffer, creditPlan.exportMode);

    await prisma.providerLog.create({
      data: {
        aiJobId: job.id,
        providerKey: generation.providerKey,
        requestJson: {
          toolKey: config.toolKey,
          model: generation.model,
          modelKey: generation.modelKey,
          qualityMode: promptPlan.qualityMode,
          prompt,
          aspectRatio: promptPlan.aspectRatio,
          input: sanitizeInputUrl(providerInput.url),
          originalInput: sanitizeInputUrl(inputUrl),
          providerInputResized: providerInput.resized,
          ...promptPlan.metadata
        },
        responseJson: toPrismaJson(generation.rawResponse),
        attemptNumber: 1,
        timedOut: false
      }
    });

    const resultMediaId = randomUUID();
    const resultFilename = `${config.outputFilenamePrefix}-${promptPlan.qualityMode}.png`;
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
        sourceProvider: generation.providerKey,
        toolKey: config.toolKey,
        model: generation.model,
        qualityMode: promptPlan.qualityMode,
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
        sourceProvider: generation.providerKey,
        toolKey: config.toolKey,
        model: generation.model,
        qualityMode: promptPlan.qualityMode,
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
          source: config.toolKey.replace(/-/g, "_"),
          toolKey: config.toolKey,
          category: config.category,
          providerKey: generation.providerKey,
          model: generation.model,
          modelKey: generation.modelKey,
          qualityMode: promptPlan.qualityMode,
          prompt,
          providerRequestId: generation.providerRequestId,
          useCases: config.useCases,
          exportMode: creditPlan.exportMode,
          creditCharged: creditPlan.charged,
          creditCost: creditPlan.creditCost,
          ...promptPlan.metadata,
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

    const completedEconomy = resolveToolEconomy({
      toolSlug: config.slug,
      qualityMode: promptPlan.qualityMode,
      providerKey: generation.providerKey
    });
    const costSnapshot = await buildJobCostSnapshotUpdate(job.id, {
      providerKey: generation.providerKey,
      qualityTier: completedEconomy.qualityTier,
      internalKey: completedEconomy.internalKey,
      publicName: completedEconomy.publicName,
      creditsCharged: creditPlan.charged ? toolCreditCost : 0
    });
    const completedJob = await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        providerKey: generation.providerKey,
        outputImageId: outputMedia.id,
        providerRequestId: generation.providerRequestId,
        providerResponseJson: toPrismaJson(generation.rawResponse),
        processingTimeMs: generation.processingTimeMs,
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

    await createJobEvent(job.id, "job_completed", `${config.publicName} completed successfully.`, {
      outputMediaId: outputMedia.id,
      providerKey: generation.providerKey,
      model: generation.model,
      qualityMode: promptPlan.qualityMode,
      exportMode: creditPlan.exportMode,
      creditCharged: creditPlan.charged,
      watermarkApplied: exportOutput.applied,
      watermarkType: exportOutput.watermarkType,
      ...promptPlan.metadata
    });
    trackServerEvent(config.completedEvent, {
      userId: user.id,
      tool: config.toolKey,
      jobId: job.id,
      qualityMode: promptPlan.qualityMode
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
    const providerError = error instanceof EcommerceGenerationProviderError ? error : null;
    const errorMessage = error instanceof Error ? error.message : `Unknown ${config.publicName} error.`;

    await refundJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: config.toolKey,
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
    await createJobEvent(job.id, "job_failed", `${config.publicName} failed.`, {
      errorMessage,
      providerKey: providerError?.providerKey,
      providerStatusCode: providerError?.statusCode,
      qualityMode: promptPlan.qualityMode
    });
    trackServerEvent(config.failedEvent, {
      userId: user.id,
      tool: config.toolKey,
      jobId: job.id,
      qualityMode: promptPlan.qualityMode,
      error: errorMessage
    });

    if (providerError) {
      await prisma.providerLog.create({
        data: {
          aiJobId: job.id,
          providerKey: providerError.providerKey,
          requestJson: {
            toolKey: config.toolKey,
            model: resolveToolModel(tool.providerConfigJson, promptPlan.qualityMode, config),
            qualityMode: promptPlan.qualityMode,
            prompt,
            aspectRatio: promptPlan.aspectRatio
          },
          responseJson: toPrismaJson(providerError.rawResponse),
          errorMessage,
          statusCode: providerError.statusCode,
          attemptNumber: 1,
          timedOut: errorMessage.toLowerCase().includes("timed out")
        }
      });
    }

    if (errorMessage === "insufficient_credits") {
      return NextResponse.json(
        {
          ok: false,
          code: "insufficient_credits",
          message: `You need more credits to run ${config.publicName}.`,
          requiredCredits: toolCreditCost
        },
        { status: 402 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        job: {
          id: job.id,
          status: JobStatus.FAILED,
          errorMessage:
            providerError?.statusCode === 429
              ? "The AI provider is busy right now. Please try again in a few seconds."
              : `We could not finish this ${config.publicName} edit. Please try another product photo.`
        },
        ...(process.env.NODE_ENV === "development"
          ? {
              debug: {
                provider: providerError?.providerKey || config.providerKey,
                model: resolveToolModel(tool.providerConfigJson, promptPlan.qualityMode, config),
                qualityMode: promptPlan.qualityMode,
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

async function ensureGenerativeTool(config: EcommerceGenerativeRouteConfig, economy: ToolEconomyTier) {
  return prisma.aiTool.upsert({
    where: {
      slug_version: {
        slug: config.slug,
        version: 1
      }
    },
    update: {
      publicName: economy.publicName,
      internalKey: economy.internalKey,
      qualityTier: economy.qualityTier,
      creditCost: economy.creditCost,
      providerKey: economy.providerKey,
      estimatedCostPerRun: economy.estimatedProviderCost,
      estimatedCostCurrency: economy.providerCurrency,
      estimatedCostProvider: economy.providerKey,
      deletedAt: null
    },
    create: {
      slug: config.slug,
      version: 1,
      name: config.publicName,
      publicName: economy.publicName,
      internalKey: economy.internalKey,
      qualityTier: economy.qualityTier,
      category: "Ecommerce",
      description: config.description,
      creditCost: economy.creditCost,
      status: ToolStatus.ACTIVE,
      inputRulesJson: {
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        maxFileSizeMb: 12,
        maxWidth: 6000,
        maxHeight: 6000
      },
      outputType: "image",
      providerKey: economy.providerKey,
      estimatedCostPerRun: economy.estimatedProviderCost,
      estimatedCostCurrency: economy.providerCurrency,
      estimatedCostProvider: economy.providerKey,
      providerConfigJson: {
        model: config.model,
        proModel: config.proModel,
        inputMode: config.inputModeDescription,
        outputFormat: "png"
      },
      fallbackProviderKeysJson: [],
      retryPolicyJson: {
        maxRetries: config.maxRetries,
        timeoutSeconds: config.timeoutSeconds,
        retryDelaySeconds: 8,
        allowFallback: false
      },
      seoTitle: `${config.publicName} - Ecommerce AI Photo Tool`,
      seoDescription: config.description,
      landingContentJson: {
        hero: config.description,
        faqs: []
      },
      exampleImagesJson: [],
      featured: true,
      recommended: config.toolKey === "ai-ad-creative-generator",
      displayOrder: economy.displayOrder
    },
    select: {
      id: true,
      version: true,
      status: true,
      creditCost: true,
      providerConfigJson: true
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

function resolveToolModel(value: Prisma.JsonValue, qualityMode: "standard" | "pro", config: EcommerceGenerativeRouteConfig) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const model = (value as { model?: unknown; proModel?: unknown }).model;
    const proModel = (value as { model?: unknown; proModel?: unknown }).proModel;
    if (qualityMode === "pro" && typeof proModel === "string" && proModel.trim()) return proModel.trim();
    if (typeof model === "string" && model.trim()) return model.trim();
  }

  return qualityMode === "pro" ? config.proModel : config.model;
}

function isUnsafePrompt(prompt: string) {
  return /\b(adult|nude|nsfw|passport|driver'?s license|id card|bank card|credit card|counterfeit|illegal)\b/i.test(prompt);
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
