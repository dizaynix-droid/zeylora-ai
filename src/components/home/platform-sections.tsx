import { CheckCircle2, Clock3, CreditCard, History, Lock, Share2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { Card } from "@/components/ui/card";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";

function getTrustItems(trialCredits: number): Array<[string, string, LucideIcon]> {
  return [
  ["Private uploads", "Product photos are stored privately and served through temporary signed links.", Lock],
  ["Seven seller workflows", "Upscale, relight, enhance, cleanup, crop, cutout, and creative shadow tools in one ecommerce studio.", Sparkles],
  ["Dashboard history", "Every completed edit stays available in your workspace.", History],
  ["Trial pack access", `Start with ${trialCredits} credits, pay once, and test your first product workflow.`, CreditCard],
  ["Signed downloads", "Preview and export URLs are temporary instead of exposed as raw storage links.", ShieldCheck],
  ["Fast seller workflow", "Upload, preview, adjust, export, and repeat without leaving the page.", Zap],
  ["Buyer-intent workflow", "Processing is credit-based from the first real edit, reducing low-quality free abuse.", CheckCircle2],
  ["Seller-ready formats", "Prepare visuals for Shopify, Amazon, Etsy, TikTok Shop, social ads, and catalog pages.", Clock3],
  ["Creator Program", "Invite sellers and earn Zeylora platform credits when referrals complete successful purchases.", Share2]
  ];
}

const credibility = [
  "Private uploads",
  "Signed preview and download links",
  "Dashboard history",
  "Starter Trial Pack",
  "Seller-ready workflows"
] as const;

export async function PlatformSections() {
  const creditPackages = await getCreditPackagesForDisplay();
  const trialPack = creditPackages.find((pack) => pack.key === "starter-trial") ?? creditPackages[0];
  const trialCredits = trialPack?.totalCredits ?? 15;
  const trialPrice = trialPack?.price ?? 7.99;
  const trustItems = getTrustItems(trialCredits);

  return (
    <>
      <section id="examples" className="section-shell py-8 md:py-14">
        <div className="glass-panel rounded-2xl p-4 md:rounded-[2rem] md:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1.4fr] md:items-center">
            <div>
              <p className="text-sm font-black uppercase text-cyan">Trust layer</p>
              <h2 className="mt-2 text-2xl font-black text-white">A secure product photo workspace for serious sellers.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
              Upload privately, run credit-based product edits, keep results in your dashboard, and export clean seller-ready assets for your store.
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
              Start with a serious first product test.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-300">
            The Starter Trial Pack gives you {trialCredits} credits for ${trialPrice}. No subscription, no long commitment, just a focused test for real ecommerce images.
          </p>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {[
            [`$${trialPrice} trial`, `${trialCredits} credits for your first product test and marketplace-ready workflow.`],
            ["No subscription", "Pay once, use credits, and re-download unlocked clean exports."],
            ["Seller-focused", "Built for Shopify, Amazon, Etsy, TikTok Shop, catalogs, and ads."]
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
                  Credit-based real processing
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald" />
                  Clean exports without Zeylora watermark
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald" />
                  Works across all seven product photo tools
                </p>
              </div>
              <CheckoutButton
                packageId={pack.id}
                label="Buy credits"
                className={
                  pack.highlight
                    ? "mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    : "mt-6 inline-flex h-11 w-full items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 px-4 text-sm font-black text-cyan transition hover:bg-cyan/15 disabled:cursor-not-allowed disabled:opacity-70"
                }
              />
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
