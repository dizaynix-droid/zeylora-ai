import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, ImageIcon, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { initialTools } from "@/config/tools";

const launchToolOrder = [
  "hd-upscale",
  "ai-relight",
  "ai-photo-enhancer",
  "object-remover",
  "ai-background-replacer",
  "ai-ad-creative-generator",
  "marketplace-crop",
  "background-remover",
  "product-shadow"
] as const;

const toolBadges: Partial<Record<(typeof launchToolOrder)[number], { label: string; tone: "primary" | "popular" | "creative" }>> = {
  "hd-upscale": { label: "Recommended", tone: "primary" },
  "ai-relight": { label: "Popular", tone: "popular" },
  "ai-background-replacer": { label: "New", tone: "primary" },
  "ai-ad-creative-generator": { label: "Marketing", tone: "popular" },
  "product-shadow": { label: "Beta look", tone: "creative" }
};

const toolPositioning: Partial<Record<(typeof launchToolOrder)[number], string>> = {
  "hd-upscale": "Best first test: 4x Ultra and Social Cleanup are strong for low-res product assets.",
  "ai-relight": "Seller-friendly lighting polish with Luxury Glow as the standout preset.",
  "ai-photo-enhancer": "Premium catalog polish for cosmetics, perfume, and product detail shots.",
  "object-remover": "Cleanup tool for cables, props, stains, dust, and distracting background items.",
  "ai-background-replacer": "Replace boring backgrounds with premium studio, marble, skincare, and ecommerce scenes.",
  "ai-ad-creative-generator": "Turn a product photo into campaign-ready visuals for ads, stories, banners, and launches.",
  "marketplace-crop": "Stable ecommerce utility with a strong white-frame marketplace preset.",
  "background-remover": "Useful cutout workflow for objects and clean foregrounds.",
  "product-shadow": "Creative shadow styling for launch; best with clean cutouts."
};

const toolVisuals: Partial<Record<(typeof launchToolOrder)[number], string>> = {
  "hd-upscale": "/showcase/hd-upscale-after.png",
  "ai-relight": "/showcase/ai-relight-after.png",
  "ai-photo-enhancer": "/showcase/photo-enhancer-after.png",
  "object-remover": "/showcase/background-remover-after.png",
  "ai-background-replacer": "/showcase/ai-relight-after.png",
  "ai-ad-creative-generator": "/showcase/photo-enhancer-after.png",
  "marketplace-crop": "/showcase/marketplace-crop-after.png",
  "background-remover": "/showcase/background-remover-after.png",
  "product-shadow": "/showcase/product-shadow-after.png"
};

export function ToolGrid() {
  const launchTools = launchToolOrder
    .map((slug) => initialTools.find((tool) => tool.slug === slug))
    .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));

  return (
    <section className="section-band py-9 md:py-20">
      <div className="section-shell">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">Product photo tools</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:mt-4 md:text-5xl">
              Start with the strongest ecommerce workflows.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-300">
            HD Upscale, AI Relight, and Photo Enhancer are the premium launch workflows. Background replacement, ad creatives, cleanup, crop, and cutout tools support the full seller production flow.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:mt-9 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
          {launchTools.map((tool, index) => {
            const badge = toolBadges[tool.slug as (typeof launchToolOrder)[number]];
            const visual = toolVisuals[tool.slug as (typeof launchToolOrder)[number]] ?? "/showcase/product-after.png";
            return (
            <Link key={tool.slug} href={`/tools/${tool.slug}`} className="group block">
              <Card className="cinematic-card-hover relative h-full overflow-hidden p-3 md:p-4">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                  <Image
                    src={visual}
                    alt={`${tool.name} ecommerce workflow preview`}
                    fill
                    className="object-cover transition duration-700 group-hover:scale-[1.035]"
                    sizes="(min-width: 1280px) 360px, (min-width: 768px) 45vw, 100vw"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(3,5,13,.72))]" />
                  <span className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/75 backdrop-blur">
                    Seller workflow
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="mt-4 grid size-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(32,211,255,.18),rgba(139,92,246,.18))] text-cyan ring-1 ring-white/10">
                    {index % 2 === 0 ? <Wand2 size={18} /> : <ImageIcon size={18} />}
                  </span>
                  <span className={`mt-4 rounded-full border px-3 py-1 text-xs font-black ${
                    badge?.tone === "primary"
                      ? "border-cyan/30 bg-cyan text-ink"
                      : badge?.tone === "popular"
                        ? "border-fuchsia/30 bg-fuchsia/15 text-fuchsia"
                        : badge?.tone === "creative"
                          ? "border-warning/30 bg-warning/10 text-warning"
                          : "border-white/10 bg-white/10 text-slate-100"
                  }`}>
                    {badge?.label ?? "Seller tool"}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-black text-white md:text-xl">{tool.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300 md:min-h-16">{tool.description}</p>
                <p className="mt-3 text-xs font-semibold leading-5 text-slate-400 md:min-h-12">
                  {toolPositioning[tool.slug as (typeof launchToolOrder)[number]]}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                  <p className="text-xs font-bold uppercase text-cyan">{tool.creditCost} credits per clean workflow</p>
                  <span className="grid size-8 place-items-center rounded-full bg-white/10 text-white transition group-hover:bg-cyan group-hover:text-ink">
                    <ArrowUpRight size={15} />
                  </span>
                </div>
              </Card>
            </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
