import Link from "next/link";
import { ArrowUpRight, ImageIcon, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { initialTools } from "@/config/tools";

export function ToolGrid() {
  return (
    <section className="section-band py-12 md:py-20">
      <div className="section-shell">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">Product photo tools</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
              Six focused workflows for product sellers.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-300">
            Start with background removal, enhancement, HD upscaling, marketplace framing, studio shadows, and premium relighting for ecommerce images.
          </p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {initialTools
            .filter((tool) => ["background-remover", "ai-photo-enhancer", "hd-upscale", "marketplace-crop", "product-shadow", "ai-relight"].includes(tool.slug))
            .map((tool, index) => (
            <Link key={tool.slug} href={`/tools/${tool.slug}`} className="group block">
              <Card className="cinematic-card-hover relative h-full overflow-hidden p-5">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(32,211,255,.18),rgba(139,92,246,.18))] text-cyan ring-1 ring-white/10">
                    {index % 2 === 0 ? <Wand2 size={20} /> : <ImageIcon size={20} />}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-slate-100">
                    Preview first
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-black text-white">{tool.name}</h3>
                <p className="mt-2 min-h-16 text-sm leading-6 text-slate-300">{tool.description}</p>
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                  <p className="text-xs font-bold uppercase text-cyan">{tool.creditCost} credits for clean export</p>
                  <span className="grid size-8 place-items-center rounded-full bg-white/10 text-white transition group-hover:bg-cyan group-hover:text-ink">
                    <ArrowUpRight size={15} />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
