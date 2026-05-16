export type ToolEconomyQualityTier = "standard" | "pro" | "hq" | "creative";

export type ToolEconomyTier = {
  toolSlug: string;
  toolKey: string;
  publicName: string;
  internalKey: string;
  qualityTier: ToolEconomyQualityTier;
  providerKey: string;
  creditCost: number;
  estimatedProviderCost: number;
  providerCurrency: string;
  featured?: boolean;
  recommended?: boolean;
  highQuality?: boolean;
  displayOrder: number;
  badge?: string;
  description: string;
  fallbackProviderKeys: string[];
};

export const TOOL_ECONOMY_TIERS: ToolEconomyTier[] = [
  {
    toolSlug: "hd-upscale",
    toolKey: "hd-upscale",
    publicName: "HD Upscale",
    internalKey: "hd-upscale-standard",
    qualityTier: "standard",
    providerKey: "replicate",
    creditCost: 2,
    estimatedProviderCost: 0.025,
    providerCurrency: "usd",
    featured: true,
    recommended: true,
    displayOrder: 10,
    badge: "Recommended",
    description: "Balanced 2x upscale for product photos and social creatives.",
    fallbackProviderKeys: []
  },
  {
    toolSlug: "hd-upscale",
    toolKey: "hd-upscale",
    publicName: "HD Upscale Pro",
    internalKey: "hd-upscale-pro",
    qualityTier: "pro",
    providerKey: "replicate",
    creditCost: 4,
    estimatedProviderCost: 0.06,
    providerCurrency: "usd",
    featured: true,
    recommended: true,
    highQuality: true,
    displayOrder: 11,
    badge: "Pro",
    description: "Higher-cost upscale tier for 4x Ultra, Sharp Catalog, and Social Cleanup runs.",
    fallbackProviderKeys: []
  },
  {
    toolSlug: "ai-relight",
    toolKey: "ai-relight",
    publicName: "AI Relight",
    internalKey: "ai-relight-standard",
    qualityTier: "standard",
    providerKey: "local-sharp",
    creditCost: 1,
    estimatedProviderCost: 0,
    providerCurrency: "usd",
    featured: true,
    recommended: true,
    displayOrder: 20,
    badge: "Popular",
    description: "Low-cost local relight for clean ecommerce brightness.",
    fallbackProviderKeys: []
  },
  {
    toolSlug: "ai-relight",
    toolKey: "ai-relight",
    publicName: "AI Relight Pro",
    internalKey: "ai-relight-pro",
    qualityTier: "pro",
    providerKey: "local-sharp",
    creditCost: 2,
    estimatedProviderCost: 0,
    providerCurrency: "usd",
    featured: true,
    displayOrder: 21,
    badge: "Pro",
    description: "Higher-value local relight tier for Luxury Glow and Dramatic Product Light presets.",
    fallbackProviderKeys: []
  },
  {
    toolSlug: "ai-photo-enhancer",
    toolKey: "photo-enhancer",
    publicName: "Photo Enhancer Pro",
    internalKey: "photo-enhancer-pro",
    qualityTier: "pro",
    providerKey: "replicate",
    creditCost: 3,
    estimatedProviderCost: 0.04,
    providerCurrency: "usd",
    featured: true,
    highQuality: true,
    displayOrder: 30,
    badge: "Pro",
    description: "Provider-backed enhancement for catalog polish and clearer product detail.",
    fallbackProviderKeys: []
  },
  {
    toolSlug: "marketplace-crop",
    toolKey: "marketplace-crop",
    publicName: "Marketplace Crop",
    internalKey: "marketplace-crop-standard",
    qualityTier: "standard",
    providerKey: "local-sharp",
    creditCost: 1,
    estimatedProviderCost: 0,
    providerCurrency: "usd",
    displayOrder: 40,
    description: "Local crop and resize tier for square, portrait, story, and horizontal formats.",
    fallbackProviderKeys: []
  },
  {
    toolSlug: "marketplace-crop",
    toolKey: "marketplace-crop",
    publicName: "Marketplace Crop Pro",
    internalKey: "marketplace-crop-pro",
    qualityTier: "pro",
    providerKey: "local-sharp",
    creditCost: 2,
    estimatedProviderCost: 0,
    providerCurrency: "usd",
    displayOrder: 41,
    badge: "Marketplace",
    description: "Premium white-frame marketplace format tier.",
    fallbackProviderKeys: []
  },
  {
    toolSlug: "background-remover",
    toolKey: "background-remover",
    publicName: "Background Remover",
    internalKey: "background-remover-standard",
    qualityTier: "standard",
    providerKey: "replicate",
    creditCost: 2,
    estimatedProviderCost: 0.01,
    providerCurrency: "usd",
    displayOrder: 50,
    description: "Standard provider-backed background removal for product photos.",
    fallbackProviderKeys: ["replicate"]
  },
  {
    toolSlug: "background-remover",
    toolKey: "background-remover",
    publicName: "Background Remover HQ",
    internalKey: "background-remover-hq",
    qualityTier: "hq",
    providerKey: "photoroom",
    creditCost: 5,
    estimatedProviderCost: 0.07,
    providerCurrency: "usd",
    highQuality: true,
    displayOrder: 51,
    badge: "High quality",
    description: "Premium PhotoRoom/remove.bg-style provider tier for higher quality cutouts.",
    fallbackProviderKeys: ["replicate"]
  },
  {
    toolSlug: "product-shadow",
    toolKey: "product-shadow",
    publicName: "Product Shadow",
    internalKey: "product-shadow-standard",
    qualityTier: "standard",
    providerKey: "local-sharp",
    creditCost: 1,
    estimatedProviderCost: 0,
    providerCurrency: "usd",
    displayOrder: 60,
    badge: "Creative",
    description: "Local studio-shadow rendering for clean product cutouts.",
    fallbackProviderKeys: []
  },
  {
    toolSlug: "product-shadow",
    toolKey: "product-shadow",
    publicName: "Product Shadow Creative",
    internalKey: "product-shadow-creative",
    qualityTier: "creative",
    providerKey: "local-sharp",
    creditCost: 2,
    estimatedProviderCost: 0,
    providerCurrency: "usd",
    displayOrder: 61,
    badge: "Creative",
    description: "Creative/luxury shadow preset tier.",
    fallbackProviderKeys: []
  },
  {
    toolSlug: "object-remover",
    toolKey: "object-remover",
    publicName: "Object Remover",
    internalKey: "object-remover-standard",
    qualityTier: "standard",
    providerKey: "replicate",
    creditCost: 4,
    estimatedProviderCost: 0.08,
    providerCurrency: "usd",
    displayOrder: 70,
    badge: "Cleanup",
    description: "Prompt-based ecommerce cleanup for cables, props, stains, dust, and distracting background items.",
    fallbackProviderKeys: []
  },
  {
    toolSlug: "object-remover",
    toolKey: "object-remover",
    publicName: "Object Remover Pro",
    internalKey: "object-remover-pro",
    qualityTier: "pro",
    providerKey: "replicate",
    creditCost: 6,
    estimatedProviderCost: 0.12,
    providerCurrency: "usd",
    highQuality: true,
    displayOrder: 71,
    badge: "Pro cleanup",
    description: "Higher-credit object removal tier for more demanding product cleanup jobs.",
    fallbackProviderKeys: []
  }
];

