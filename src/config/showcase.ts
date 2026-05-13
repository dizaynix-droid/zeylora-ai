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
    slug: "hd-upscale",
    title: "Turn low-resolution product photos into sharper HD assets.",
    tool: "HD Upscale",
    promise: "Upscale blurry, compressed, or small product photos into cleaner, sharper ecommerce-ready visuals for listings and social campaigns.",
    before: "/showcase/hd-upscale-before.png",
    after: "/showcase/hd-upscale-after.png",
    metric: "Recommended",
    metricLabel: "4x Ultra, detail, artifact cleanup",
    useCase: "Amazon listings, Shopify PDPs, TikTok Shop images",
    beforeLabel: "Low resolution",
    afterLabel: "HD upscale"
  },
  {
    slug: "ai-relight",
    title: "Give dull product photos a premium studio light direction.",
    tool: "AI Relight",
    promise: "Transform flat or low-light product photos into brighter, cleaner, premium studio-style visuals for marketplace listings and ads.",
    before: "/showcase/ai-relight-before.png",
    after: "/showcase/ai-relight-after.png",
    metric: "Popular",
    metricLabel: "Luxury Glow, studio balance, product focus",
    useCase: "Shopify stores, Etsy listings, TikTok Shop ads",
    beforeLabel: "Flat lighting",
    afterLabel: "Studio relit"
  },
  {
    slug: "catalog-photo-prep",
    title: "Polish cosmetics, perfume, and catalog product images.",
    tool: "Photo Enhancer",
    promise: "Improve dull, compressed, or soft product images so catalog and ad creatives feel brighter, sharper, and more premium.",
    before: "/showcase/photo-enhancer-before.jpg",
    after: "/showcase/photo-enhancer-after.png",
    metric: "Details enhanced",
    metricLabel: "clarity, brightness, polish",
    useCase: "Cosmetics, perfume, Shopify catalog PDPs",
    beforeLabel: "Dull compressed image",
    afterLabel: "Details enhanced"
  },
  {
    slug: "marketplace-crop",
    title: "Marketplace-ready frames, especially clean white ecommerce layouts.",
    tool: "Marketplace Crop",
    promise: "Resize and frame product photos for Shopify, Amazon, Etsy, TikTok Shop, and social ads, with a strong white-frame preset for marketplaces.",
    before: "/showcase/marketplace-crop-before.png",
    after: "/showcase/marketplace-crop-after.png",
    metric: "Marketplace ready",
    metricLabel: "white frame, 1:1, 4:5, 9:16, 16:9",
    useCase: "Amazon white frames, Shopify grids, Etsy listings",
    beforeLabel: "Original frame",
    afterLabel: "Marketplace ready"
  },
  {
    slug: "ecommerce-background-removal",
    title: "Clean product cutouts for ecommerce listings.",
    tool: "Background Remover",
    promise: "Remove distracting scenes and turn product uploads into clean cutouts on transparent or ecommerce-ready backgrounds.",
    before: "/showcase/background-remover-before.png",
    after: "/showcase/background-remover-after.png",
    metric: "Cutout workflow",
    metricLabel: "background cleanup and clean frame",
    useCase: "Jewelry, shoes, cosmetics, clean Amazon assets",
    beforeLabel: "Cluttered background",
    afterLabel: "Background removed"
  },
  {
    slug: "product-shadow",
    title: "Creative shadow looks for flat product cutouts.",
    tool: "Product Shadow",
    promise: "Add creative catalog-style grounding and depth to clean product cutouts. Best used as a lightweight creative look for launch.",
    before: "/showcase/product-shadow-before.png",
    after: "/showcase/product-shadow-after.png",
    metric: "Beta look",
    metricLabel: "creative shadow, grounding, catalog feel",
    useCase: "Creative PDP images, catalog tiles, ad tests",
    beforeLabel: "Flat product",
    afterLabel: "Studio shadow"
  }
];
