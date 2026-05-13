import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { Card } from "@/components/ui/card";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Pricing",
  description: "Buy Zeylora AI credits for watermark-free clean exports and seller-focused AI product photo workflows.",
  path: "/pricing"
});

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const creditPackages = await getCreditPackagesForDisplay();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-premium-radial py-14">
        <section className="section-shell">
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">
            Buy credits for clean product exports.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Preview edits with Zeylora branding, then use credits to unlock watermark-free clean exports for your store, marketplace, or ad creative.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              ["Free preview", "Generate branded previews before spending credits."],
              ["Clean export", "Credits are spent only when you unlock a watermark-free file."],
              ["Re-downloads", "Unlocked clean exports can be downloaded again without another charge."]
            ].map(([label, copy]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan">{label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{copy}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {creditPackages.map((pack) => (
              <Card key={pack.key} className={pack.highlight ? "premium-ring p-6" : "p-6"}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-black text-white">{pack.name}</h2>
                  {pack.badgeText ? (
                    <span className="rounded-full bg-cyan px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-ink">
                      {pack.badgeText}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-300">{pack.description}</p>
                <p className="mt-6 text-5xl font-black text-white">${pack.price}</p>
                <p className="mt-2 font-bold text-cyan">
                  {pack.totalCredits} credits{pack.bonusCredits ? ` (${pack.bonusCredits} bonus)` : ""}
                </p>
                <p className="mt-2 text-xs font-bold uppercase text-slate-500">one time credits</p>
                <CheckoutButton
                  packageId={pack.id}
                  label="Buy credits"
                  className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-cyan text-sm font-black text-ink transition hover:bg-cyan/90"
                />
              </Card>
            ))}
          </div>

          <Card className="mt-6 p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan">Need more credits?</p>
                <h2 className="mt-2 text-2xl font-black text-white">Bulk credits for catalog teams and larger sellers.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  For bigger Shopify, Amazon, Etsy, or TikTok Shop production runs, contact us for a custom credit package.
                </p>
              </div>
              <a
                href="/contact"
                className="inline-flex h-11 items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 px-5 text-sm font-black text-cyan transition hover:bg-cyan/15"
              >
                Contact us for bulk credits
              </a>
            </div>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
