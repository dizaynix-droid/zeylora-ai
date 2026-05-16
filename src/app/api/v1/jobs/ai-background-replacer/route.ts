import { NextResponse } from "next/server";
import {
  aiBackgroundReplacerConfig,
  type AiBackgroundReplacerStyle,
  type GenerativeQualityMode
} from "@/config/ai-tools";
import { trackingEvents } from "@/config/tracking";
import { handleEcommerceGenerativeJob } from "@/app/api/v1/jobs/_shared/ecommerce-generative-route";

export const runtime = "nodejs";

export function POST(request: Request): Promise<NextResponse> {
  return handleEcommerceGenerativeJob(request, {
    toolKey: aiBackgroundReplacerConfig.toolKey,
    slug: aiBackgroundReplacerConfig.slug,
    publicName: "AI Background Replacer",
    category: aiBackgroundReplacerConfig.category,
    description: "Replace boring product backgrounds with premium ecommerce studio and lifestyle scenes.",
    providerKey: aiBackgroundReplacerConfig.providerKey,
    model: aiBackgroundReplacerConfig.model,
    proModel: aiBackgroundReplacerConfig.proModel,
    maxRetries: aiBackgroundReplacerConfig.maxRetries,
    timeoutSeconds: aiBackgroundReplacerConfig.timeoutSeconds,
    creditCost: aiBackgroundReplacerConfig.creditCost,
    proCreditCost: aiBackgroundReplacerConfig.proCreditCost,
    promptMaxLength: aiBackgroundReplacerConfig.promptMaxLength,
    inputModeDescription: "image-to-image background replacement",
    outputFilenamePrefix: "ai-background-replacer",
    startedEvent: trackingEvents.backgroundReplacerStarted,
    completedEvent: trackingEvents.backgroundReplacerCompleted,
    failedEvent: trackingEvents.backgroundReplacerFailed,
    useCases: ["premium_background_replacement", "ecommerce_scenes", "shopify_amazon_etsy_visuals"],
    buildPrompt: (body) => {
      const style = normalizeStyle(body.backgroundStyle);
      const qualityMode = normalizeQualityMode(body.qualityMode);
      const customPrompt = normalizePrompt(body.customPrompt);
      const styleConfig = aiBackgroundReplacerConfig.styles[style];
      const scenePrompt = style === "custom" ? customPrompt : styleConfig.prompt;

      return {
        qualityMode,
        prompt: [
          scenePrompt,
          "Preserve the original product, packaging, logo placement, shape, scale, and important product details.",
          "Only change the surrounding background and scene. Do not add people, fake brand claims, unsafe content, or misleading elements.",
          "Make the result realistic, premium, seller-ready, and suitable for Shopify, Amazon, Etsy, TikTok Shop, and paid social ads."
        ].filter(Boolean).join(" "),
        metadata: {
          backgroundStyle: style,
          backgroundStyleLabel: styleConfig.label,
          customPrompt: style === "custom" ? customPrompt : undefined
        }
      };
    }
  });
}

function normalizeStyle(value: unknown): AiBackgroundReplacerStyle {
  const allowed: AiBackgroundReplacerStyle[] = [
    "white-studio",
    "luxury-marble",
    "dark-premium",
    "soft-skincare",
    "minimal-ecommerce",
    "tiktok-shop",
    "custom"
  ];
  return typeof value === "string" && allowed.includes(value as AiBackgroundReplacerStyle)
    ? value as AiBackgroundReplacerStyle
    : "luxury-marble";
}

function normalizeQualityMode(value: unknown): GenerativeQualityMode {
  return value === "pro" ? "pro" : "standard";
}

function normalizePrompt(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, aiBackgroundReplacerConfig.promptMaxLength)
    : "";
}
