import sharp from "sharp";
import {
  aiRelightConfig,
  type AiRelightPreset
} from "@/config/ai-tools";

type RelightPresetConfig = {
  brightness: number;
  saturation: number;
  contrast: number;
  gamma: number;
  highlightOpacity: number;
  glowOpacity: number;
  warmthOpacity: number;
  vignetteOpacity: number;
  sharpen: number;
};

export type AiRelightResult = {
  buffer: Buffer;
  width: number;
  height: number;
  preset: AiRelightPreset;
  label: string;
};

const presetConfigs: Record<AiRelightPreset, RelightPresetConfig> = {
  "soft-studio-light": {
    brightness: 1.08,
    saturation: 1.05,
    contrast: 1.08,
    gamma: 1.02,
    highlightOpacity: 0.22,
    glowOpacity: 0.1,
    warmthOpacity: 0.06,
    vignetteOpacity: 0.08,
    sharpen: 0.18
  },
  "luxury-glow": {
    brightness: 1.1,
    saturation: 1.09,
    contrast: 1.12,
    gamma: 1.0,
    highlightOpacity: 0.3,
    glowOpacity: 0.16,
    warmthOpacity: 0.14,
    vignetteOpacity: 0.12,
    sharpen: 0.16
  },
  "bright-catalog": {
    brightness: 1.18,
    saturation: 1.03,
    contrast: 1.05,
    gamma: 1.08,
    highlightOpacity: 0.34,
    glowOpacity: 0.08,
    warmthOpacity: 0.03,
    vignetteOpacity: 0.04,
    sharpen: 0.14
  },
  "dramatic-product-light": {
    brightness: 1.06,
    saturation: 1.08,
    contrast: 1.22,
    gamma: 1.0,
    highlightOpacity: 0.26,
    glowOpacity: 0.1,
    warmthOpacity: 0.08,
    vignetteOpacity: 0.2,
    sharpen: 0.24
  }
};

export function normalizeAiRelightPreset(preset?: string | null): AiRelightPreset {
  if (
    preset === "soft-studio-light" ||
    preset === "luxury-glow" ||
    preset === "bright-catalog" ||
    preset === "dramatic-product-light"
  ) {
    return preset;
  }

  return "soft-studio-light";
}

export async function createAiRelight(input: Buffer, preset: AiRelightPreset): Promise<AiRelightResult> {
  const config = presetConfigs[preset];
  const metadata = await sharp(input, { failOn: "none" }).rotate().metadata();
  const width = metadata.width ?? 1600;
  const height = metadata.height ?? 1600;
  const contrastOffset = Math.round(128 - 128 * config.contrast);
  const overlay = createLightOverlay({
    width,
    height,
    preset,
    highlightOpacity: config.highlightOpacity,
    glowOpacity: config.glowOpacity,
    warmthOpacity: config.warmthOpacity,
    vignetteOpacity: config.vignetteOpacity
  });

  const buffer = await sharp(input, { failOn: "none" })
    .rotate()
    .ensureAlpha()
    .modulate({
      brightness: config.brightness,
      saturation: config.saturation
    })
    .gamma(config.gamma)
    .linear(config.contrast, contrastOffset)
    .composite([
      { input: overlay.highlight, blend: "screen" },
      { input: overlay.glow, blend: "soft-light" },
      { input: overlay.warmth, blend: "overlay" },
      { input: overlay.vignette, blend: "multiply" }
    ])
    .sharpen({ sigma: 0.22, m1: config.sharpen, m2: config.sharpen * 0.6 })
    .png({
      compressionLevel: 6,
      adaptiveFiltering: true,
      palette: false
    })
    .toBuffer();

  return {
    buffer,
    width,
    height,
    preset,
    label: aiRelightConfig.presets[preset].label
  };
}

function createLightOverlay(input: {
  width: number;
  height: number;
  preset: AiRelightPreset;
  highlightOpacity: number;
  glowOpacity: number;
  warmthOpacity: number;
  vignetteOpacity: number;
}) {
  const dramatic = input.preset === "dramatic-product-light";
  const bright = input.preset === "bright-catalog";
  const luxury = input.preset === "luxury-glow";
  const keyLightX = dramatic ? "24%" : bright ? "50%" : "32%";
  const keyLightY = dramatic ? "18%" : "20%";
  const glowX = luxury ? "68%" : "52%";
  const glowY = luxury ? "32%" : "42%";

  return {
    highlight: Buffer.from(`
      <svg width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="key" cx="${keyLightX}" cy="${keyLightY}" r="${bright ? "78%" : "64%"}">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="${input.highlightOpacity}" />
            <stop offset="42%" stop-color="#ffffff" stop-opacity="${input.highlightOpacity * 0.36}" />
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#key)" />
      </svg>
    `),
    glow: Buffer.from(`
      <svg width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="glow" cx="${glowX}" cy="${glowY}" r="52%">
            <stop offset="0%" stop-color="#67e8f9" stop-opacity="${input.glowOpacity}" />
            <stop offset="50%" stop-color="#8b5cf6" stop-opacity="${input.glowOpacity * 0.28}" />
            <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#glow)" />
      </svg>
    `),
    warmth: Buffer.from(`
      <svg width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="warm" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
            <stop offset="48%" stop-color="#fef3c7" stop-opacity="${input.warmthOpacity}" />
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="${input.warmthOpacity * 0.55}" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#warm)" />
      </svg>
    `),
    vignette: Buffer.from(`
      <svg width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="v" cx="50%" cy="48%" r="72%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
            <stop offset="62%" stop-color="#ffffff" stop-opacity="1" />
            <stop offset="100%" stop-color="#111827" stop-opacity="${input.vignetteOpacity}" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#v)" />
      </svg>
    `)
  };
}
