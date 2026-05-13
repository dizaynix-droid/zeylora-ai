import Link from "next/link";
import { ArrowUpRight, ImageIcon, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { initialTools } from "@/config/tools";

const launchToolOrder = [
  "hd-upscale",
  "ai-relight",
  "ai-photo-enhancer",
  "marketplace-crop",
  "background-remover",
  "product-shadow"
] as const;

const toolBadges: Partial<Record<(typeof launchToolOrder)[number], { label: string; tone: "primary" | "popular" | "creative" }>> = {
  "hd-upscale": { label: "Recommended", tone: "primary" },
  "ai-relight": { label: "Popular", tone: "popular" },
  "product-shadow": { label: "Beta look", tone: "creative" }
};

const toolPositioning: Partial<Record<(typeof launchToolOrder)[number], string>> = {
  "hd-upscale": "Best first test: 4x Ultra and Social Cleanup are strong for low-res product assets.",
  "ai-relight": "Seller-friendly lighting polish with Luxury Glow as the standout preset.",
  "ai-photo-enhancer": "Premium catalog polish for cosmetics, perfume, and product detail shots.",
  "marketplace-crop": "Stable ecommerce utility with a strong white-frame marketplace preset.",
  "background-remover": "Useful cutout workflow for objects and clean foregrounds.",
  "product-shadow": "Creative shadow styling for launch; best with clean cutouts."
};

export function ToolGrid() {
  const launchTools = launchToolOrder
    .map((slug) => initialTools.find((tool) => tool.slug === slug))
    .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));

  return (
    <section className="section-band py-12 md:py-20">
      <div className="section-shell">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">Product photo tools</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
              Start with the strongest ecommerce workflows.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-300">
            HD Upscale, AI Relight, and Photo Enhancer carry the premium launch experience. Crop, cutout, and shadow tools complete the seller workflow.
          </p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {launchTools.map((tool, index) => {
            const badge = toolBadges[tool.slug as (typeof launchToolOrder)[number]];
            return (
            <Link key={tool.slug} href={`/tools/${tool.slug}`} className="group block">
              <Card className="cinematic-card-hover relative h-full overflow-hidden p-5">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(32,211,255,.18),rgba(139,92,246,.18))] text-cyan ring-1 ring-white/10">
                    {index % 2 === 0 ? <Wand2 size={20} /> : <ImageIcon size={20} />}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${
                    badge?.tone === "primary"
                      ? "border-cyan/30 bg-cyan text-ink"
                      : badge?.tone === "popular"
                        ? "border-fuchsia/30 bg-fuchsia/15 text-fuchsia"
                        : badge?.tone === "creative"
                          ? "border-warning/30 bg-warning/10 text-warning"
                          : "border-white/10 bg-white/10 text-slate-100"
                  }`}>
                    {badge?.label ?? "Preview first"}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-black text-white">{tool.name}</h3>
                <p className="mt-2 min-h-16 text-sm leading-6 text-slate-300">{tool.description}</p>
                <p className="mt-3 min-h-12 text-xs font-semibold leading-5 text-slate-400">
                  {toolPositioning[tool.slug as (typeof launchToolOrder)[number]]}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                  <p className="text-xs font-bold uppercase text-cyan">{tool.creditCost} credits for clean export</p>
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
