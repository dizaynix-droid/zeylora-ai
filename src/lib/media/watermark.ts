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

  const previewBuffer = await createProtectedPreviewBuffer(input);
  const image = sharp(previewBuffer, { failOn: "none" });
  const [metadata, luminance] = await Promise.all([
    image.metadata(),
    getAverageLuminance(previewBuffer)
  ]);
  const width = metadata.width ?? 1400;
  const height = metadata.height ?? 1000;
  const label = "ZEYLORA PREVIEW";
  const placement = "center";
  const markTone = luminance > 142
    ? { fill: "#050712", centerOpacity: 0.24, badgeFillOpacity: 0.58, haloOpacity: 0.14 }
    : { fill: "#FFFFFF", centerOpacity: 0.28, badgeFillOpacity: 0.48, haloOpacity: 0.18 };

  const shortEdge = Math.min(width, height);
  const fontSize = clamp(Math.round(shortEdge * 0.026), 15, 27);
  const centerFontSize = clamp(Math.round(shortEdge * 0.078), 42, 96);
  const subFontSize = clamp(Math.round(shortEdge * 0.022), 13, 24);
  const markSize = Math.round(fontSize * 1.45);
  const gap = Math.round(fontSize * 0.48);
  const horizontalPadding = Math.round(fontSize * 0.78);
  const verticalPadding = Math.round(fontSize * 0.48);
  const estimatedTextWidth = Math.round(label.length * fontSize * 0.56);
  const badgeWidth = Math.min(width - 32, estimatedTextWidth + markSize + gap + horizontalPadding * 2);
  const badgeHeight = Math.max(markSize + verticalPadding, fontSize + verticalPadding * 2);
  const safeInsetX = Math.max(14, Math.round(width * 0.026));
  const safeInsetY = Math.max(14, Math.round(height * 0.028));
  const x = Math.max(14, width - badgeWidth - safeInsetX);
  const y = Math.max(14, height - badgeHeight - safeInsetY);
  const markX = x + horizontalPadding;
  const markY = y + Math.round((badgeHeight - markSize) / 2);
  const textX = markX + markSize + gap;
  const textY = y + Math.round(badgeHeight / 2) + Math.round(fontSize * 0.34);
  const centerText = "ZEYLORA PREVIEW";
  const centerSubText = "BRANDED PREVIEW EXPORT";
  const centerTextWidth = Math.round(centerText.length * centerFontSize * 0.58);
  const centerBoxWidth = Math.min(Math.round(width * 0.86), Math.max(Math.round(width * 0.48), centerTextWidth + Math.round(centerFontSize * 1.3)));
  const centerBoxHeight = Math.max(Math.round(centerFontSize * 1.65), centerFontSize + subFontSize + Math.round(shortEdge * 0.075));
  const centerX = Math.round((width - centerBoxWidth) / 2);
  const centerY = Math.round((height - centerBoxHeight) / 2);
  const centerTextX = Math.round(width / 2);
  const centerTextY = centerY + Math.round(centerBoxHeight * 0.47);
  const centerSubTextY = centerTextY + Math.round(centerFontSize * 0.46);

  const watermarkSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="zeyloraMark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#20D3FF" stop-opacity="0.9"/>
          <stop offset="54%" stop-color="#8B5CF6" stop-opacity="0.88"/>
          <stop offset="100%" stop-color="#F05FB8" stop-opacity="0.86"/>
        </linearGradient>
        <filter id="glassShadow" x="-25%" y="-60%" width="150%" height="220%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#02030A" flood-opacity="0.34"/>
        </filter>
        <filter id="centerShadow" x="-30%" y="-60%" width="160%" height="220%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#02030A" flood-opacity="0.34"/>
        </filter>
      </defs>
      <g filter="url(#centerShadow)" opacity="0.96">
        <rect x="${centerX}" y="${centerY}" width="${centerBoxWidth}" height="${centerBoxHeight}" rx="${Math.round(centerBoxHeight * 0.22)}"
          fill="#050712" fill-opacity="${markTone.badgeFillOpacity}"/>
        <rect x="${centerX + 1}" y="${centerY + 1}" width="${centerBoxWidth - 2}" height="${centerBoxHeight - 2}" rx="${Math.round(centerBoxHeight * 0.22) - 1}"
          fill="none" stroke="url(#zeyloraMark)" stroke-opacity="0.42" stroke-width="1.5"/>
        <ellipse cx="${centerTextX}" cy="${Math.round(height / 2)}" rx="${Math.round(centerBoxWidth * 0.43)}" ry="${Math.round(centerBoxHeight * 0.48)}"
          fill="url(#zeyloraMark)" fill-opacity="${markTone.haloOpacity}"/>
        <text x="${centerTextX}" y="${centerTextY}"
          text-anchor="middle"
          font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-size="${centerFontSize}"
          font-weight="900"
          letter-spacing="0"
          fill="${markTone.fill}"
          fill-opacity="${markTone.centerOpacity}">${centerText}</text>
        <text x="${centerTextX}" y="${centerSubTextY}"
          text-anchor="middle"
          font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-size="${subFontSize}"
          font-weight="850"
          letter-spacing="0"
          fill="${markTone.fill}"
          fill-opacity="${Math.min(markTone.centerOpacity + 0.12, 0.42)}">${centerSubText}</text>
      </g>
      <g filter="url(#glassShadow)" opacity="0.88">
        <rect x="${x}" y="${y}" width="${badgeWidth}" height="${badgeHeight}" rx="${Math.round(badgeHeight / 2)}" fill="#050712" fill-opacity="${markTone.badgeFillOpacity}"/>
        <rect x="${x + 1}" y="${y + 1}" width="${badgeWidth - 2}" height="${badgeHeight - 2}" rx="${Math.round(badgeHeight / 2) - 1}" fill="none" stroke="url(#zeyloraMark)" stroke-opacity="0.38" stroke-width="1"/>
        <circle cx="${markX + Math.round(markSize / 2)}" cy="${markY + Math.round(markSize / 2)}" r="${Math.round(markSize / 2)}" fill="url(#zeyloraMark)" fill-opacity="0.86"/>
        <text x="${markX + Math.round(markSize / 2)}" y="${markY + Math.round(markSize / 2) + Math.round(fontSize * 0.37)}"
          text-anchor="middle"
          font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-size="${Math.round(fontSize * 0.96)}"
          font-weight="900"
          fill="#FFFFFF"
          fill-opacity="0.96">Z</text>
      </g>
      <text x="${textX}" y="${textY}"
        text-anchor="start"
        font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="${fontSize}"
        font-weight="760"
        letter-spacing="0"
        fill="#FFFFFF"
        fill-opacity="0.84">Made with Zeylora AI</text>
    </svg>
  `);

  const buffer = await sharp(previewBuffer, { failOn: "none" })
    .composite([{ input: watermarkSvg, blend: "over" }])
    .png({
      compressionLevel: 6,
      adaptiveFiltering: true,
      palette: false
    })
    .toBuffer();

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

  const watermarked = await applyFreeExportWatermark(input);
  return {
    ...watermarked,
    exportMode
  };
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
    .blur(0.16)
    .png({
      compressionLevel: 6,
      adaptiveFiltering: true,
      palette: false
    })
    .toBuffer();
}

async function getAverageLuminance(input: Buffer) {
  try {
    const { data } = await sharp(input, { failOn: "none" })
      .removeAlpha()
      .resize(1, 1, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const red = data[0] ?? 12;
    const green = data[1] ?? red;
    const blue = data[2] ?? red;
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  } catch {
    return 128;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
