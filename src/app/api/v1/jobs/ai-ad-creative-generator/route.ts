import { NextResponse } from "next/server";
import {
  aiAdCreativeConfig,
  type AiAdCreativeFormat,
  type AiAdCreativeStyle,
  type GenerativeQualityMode
} from "@/config/ai-tools";
import { trackingEvents } from "@/config/tracking";
import { handleEcommerceGenerativeJob } from "@/app/api/v1/jobs/_shared/ecommerce-generative-route";

export const runtime = "nodejs";

export function POST(request: Request): Promise<NextResponse> {
  return handleEcommerceGenerativeJob(request, {
    toolKey: aiAdCreativeConfig.toolKey,
    slug: aiAdCreativeConfig.slug,
    publicName: "AI Ad Creative Generator",
    category: aiAdCreativeConfig.category,
    description: "Generate ready-to-use ecommerce ad creatives from product photos.",
    providerKey: aiAdCreativeConfig.providerKey,
    model: aiAdCreativeConfig.model,
    proModel: aiAdCreativeConfig.proModel,
    maxRetries: aiAdCreativeConfig.maxRetries,
    timeoutSeconds: aiAdCreativeConfig.timeoutSeconds,
    creditCost: aiAdCreativeConfig.creditCost,
    proCreditCost: aiAdCreativeConfig.proCreditCost,
    promptMaxLength: aiAdCreativeConfig.promptMaxLength,
    inputModeDescription: "image-to-image ecommerce ad creative generation",
    outputFilenamePrefix: "ai-ad-creative-generator",
    startedEvent: trackingEvents.adCreativeStarted,
    completedEvent: trackingEvents.adCreativeCompleted,
    failedEvent: trackingEvents.adCreativeFailed,
    useCases: ["instagram_ads", "facebook_ads", "tiktok_shop", "shopify_banners", "campaign_creatives"],
    buildPrompt: (body) => {
      const creativeFormat = normalizeFormat(body.creativeFormat);
      const style = normalizeStyle(body.creativeStyle);
      const qualityMode = normalizeQualityMode(body.qualityMode);
      const headline = normalizeText(body.headline, 60);
      const offer = normalizeText(body.offer, 48);
      const cta = normalizeText(body.cta, 28);
      const formatConfig = aiAdCreativeConfig.formats[creativeFormat];
      const styleConfig = aiAdCreativeConfig.styles[style];
      const textInstruction = [headline && `Headline: ${headline}`, offer && `Offer: ${offer}`, cta && `CTA: ${cta}`]
        .filter(Boolean)
        .join(". ");

      return {
        qualityMode,
        aspectRatio: formatConfig.aspectRatio,
        prompt: [
          styleConfig.prompt,
          `Create the ad in ${formatConfig.label} format (${formatConfig.aspectRatio}).`,
          "Keep the product recognizable, premium, and central. Build a clean marketing composition with enough negative space.",
          textInstruction
            ? `Include only short, clean, readable marketing text if the model can render it reliably: ${textInstruction}. If text may become messy, leave clean space for editable text instead.`
            : "Do not add messy unreadable text. Prefer clean space for editable marketing copy.",
          "Avoid fake brand claims, unsafe content, adult content, people-focused identity edits, or financial guarantees."
        ].join(" "),
        metadata: {
          creativeFormat,
          creativeFormatLabel: formatConfig.label,
          aspectRatio: formatConfig.aspectRatio,
          creativeStyle: style,
          creativeStyleLabel: styleConfig.label,
          headline: headline || undefined,
          offer: offer || undefined,
          cta: cta || undefined
        }
      };
    }
  });
}

function normalizeFormat(value: unknown): AiAdCreativeFormat {
  const allowed: AiAdCreativeFormat[] = ["square", "vertical", "story", "landscape", "shopify-banner"];
  return typeof value === "string" && allowed.includes(value as AiAdCreativeFormat)
    ? value as AiAdCreativeFormat
    : "square";
}

function normalizeStyle(value: unknown): AiAdCreativeStyle {
  const allowed: AiAdCreativeStyle[] = [
    "clean-ecommerce",
    "luxury-product-ad",
    "bold-sale-promo",
    "minimal-premium",
    "tiktok-shop",
    "dark-saas-tech"
  ];
  return typeof value === "string" && allowed.includes(value as AiAdCreativeStyle)
    ? value as AiAdCreativeStyle
    : "luxury-product-ad";
}

function normalizeQualityMode(value: unknown): GenerativeQualityMode {
  return value === "pro" ? "pro" : "standard";
}

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}
