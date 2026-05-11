import { randomUUID } from "node:crypto";
import { MediaProcessingStatus, MediaType, MediaVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { getCacheControl } from "@/lib/storage/policy";
import { createPrivateReadUrl, uploadPrivateObject } from "@/lib/storage/s3-client";
import {
  downloadProviderOutput,
  getBackgroundRemovalComparisonTargets,
  runBackgroundRemovalTarget
} from "@/lib/ai/background-removal/providers";
import { BackgroundRemovalProviderError } from "@/lib/ai/background-removal/types";

export const runtime = "nodejs";

type CompareRequest = {
  inputMediaId?: string;
  targetKeys?: string[];
};

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ ok: false, error: "You must be logged in to compare providers." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CompareRequest | null;

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

  const inputUrl = await createPrivateReadUrl(inputMedia.storageKey);
  const imageBuffer = await downloadProviderOutput(inputUrl);
  const requestedTargets = new Set(body.targetKeys || []);
  const targets = getBackgroundRemovalComparisonTargets().filter((target) => {
    return requestedTargets.size === 0 || requestedTargets.has(target.key);
  });

  if (targets.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "No comparison providers are available. Add REPLICATE_API_TOKEN, PHOTOROOM_API_KEY, or REMOVEBG_API_KEY."
    }, { status: 409 });
  }

  const comparisonId = randomUUID();
  const results = [];

  for (const target of targets) {
    try {
      const result = await runBackgroundRemovalTarget({
        imageUrl: inputUrl,
        imageBuffer,
        mimeType: inputMedia.mimeType,
        filename: inputMedia.originalFilename || "comparison-input",
        target
      });
      const mediaId = randomUUID();
      const storageKey = buildComparisonStorageKey({
        userId: user.id,
        comparisonId,
        providerKey: result.providerKey,
        targetKey: result.targetKey
      });
      const cacheControl = getCacheControl("private");

      await uploadPrivateObject({
        key: storageKey,
        body: result.outputBuffer,
        contentType: result.contentType || "image/png",
        cacheControl,
        metadata: {
          userId: user.id,
          comparisonId,
          providerKey: result.providerKey,
          targetKey: result.targetKey
        }
      });

      const mediaAsset = await prisma.mediaAsset.create({
        data: {
          id: mediaId,
          userId: user.id,
          type: MediaType.RESULT,
          storageKey,
          originalFilename: `${result.targetKey}.png`,
          mimeType: "image/png",
          fileSize: result.outputBuffer.length,
          visibility: MediaVisibility.PRIVATE,
          processingStatus: MediaProcessingStatus.STORED,
          cacheControl,
          metadataJson: {
            source: "background_removal_provider_comparison",
            comparisonId,
            inputMediaId: inputMedia.id,
            providerKey: result.providerKey,
            targetKey: result.targetKey,
            label: result.label,
            model: result.model,
            qualityTier: result.qualityTier,
            processingTimeMs: result.processingTimeMs,
            focus: "product_object_clean_foregrounds"
          }
        },
        select: {
          id: true,
          storageKey: true
        }
      });

      results.push({
        ok: true,
        providerKey: result.providerKey,
        targetKey: result.targetKey,
        label: result.label,
        model: result.model,
        qualityTier: result.qualityTier,
        processingTimeMs: result.processingTimeMs,
        mediaId: mediaAsset.id,
        previewUrl: await createPrivateReadUrl(storageKey, Number(process.env.RESULT_SIGNED_URL_TTL_SECONDS || 1800))
      });
    } catch (error) {
      const providerError = error instanceof BackgroundRemovalProviderError ? error : null;

      results.push({
        ok: false,
        providerKey: providerError?.providerKey || target.providerKey,
        targetKey: providerError?.targetKey || target.key,
        label: target.label,
        errorMessage: error instanceof Error ? error.message : "Unknown provider comparison error.",
        statusCode: providerError?.statusCode,
        providerResponse: sanitizeProviderResponse(providerError?.rawResponse)
      });
    }
  }

  return NextResponse.json({
    ok: true,
    comparisonId,
    inputMediaId: inputMedia.id,
    focus: "Product/object photos and clean foregrounds. Portrait Cutout should be separate later for people, hair, hands, shoes, and full-body poses.",
    results
  });
}

function buildComparisonStorageKey(input: {
  userId: string;
  comparisonId: string;
  providerKey: string;
  targetKey: string;
}) {
  return `comparisons/background-remover/${input.userId}/${input.comparisonId}/${input.providerKey}-${sanitizeKey(input.targetKey)}.png`;
}

function sanitizeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function sanitizeProviderResponse(value: unknown) {
  if (!value) return value;
  return JSON.parse(JSON.stringify(value, (_key, nestedValue) => {
    if (typeof nestedValue === "string" && nestedValue.startsWith("http")) {
      try {
        const url = new URL(nestedValue);
        return `${url.protocol}//${url.host}${url.pathname}`;
      } catch {
        return "invalid-url";
      }
    }

    return nestedValue;
  })) as unknown;
}
