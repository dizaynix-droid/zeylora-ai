import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card } from "@/components/ui/card";
import { creditPackages } from "@/config/pricing";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Pricing",
  description: "Preview Zeylora AI credit packs for future watermark-free exports, paid credits, and seller-focused AI photo workflows.",
  path: "/pricing"
});

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-premium-radial py-14">
        <section className="section-shell">
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">
            Start with credits. Scale into plans later.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Phase 1 prepares credit packages, Stripe-ready IDs, future coupons, and subscription-ready database structure.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {creditPackages.map((pack) => (
              <Card key={pack.key} className={pack.highlight ? "premium-ring p-6" : "p-6"}>
                <h2 className="text-2xl font-black text-white">{pack.name}</h2>
                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-300">{pack.description}</p>
                <p className="mt-6 text-5xl font-black text-white">${pack.price}</p>
                <p className="mt-2 font-bold text-cyan">
                  {pack.credits + pack.bonusCredits} credits{pack.bonusCredits ? ` (${pack.bonusCredits} bonus)` : ""}
                </p>
                <p className="mt-2 text-xs font-bold uppercase text-slate-500">{pack.billingModel.replaceAll("_", " ")}</p>
                <button className="mt-6 h-11 w-full rounded-full bg-cyan text-sm font-black text-ink transition hover:bg-cyan/90">
                  Coming soon
                </button>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
