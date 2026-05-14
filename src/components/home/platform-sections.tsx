import { CheckCircle2, Clock3, CreditCard, History, Lock, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";

const trustItems: Array<[string, string, LucideIcon]> = [
  ["Private uploads", "Product photos are stored privately and served through temporary signed links.", Lock],
  ["Six seller workflows", "Upscale, relight, enhance, crop, cutout, and creative shadow tools in one ecommerce studio.", Sparkles],
  ["Dashboard history", "Every completed edit stays available in your workspace.", History],
  ["Credit clean exports", "Credits unlock watermark-free files when the preview is ready.", CreditCard],
  ["Signed downloads", "Preview and export URLs are temporary instead of exposed as raw storage links.", ShieldCheck],
  ["Fast seller workflow", "Upload, preview, adjust, export, and repeat without leaving the page.", Zap],
  ["Free branded preview", "Free previews are visibly branded so clean exports stay credit-based.", CheckCircle2],
  ["Seller-ready formats", "Prepare visuals for Shopify, Amazon, Etsy, TikTok Shop, social ads, and catalog pages.", Clock3]
];

const credibility = [
  "Private uploads",
  "Signed preview and download links",
  "Dashboard history",
  "Credit-based clean exports",
  "Seller-ready workflows"
] as const;

export async function PlatformSections() {
  const creditPackages = await getCreditPackagesForDisplay();

  return (
    <>
      <section id="examples" className="section-shell py-8 md:py-14">
        <div className="glass-panel rounded-2xl p-4 md:rounded-[2rem] md:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1.4fr] md:items-center">
            <div>
              <p className="text-sm font-black uppercase text-cyan">Trust layer</p>
              <h2 className="mt-2 text-2xl font-black text-white">A secure product photo workspace for serious sellers.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
              Upload privately, preview branded edits for free, keep results in your dashboard, and export clean seller-ready assets with credits.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {credibility.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <span className="grid size-8 place-items-center rounded-full bg-emerald/10 text-emerald">
                    <CheckCircle2 size={16} />
                  </span>
                  <span className="text-sm font-bold text-slate-200">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-band py-12 md:py-20">
        <div className="section-shell">
          <div className="mb-6 max-w-2xl md:mb-8">
            <p className="eyebrow">Feature explanation</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:mt-4 md:text-5xl">
              Built for repeat ecommerce product-photo production.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Zeylora focuses on seller workflows first: sharpen low-res assets, improve lighting, polish catalog photos, then prepare exports for Shopify, Etsy, Amazon, TikTok Shop, and social ads.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {trustItems.map(([title, description, Icon]) => (
              <Card key={title} className="cinematic-card-hover p-4 md:p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-cyan">
                  <Icon size={18} />
                </span>
                <h3 className="mt-4 font-black text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell py-9 md:py-20">
        <div className="mb-5 flex flex-col justify-between gap-3 md:mb-7 md:flex-row md:items-end md:gap-4">
          <div>
            <p className="eyebrow">Credit packs</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:mt-4 md:text-5xl">
              Export clean results when the image is ready.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-300">
            Previews are free and watermarked. Credits are used when you want clean files without the Zeylora watermark.
          </p>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {[
            ["1 credit", "One clean export for selected lightweight tools like crop, relight, or shadow."],
            ["2 credits", "HD Upscale and Background Remover use 2 credits for clean exports."],
            ["3 credits", "Photo Enhancer uses 3 credits for a polished clean export."]
          ].map(([label, description]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 md:p-4">
              <p className="text-sm font-black uppercase text-cyan">{label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {creditPackages.slice(0, 4).map((pack) => (
            <Card
              key={pack.key}
              className={pack.highlight ? "premium-ring cinematic-card-hover p-4 md:-mt-4 md:p-6" : "cinematic-card-hover p-4 md:p-6"}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white">{pack.name}</h3>
                {pack.badgeText ? (
                  <span className="rounded-full bg-cyan px-3 py-1 text-xs font-black text-ink">{pack.badgeText}</span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{pack.description}</p>
              <p className="mt-4 text-3xl font-black text-white md:mt-6 md:text-4xl">${pack.price}</p>
              <p className="mt-1 text-sm font-bold text-cyan">
                {pack.totalCredits} credits{pack.bonusCredits ? ` (${pack.credits} + ${pack.bonusCredits} bonus)` : ""}
              </p>
              <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 text-sm text-slate-300 md:mt-5 md:pt-5">
                <p className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald" />
                  Free watermarked previews before export
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald" />
                  Clean exports without Zeylora watermark
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald" />
                  Works across all six product photo tools
                </p>
              </div>
              <Button href="#upload" variant={pack.highlight ? "primary" : "secondary"} className="mt-6 h-11 w-full">
                Start with a preview
              </Button>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
