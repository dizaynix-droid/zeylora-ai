import type { Metadata } from "next";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { CheckoutResume } from "@/components/billing/checkout-resume";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Card } from "@/components/ui/card";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Pricing",
  description: "Buy Zeylora AI email verification credits. 1 credit verifies 1 email.",
  path: "/pricing"
});

export const dynamic = "force-dynamic";

export default async function PricingPage({
  searchParams
}: {
  searchParams?: Promise<{ checkout?: string; checkoutPackage?: string }>;
}) {
  const params = await searchParams;
  const packages = await getCreditPackagesForDisplay();
  const checkoutPackage = sanitizePackageId(params?.checkoutPackage);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-premium-radial py-14">
        <section className="section-shell">
          <CheckoutResume packageId={checkoutPackage} />
          <p className="eyebrow">Verification credits</p>
          <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight text-white md:text-6xl">
            Clean email lists before campaigns hit inboxes.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            1 credit verifies 1 email. Buy once, upload lists anytime, and download valid, invalid, risky, disposable, and full report CSVs.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              ["No subscription", "Buy verification credits once and use them as needed."],
              ["Sender reputation", "Remove invalid and risky emails before sending."],
              ["Clean reports", "Download valid-only, risky/catch-all, invalid-only, or full CSV reports."]
            ].map(([label, copy]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan">{label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{copy}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {packages.map((pack) => (
              <Card key={pack.key} className={pack.highlight ? "premium-ring p-6" : "p-6"}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-black text-white">{pack.name}</h2>
                  {pack.badgeText ? (
                    <span className="rounded-full bg-cyan px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-ink">
                      {pack.badgeText}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 min-h-16 text-sm leading-6 text-slate-300">{pack.description}</p>
                <p className="mt-6 text-5xl font-black text-white">${pack.price}</p>
                <p className="mt-2 font-bold text-cyan">
                  {pack.totalCredits.toLocaleString()} verifications
                  {pack.bonusCredits ? ` (${pack.credits.toLocaleString()} + ${pack.bonusCredits.toLocaleString()} bonus)` : ""}
                </p>
                <p className="mt-2 text-xs font-bold uppercase text-slate-500">one time credits</p>
                <CheckoutButton
                  packageId={pack.id}
                  label={pack.key === "trial" ? "Start Trial Pack" : "Buy credits"}
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
