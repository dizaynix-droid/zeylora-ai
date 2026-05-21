import type { Metadata } from "next";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { CheckoutResume } from "@/components/billing/checkout-resume";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { VerifyBadge, VerifyContainer, VerifyPageShell, VerifyPanel } from "@/components/verify-ui/core";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";
import { createMetadata } from "@/lib/seo";

const pricingFeatures = [
  "SMTP & MX Validation",
  "Disposable Email Detection",
  "Catch-All Detection",
  "CSV Export",
  "Real-Time Verification",
  "Sender Reputation Protection",
  "Usage Based Credits",
  "No Subscription Required"
];

export const metadata: Metadata = createMetadata({
  title: "Email Verification Pricing",
  description:
    "Usage-based pricing for email verification, bulk email list cleaning, email address checks, disposable detection, catch-all detection, and CSV exports.",
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
      <VerifyPageShell>
        <section className="border-b border-slate-200 bg-white">
          <VerifyContainer className="py-12 lg:py-16">
            <CheckoutResume packageId={checkoutPackage} />
            <VerifyBadge tone="blue">Verification credits</VerifyBadge>
            <h1 className="mt-5 max-w-5xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-6xl">
              Clean email lists before campaigns hit inboxes.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              1 credit verifies 1 email. Buy once, upload lists anytime, and download valid, invalid, risky, disposable, and full report CSVs.
            </p>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              {[
                ["No subscription", "Buy verification credits once and use them as needed."],
                ["Sender reputation", "Remove invalid and risky emails before sending."],
                ["Segmented exports", "Download clean CSV segments for reporting and campaign hygiene."]
              ].map(([label, copy]) => (
                <VerifyPanel key={label} className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">{label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
                </VerifyPanel>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {pricingFeatures.map((feature) => (
                <span key={feature} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                  {feature}
                </span>
              ))}
            </div>
          </VerifyContainer>
        </section>

        <section className="bg-[#f7f8fb]">
          <VerifyContainer className="py-10 lg:py-14">
            <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
              {packages.map((pack) => (
                <VerifyPanel key={pack.key} className={`flex h-full flex-col p-5 ${pack.highlight ? "border-blue-300 bg-blue-50" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950">{pack.name}</h2>
                    {pack.badgeText ? <VerifyBadge tone="blue">{pack.badgeText}</VerifyBadge> : null}
                  </div>
                  <p className="mt-3 min-h-20 text-sm leading-6 text-slate-600">{pack.description}</p>
                  <p className="mt-6 text-5xl font-semibold tracking-[-0.04em] text-slate-950">${pack.price}</p>
                  <p className="mt-2 font-semibold text-blue-700">
                    {pack.totalCredits.toLocaleString()} email verifications
                    {pack.bonusCredits ? ` (${pack.credits.toLocaleString()} + ${pack.bonusCredits.toLocaleString()} bonus)` : ""}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {formatCostPerThousand(pack.price, pack.totalCredits)} per 1k verifications
                  </p>
                  <div className="mt-5 grid gap-2 text-sm text-slate-600">
                    <p>Reduce bounce rate before sending.</p>
                    <p>Remove risky, invalid, and disposable emails.</p>
                    <p>Export clean campaign segments.</p>
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">usage based, no subscription</p>
                  <CheckoutButton
                    packageId={pack.id}
                    label={pack.key === "starter" ? "Start here" : "Buy verifications"}
                    className="mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700"
                  />
                </VerifyPanel>
              ))}
            </div>

            <VerifyPanel className="mt-6 p-5">
              <h2 className="text-xl font-semibold text-slate-950">Recommended package calculator</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Example: a 10,000-email list needs 10,000 verification credits, so Scale is the recommended package. Zeylora calculates this automatically when you upload or paste a list.
              </p>
            </VerifyPanel>

            <VerifyPanel className="mt-6 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Need higher volume?</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Need more volume? Contact sales for private verification capacity above 1,000,000 emails.
                  </p>
                </div>
                <a href="/contact" className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Contact sales
                </a>
              </div>
            </VerifyPanel>
          </VerifyContainer>
        </section>
      </VerifyPageShell>
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

function formatCostPerThousand(price: number, credits: number) {
  if (!credits) return "$0.00";
  return `$${((price / credits) * 1000).toFixed(2)}`;
}
