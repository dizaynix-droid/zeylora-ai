import sharp from "sharp";
import { businessFoundation } from "@/config/business";
import type { ExportMode } from "@/lib/jobs/credit-policy";

export type WatermarkResult = {
  buffer: Buffer;
  applied: boolean;
  label: string;
  placement: "bottom-right" | "bottom-center";
  watermarkType: "none" | "protected_pattern_badge";
};

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

  const image = sharp(input, { failOn: "none" });
  const [metadata, luminance] = await Promise.all([
    image.metadata(),
    getAverageLuminance(input)
  ]);
  const width = metadata.width ?? 1400;
  const height = metadata.height ?? 1000;
  const label = businessFoundation.exports.freeWatermarkText;
  const isPortrait = height > width * 1.18;
  const placement = isPortrait ? "bottom-center" : "bottom-right";
  const markTone = luminance > 142
    ? { fill: "#050712", opacity: 0.115, badgeFillOpacity: 0.5 }
    : { fill: "#FFFFFF", opacity: 0.125, badgeFillOpacity: 0.44 };

  const shortEdge = Math.min(width, height);
  const fontSize = clamp(Math.round(shortEdge * 0.026), 15, 28);
  const patternFontSize = clamp(Math.round(shortEdge * 0.052), 26, 54);
  const markSize = Math.round(fontSize * 1.45);
  const gap = Math.round(fontSize * 0.48);
  const horizontalPadding = Math.round(fontSize * 0.78);
  const verticalPadding = Math.round(fontSize * 0.48);
  const estimatedTextWidth = Math.round(label.length * fontSize * 0.56);
  const badgeWidth = Math.min(width - 32, estimatedTextWidth + markSize + gap + horizontalPadding * 2);
  const badgeHeight = Math.max(markSize + verticalPadding, fontSize + verticalPadding * 2);
  const safeInsetX = Math.max(14, Math.round(width * 0.026));
  const safeInsetY = Math.max(14, Math.round(height * 0.028));
  const x = placement === "bottom-center"
    ? Math.round((width - badgeWidth) / 2)
    : Math.max(14, width - badgeWidth - safeInsetX);
  const y = Math.max(14, height - badgeHeight - safeInsetY);
  const markX = x + horizontalPadding;
  const markY = y + Math.round((badgeHeight - markSize) / 2);
  const textX = markX + markSize + gap;
  const textY = y + Math.round(badgeHeight / 2) + Math.round(fontSize * 0.34);
  const patternText = createDiagonalPatternText({
    width,
    height,
    fontSize: patternFontSize,
    fill: markTone.fill,
    opacity: markTone.opacity
  });

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
      </defs>
      ${patternText}
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
        fill-opacity="0.84">${escapeXml(label)}</text>
    </svg>
  `);

  const buffer = await sharp(input, { failOn: "none" })
    .composite([{ input: watermarkSvg, blend: "over" }])
    .sharpen({ sigma: 0.25, m1: 0.18, m2: 0.12 })
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
    watermarkType: "protected_pattern_badge"
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

function createDiagonalPatternText(input: {
  width: number;
  height: number;
  fontSize: number;
  fill: string;
  opacity: number;
}) {
  const spacingX = Math.round(input.fontSize * 5.4);
  const spacingY = Math.round(input.fontSize * 3.2);
  const startX = -input.width;
  const endX = input.width * 2;
  const startY = -input.height * 0.35;
  const endY = input.height * 1.35;
  const rows: string[] = [];

  for (let y = startY; y <= endY; y += spacingY) {
    for (let x = startX; x <= endX; x += spacingX) {
      rows.push(`
        <text x="${Math.round(x)}" y="${Math.round(y)}"
          font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-size="${input.fontSize}"
          font-weight="850"
          letter-spacing="0"
          fill="${input.fill}"
          fill-opacity="${input.opacity}">Zeylora AI</text>
      `);
    }
  }

  return `
    <g transform="rotate(-28 ${Math.round(input.width / 2)} ${Math.round(input.height / 2)})" opacity="1">
      ${rows.join("")}
    </g>
  `;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}
