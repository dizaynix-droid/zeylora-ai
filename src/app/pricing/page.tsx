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

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {creditPackages.map((pack) => (
              <Card key={pack.key} className={pack.highlight ? "premium-ring p-6" : "p-6"}>
                <h2 className="text-2xl font-black text-white">{pack.name}</h2>
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
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
