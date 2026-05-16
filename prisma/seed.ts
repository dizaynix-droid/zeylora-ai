import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const initialTools = [
  {
    slug: "ai-photo-enhancer",
    name: "AI Photo Enhancer",
    category: "Enhancement",
    description: "Improve clarity, lighting, detail, and overall image quality.",
    creditCost: 3,
    outputType: "image"
  },
  {
    slug: "background-remover",
    name: "Background Remover",
    category: "Editing",
    description: "Remove image backgrounds and prepare clean transparent results.",
    creditCost: 2,
    outputType: "image"
  },
  {
    slug: "marketplace-crop",
    name: "Marketplace Crop",
    category: "Ecommerce",
    description: "Resize and frame product photos for Shopify, Amazon, Etsy, and social ads.",
    creditCost: 1,
    outputType: "image"
  },
  {
    slug: "product-shadow",
    name: "Product Shadow",
    category: "Ecommerce",
    description: "Add natural studio shadows and premium depth to product photos for Shopify, Amazon, Etsy, catalog pages, and ads.",
    creditCost: 1,
    outputType: "image"
  },
  {
    slug: "ai-relight",
    name: "AI Relight",
    category: "Ecommerce",
    description: "Transform dull product photos into brighter, cleaner, premium studio-style visuals for Shopify, Amazon, Etsy, ads, and catalog pages.",
    creditCost: 1,
    outputType: "image"
  },
  {
    slug: "hd-upscale",
    name: "HD Upscale",
    category: "Enhancement",
    description: "Upscale blurry or low-resolution product images into sharper, cleaner ecommerce-ready visuals.",
    creditCost: 2,
    outputType: "image"
  },
  {
    slug: "ai-headshot-generator",
    name: "AI Headshot Generator",
    category: "Portrait",
    description: "Create polished profile-ready headshots from user photos.",
    creditCost: 8,
    outputType: "image"
  },
  {
    slug: "old-photo-restorer",
    name: "Old Photo Restorer",
    category: "Restoration",
    description: "Repair scratches, fading, and aging in old photographs.",
    creditCost: 5,
    outputType: "image"
  },
  {
    slug: "object-remover",
    name: "Object Remover",
    category: "Ecommerce",
    description: "Remove unwanted objects, cables, props, stains, dust, and distracting background items from product photos.",
    creditCost: 4,
    outputType: "image"
  },
  {
    slug: "ai-background-replacer",
    name: "AI Background Replacer",
    category: "Ecommerce",
    description: "Replace boring or ugly product backgrounds with premium studio and lifestyle ecommerce scenes.",
    creditCost: 4,
    outputType: "image"
  },
  {
    slug: "ai-ad-creative-generator",
    name: "AI Ad Creative Generator",
    category: "Marketing",
    description: "Turn product photos into ready-to-use ecommerce ad creatives for social, marketplace, and store campaigns.",
    creditCost: 6,
    outputType: "image"
  },
  {
    slug: "cartoon-anime-generator",
    name: "Cartoon / Anime Generator",
    category: "Style",
    description: "Transform photos into cinematic cartoon or anime-inspired styles.",
    creditCost: 6,
    outputType: "image"
  },
  {
    slug: "photo-colorizer",
    name: "Black and White Photo Colorizer",
    category: "Restoration",
    description: "Add natural-looking color to black and white photographs.",
    creditCost: 4,
    outputType: "image"
  }
];

