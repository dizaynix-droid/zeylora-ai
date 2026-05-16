import { ArrowRight, CheckCircle2, CreditCard, History, Lock, Share2, ShieldCheck, Sparkles, UploadCloud, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { Card } from "@/components/ui/card";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";

const buyerProof: Array<[string, string, LucideIcon]> = [
  ["Private uploads", "Your product images are stored privately and served through signed links.", Lock],
  ["Clean export ownership", "Unlocked clean files can be downloaded again without another credit charge.", ShieldCheck],
  ["Dashboard history", "Every completed edit stays organized in your customer workspace.", History],
  ["Creator Program", "Invite other sellers and earn platform credits from successful referrals.", Share2]
];

export async function PlatformSections() {
  const creditPackages = await getCreditPackagesForDisplay();
  const trialPack = creditPackages.find((pack) => pack.key === "starter-trial") ?? creditPackages[0];
  const trialCredits = trialPack?.totalCredits ?? 15;
  const trialPrice = trialPack?.price ?? 7.99;

  return (
    <>
      <section className="section-shell py-9 md:py-16">
        <div className="grid gap-4 md:grid-cols-3">
          <WorkflowCard
            icon={UploadCloud}
            step="01"
            title="Upload a real product photo"
            text="Use a product shot from your store, supplier, phone, or marketplace listing."
          />
          <WorkflowCard
            icon={Wand2}
            step="02"
            title="Choose the right workflow"
            text="Upscale, relight, enhance, crop, cleanup, cutout, or add a catalog-style shadow."
          />
          <WorkflowCard
            icon={CreditCard}
            step="03"
            title="Export clean files with credits"
            text="Start with the trial pack, then unlock watermark-free exports for your store."
          />
        </div>
      </section>

      <section className="section-shell py-8 md:py-20">
        <div className="premium-ring rounded-[2rem]">
          <div className="glass-panel overflow-hidden rounded-[2rem] p-4 md:p-7">
            <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="eyebrow">
                  <CreditCard size={14} />
                  Start here
                </p>
                <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white md:text-5xl">
                  A simple paid test for serious sellers.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base md:leading-8">
                  No unlimited free abuse. No subscription trap. Buy credits once, test real product photos, and keep clean exports in your dashboard.
                </p>
                <div className="mt-5 grid gap-3">
                  {[
                    `${trialCredits} credits for $${trialPrice}`,
                    "One-time purchase, no subscription",
                    "Clean exports without Zeylora watermark",
                    "Re-download unlocked files without paying again"
                  ].map((item) => (
                    <p key={item} className="flex items-start gap-3 text-sm font-bold leading-6 text-slate-200">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-emerald" size={17} />
                      {item}
                    </p>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {creditPackages.slice(0, 4).map((pack) => (
                  <Card
                    key={pack.key}
                    className={pack.highlight ? "premium-ring cinematic-card-hover p-5" : "cinematic-card-hover p-5"}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-2xl font-black text-white">{pack.name}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{pack.description}</p>
                      </div>
                      {pack.badgeText ? (
                        <span className="shrink-0 rounded-full bg-cyan px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-ink">
                          {pack.badgeText}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
                      <div>
                        <p className="text-4xl font-black text-white">${pack.price}</p>
                        <p className="mt-1 text-sm font-black text-cyan">
                          {pack.totalCredits} credits{pack.bonusCredits ? ` (${pack.credits} + ${pack.bonusCredits} bonus)` : ""}
                        </p>
                      </div>
                      <p className="text-right text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                        one time
                      </p>
                    </div>
                    <CheckoutButton
                      packageId={pack.id}
                      label={pack.key === "starter-trial" ? `Start with ${pack.totalCredits} Credits` : "Buy credits"}
                      className={
                        pack.highlight
                          ? "mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                          : "mt-5 inline-flex h-12 w-full items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 px-4 text-sm font-black text-cyan transition hover:bg-cyan/15 disabled:cursor-not-allowed disabled:opacity-70"
                      }
                    />
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-band py-10 md:py-20">
        <div className="section-shell">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="eyebrow">
                <Sparkles size={14} />
                Built for buyer intent
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                Not a free AI toy. A product photo sales workflow.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base md:leading-8">
                Zeylora is intentionally credit-based from the first real processing run. That keeps the platform focused on sellers who want cleaner listings, stronger ads, and premium catalog visuals.
              </p>
              <a
                href="/dashboard/affiliate"
                className="mt-5 inline-flex h-12 items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 px-5 text-sm font-black text-cyan transition hover:bg-cyan/15"
              >
                Invite sellers, earn credits
                <ArrowRight className="ml-2" size={17} />
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {buyerProof.map(([title, text, Icon]) => (
                <Card key={title} className="p-4">
                  <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-cyan">
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-4 font-black text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function WorkflowCard({
  icon: Icon,
  step,
  title,
  text
}: {
  icon: LucideIcon;
  step: string;
  title: string;
  text: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(32,211,255,.16),rgba(139,92,246,.14))] text-cyan ring-1 ring-white/10">
          <Icon size={19} />
        </span>
        <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan/70">{step}</span>
      </div>
      <h3 className="mt-5 text-xl font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </Card>
  );
}
