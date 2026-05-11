export type ShowcaseExample = {
  slug: string;
  title: string;
  tool: string;
  promise: string;
  before: string;
  after: string;
  metric: string;
  metricLabel: string;
  useCase: string;
  beforeLabel: string;
  afterLabel: string;
};

export const showcaseExamples: ShowcaseExample[] = [
  {
    slug: "ecommerce-background-removal",
    title: "Clean product cutouts for ecommerce listings.",
    tool: "Background Remover",
    promise: "Remove distracting scenes and turn product uploads into clean cutouts on transparent or ecommerce-ready backgrounds.",
    before: "/showcase/background-remover-before.png",
    after: "/showcase/background-remover-after.png",
    metric: "Background removed",
    metricLabel: "cutout and clean frame",
    useCase: "Cosmetics, perfume, jewelry, shoes",
    beforeLabel: "Cluttered background",
    afterLabel: "Background removed"
  },
  {
    slug: "catalog-photo-prep",
    title: "Catalog visuals with a luxury studio direction.",
    tool: "Photo Enhancer",
    promise: "Improve dull, compressed, or soft product images so catalog and ad creatives feel brighter, sharper, and more premium.",
    before: "/showcase/photo-enhancer-before.jpg",
    after: "/showcase/photo-enhancer-after.png",
    metric: "Details enhanced",
    metricLabel: "clarity, brightness, polish",
    useCase: "Catalog, social, marketplace PDPs",
    beforeLabel: "Dull compressed image",
    afterLabel: "Details enhanced"
  },
  {
    slug: "marketplace-crop",
    title: "Marketplace-ready frames for every channel.",
    tool: "Marketplace Crop",
    promise: "Resize and frame product photos for Shopify, Amazon, Etsy, and social ads.",
    before: "/showcase/marketplace-crop-before.png",
    after: "/showcase/marketplace-crop-after.png",
    metric: "Marketplace ready",
    metricLabel: "1:1, 4:5, 9:16, 16:9, white frame",
    useCase: "Shopify, Amazon, Etsy, social ads",
    beforeLabel: "Original frame",
    afterLabel: "Marketplace ready"
  },
  {
    slug: "product-shadow",
    title: "Studio depth for flat product cutouts.",
    tool: "Product Shadow",
    promise: "Add natural shadows and premium grounding so product photos feel ready for Shopify, Amazon, Etsy, catalogs, and ads.",
    before: "/showcase/product-shadow-before.png",
    after: "/showcase/product-shadow-after.png",
    metric: "Studio shadow",
    metricLabel: "grounding, depth, catalog feel",
    useCase: "Catalog pages, PDPs, ads",
    beforeLabel: "Flat product",
    afterLabel: "Studio shadow"
  },
  {
    slug: "ai-relight",
    title: "Studio lighting for dull product photos.",
    tool: "AI Relight",
    promise: "Transform flat or low-light product photos into brighter, cleaner, premium studio-style visuals for marketplace listings and ads.",
    before: "/showcase/ai-relight-before.png",
    after: "/showcase/ai-relight-after.png",
    metric: "Studio relit",
    metricLabel: "brightness, contrast, premium focus",
    useCase: "Shopify, Amazon, Etsy, catalog ads",
    beforeLabel: "Flat lighting",
    afterLabel: "Studio relit"
  },
  {
    slug: "hd-upscale",
    title: "Sharper exports from low-resolution product images.",
    tool: "HD Upscale",
    promise: "Upscale blurry, compressed, or small product photos into cleaner, sharper ecommerce-ready visuals for listings and social campaigns.",
    before: "/showcase/hd-upscale-before.png",
    after: "/showcase/hd-upscale-after.png",
    metric: "HD upscale",
    metricLabel: "sharpness, detail, artifact cleanup",
    useCase: "Ecommerce, social, low-res product photos",
    beforeLabel: "Low resolution",
    afterLabel: "HD upscale"
  }
];
