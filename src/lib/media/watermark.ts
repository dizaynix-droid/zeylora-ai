import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { businessFoundation } from "@/config/business";
import type { ExportMode } from "@/lib/jobs/credit-policy";

export type WatermarkResult = {
  buffer: Buffer;
  applied: boolean;
  label: string;
  placement: "bottom-right" | "bottom-center" | "center";
  watermarkType: "none" | "protected_pattern_badge" | "premium_center_preview";
};

const FREE_PREVIEW_MAX_LONG_EDGE = 1600;
const CENTER_WATERMARK_ASSET_PATH = path.join(
  process.cwd(),
  "public/watermarks/zeylora-preview-center.png"
);
const BADGE_WATERMARK_ASSET_PATH = path.join(
  process.cwd(),
  "public/watermarks/zeylora-preview-badge.png"
);
let cachedCenterWatermarkAsset: Buffer | undefined;
let cachedBadgeWatermarkAsset: Buffer | undefined;

export async function applyFreeExportWatermark(input: Buffer): Promise<WatermarkResult> {
  if (!businessFoundation.exports.freeWatermarkEnabled) {
    return {
      buffer: input,
      applied: false,
      label: businessFoundation.exports.freeWatermarkText,
      placement: "bottom-right",
      watermarkType: "none"
    };
  }

  try {
    return await applyPremiumPreviewWatermark(input);
  } catch (error) {
    logPreviewProtection("premium_center_preview_failed", {
      errorMessage: error instanceof Error ? error.message : "Unknown preview watermark error.",
      inputBytes: input.length
    });

    return createSafePreviewFallback(input, error);
  }
}

async function applyPremiumPreviewWatermark(input: Buffer): Promise<WatermarkResult> {
  if (!input?.length) {
    throw new Error("Preview watermark input buffer is empty.");
  }

  logPreviewProtection("premium_center_preview_started", {
    inputBytes: input.length
  });

  const previewBuffer = await createProtectedPreviewBuffer(input);
  const metadata = await sharp(previewBuffer, { failOn: "none" }).metadata();
  const width = metadata.width ?? 1400;
  const height = metadata.height ?? 1000;

  if (width < 8 || height < 8) {
    throw new Error(`Preview watermark dimensions are too small: ${width}x${height}.`);
  }

  logPreviewProtection("premium_center_preview_metadata", {
    width,
    height,
    previewBytes: previewBuffer.length
  });

  const label = "ZEYLORA PREVIEW";
  const placement = "center";
  const safeInsetX = Math.max(14, Math.round(width * 0.026));
  const safeInsetY = Math.max(14, Math.round(height * 0.028));
  const centerOverlayWidth = clamp(Math.round(width * 0.38), Math.min(width - 24, 180), Math.min(width - 24, 620));
  const centerOverlay = await resizeOverlayPng(getCenterWatermarkAsset(), centerOverlayWidth);
  const centerMetadata = await sharp(centerOverlay, { failOn: "none" }).metadata();
  const centerWidth = centerMetadata.width ?? centerOverlayWidth;
  const centerHeight = centerMetadata.height ?? Math.round(centerOverlayWidth * 0.24);
  const centerX = Math.max(0, Math.round((width - centerWidth) / 2));
  const centerY = Math.max(0, Math.round((height - centerHeight) / 2));

  const badgeOverlayWidth = clamp(Math.round(width * 0.22), Math.min(width - 24, 170), Math.min(width - 24, 360));
  const badgeOverlay = await resizeOverlayPng(getBadgeWatermarkAsset(), badgeOverlayWidth);
  const badgeMetadata = await sharp(badgeOverlay, { failOn: "none" }).metadata();
  const badgeWidth = badgeMetadata.width ?? badgeOverlayWidth;
  const badgeHeight = badgeMetadata.height ?? Math.round(badgeOverlayWidth * 0.16);
  const badgeX = Math.max(0, width - badgeWidth - safeInsetX);
  const badgeY = Math.max(0, height - badgeHeight - safeInsetY);

  logPreviewProtection("premium_center_preview_overlay_created", {
    width,
    height,
    centerOverlayBytes: centerOverlay.length,
    badgeOverlayBytes: badgeOverlay.length,
    centerOverlayWidth: centerWidth,
    badgeOverlayWidth: badgeWidth
  });

  const buffer = await sharp(previewBuffer, { failOn: "none" })
    .composite([
      { input: centerOverlay, left: centerX, top: centerY, blend: "over" },
      { input: badgeOverlay, left: badgeX, top: badgeY, blend: "over" }
    ])
    .png({
      compressionLevel: 6,
      adaptiveFiltering: true,
      palette: false
    })
    .toBuffer();

  logPreviewProtection("premium_center_preview_composite_succeeded", {
    outputBytes: buffer.length,
    width,
    height
  });

  return {
    buffer,
    applied: true,
    label,
    placement,
    watermarkType: "premium_center_preview"
  };
}

export async function prepareExportBuffer(input: Buffer, exportMode: ExportMode): Promise<WatermarkResult & { exportMode: ExportMode }> {
  if (exportMode === "paid_clean") {
    return {
      buffer: input,
      applied: false,
      label: "Watermark-free Zeylora AI export",
      placement: "bottom-right",
      watermarkType: "none",
      exportMode
    };
  }

  try {
    const watermarked = await applyFreeExportWatermark(input);
    return {
      ...watermarked,
      exportMode
    };
  } catch (error) {
    logPreviewProtection("prepare_export_failsafe_used", {
      errorMessage: error instanceof Error ? error.message : "Unknown export preparation error.",
      inputBytes: input.length
    });

    const fallback = await createLastResortPreview(input);
    return {
      ...fallback,
      exportMode
    };
  }
}

