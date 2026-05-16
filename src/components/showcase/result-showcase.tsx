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
  const heroExample = showcaseExamples.find((example) => example.slug === "catalog-photo-prep") ?? showcaseExamples[0];
  const transformationExamples = [
    heroExample,
    showcaseExamples.find((example) => example.slug === "ai-relight") ?? showcaseExamples[1],
    showcaseExamples.find((example) => example.slug === "ecommerce-background-removal") ?? showcaseExamples[4]
  ];

  return (
    <section className="section-band py-10 md:py-24">
      <div className="section-shell">
        <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">
              <Sparkles size={14} />
              Premium ecommerce transformations
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white md:mt-5 md:text-6xl">
              One strong product image can change the whole store.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 md:text-lg md:leading-8">
              Fewer examples, more proof. Zeylora is built to turn weak ecommerce assets into sharper, brighter, seller-ready visuals that feel premium enough for paid traffic.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {useCases.map((useCase) => (
                <span key={useCase} className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-black text-slate-200">
                  {useCase}
                </span>
              ))}
            </div>
        </div>

        <div className="mt-8 grid gap-5 md:mt-12 md:gap-8">
          {transformationExamples.map((example, index) => (
            <article
              key={example.slug}
              className={`overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,.075),rgba(32,211,255,.03),rgba(139,92,246,.04))] p-3 shadow-cinematic md:rounded-[2.25rem] md:p-5 ${
                index % 2 === 1 ? "lg:[&_.story-grid]:grid-cols-[0.92fr_1.08fr]" : ""
              }`}
            >
              <div className={`story-grid grid gap-5 lg:grid-cols-[1.08fr_0.92fr] lg:items-center ${index % 2 === 1 ? "lg:[&_.visual]:order-2" : ""}`}>
                <div className="visual">
              <BeforeAfterSlider
                before={example.before}
                after={example.after}
                title={example.title}
                beforeLabel={example.beforeLabel}
                afterLabel={example.afterLabel}
                priority={index === 0}
              />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="rounded-full bg-cyan/10 px-3 py-1 text-xs font-black uppercase text-cyan">{example.tool}</p>
                    <p className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black uppercase text-slate-300">
                      {example.metric}
                    </p>
                  </div>
                  <h3 className="mt-3 text-xl font-black leading-tight text-white md:text-2xl">
                    {example.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300 md:mt-4 md:text-base md:leading-8">{example.promise}</p>
                  <div className="mt-5 grid gap-3">
                    {storyPoints.slice(0, 3).map((point) => (
                      <p key={point} className="flex items-start gap-3 text-sm font-semibold leading-6 text-slate-200">
                        <CheckCircle2 className="mt-0.5 shrink-0 text-emerald" size={17} />
                        {point}
                      </p>
                    ))}
                  </div>
                  <p className="mt-4 inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black uppercase text-slate-300">
                    Seller use: {example.useCase}
                  </p>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-2xl font-black text-white">{example.afterLabel}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-slate-400">{example.metricLabel}</p>
                  </div>
                  <Button href="/tools/hd-upscale" className="mt-4 h-11 w-full md:h-12">
                    Start your product test
                    <ArrowRight className="ml-2" size={18} />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
