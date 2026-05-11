import sharp from "sharp";
import {
  productShadowConfig,
  type ProductShadowPreset
} from "@/config/ai-tools";

type ShadowPresetConfig = {
  floor: string;
  floorEnd: string;
  ellipseOpacity: number;
  ellipseBlur: number;
  ellipseScale: number;
  shapeOpacity: number;
  shapeBlur: number;
  contactOpacity: number;
  lift: number;
  ambientOpacity: number;
  productScale: number;
  productTopRatio: number;
  reflectionOpacity: number;
};

export type ProductShadowResult = {
  buffer: Buffer;
  width: number;
  height: number;
  preset: ProductShadowPreset;
  label: string;
  hasInputAlpha: boolean;
};

const CANVAS_SIZE = 1600;

const presetConfigs: Record<ProductShadowPreset, ShadowPresetConfig> = {
  "soft-studio": {
    floor: "#f7f8fb",
    floorEnd: "#e9eef6",
    ellipseOpacity: 0.28,
    ellipseBlur: 30,
    ellipseScale: 0.86,
    shapeOpacity: 0.2,
    shapeBlur: 18,
    contactOpacity: 0.22,
    lift: 18,
    ambientOpacity: 0.12,
    productScale: 0.78,
    productTopRatio: 0.44,
    reflectionOpacity: 0.03
  },
  "floating-shadow": {
    floor: "#fbfcff",
    floorEnd: "#eef4fb",
    ellipseOpacity: 0.34,
    ellipseBlur: 58,
    ellipseScale: 0.7,
    shapeOpacity: 0.16,
    shapeBlur: 34,
    contactOpacity: 0.1,
    lift: -8,
    ambientOpacity: 0.08,
    productScale: 0.74,
    productTopRatio: 0.39,
    reflectionOpacity: 0.02
  },
  "luxury-catalog": {
    floor: "#f3eee8",
    floorEnd: "#e5dbcf",
    ellipseOpacity: 0.4,
    ellipseBlur: 28,
    ellipseScale: 0.82,
    shapeOpacity: 0.24,
    shapeBlur: 16,
    contactOpacity: 0.3,
    lift: 24,
    ambientOpacity: 0.18,
    productScale: 0.76,
    productTopRatio: 0.43,
    reflectionOpacity: 0.09
  },
  "soft-floor": {
    floor: "#f8fafc",
    floorEnd: "#e6edf6",
    ellipseOpacity: 0.3,
    ellipseBlur: 70,
    ellipseScale: 1.08,
    shapeOpacity: 0.14,
    shapeBlur: 38,
    contactOpacity: 0.16,
    lift: 8,
    ambientOpacity: 0.11,
    productScale: 0.72,
    productTopRatio: 0.42,
    reflectionOpacity: 0.035
  }
};

export function normalizeProductShadowPreset(preset?: string | null): ProductShadowPreset {
  if (
    preset === "soft-studio" ||
    preset === "floating-shadow" ||
    preset === "luxury-catalog" ||
    preset === "soft-floor"
  ) {
    return preset;
  }

  return "soft-studio";
}