async function createProtectedPreviewBuffer(input: Buffer) {
  const metadata = await sharp(input, { failOn: "none" }).metadata();
  const width = metadata.width ?? FREE_PREVIEW_MAX_LONG_EDGE;
  const height = metadata.height ?? FREE_PREVIEW_MAX_LONG_EDGE;
  const longEdge = Math.max(width, height);
  const resizeOptions = longEdge > FREE_PREVIEW_MAX_LONG_EDGE
    ? {
        width: width >= height ? FREE_PREVIEW_MAX_LONG_EDGE : undefined,
        height: height > width ? FREE_PREVIEW_MAX_LONG_EDGE : undefined,
        fit: "inside" as const,
        withoutEnlargement: true
      }
    : undefined;

  let pipeline = sharp(input, { failOn: "none" }).rotate();

  if (resizeOptions) {
    pipeline = pipeline.resize(resizeOptions);
  }

  return pipeline
    .modulate({
      brightness: 0.992,
      saturation: 0.97
    })
    .blur(0.3)
    .png({
      compressionLevel: 6,
      adaptiveFiltering: true,
      palette: false
    })
    .toBuffer();
}

async function createSafePreviewFallback(input: Buffer, originalError: unknown): Promise<WatermarkResult> {
  try {
    logPreviewProtection("safe_preview_fallback_started", {
      errorMessage: originalError instanceof Error ? originalError.message : "Unknown preview watermark error.",
      inputBytes: input.length
    });

    const previewBuffer = await createProtectedPreviewBuffer(input);
    const metadata = await sharp(previewBuffer, { failOn: "none" }).metadata();
    const width = metadata.width ?? 1200;
    const height = metadata.height ?? 900;
    const centerOverlayWidth = clamp(Math.round(width * 0.38), Math.min(width - 24, 180), Math.min(width - 24, 620));
    const centerOverlay = await resizeOverlayPng(getCenterWatermarkAsset(), centerOverlayWidth);
    const centerMetadata = await sharp(centerOverlay, { failOn: "none" }).metadata();
    const centerWidth = centerMetadata.width ?? centerOverlayWidth;
    const centerHeight = centerMetadata.height ?? Math.round(centerOverlayWidth * 0.24);
    const centerX = Math.max(0, Math.round((width - centerWidth) / 2));
    const centerY = Math.max(0, Math.round((height - centerHeight) / 2));

    const buffer = await sharp(previewBuffer, { failOn: "none" })
      .composite([{ input: centerOverlay, left: centerX, top: centerY, blend: "over" }])
      .png({
        compressionLevel: 6,
        adaptiveFiltering: true,
        palette: false
      })
      .toBuffer();

    logPreviewProtection("safe_preview_fallback_succeeded", {
      width,
      height,
      outputBytes: buffer.length
    });

    return {
      buffer,
      applied: true,
      label: "ZEYLORA PREVIEW",
      placement: "center",
      watermarkType: "premium_center_preview"
    };
  } catch (fallbackError) {
    logPreviewProtection("safe_preview_fallback_failed", {
      errorMessage: fallbackError instanceof Error ? fallbackError.message : "Unknown fallback preview error.",
      inputBytes: input.length
    });

    return createLastResortPreview(input);
  }
}

async function createLastResortPreview(input: Buffer): Promise<WatermarkResult> {
  try {
    const buffer = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: FREE_PREVIEW_MAX_LONG_EDGE,
        height: FREE_PREVIEW_MAX_LONG_EDGE,
        fit: "inside",
        withoutEnlargement: true
      })
      .png({
        compressionLevel: 6,
        adaptiveFiltering: true,
        palette: false
      })
      .toBuffer();

    logPreviewProtection("last_resort_preview_succeeded", {
      outputBytes: buffer.length
    });

    return {
      buffer,
      applied: false,
      label: "Zeylora preview fallback",
      placement: "center",
      watermarkType: "none"
    };
  } catch (error) {
    logPreviewProtection("last_resort_preview_failed_returning_original", {
      errorMessage: error instanceof Error ? error.message : "Unknown last resort preview error.",
      inputBytes: input.length
    });

    return {
      buffer: input,
      applied: false,
      label: "Zeylora original fallback",
      placement: "center",
      watermarkType: "none"
    };
  }
}

async function resizeOverlayPng(input: Buffer, width: number) {
  return sharp(input, { failOn: "none" })
    .resize({
      width: Math.max(1, Math.round(width)),
      withoutEnlargement: true
    })
    .png({
      compressionLevel: 6,
      adaptiveFiltering: true,
      palette: false
    })
    .toBuffer();
}

function getCenterWatermarkAsset() {
  cachedCenterWatermarkAsset ??= readFileSync(CENTER_WATERMARK_ASSET_PATH);
  return cachedCenterWatermarkAsset;
}

function getBadgeWatermarkAsset() {
  cachedBadgeWatermarkAsset ??= readFileSync(BADGE_WATERMARK_ASSET_PATH);
  return cachedBadgeWatermarkAsset;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function logPreviewProtection(event: string, payload: Record<string, unknown>) {
  const safePayload = JSON.stringify(payload);
  if (process.env.NODE_ENV === "development") {
    console.info(`[preview-protection:${event}]`, safePayload);
    return;
  }

  if (event.includes("failed") || event.includes("failsafe")) {
    console.warn(`[preview-protection:${event}]`, safePayload);
  }
}
