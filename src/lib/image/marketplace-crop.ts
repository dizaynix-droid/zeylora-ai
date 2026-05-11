import sharp from "sharp";
import {
  marketplaceCropConfig,
  type MarketplaceCropFormat
} from "@/config/ai-tools";

export type MarketplaceCropResult = {
  buffer: Buffer;
  width: number;
  height: number;
  format: MarketplaceCropFormat;
  label: string;
  preservedTransparency: boolean;
};

export function normalizeMarketplaceCropFormat(format?: string | null): MarketplaceCropFormat {
  if (
    format === "square" ||
    format === "portrait" ||
    format === "story" ||
    format === "horizontal" ||
    format === "marketplace-white"
  ) {
    return format;
  }

  return "square";
}

export async function createMarketplaceCrop(input: Buffer, format: MarketplaceCropFormat): Promise<MarketplaceCropResult> {
  const target = marketplaceCropConfig.formats[format];
  const metadata = await sharp(input, { failOn: "none" }).rotate().metadata();
  const hasAlpha = Boolean(metadata.hasAlpha);
  const isWhiteFrame = format === "marketplace-white";
  const background = isWhiteFrame || !hasAlpha
    ? { r: 250, g: 251, b: 253, alpha: 1 }
    : { r: 0, g: 0, b: 0, alpha: 0 };

  const fitPadding = isWhiteFrame ? 0.84 : 0.9;
  const innerWidth = Math.round(target.width * fitPadding);
  const innerHeight = Math.round(target.height * fitPadding);

  const framed = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({
      width: innerWidth,
      height: innerHeight,
      fit: "inside",
      withoutEnlargement: false,
      background
    })
    .toBuffer();

  const imageMetadata = await sharp(framed, { failOn: "none" }).metadata();
  const resizedWidth = imageMetadata.width ?? innerWidth;
  const resizedHeight = imageMetadata.height ?? innerHeight;
  const left = Math.max(0, Math.round((target.width - resizedWidth) / 2));
  const top = Math.max(0, Math.round((target.height - resizedHeight) / 2));

  const buffer = await sharp({
    create: {
      width: target.width,
      height: target.height,
      channels: 4,
      background
    }
  })
    .composite([{ input: framed, left, top }])
    .sharpen({ sigma: 0.22, m1: 0.14, m2: 0.08 })
    .png({
      compressionLevel: 6,
      adaptiveFiltering: true,
      palette: false
    })
    .toBuffer();

  return {
    buffer,
    width: target.width,
    height: target.height,
    format,
    label: target.label,
    preservedTransparency: hasAlpha && !isWhiteFrame
  };
}
