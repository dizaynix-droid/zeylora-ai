export type ToolCategory = "Enhancement" | "Editing" | "Portrait" | "Restoration" | "Style" | "Ecommerce";

export type AiToolConfig = {
  slug: string;
  version: number;
  name: string;
  category: ToolCategory;
  description: string;
  creditCost: number;
  status: "active" | "inactive" | "paused";
  providerKey: "replicate" | "openai" | "stability" | "clipdrop" | "local-sharp";
  fallbackProviderKeys: string[];
  inputRules: {
    allowedMimeTypes: string[];
    maxFileSizeMb: number;
    maxWidth: number;
    maxHeight: number;
  };
  retryPolicy: {
    maxRetries: number;
    timeoutSeconds: number;
    retryDelaySeconds: number;
    allowFallback: boolean;
  };
};

export const initialTools: AiToolConfig[] = [
  {
    slug: "ai-photo-enhancer",
    version: 1,
    name: "AI Photo Enhancer",
    category: "Enhancement",
    description: "Planned enhancement workflow for sharper, cleaner, better-lit product and catalog images.",
    creditCost: 3,
    status: "active",
    providerKey: "replicate",
    fallbackProviderKeys: ["openai", "stability"],
    inputRules: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSizeMb: 12,
      maxWidth: 6000,
      maxHeight: 6000
    },
    retryPolicy: {
      maxRetries: 2,
      timeoutSeconds: 90,
      retryDelaySeconds: 10,
      allowFallback: true
    }
  },
  {
    slug: "background-remover",
    version: 1,
    name: "Background Remover",
    category: "Editing",
    description: "Remove backgrounds for product photos, ecommerce assets, cosmetics, perfume, jewelry, shoes, and clean objects.",
    creditCost: 2,
    status: "active",
    providerKey: "replicate",
    fallbackProviderKeys: ["clipdrop"],
    inputRules: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSizeMb: 12,
      maxWidth: 6000,
      maxHeight: 6000
    },
    retryPolicy: {
      maxRetries: 2,
      timeoutSeconds: 60,
      retryDelaySeconds: 8,
      allowFallback: true
    }
  },
  {
    slug: "marketplace-crop",
    version: 1,
    name: "Marketplace Crop",
    category: "Ecommerce",
    description: "Resize and frame product photos for Shopify, Amazon, Etsy, and social ads.",
    creditCost: 1,
    status: "active",
    providerKey: "local-sharp",
    fallbackProviderKeys: [],
    inputRules: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSizeMb: 12,
      maxWidth: 6000,
      maxHeight: 6000
    },
    retryPolicy: {
      maxRetries: 0,
      timeoutSeconds: 20,
      retryDelaySeconds: 0,
      allowFallback: false
    }
  },
  {
    slug: "product-shadow",
    version: 1,
    name: "Product Shadow",
    category: "Ecommerce",
    description: "Add natural studio shadows and premium depth to product photos for Shopify, Amazon, Etsy, catalog pages, and ads.",
    creditCost: 1,
    status: "active",
    providerKey: "local-sharp",
    fallbackProviderKeys: [],
    inputRules: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSizeMb: 12,
      maxWidth: 6000,
      maxHeight: 6000
    },
    retryPolicy: {
      maxRetries: 0,
      timeoutSeconds: 20,
      retryDelaySeconds: 0,
      allowFallback: false
    }
  },
  {
    slug: "ai-relight",
    version: 1,
    name: "AI Relight",
    category: "Ecommerce",
    description: "Transform dull product photos into brighter, cleaner, premium studio-style visuals for Shopify, Amazon, Etsy, ads, and catalog pages.",
    creditCost: 1,
    status: "active",
    providerKey: "local-sharp",
    fallbackProviderKeys: [],
    inputRules: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSizeMb: 12,
      maxWidth: 6000,
      maxHeight: 6000
    },
    retryPolicy: {
      maxRetries: 0,
      timeoutSeconds: 20,
      retryDelaySeconds: 0,
      allowFallback: false
    }
  },
  {
    slug: "hd-upscale",
    version: 1,
    name: "HD Upscale",
    category: "Enhancement",
    description: "Upscale blurry or low-resolution product images into sharper, cleaner, ecommerce-ready visuals.",
    creditCost: 2,
    status: "active",
    providerKey: "replicate",
    fallbackProviderKeys: [],
    inputRules: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSizeMb: 12,
      maxWidth: 6000,
      maxHeight: 6000
    },
    retryPolicy: {
      maxRetries: 1,
      timeoutSeconds: 90,
      retryDelaySeconds: 8,
      allowFallback: false
    }
  },
  {
    slug: "object-remover",
    version: 1,
    name: "Object Remover",
    category: "Ecommerce",
    description: "Remove unwanted objects, cables, props, stains, dust, and distracting background items from product photos.",
    creditCost: 4,
    status: "active",
    providerKey: "replicate",
    fallbackProviderKeys: [],
    inputRules: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSizeMb: 12,
      maxWidth: 6000,
      maxHeight: 6000
    },
    retryPolicy: {
      maxRetries: 1,
      timeoutSeconds: 120,
      retryDelaySeconds: 8,
      allowFallback: false
    }
  },
  {
    slug: "ai-background-replacer",
    version: 1,
    name: "AI Background Replacer",
    category: "Ecommerce",
    description: "Replace boring product backgrounds with premium studio, marble, skincare, and lifestyle ecommerce scenes.",
    creditCost: 4,
    status: "active",
    providerKey: "replicate",
    fallbackProviderKeys: [],
    inputRules: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSizeMb: 12,
      maxWidth: 6000,
      maxHeight: 6000
    },
    retryPolicy: {
      maxRetries: 1,
      timeoutSeconds: 150,
      retryDelaySeconds: 8,
      allowFallback: false
    }
  },
  {
    slug: "ai-ad-creative-generator",
    version: 1,
    name: "AI Ad Creative Generator",
    category: "Ecommerce",
    description: "Generate ready-to-use ecommerce ad creatives for Instagram, Facebook, TikTok Shop, Shopify banners, and product launches.",
    creditCost: 6,
    status: "active",
    providerKey: "replicate",
    fallbackProviderKeys: [],
    inputRules: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSizeMb: 12,
      maxWidth: 6000,
      maxHeight: 6000
    },
    retryPolicy: {
      maxRetries: 1,
      timeoutSeconds: 150,
      retryDelaySeconds: 8,
      allowFallback: false
    }
  },
  {
    slug: "ai-headshot-generator",
    version: 1,
    name: "AI Headshot Generator",
    category: "Portrait",
    description: "Create polished headshots for profiles, resumes, and social media.",
    creditCost: 8,
    status: "active",
    providerKey: "replicate",
    fallbackProviderKeys: ["openai"],
    inputRules: {
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSizeMb: 12,
      maxWidth: 6000,
      maxHeight: 6000
    },
    retryPolicy: {
      maxRetries: 1,
      timeoutSeconds: 120,
      retryDelaySeconds: 15,
      allowFallback: true
    }
  }
];
