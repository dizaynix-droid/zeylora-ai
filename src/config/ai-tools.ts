export type BackgroundRemovalQualityMode = "fast" | "standard" | "high";

export type BackgroundRemovalModelInput = "transparent-background" | "remove-bg" | "bria-rmbg";

export type BackgroundRemovalProviderKey = "replicate" | "photoroom" | "removebg";

export type BackgroundRemovalAttempt = {
  key: string;
  model: string;
  inputType: BackgroundRemovalModelInput;
  qualityTier: BackgroundRemovalQualityMode;
};

export const backgroundRemoverConfig = {
  slug: "background-remover",
  creditCost: 2,
  primaryProviderKey: "replicate",
  primaryModel: process.env.AI_BACKGROUND_REMOVER_MODEL || "851-labs/background-remover",
  fallbackModel: process.env.AI_BACKGROUND_REMOVER_FALLBACK_MODEL || "lucataco/remove-bg",
  highQualityModel: process.env.AI_BACKGROUND_REMOVER_HIGH_QUALITY_MODEL || "bria/remove-background",
  backgroundRemovalProvider: normalizeBackgroundRemovalProvider(process.env.BACKGROUND_REMOVAL_PROVIDER),
  timeoutSeconds: Number(process.env.AI_JOB_TIMEOUT_SECONDS || 60),
  maxRetries: Number(process.env.AI_JOB_MAX_RETRIES || 1),
  pollIntervalSeconds: Number(process.env.AI_JOB_POLL_INTERVAL_SECONDS || 2),
  qualityMode: (process.env.AI_BACKGROUND_REMOVER_QUALITY_MODE || "standard") as BackgroundRemovalQualityMode
} as const;

export const photoEnhancerConfig = {
  toolKey: "photo-enhancer",
  slug: "ai-photo-enhancer",
  category: "enhance",
  creditCost: 3,
  providerKey: "replicate",
  model: process.env.AI_PHOTO_ENHANCER_MODEL || "nightmareai/real-esrgan",
  scale: Number(process.env.AI_PHOTO_ENHANCER_SCALE || 2),
  faceEnhance: process.env.AI_PHOTO_ENHANCER_FACE_ENHANCE === "true",
  timeoutSeconds: Number(process.env.AI_PHOTO_ENHANCER_TIMEOUT_SECONDS || process.env.AI_JOB_TIMEOUT_SECONDS || 90),
  pollIntervalSeconds: Number(process.env.AI_JOB_POLL_INTERVAL_SECONDS || 2),
  maxRetries: Number(process.env.AI_PHOTO_ENHANCER_MAX_RETRIES || process.env.AI_JOB_MAX_RETRIES || 1)
} as const;

export type HdUpscalePreset = "2x-hd" | "4x-ultra" | "sharp-catalog" | "social-cleanup";

export const hdUpscaleConfig = {
  toolKey: "hd-upscale",
  slug: "hd-upscale",
  category: "enhance",
  creditCost: 2,
  providerKey: "replicate",
  model: process.env.AI_HD_UPSCALE_MODEL || process.env.AI_PHOTO_ENHANCER_MODEL || "nightmareai/real-esrgan",
  timeoutSeconds: Number(process.env.AI_HD_UPSCALE_TIMEOUT_SECONDS || process.env.AI_PHOTO_ENHANCER_TIMEOUT_SECONDS || process.env.AI_JOB_TIMEOUT_SECONDS || 90),
  pollIntervalSeconds: Number(process.env.AI_JOB_POLL_INTERVAL_SECONDS || 2),
  maxRetries: Number(process.env.AI_HD_UPSCALE_MAX_RETRIES || process.env.AI_JOB_MAX_RETRIES || 1),
  presets: {
    "2x-hd": {
      label: "2x HD",
      scale: 2,
      faceEnhance: false,
      description: "Balanced 2x upscale for product images and general ecommerce visuals."
    },
    "4x-ultra": {
      label: "4x Ultra",
      scale: 4,
      faceEnhance: false,
      description: "Higher-resolution upscale for small or heavily compressed source images."
    },
    "sharp-catalog": {
      label: "Sharp Catalog",
      scale: 2,
      faceEnhance: false,
      description: "Sharper product detail for catalog and marketplace listing images."
    },
    "social-cleanup": {
      label: "Social Cleanup",
      scale: 2,
      faceEnhance: true,
      description: "Cleaner social-ready output for mixed product, creator, and lifestyle images."
    }
  } satisfies Record<string, { label: string; scale: number; faceEnhance: boolean; description: string }>
} as const;

export type MarketplaceCropFormat = "square" | "portrait" | "story" | "horizontal" | "marketplace-white";
export type ProductShadowPreset = "soft-studio" | "floating-shadow" | "luxury-catalog" | "soft-floor";
export type AiRelightPreset = "soft-studio-light" | "luxury-glow" | "bright-catalog" | "dramatic-product-light";
export type ObjectRemovalQualityMode = "standard" | "pro";

export const marketplaceCropConfig = {
  toolKey: "marketplace-crop",
  slug: "marketplace-crop",
  category: "ecommerce",
  creditCost: 1,
  providerKey: "local-sharp",
  maxRetries: 0,
  formats: {
    square: {
      label: "1:1 Square",
      width: 1600,
      height: 1600,
      description: "Square product image for Shopify, Etsy, and marketplace grids."
    },
    portrait: {
      label: "4:5 Portrait",
      width: 1600,
      height: 2000,
      description: "Portrait product creative for paid social and catalog cards."
    },
    story: {
      label: "9:16 Story/Reels",
      width: 1440,
      height: 2560,
      description: "Vertical product frame for stories, reels, and mobile-first ads."
    },
    horizontal: {
      label: "16:9 Horizontal",
      width: 1920,
      height: 1080,
      description: "Wide product frame for banners, ads, and hero visuals."
    },
    "marketplace-white": {
      label: "Marketplace White Frame",
      width: 2000,
      height: 2000,
      description: "Amazon-style clean white product frame with centered object focus."
    }
  } satisfies Record<string, { label: string; width: number; height: number; description: string }>
} as const;