export async function createProductShadow(input: Buffer, preset: ProductShadowPreset): Promise<ProductShadowResult> {
  const config = presetConfigs[preset];
  const normalizedInput = sharp(input, { failOn: "none" }).rotate();
  const metadata = await normalizedInput.metadata();
  const hasInputAlpha = Boolean(metadata.hasAlpha);
  const maxProductWidth = Math.round(CANVAS_SIZE * config.productScale);
  const maxProductHeight = Math.round(CANVAS_SIZE * 0.72);

  const product = await sharp(input, { failOn: "none" })
    .rotate()
    .ensureAlpha()
    .resize({
      width: maxProductWidth,
      height: maxProductHeight,
      fit: "inside",
      withoutEnlargement: false
    })
    .png({ compressionLevel: 6, adaptiveFiltering: true, palette: false })
    .toBuffer();

  const productMetadata = await sharp(product, { failOn: "none" }).metadata();
  const productWidth = productMetadata.width ?? maxProductWidth;
  const productHeight = productMetadata.height ?? maxProductHeight;
  const productLeft = Math.round((CANVAS_SIZE - productWidth) / 2);
  const productTop = Math.max(92, Math.round(CANVAS_SIZE * config.productTopRatio - productHeight / 2));
  const productBottom = productTop + productHeight;
  const shadowCenterX = Math.round(CANVAS_SIZE / 2);
  const shadowCenterY = Math.min(CANVAS_SIZE - 210, productBottom - config.lift);
  const shadowWidth = Math.max(460, Math.round(productWidth * config.ellipseScale));
  const shadowHeight = Math.max(110, Math.round(productHeight * 0.15));
  const shapeShadowWidth = Math.max(420, Math.round(productWidth * Math.min(1.04, config.ellipseScale)));
  const shapeShadowHeight = Math.max(80, Math.round(productHeight * 0.12));
  const shapeShadow = await createShapeShadow({
    product,
    width: shapeShadowWidth,
    height: shapeShadowHeight,
    opacity: config.shapeOpacity,
    blur: config.shapeBlur
  });
  const shapeShadowLeft = Math.round((CANVAS_SIZE - shapeShadowWidth) / 2);
  const shapeShadowTop = Math.round(shadowCenterY - shapeShadowHeight / 2);

  const floorSvg = Buffer.from(`
    <svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ambient" cx="50%" cy="58%" r="56%">
          <stop offset="0%" stop-color="#111827" stop-opacity="${config.ambientOpacity}" />
          <stop offset="58%" stop-color="#111827" stop-opacity="0.025" />
          <stop offset="100%" stop-color="#111827" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="floorGlow" cx="50%" cy="68%" r="62%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.72" />
          <stop offset="48%" stop-color="#ffffff" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="floor" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="48%" stop-color="${config.floor}" />
          <stop offset="100%" stop-color="${config.floorEnd}" />
        </linearGradient>
        <filter id="shadowBlur" x="-40%" y="-120%" width="180%" height="340%">
          <feGaussianBlur stdDeviation="${config.ellipseBlur}" />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#floor)" />
      <rect width="100%" height="100%" fill="url(#floorGlow)" />
      <rect width="100%" height="100%" fill="url(#ambient)" />
      <ellipse
        cx="${shadowCenterX}"
        cy="${shadowCenterY + Math.round(shadowHeight * 0.38)}"
        rx="${Math.round(shadowWidth * 0.42)}"
        ry="${Math.round(shadowHeight * 0.16)}"
        fill="#ffffff"
        opacity="${config.reflectionOpacity}"
      />
      <ellipse
        cx="${shadowCenterX}"
        cy="${shadowCenterY}"
        rx="${Math.round(shadowWidth / 2)}"
        ry="${Math.round(shadowHeight / 2)}"
        fill="#111827"
        opacity="${config.ellipseOpacity}"
        filter="url(#shadowBlur)"
      />
      <ellipse
        cx="${shadowCenterX}"
        cy="${shadowCenterY + Math.round(shadowHeight * 0.05)}"
        rx="${Math.round(shadowWidth * 0.34)}"
        ry="${Math.round(shadowHeight * 0.2)}"
        fill="#111827"
        opacity="${config.contactOpacity}"
      />
    </svg>
  `);

  const buffer = await sharp(floorSvg, { failOn: "none" })
    .composite([
      { input: shapeShadow, left: shapeShadowLeft, top: shapeShadowTop },
      { input: product, left: productLeft, top: productTop }
    ])
    .sharpen({ sigma: 0.2, m1: 0.12, m2: 0.08 })
    .png({ compressionLevel: 6, adaptiveFiltering: true, palette: false })
    .toBuffer();

  return {
    buffer,
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    preset,
    label: productShadowConfig.presets[preset].label,
    hasInputAlpha
  };
}

async function createShapeShadow(input: {
  product: Buffer;
  width: number;
  height: number;
  opacity: number;
  blur: number;
}) {
  return sharp(input.product, { failOn: "none" })
    .ensureAlpha()
    .modulate({ brightness: Math.max(0.08, input.opacity), saturation: 0 })
    .tint({ r: 17, g: 24, b: 39 })
    .resize({
      width: input.width,
      height: input.height,
      fit: "fill"
    })
    .blur(input.blur)
    .png({ compressionLevel: 7, adaptiveFiltering: true, palette: false })
    .toBuffer();
}
