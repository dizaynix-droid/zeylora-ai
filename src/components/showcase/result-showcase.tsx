import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showcaseExamples } from "@/config/showcase";
import { BeforeAfterSlider } from "./before-after-slider";

const storyPoints = [
  "Amazon sellers can sharpen catalog assets and prepare clean marketplace frames.",
  "Shopify stores can relight dull product photos before publishing PDP visuals.",
  "Etsy and TikTok Shop sellers can preview branded edits before clean exports.",
  "Signed preview/download links and dashboard history keep production organized."
] as const;

const useCases = ["Shopify", "Amazon", "Etsy", "TikTok Shop", "Perfume", "Skincare"] as const;

export function ResultShowcase() {
  const featuredExamples = showcaseExamples.slice(0, 2);
  const compactExamples = showcaseExamples.slice(2);

  return (
    <section className="section-band py-12 md:py-20">
      <div className="section-shell">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="eyebrow">
              <Sparkles size={14} />
              Ecommerce product studio
            </p>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-white md:text-5xl">
              Lead with sharper, brighter, more premium product visuals.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">
              Real seller workflows first: upscale low-res listing images, relight dull product shots, polish cosmetics and perfume photos, then frame assets for Amazon, Shopify, Etsy, and TikTok Shop.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {useCases.map((useCase) => (
                <span key={useCase} className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-black text-slate-200">
                  {useCase}
                </span>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-4 md:p-5">
            <div className="grid gap-3">
              {storyPoints.map((point) => (
                <p key={point} className="flex items-start gap-3 text-sm font-semibold leading-6 text-slate-200">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald" size={17} />
                  {point}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {featuredExamples.map((example, index) => (
            <article
              key={example.slug}
              className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,.07),rgba(32,211,255,.035),rgba(139,92,246,.045))] p-3 shadow-cinematic lg:p-4"
            >
              <BeforeAfterSlider
                before={example.before}
                after={example.after}
                title={example.title}
                beforeLabel={example.beforeLabel}
                afterLabel={example.afterLabel}
                priority={index === 0}
              />

              <div className="grid gap-5 p-2 pt-5 lg:grid-cols-[1fr_auto] lg:items-end lg:p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="rounded-full bg-cyan/10 px-3 py-1 text-xs font-black uppercase text-cyan">{example.tool}</p>
                    <p className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black uppercase text-slate-300">
                      {example.metric}
                    </p>
                  </div>
                  <h3 className="mt-3 text-2xl font-black leading-tight text-white">
                    {example.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{example.promise}</p>
                  <p className="mt-4 inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black uppercase text-slate-300">
                    Seller use: {example.useCase}
                  </p>
                </div>

                <div className="min-w-[190px]">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-2xl font-black text-white">{example.afterLabel}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-slate-400">{example.metricLabel}</p>
                  </div>
                  <Button href="#upload" className="mt-4 h-12 w-full">
                    Start with a preview
                    <ArrowRight className="ml-2" size={18} />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {compactExamples.map((example) => (
            <article
              key={example.slug}
              className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-3 shadow-cinematic"
            >
              <BeforeAfterSlider
                before={example.before}
                after={example.after}
                title={example.title}
                beforeLabel={example.beforeLabel}
                afterLabel={example.afterLabel}
                priority={false}
              />
              <div className="p-2 pt-4">
                <p className="text-xs font-black uppercase text-cyan">{example.tool}</p>
                <h3 className="mt-2 text-xl font-black leading-tight text-white">{example.afterLabel}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{example.promise}</p>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <p className="text-[11px] font-black uppercase text-slate-400">{example.metricLabel}</p>
                  <a href="#upload" className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white transition hover:bg-cyan hover:text-ink">
                    Try
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