async function main() {
  const testUser = await prisma.user.upsert({
    where: { email: "dev-upload-tester@zeylora.local" },
    update: {
      status: "ACTIVE",
      deletedAt: null
    },
    create: {
      email: "dev-upload-tester@zeylora.local",
      name: "Dev Upload Tester",
      role: "USER",
      creditBalance: 25,
      status: "ACTIVE",
      affiliateCode: "DEVUPLOAD"
    }
  });

  console.log(`Dev upload test user id: ${testUser.id}`);

  await prisma.siteSetting.upsert({
    where: { key: "maintenance_mode" },
    update: {},
    create: {
      key: "maintenance_mode",
      valueJson: {
        enabled: false,
        message: "We are improving the studio. Please check back soon.",
        allowAdminAccess: true
      }
    }
  });

  await prisma.siteSetting.upsert({
    where: { key: "free_trial" },
    update: {},
    create: {
      key: "free_trial",
      valueJson: {
        enabled: false,
        credits: 0,
        dailyFreeUsageLimit: 1
      }
    }
  });

  for (const creditPackage of [
    { name: "Starter", credits: 20, price: "19.00", currency: "usd", sortOrder: 1, featureFlagKey: "pricing_pack_starter" },
    { name: "Creator", credits: 50, price: "39.00", currency: "usd", sortOrder: 2, featureFlagKey: "pricing_pack_creator" },
    { name: "Pro Seller", credits: 120, price: "79.00", currency: "usd", sortOrder: 3, featureFlagKey: "pricing_pack_pro_seller" },
    { name: "Business", credits: 260, price: "149.00", currency: "usd", sortOrder: 4, featureFlagKey: "pricing_pack_business" }
  ]) {
    const existing = await prisma.creditPackage.findFirst({
      where: { name: creditPackage.name, deletedAt: null },
      select: { id: true }
    });

    if (existing) {
      await prisma.creditPackage.update({
        where: { id: existing.id },
        data: creditPackage
      });
    } else {
      await prisma.creditPackage.create({ data: creditPackage });
    }
  }

  for (const tool of initialTools) {
    await prisma.aiTool.upsert({
      where: {
        slug_version: {
          slug: tool.slug,
          version: 1
        }
      },
      update: {},
      create: {
        ...tool,
        version: 1,
        status: "ACTIVE",
        inputRulesJson: {
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
          maxFileSizeMb: 12,
          maxWidth: 6000,
          maxHeight: 6000
        },
        providerKey: ["marketplace-crop", "product-shadow", "ai-relight"].includes(tool.slug) ? "local-sharp" : "replicate",
        providerConfigJson: {
          model: ["marketplace-crop", "product-shadow", "ai-relight"].includes(tool.slug)
            ? "sharp-local-transform"
            : tool.slug === "hd-upscale"
              ? "nightmareai/real-esrgan"
              : tool.slug === "object-remover"
                ? "adirik/inst-inpaint"
                : tool.slug === "ai-background-replacer"
                  ? process.env.AI_BACKGROUND_REPLACER_MODEL || "black-forest-labs/flux-kontext-pro"
                  : tool.slug === "ai-ad-creative-generator"
                    ? process.env.AI_AD_CREATIVE_MODEL || "black-forest-labs/flux-kontext-pro"
                    : "",
          promptTemplate: "",
          outputFormat: ["marketplace-crop", "product-shadow", "ai-relight", "object-remover", "ai-background-replacer", "ai-ad-creative-generator"].includes(tool.slug) ? "png" : "webp"
        },
        fallbackProviderKeysJson: ["marketplace-crop", "product-shadow", "ai-relight"].includes(tool.slug) ? [] : ["openai", "stability"],
        retryPolicyJson: {
          maxRetries: 2,
          timeoutSeconds: 90,
          retryDelaySeconds: 10,
          allowFallback: true
        },
        seoTitle: `${tool.name} - AI Photo Editing Tool`,
        seoDescription: tool.description,
        landingContentJson: {
          hero: tool.description,
          faqs: []
        },
        exampleImagesJson: []
      }
    });
  }

  await prisma.featureFlag.createMany({
    data: [
      {
        key: "upload_flow",
        name: "Upload Flow",
        description: "Controls access to the core upload experience.",
        scope: "GLOBAL",
        enabled: true
      },
      {
        key: "credit_checkout",
        name: "Credit Checkout",
        description: "Controls credit package checkout visibility.",
        scope: "PRICING",
        enabled: false
      },
      {
        key: "language_tr",
        name: "Turkish Language",
        description: "Future Turkish localization switch.",
        scope: "LANGUAGE",
        enabled: false
      }
    ],
    skipDuplicates: true
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
