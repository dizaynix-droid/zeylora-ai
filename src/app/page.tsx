import { ArrowRight, BarChart3, Download, MailCheck, ShieldCheck, TrendingDown, UploadCloud } from "lucide-react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { HomepageListChecker } from "@/components/home/homepage-list-checker";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  VerifyAction,
  VerifyBadge,
  VerifyContainer,
  VerifyMetric,
  VerifyPageShell,
  VerifyPanel
} from "@/components/verify-ui/core";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";

export default async function HomePage() {
  const packages = await getCreditPackagesForDisplay();
  const compactPackages = packages.slice(0, 3);

  return (
    <>
      <SiteHeader />
      <VerifyPageShell>
        <section className="border-b border-slate-200 bg-white">
          <VerifyContainer className="grid gap-8 py-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:py-16">
            <div className="max-w-2xl">
              <VerifyBadge tone="blue">Bulk email verification</VerifyBadge>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
                Stop paying to send emails that bounce.
              </h1>
              <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
                Clean invalid, risky, catch-all, disposable, and duplicate addresses before campaigns hit spam folders, waste sends, or damage sender reputation.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <VerifyAction href="/auth/sign-in?next=/dashboard" className="h-12 px-6 text-base">
                  Check my list
                  <ArrowRight size={18} />
                </VerifyAction>
                <VerifyAction href="#how-it-works" variant="secondary" className="h-12 px-6 text-base">
                  See how it works
                </VerifyAction>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <TrustPoint icon={ShieldCheck} label="Private uploads" />
                <TrustPoint icon={MailCheck} label="Bounce risk removal" />
                <TrustPoint icon={Download} label="Segmented CSV exports" />
              </div>
            </div>

            <HomepageListChecker />
          </VerifyContainer>
        </section>

        <section id="results" className="border-b border-slate-200 bg-[#f7f8fb]">
          <VerifyContainer className="grid gap-8 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:py-16">
            <div>
              <VerifyBadge tone="green">Operational proof</VerifyBadge>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                See the bounce risk disappear before you spend on sending.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Upload a messy list, remove the addresses that hurt deliverability, then export clean segments for campaigns, CRMs, and cold email tools.
              </p>
              <div className="mt-6 grid gap-3">
                <OutcomePoint icon={TrendingDown} label="Reduce wasted sends and bounce penalties." />
                <OutcomePoint icon={ShieldCheck} label="Protect sender reputation before a campaign goes live." />
                <OutcomePoint icon={MailCheck} label="Improve inbox placement by keeping risky mail out." />
              </div>
            </div>
            <DashboardPreview />
          </VerifyContainer>
        </section>

        <section id="how-it-works" className="border-b border-slate-200 bg-white">
          <VerifyContainer className="py-12 lg:py-16">
            <div className="mx-auto max-w-3xl text-center">
              <VerifyBadge>Verification workflow</VerifyBadge>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                From raw list to clean sending segments.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                The workflow is built around outcomes: fewer bounces, cleaner campaigns, and export files your team can use immediately.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <WorkflowStep
                icon={UploadCloud}
                title="Upload list"
                copy="Drop a CSV/TXT file or paste emails. Zeylora detects addresses, removes duplicates, and estimates required credits before processing."
              />
              <WorkflowStep
                icon={BarChart3}
                title="Watch quality change"
                copy="See valid rate, bounce risk, catch-all, disposable, and duplicate signals as the list moves through verification."
              />
              <WorkflowStep
                icon={Download}
                title="Download clean results"
                copy="Export valid-only, invalid-only, risky/catch-all, disposable, or a full report with status columns."
              />
            </div>
          </VerifyContainer>
        </section>

        <section id="pricing" className="bg-[#f7f8fb]">
          <VerifyContainer className="py-12 lg:py-16">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <VerifyBadge>Credits</VerifyBadge>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                  Start small, verify when you need it.
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  Pricing stays below the workflow, because the product is the verification tool. 1 credit verifies 1 email.
                </p>
              </div>
              <VerifyAction href="/pricing" variant="secondary">View all credit packs</VerifyAction>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {compactPackages.map((pack) => (
                <VerifyPanel key={pack.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-950">{pack.name}</h3>
                    {pack.badgeText ? <VerifyBadge tone="blue">{pack.badgeText}</VerifyBadge> : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{pack.description}</p>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">${pack.price}</p>
                      <p className="mt-1 text-sm font-semibold text-blue-700">{pack.totalCredits.toLocaleString()} verifications</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Pay per verified email</p>
                    </div>
                    <CheckoutButton
                      packageId={pack.id}
                      label={pack.key === "trial" ? "Start trial" : "Buy"}
                      className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                    />
                  </div>
                </VerifyPanel>
              ))}
            </div>
          </VerifyContainer>
        </section>
      </VerifyPageShell>
      <SiteFooter />
    </>
  );
}

function TrustPoint({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <span className="rounded-md bg-blue-50 p-2 text-blue-700">
        <Icon size={18} />
      </span>
      <span className="text-sm font-semibold text-slate-900">{label}</span>
    </div>
  );
}

function WorkflowStep({ icon: Icon, title, copy }: { icon: typeof UploadCloud; title: string; copy: string }) {
  return (
    <VerifyPanel className="p-5">
      <div className="w-fit rounded-md bg-blue-50 p-3 text-blue-700">
        <Icon size={22} />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
    </VerifyPanel>
  );
}

function OutcomePoint({ icon: Icon, label }: { icon: typeof TrendingDown; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <span className="rounded-md bg-emerald-50 p-2 text-emerald-700">
        <Icon size={18} />
      </span>
      <span className="text-sm font-semibold text-slate-900">{label}</span>
    </div>
  );
}

function DashboardPreview() {
  return (
    <VerifyPanel className="overflow-hidden">
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">Verification job</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">campaign-leads-may.csv</h3>
          </div>
          <VerifyBadge tone="green">Completed</VerifyBadge>
        </div>
      </div>
      <div className="grid gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <VerifyMetric label="Valid rate" value="86%" note="Ready to send" tone="green" />
          <VerifyMetric label="Bounce risk cut" value="-74%" note="Invalid + disposable removed" tone="blue" />
          <VerifyMetric label="Risky isolated" value="1,248" note="Catch-all / unknown" tone="amber" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_.85fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Before / after list quality</p>
            <div className="mt-4 grid gap-4">
              <BeforeAfterRow label="Before cleaning" valid={58} invalid={24} risky={18} />
              <BeforeAfterRow label="After cleaning" valid={86} invalid={3} risky={11} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-200">Live activity</p>
            <div className="mt-4 grid gap-2">
              {[
                ["Scanning MX records", "done"],
                ["Duplicates removed", "312"],
                ["Catch-all detected", "624"],
                ["Disposable domains blocked", "189"]
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />
                    {label}
                  </span>
                  <span className="text-sm font-semibold text-blue-200">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </VerifyPanel>
  );
}

function BeforeAfterRow({ label, valid, invalid, risky }: { label: string; valid: number; invalid: number; risky: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
        <span>{label}</span>
        <span>{valid}% valid</span>
      </div>
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-200">
        <div className="bg-emerald-500" style={{ width: `${valid}%` }} />
        <div className="bg-amber-400" style={{ width: `${risky}%` }} />
        <div className="bg-rose-500" style={{ width: `${invalid}%` }} />
      </div>
      <div className="mt-2 flex gap-3 text-xs font-semibold text-slate-500">
        <span>Valid</span>
        <span>Risky</span>
        <span>Invalid</span>
      </div>
    </div>
  );
}