export const productShadowConfig = {
  toolKey: "product-shadow",
  slug: "product-shadow",
  category: "ecommerce",
  creditCost: 1,
  providerKey: "local-sharp",
  maxRetries: 0,
  presets: {
    "soft-studio": {
      label: "Soft Studio",
      description: "Balanced catalog shadow with natural product grounding."
    },
    "floating-shadow": {
      label: "Floating Shadow",
      description: "A lighter floating shadow for transparent product cutouts."
    },
    "luxury-catalog": {
      label: "Luxury Catalog",
      description: "Deeper premium shadow and warm catalog floor tone."
    },
    "soft-floor": {
      label: "Soft Floor",
      description: "Wide soft floor shadow for ad-friendly product depth."
    }
  } satisfies Record<string, { label: string; description: string }>
} as const;

export const aiRelightConfig = {
  toolKey: "ai-relight",
  slug: "ai-relight",
  category: "ecommerce",
  creditCost: 1,
  providerKey: "local-sharp",
  maxRetries: 0,
  presets: {
    "soft-studio-light": {
      label: "Soft Studio Light",
      description: "Clean balanced light with gentle premium highlights."
    },
    "luxury-glow": {
      label: "Luxury Glow",
      description: "Warm premium highlights and soft catalog glow."
    },
    "bright-catalog": {
      label: "Bright Catalog",
      description: "High-key ecommerce brightness for marketplace listings."
    },
    "dramatic-product-light": {
      label: "Dramatic Product Light",
      description: "Focused contrast and directional highlight for ad creatives."
    }
  } satisfies Record<string, { label: string; description: string }>
} as const;

export const objectRemoverConfig = {
  toolKey: "object-remover",
  slug: "object-remover",
  category: "ecommerce",
  creditCost: 4,
  proCreditCost: 6,
  providerKey: "replicate",
  model: process.env.AI_OBJECT_REMOVER_MODEL || "adirik/inst-inpaint",
  proModel: process.env.AI_OBJECT_REMOVER_PRO_MODEL || process.env.AI_OBJECT_REMOVER_MODEL || "adirik/inst-inpaint",
  timeoutSeconds: Number(process.env.AI_OBJECT_REMOVER_TIMEOUT_SECONDS || process.env.AI_JOB_TIMEOUT_SECONDS || 120),
  pollIntervalSeconds: Number(process.env.AI_JOB_POLL_INTERVAL_SECONDS || 2),
  maxRetries: Number(process.env.AI_OBJECT_REMOVER_MAX_RETRIES || process.env.AI_JOB_MAX_RETRIES || 1),
  promptMaxLength: 240
} as const;

export function getBackgroundRemovalAttempts(mode: BackgroundRemovalQualityMode): BackgroundRemovalAttempt[] {
  if (mode === "fast") {
    return [
      {
        key: "lucataco-fast",
        model: backgroundRemoverConfig.fallbackModel,
        inputType: "remove-bg",
        qualityTier: "fast"
      },
      {
        key: "851-standard-fallback",
        model: backgroundRemoverConfig.primaryModel,
        inputType: "transparent-background",
        qualityTier: "standard"
      }
    ];
  }

  if (mode === "high") {
    return [
      {
        key: "bria-high",
        model: backgroundRemoverConfig.highQualityModel,
        inputType: "bria-rmbg",
        qualityTier: "high"
      },
      {
        key: "851-standard-fallback",
        model: backgroundRemoverConfig.primaryModel,
        inputType: "transparent-background",
        qualityTier: "standard"
      }
    ];
  }

  return [
    {
      key: "851-standard",
      model: backgroundRemoverConfig.primaryModel,
      inputType: "transparent-background",
      qualityTier: "standard"
    },
    {
      key: "lucataco-fast-fallback",
      model: backgroundRemoverConfig.fallbackModel,
      inputType: "remove-bg",
      qualityTier: "fast"
    }
  ];
}

export function getBackgroundRemovalQualityFallbackAttempt(): BackgroundRemovalAttempt {
  return {
    key: "bria-quality-fallback",
    model: backgroundRemoverConfig.highQualityModel,
    inputType: "bria-rmbg",
    qualityTier: "high"
  };
}

export function getBackgroundRemovalComparisonAttempts(): BackgroundRemovalAttempt[] {
  const attempts: BackgroundRemovalAttempt[] = [
    {
      key: "replicate-851-labs-background-remover",
      model: backgroundRemoverConfig.primaryModel,
      inputType: "transparent-background",
      qualityTier: "standard"
    },
    {
      key: "replicate-lucataco-remove-bg",
      model: backgroundRemoverConfig.fallbackModel,
      inputType: "remove-bg",
      qualityTier: "fast"
    },
    {
      key: "replicate-bria-remove-background",
      model: backgroundRemoverConfig.highQualityModel,
      inputType: "bria-rmbg",
      qualityTier: "high"
    }
  ];

  return attempts.filter((attempt) => attempt.model);
}

function normalizeBackgroundRemovalProvider(value?: string): BackgroundRemovalProviderKey {
  if (value === "photoroom") return value;
  return "replicate";
}
