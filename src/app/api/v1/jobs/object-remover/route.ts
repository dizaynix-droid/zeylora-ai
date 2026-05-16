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
import { objectRemoverConfig, type ObjectRemovalQualityMode } from "@/config/ai-tools";
import { trackingEvents } from "@/config/tracking";
import { resolveToolEconomy } from "@/config/tool-economy";
import { checkRateLimit, rateLimitResponse } from "@/lib/abuse/rate-limit";
import {
  ObjectRemovalProviderError,
  runObjectRemoval
} from "@/lib/ai/object-removal/providers";
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

export const runtime = "nodejs";

type JobRequest = {
  inputMediaId?: string;
  removalPrompt?: string;
  qualityMode?: ObjectRemovalQualityMode;
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
  const qualityMode = normalizeQualityMode(body?.qualityMode);
  const removalPrompt = normalizeRemovalPrompt(body?.removalPrompt);

  if (!body?.inputMediaId) {
    return NextResponse.json({ ok: false, error: "inputMediaId is required." }, { status: 400 });
  }

  if (!removalPrompt) {
    return NextResponse.json(
      { ok: false, error: "Describe what to remove from the product photo." },
      { status: 400 }
    );
  }

  if (isUnsafeRemovalPrompt(removalPrompt)) {
    return NextResponse.json(
      { ok: false, error: "This cleanup request is not supported for safety reasons." },
      { status: 400 }
    );
  }

  const providerPrompt = buildObjectRemovalProviderPrompt(removalPrompt);

  const economy = resolveToolEconomy({
    toolSlug: objectRemoverConfig.slug,
    qualityMode,
    providerKey: objectRemoverConfig.providerKey
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

  const tool = await ensureObjectRemoverTool(economy);
  if (tool.status !== ToolStatus.ACTIVE) {
    return NextResponse.json({ ok: false, error: "Object Remover is not active yet." }, { status: 409 });
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
      maxRetries: objectRemoverConfig.maxRetries,
      toolVersion: tool.version
    }
  });

  await createJobEvent(job.id, "job_created", "Object remover job created.", {
    inputMediaId: inputMedia.id,
    toolKey: objectRemoverConfig.toolKey,
    qualityMode,
    prompt: removalPrompt,
    providerPrompt,
    creditCost: toolCreditCost,
    creditEnforcementActive: true,
    exportMode: creditPlan.exportMode,
    creditBalanceBefore: creditPlan.balanceBefore
  });

  try {
    creditPlan = await reserveJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: objectRemoverConfig.toolKey,
      plan: creditPlan
    });

    await prisma.aiJob.update({
      where: { id: job.id },
      data: { status: JobStatus.PROCESSING }
    });
    await createJobEvent(job.id, "job_processing", "Object remover processing started.", {
      qualityMode
    });
    trackServerEvent(trackingEvents.objectRemoverStarted, {
      userId: user.id,
      tool: objectRemoverConfig.toolKey,
      jobId: job.id,
      qualityMode
    });

    const inputUrl = await createPrivateReadUrl(inputMedia.storageKey);
    await createJobEvent(job.id, "provider_attempt_started", "Replicate object removal attempt started.", {
      providerKey: objectRemoverConfig.providerKey,
      model: resolveToolModel(tool.providerConfigJson, qualityMode),
      qualityMode,
      prompt: removalPrompt,
      providerPrompt,
      input: sanitizeInputUrl(inputUrl)
    });

    const removal = await runObjectRemoval({
      imageUrl: inputUrl,
      prompt: providerPrompt,
      qualityMode,
      modelOverride: resolveToolModel(tool.providerConfigJson, qualityMode)
    });
    const outputBuffer = await downloadOutput(removal.outputUrl);
    const exportOutput = await prepareExportBuffer(outputBuffer, creditPlan.exportMode);

    await prisma.providerLog.create({
      data: {
        aiJobId: job.id,
        providerKey: removal.providerKey,
        requestJson: {
          toolKey: objectRemoverConfig.toolKey,
          model: removal.model,
          modelKey: removal.modelKey,
          qualityMode,
          prompt: removalPrompt,
          providerPrompt,
          input: sanitizeInputUrl(inputUrl)
        },
        responseJson: toPrismaJson(removal.rawResponse),
        attemptNumber: 1,
        timedOut: false
      }
    });

    const resultMediaId = randomUUID();
    const resultFilename = `object-remover-${qualityMode}.png`;
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
        sourceProvider: removal.providerKey,
        toolKey: objectRemoverConfig.toolKey,
        model: removal.model,
        qualityMode,
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
        sourceProvider: removal.providerKey,
        toolKey: objectRemoverConfig.toolKey,
        model: removal.model,
        qualityMode,
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
          source: "object_remover",
          toolKey: objectRemoverConfig.toolKey,
          category: objectRemoverConfig.category,
          providerKey: removal.providerKey,
          model: removal.model,
          modelKey: removal.modelKey,
          qualityMode,
          removalPrompt,
          providerRequestId: removal.providerRequestId,
          useCases: ["product_photo_cleanup", "marketplace_ready_visuals", "ecommerce_distraction_removal"],
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

    const completedEconomy = resolveToolEconomy({
      toolSlug: objectRemoverConfig.slug,
      qualityMode,
      providerKey: removal.providerKey
    });
    const costSnapshot = await buildJobCostSnapshotUpdate(job.id, {
      providerKey: removal.providerKey,
      qualityTier: completedEconomy.qualityTier,
      internalKey: completedEconomy.internalKey,
      publicName: completedEconomy.publicName,
      creditsCharged: creditPlan.charged ? toolCreditCost : 0
    });
    const completedJob = await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        providerKey: removal.providerKey,
        outputImageId: outputMedia.id,
        providerRequestId: removal.providerRequestId,
        providerResponseJson: toPrismaJson(removal.rawResponse),
        processingTimeMs: removal.processingTimeMs,
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

    await createJobEvent(job.id, "job_completed", "Object remover completed successfully.", {
      outputMediaId: outputMedia.id,
      providerKey: removal.providerKey,
      model: removal.model,
      qualityMode,
      exportMode: creditPlan.exportMode,
      creditCharged: creditPlan.charged,
      watermarkApplied: exportOutput.applied,
      watermarkType: exportOutput.watermarkType
    });
    trackServerEvent(trackingEvents.objectRemoverCompleted, {
      userId: user.id,
      tool: objectRemoverConfig.toolKey,
      jobId: job.id,
      qualityMode
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
    const providerError = error instanceof ObjectRemovalProviderError ? error : null;
    const errorMessage = error instanceof Error ? error.message : "Unknown object remover error.";

    await refundJobCredits({
      userId: user.id,
      jobId: job.id,
      toolKey: objectRemoverConfig.toolKey,
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
    await createJobEvent(job.id, "job_failed", "Object remover failed.", {
      errorMessage,
      providerKey: providerError?.providerKey,
      providerStatusCode: providerError?.statusCode,
      qualityMode
    });
    trackServerEvent(trackingEvents.objectRemoverFailed, {
      userId: user.id,
      tool: objectRemoverConfig.toolKey,
      jobId: job.id,
      qualityMode,
      error: errorMessage
    });

    if (providerError) {
      await prisma.providerLog.create({
        data: {
          aiJobId: job.id,
          providerKey: providerError.providerKey,
          requestJson: {
            toolKey: objectRemoverConfig.toolKey,
            model: resolveToolModel(tool.providerConfigJson, qualityMode),
            qualityMode,
            prompt: removalPrompt,
            providerPrompt
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
          message: "You need more credits to run Object Remover.",
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
          errorMessage: "We could not remove the object from this image. Try a clearer product photo or a more specific cleanup description."
        },
        ...(process.env.NODE_ENV === "development"
          ? {
              debug: {
                provider: providerError?.providerKey || objectRemoverConfig.providerKey,
                model: resolveToolModel(tool.providerConfigJson, qualityMode),
                qualityMode,
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

async function ensureObjectRemoverTool(economy: ReturnType<typeof resolveToolEconomy>) {
  return prisma.aiTool.upsert({
    where: {
      slug_version: {
        slug: objectRemoverConfig.slug,
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
      slug: objectRemoverConfig.slug,
      version: 1,
      name: "Object Remover",
      publicName: economy.publicName,
      internalKey: economy.internalKey,
      qualityTier: economy.qualityTier,
      category: "Ecommerce",
      description: "Remove unwanted objects, cables, props, stains, dust, and distracting background items from product photos.",
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
        model: objectRemoverConfig.model,
        proModel: objectRemoverConfig.proModel,
        inputMode: "prompt",
        outputFormat: "png"
      },
      fallbackProviderKeysJson: [],
      retryPolicyJson: {
        maxRetries: objectRemoverConfig.maxRetries,
        timeoutSeconds: objectRemoverConfig.timeoutSeconds,
        retryDelaySeconds: 8,
        allowFallback: false
      },
      seoTitle: "Object Remover - Product Photo Cleanup",
      seoDescription: "Remove distracting objects, cables, props, stains, and background items from ecommerce product photos.",
      landingContentJson: {
        hero: "Remove unwanted objects from product photos.",
        faqs: []
      },
      exampleImagesJson: [],
      featured: false,
      recommended: false,
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

function normalizeQualityMode(value?: string): ObjectRemovalQualityMode {
  return value === "pro" ? "pro" : "standard";
}

function normalizeRemovalPrompt(value?: string) {
  return (value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, objectRemoverConfig.promptMaxLength);
}

function buildObjectRemovalProviderPrompt(prompt: string) {
  const normalized = prompt.toLowerCase();
  const asksForTextCleanup = [
    "text",
    "writing",
    "letters",
    "lettering",
    "words",
    "word",
    "label",
    "brand name",
    "typography",
    "caption",
    "sticker",
    "yazi",
    "yazı",
    "metin",
    "etiket"
  ].some((term) => normalized.includes(term));
  const asksForLogoCleanup = [
    "logo",
    "brand mark",
    "icon",
    "logotype",
    "amblem",
    "marka logosu"
  ].some((term) => normalized.includes(term));

  if (asksForTextCleanup && !asksForLogoCleanup) {
    return [
      "Remove only the specified visible text, letters, label text, typography, caption, sticker, or writing from this product photo.",
      "Preserve logos, icons, product silhouettes, packaging shape, and non-text design elements unless the user explicitly asks to remove them.",
      "Reconstruct the cleaned area with matching product surface, lighting, texture, and perspective.",
      "Do not remove the product itself. Do not change the product shape. Keep the result realistic for ecommerce.",
      `User request: ${prompt}`
    ].join(" ");
  }

  if (asksForLogoCleanup && !asksForTextCleanup) {
    return [
      "Remove only the specified logo, icon, brand mark, or graphic mark from this product photo.",
      "Preserve readable text, product silhouettes, packaging shape, and unrelated design elements unless the user explicitly asks to remove them.",
      "Reconstruct the cleaned area with matching product surface, lighting, texture, and perspective.",
      "Do not remove the product itself. Do not change the product shape. Keep the result realistic for ecommerce.",
      `User request: ${prompt}`
    ].join(" ");
  }

  if (asksForTextCleanup && asksForLogoCleanup) {
    return [
      "Remove only the text or logo elements explicitly described by the user, without removing the main product or unrelated design areas.",
      "If the request is ambiguous, prioritize removing readable text first and preserve product shape and important visual structure.",
      "Reconstruct the cleaned area with matching product surface, lighting, texture, and perspective.",
      "Keep the result realistic for ecommerce.",
      `User request: ${prompt}`
    ].join(" ");
  }

  return [
    "Remove only the unwanted object or visual distraction described by the user from this product photo.",
    "Fill the removed area naturally with matching background, lighting, texture, and perspective.",
    "Do not remove the main product. Keep the result realistic for ecommerce.",
    `User request: ${prompt}`
  ].join(" ");
}

function isUnsafeRemovalPrompt(prompt: string) {
  const normalized = prompt.toLowerCase();
  return [
    "passport",
    "driver license",
    "id card",
    "identity card",
    "signature",
    "watermark from another brand",
    "remove copyright",
    "nude",
    "nsfw",
    "adult"
  ].some((term) => normalized.includes(term));
}

function getModelForQuality(qualityMode: ObjectRemovalQualityMode) {
  return qualityMode === "pro" ? objectRemoverConfig.proModel : objectRemoverConfig.model;
}

function resolveToolModel(providerConfigJson: Prisma.JsonValue | null | undefined, qualityMode: ObjectRemovalQualityMode) {
  if (providerConfigJson && typeof providerConfigJson === "object" && !Array.isArray(providerConfigJson)) {
    const config = providerConfigJson as Record<string, unknown>;
    const model = qualityMode === "pro" ? config.proModel || config.model : config.model;
    if (typeof model === "string" && model.trim()) return model.trim();
  }

  return getModelForQuality(qualityMode);
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
