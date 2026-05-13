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
    title: "Recover blurry product photos into sharper HD listing assets.",
    tool: "HD Upscale",
    promise: "Turn small, compressed, or soft product images into sharper ecommerce visuals with clearer edges, cleaner details, and stronger product presentation.",
    before: "/showcase/hd-upscale-before.png",
    after: "/showcase/hd-upscale-after.png",
    metric: "Recommended",
    metricLabel: "4x Ultra, sharper detail, artifact cleanup",
    useCase: "Amazon listings, Shopify PDPs, TikTok Shop product images",
    beforeLabel: "Blurry low-res",
    afterLabel: "Sharp HD export"
  },
  {
    slug: "ai-relight",
    title: "Turn dull product lighting into a premium studio-lit look.",
    tool: "AI Relight",
    promise: "Brighten dark, flat, or uneven product photos so bottles, cosmetics, jewelry, and accessories feel cleaner and more premium for ads.",
    before: "/showcase/ai-relight-before.png",
    after: "/showcase/ai-relight-after.png",
    metric: "Popular",
    metricLabel: "Luxury Glow, studio balance, product focus",
    useCase: "Shopify stores, Etsy listings, TikTok Shop ads",
    beforeLabel: "Dull dark lighting",
    afterLabel: "Studio relit"
  },
  {
    slug: "catalog-photo-prep",
    title: "Polish dull catalog photos into sharper product visuals.",
    tool: "Photo Enhancer",
    promise: "Improve compressed or soft catalog images with cleaner clarity, brighter product detail, and a more polished ecommerce finish.",
    before: "/showcase/photo-enhancer-before.jpg",
    after: "/showcase/photo-enhancer-after.png",
    metric: "Details enhanced",
    metricLabel: "clarity, brightness, catalog polish",
    useCase: "Cosmetics, perfume, Shopify catalog PDPs",
    beforeLabel: "Dull compressed",
    afterLabel: "Clear catalog polish"
  },
  {
    slug: "marketplace-crop",
    title: "Frame product photos into marketplace-ready formats.",
    tool: "Marketplace Crop",
    promise: "Resize and frame product photos for Shopify, Amazon, Etsy, TikTok Shop, and social ads, with a clean white-frame preset for listings.",
    before: "/showcase/marketplace-crop-before.png",
    after: "/showcase/marketplace-crop-after.png",
    metric: "Marketplace ready",
    metricLabel: "white frame, 1:1, 4:5, 9:16, 16:9",
    useCase: "Amazon white frames, Shopify grids, Etsy listings",
    beforeLabel: "Original frame",
    afterLabel: "Marketplace frame"
  },
  {
    slug: "ecommerce-background-removal",
    title: "Clean supporting cutouts for product listings.",
    tool: "Background Remover",
    promise: "Remove distracting backgrounds for objects and clean foregrounds. Best used as a supporting cutout workflow, not overpromised for complex human poses.",
    before: "/showcase/background-remover-before.png",
    after: "/showcase/background-remover-after.png",
    metric: "Cutout workflow",
    metricLabel: "object cutouts and clean frames",
    useCase: "Jewelry, shoes, cosmetics, clean Amazon assets",
    beforeLabel: "Cluttered background",
    afterLabel: "Background removed"
  },
  {
    slug: "product-shadow",
    title: "Creative shadow looks for flat product cutouts.",
    tool: "Product Shadow",
    promise: "Add creative catalog-style grounding and depth to clean product cutouts. Kept as a beta-style support tool for lightweight creative looks.",
    before: "/showcase/product-shadow-before.png",
    after: "/showcase/product-shadow-after.png",
    metric: "Beta look",
    metricLabel: "creative shadow, grounding, catalog feel",
    useCase: "Creative PDP images, catalog tiles, ad tests",
    beforeLabel: "Flat product",
    afterLabel: "Studio shadow"
  }
];
