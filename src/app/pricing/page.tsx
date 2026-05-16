import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { CheckoutResume } from "@/components/billing/checkout-resume";
import { TrialPackTracker } from "@/components/billing/trial-pack-tracker";
import { Card } from "@/components/ui/card";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Pricing",
  description: "Buy Zeylora AI credits for watermark-free clean exports and seller-focused AI product photo workflows.",
  path: "/pricing"
});

export const dynamic = "force-dynamic";

export default async function PricingPage({
  searchParams
}: {
  searchParams?: Promise<{ trial?: string; checkout?: string; checkoutPackage?: string }>;
}) {
  const params = await searchParams;
  const creditPackages = await getCreditPackagesForDisplay();
  const trialPack = creditPackages.find((pack) => pack.key === "starter-trial") ?? creditPackages[0];
  const trialMode = params?.trial === "1";
  const checkoutPackage = sanitizePackageId(params?.checkoutPackage);

  return (
    <>
      <SiteHeader />
      <TrialPackTracker enabled={trialMode} price={trialPack?.price ?? 7.99} credits={trialPack?.totalCredits ?? 15} />
      <main className="min-h-screen bg-premium-radial py-14">
        <section className="section-shell">
          <CheckoutResume packageId={checkoutPackage} />
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">
            Start with {trialPack?.totalCredits ?? 15} credits. Upgrade your product photos today.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Bad product photos kill conversions. Zeylora turns low-quality uploads into sharper, brighter,
            marketplace-ready visuals for Shopify, Amazon, Etsy, and TikTok Shop.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              ["No subscription", "Buy credits once and use them for professional product-photo workflows."],
              ["Starter trial", `$${trialPack?.price ?? 7.99} gets ${trialPack?.totalCredits ?? 15} credits for your first serious product test.`],
              ["Clean ownership", "Unlocked clean exports can be downloaded again without another charge."]
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
                  {pack.totalCredits} credits{pack.bonusCredits ? ` (${pack.credits} + ${pack.bonusCredits} bonus)` : ""}
                </p>
                <p className="mt-2 text-xs font-bold uppercase text-slate-500">one time credits</p>
                <CheckoutButton
                  packageId={pack.id}
                  label={pack.key === "starter-trial" ? `Start with ${pack.totalCredits} Credits` : "Buy credits"}
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

function sanitizePackageId(value: string | undefined) {
  if (!value) return undefined;
  try {
    const decoded = decodeURIComponent(value);
    if (!/^[a-zA-Z0-9_-]+$/.test(decoded)) return undefined;
    return decoded.slice(0, 120);
  } catch {
    return undefined;
  }
}