export function resolveToolEconomy(input: {
  toolSlug: string;
  qualityMode?: string;
  preset?: string;
  providerKey?: string;
}): ToolEconomyTier {
  const internalKey = resolveInternalKey(input);
  return TOOL_ECONOMY_TIERS.find((tier) => tier.internalKey === internalKey) ||
    TOOL_ECONOMY_TIERS.find((tier) => tier.toolSlug === input.toolSlug) ||
    createUnknownTier(input.toolSlug, input.providerKey);
}

export function getToolEconomyTiers(toolSlug?: string) {
  return toolSlug ? TOOL_ECONOMY_TIERS.filter((tier) => tier.toolSlug === toolSlug) : TOOL_ECONOMY_TIERS;
}

export function getQualityTierLabel(tier?: string | null) {
  if (tier === "hq") return "High Quality";
  if (tier === "pro") return "Pro";
  if (tier === "creative") return "Creative";
  if (tier === "standard") return "Standard";
  return "Standard";
}

function resolveInternalKey(input: {
  toolSlug: string;
  qualityMode?: string;
  preset?: string;
  providerKey?: string;
}) {
  if (input.toolSlug === "background-remover") {
    if (input.qualityMode === "high" && input.providerKey === "photoroom") return "background-remover-hq";
    return "background-remover-standard";
  }

  if (input.toolSlug === "hd-upscale") {
    if (input.preset === "4x-ultra" || input.preset === "sharp-catalog" || input.preset === "social-cleanup") return "hd-upscale-pro";
    return "hd-upscale-standard";
  }

  if (input.toolSlug === "ai-relight") {
    if (input.preset === "luxury-glow" || input.preset === "dramatic-product-light") return "ai-relight-pro";
    return "ai-relight-standard";
  }

  if (input.toolSlug === "marketplace-crop") {
    if (input.preset === "marketplace-white") return "marketplace-crop-pro";
    return "marketplace-crop-standard";
  }

  if (input.toolSlug === "product-shadow") {
    if (input.preset === "luxury-catalog" || input.preset === "floating-shadow") return "product-shadow-creative";
    return "product-shadow-standard";
  }

  if (input.toolSlug === "object-remover") {
    if (input.qualityMode === "pro" || input.preset === "pro") return "object-remover-pro";
    return "object-remover-standard";
  }

  if (input.toolSlug === "ai-photo-enhancer") return "photo-enhancer-pro";
  return `${input.toolSlug}-standard`;
}

function createUnknownTier(toolSlug: string, providerKey = "unknown"): ToolEconomyTier {
  return {
    toolSlug,
    toolKey: toolSlug,
    publicName: toolSlug,
    internalKey: `${toolSlug}-standard`,
    qualityTier: "standard",
    providerKey,
    creditCost: 1,
    estimatedProviderCost: 0,
    providerCurrency: "usd",
    displayOrder: 999,
    description: "Fallback tool economy tier.",
    fallbackProviderKeys: []
  };
}
