import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  DatabaseZap,
  Download,
  FileCheck2,
  Globe2,
  KeyRound,
  MailCheck,
  ShieldCheck,
  TrendingDown,
  UploadCloud,
  Users2,
} from "lucide-react";
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

type DisplayPackage = Awaited<ReturnType<typeof getCreditPackagesForDisplay>>[number];

export default async function HomePage() {
  const packages = await getCreditPackagesForDisplay();
  const compactPackages = packages.slice(0, 4);
  const starterPackage = packages.find((pack) => pack.key === "starter") ?? compactPackages[0];

  return (
    <>
      <SiteHeader />
      <VerifyPageShell>
        <section className="relative isolate overflow-hidden border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_52%,#eef5ff_100%)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,.13),transparent_34%),radial-gradient(circle_at_82%_16%,rgba(14,165,233,.16),transparent_30%),linear-gradient(rgba(15,23,42,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.035)_1px,transparent_1px)] bg-[size:auto,auto,44px_44px,44px_44px]" />
          <div className="pointer-events-none absolute left-1/2 top-12 h-72 w-[min(900px,90vw)] -translate-x-1/2 rounded-full bg-blue-200/30 blur-3xl" />

          <VerifyContainer className="relative py-8 sm:py-10 lg:py-14">
            <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr] xl:items-start">
              <div className="pt-2 xl:sticky xl:top-24">
                <VerifyBadge tone="blue" className="shadow-sm">
                  Pre-send email list cleaning
                </VerifyBadge>
                <h1 className="mt-5 max-w-3xl text-4xl font-semibold text-slate-950 sm:text-5xl lg:text-6xl">
                  Bad email lists silently burn campaign budget.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  Verify every address before it hurts inbox placement, wastes sends, or damages sender reputation. Paste a list, see the risk, then download clean CSV segments before your next campaign.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <VerifyAction href="#verify-list" className="h-12 px-5 text-base shadow-lg shadow-blue-600/20">
                    Check my list now
                    <ArrowRight size={18} />
                  </VerifyAction>
                  <VerifyAction href="#pricing" variant="secondary" className="h-12 px-5 text-base">
                    Buy verification credits
                  </VerifyAction>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <HeroPromise icon={TrendingDown} title="Stop wasted sends" text="Find invalid, risky, and disposable addresses before they drain campaign budget." />
                  <HeroPromise icon={MailCheck} title="Pay per verified email" text="1 credit verifies 1 unique address after duplicates are removed." />
                  <HeroPromise icon={ShieldCheck} title="Protect sender reputation" text="Clean bad addresses before they damage deliverability signals." />
                  <HeroPromise icon={Download} title="Export clean segments" text="Download valid, risky, invalid, disposable, and full report CSVs." />
                </div>
                <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold text-slate-600">
                  <AudiencePill icon={Users2} label="Newsletter lists" />
                  <AudiencePill icon={Building2} label="Agencies" />
                  <AudiencePill icon={DatabaseZap} label="CRM exports" />
                  <AudiencePill icon={MailCheck} label="SaaS & ecommerce" />
                </div>
                {starterPackage ? <HeroOfferCard starterPackage={starterPackage} /> : null}
              </div>

              <div id="verify-list" className="relative">
                <div className="absolute -inset-3 rounded-2xl bg-white/60 blur-xl" />
                <div className="relative rounded-2xl border border-white/70 bg-white/75 p-2 shadow-[0_24px_80px_rgba(15,23,42,.12)] backdrop-blur-xl">
                  <HomepageListChecker />
                </div>
              </div>
            </div>

            <HeroActivityStrip />
          </VerifyContainer>
        </section>

        <section id="results" className="border-b border-slate-200 bg-[#f7f8fb]">
          <VerifyContainer className="grid gap-8 py-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:py-16">
            <div>
              <VerifyBadge tone="green">Deliverability improvement</VerifyBadge>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                Turn a risky list into send-ready segments.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Upload a messy list, isolate addresses that hurt deliverability, then export cleaner segments for CRMs, newsletters, and campaign tools.
              </p>
              <div className="mt-6 grid gap-3">
                  <OutcomePoint icon={TrendingDown} label="Cut wasted sends before campaign budget is spent." />
                  <OutcomePoint icon={ShieldCheck} label="Protect sender reputation before a campaign goes live." />
                  <OutcomePoint icon={MailCheck} label="Improve list quality before your next send." />
              </div>
            </div>
            <VerifyPanel className="p-5 shadow-[0_20px_60px_rgba(15,23,42,.08)]">
              <div className="grid gap-5">
                <BeforeAfterRow label="Before cleaning" valid={58} invalid={24} risky={18} />
                <BeforeAfterRow label="After cleaning" valid={86} invalid={3} risky={11} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <VerifyMetric label="Sender risk" value="-74%" note="Bounce exposure reduced" tone="green" />
                  <VerifyMetric label="Risky isolated" value="1,248" note="Catch-all / unknown" tone="amber" />
                  <VerifyMetric label="Segmented exports" value="5 CSVs" note="Valid, invalid, risky, disposable, full" tone="blue" />
                </div>
              </div>
            </VerifyPanel>
          </VerifyContainer>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <VerifyContainer className="py-12 lg:py-16">
            <div className="grid gap-8 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
              <div>
                <VerifyBadge tone="amber">ROI protection</VerifyBadge>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                  Stop paying to send emails that bounce.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Every invalid address wastes sending capacity, weakens domain trust, and hides the real campaign result. Zeylora turns that risk into a clear pre-send decision.
                </p>
              </div>
              <MoneySavingCalculator />
            </div>
          </VerifyContainer>
        </section>

        <section id="how-it-works" className="border-b border-slate-200 bg-white">
          <VerifyContainer className="py-12 lg:py-16">
            <div className="mx-auto max-w-3xl text-center">
              <VerifyBadge>Verification workflow</VerifyBadge>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                From raw list to clean CSV exports.
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

        <section className="border-b border-slate-200 bg-[#f7f8fb]">
          <VerifyContainer className="py-12 lg:py-16">
            <div className="mx-auto max-w-3xl text-center">
              <VerifyBadge tone="green">Trust and control</VerifyBadge>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                Built for teams that cannot afford dirty-list mistakes.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Verification should feel operationally safe: private uploads, controlled exports, signed downloads, and clear checks without subscription pressure.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <TrustBlock icon={ShieldCheck} title="Private uploads" copy="Lists stay scoped to your account and verification workspace." />
              <TrustBlock icon={KeyRound} title="Signed download links" copy="CSV exports are delivered through controlled private links." />
              <TrustBlock icon={Globe2} title="GDPR-friendly workflow" copy="Designed around list hygiene, export control, and minimal operational exposure." />
              <TrustBlock icon={FileCheck2} title="Export control" copy="Download valid, invalid, risky, disposable, duplicate, and full report segments." />
              <TrustBlock icon={DatabaseZap} title="Verification checks" copy="MX, SMTP, disposable, catch-all, and syntax signals help separate clean sends from risky addresses." />
              <TrustBlock icon={Calculator} title="No subscription required" copy="Buy verification volume once and use it when your lists are ready." />
            </div>
          </VerifyContainer>
        </section>

        <section id="pricing" className="bg-[#f7f8fb]">
          <VerifyContainer className="py-12 lg:py-16">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <VerifyBadge>Usage-based verification</VerifyBadge>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                  Buy verification volume only when you need it.
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  1 credit verifies 1 email. Start with a small list, then scale to higher-volume list cleaning when the numbers make sense.
                </p>
              </div>
              <VerifyAction href="/pricing" variant="secondary">View all plans</VerifyAction>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {compactPackages.map((pack) => (
                <VerifyPanel key={pack.id} className={`flex h-full flex-col p-5 ${pack.highlight ? "border-blue-300 bg-blue-50 shadow-[0_18px_50px_rgba(37,99,235,.12)]" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-semibold text-slate-950">{pack.name}</h3>
                    {pack.badgeText ? <VerifyBadge tone="blue">{pack.badgeText}</VerifyBadge> : null}
                  </div>
                  <p className="mt-2 min-h-16 text-sm leading-6 text-slate-600">{pack.description}</p>
                  <div className="mt-5">
                    <p className="text-4xl font-semibold tracking-[-0.04em] text-slate-950">${pack.price}</p>
                    <p className="mt-2 text-sm font-semibold text-blue-700">{pack.totalCredits.toLocaleString()} email verifications</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {formatCostPerThousand(pack.price, pack.totalCredits)} per 1k verifications
                    </p>
                  </div>
                  <div className="mt-5 grid gap-2 text-sm text-slate-600">
                    <p>Reduce bounce rate before sending.</p>
                    <p>Export valid, invalid, risky, and full report CSVs.</p>
                  </div>
                <CheckoutButton
                    packageId={pack.id}
                    label={pack.key === "starter" ? "Start here" : "Buy verifications"}
                    className="mt-auto inline-flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                  />
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

function HeroPromise({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/70 bg-white/75 p-4 text-left shadow-[0_12px_42px_rgba(15,23,42,.07)] backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
          <Icon size={19} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
        </div>
      </div>
    </div>
  );
}

function AudiencePill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
      <Icon size={15} className="text-blue-700" />
      {label}
    </span>
  );
}

function HeroOfferCard({ starterPackage }: { starterPackage: DisplayPackage }) {
  return (
    <VerifyPanel className="mt-6 overflow-hidden border-blue-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(37,99,235,.10)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">Start cleaning today</p>
          <p className="mt-1 text-3xl font-semibold text-slate-950">${starterPackage.price}</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {starterPackage.totalCredits.toLocaleString()} email verifications
          </p>
        </div>
        <VerifyBadge tone="green">No subscription</VerifyBadge>
      </div>
      <div className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
        <OfferLine text="Verify a real list before your next campaign goes out." />
        <OfferLine text="1 credit checks 1 unique email after duplicates are removed." />
        <OfferLine text="Get valid, risky, invalid, disposable, duplicate, and full CSV exports." />
      </div>
      <CheckoutButton
        packageId={starterPackage.id}
        label={`Start with ${starterPackage.totalCredits.toLocaleString()} verifications`}
        className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
      />
    </VerifyPanel>
  );
}

function OfferLine({ text }: { text: string }) {
  return (
    <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <CheckDot />
      <span>{text}</span>
    </div>
  );
}

function CheckDot() {
  return <span className="mt-1 size-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" />;
}

function HeroActivityStrip() {
  const items = [
    ["Risk found", "before you send"],
    ["Duplicates removed", "no wasted credits"],
    ["Invalid blocked", "fewer bounces"],
    ["Clean exports", "ready for CRM"],
    ["Budget protected", "pay as you go"]
  ];

  return (
    <div className="mt-8 rounded-2xl border border-white/70 bg-white/70 p-2 shadow-[0_18px_60px_rgba(15,23,42,.09)] backdrop-blur-xl">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {items.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3">
            <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
              <span className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</span>
            </div>
            <span className="mt-1 block truncate text-sm font-semibold text-slate-950">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoneySavingCalculator() {
  const rows = [
    ["Uploaded emails", "25,000", "List volume before verification"],
    ["Estimated bounce risk", "18%", "Risk hidden inside the raw list"],
    ["Wasted sends avoided", "4,500", "Invalid and risky addresses isolated"],
    ["Sender risk reduced", "-74%", "Cleaner list before campaign launch"],
    ["Recommended volume", "Scale", "20,000 verification package fit"]
  ];

  return (
    <VerifyPanel className="overflow-hidden p-5 shadow-[0_22px_70px_rgba(15,23,42,.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Savings model</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Pre-send ROI calculator</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">Live estimate</span>
      </div>

      <div className="mt-5 grid gap-3">
        {rows.map(([label, value, note], index) => (
          <div key={label} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-sm font-semibold text-slate-950">{label}</p>
              <p className="mt-1 text-sm text-slate-500">{note}</p>
            </div>
            <p className={index === 3 ? "text-3xl font-semibold tracking-[-0.04em] text-emerald-700" : "text-3xl font-semibold tracking-[-0.04em] text-slate-950"}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
          <span>Budget protected before send</span>
          <span>74%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white">
          <div className="h-full w-[74%] rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 shadow-[0_0_18px_rgba(37,99,235,.25)]" />
        </div>
      </div>
    </VerifyPanel>
  );
}

function TrustBlock({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return (
    <VerifyPanel className="p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_55px_rgba(15,23,42,.08)]">
      <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <Icon size={21} />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
    </VerifyPanel>
  );
}

function WorkflowStep({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return (
    <VerifyPanel className="p-5 transition hover:-translate-y-0.5 hover:shadow-[0_16px_48px_rgba(15,23,42,.08)]">
      <div className="w-fit rounded-md bg-blue-50 p-3 text-blue-700">
        <Icon size={22} />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
    </VerifyPanel>
  );
}

function OutcomePoint({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="rounded-md bg-emerald-50 p-2 text-emerald-700">
        <Icon size={18} />
      </span>
      <span className="text-sm font-semibold text-slate-900">{label}</span>
    </div>
  );
}

function BeforeAfterRow({ label, valid, invalid, risky }: { label: string; valid: number; invalid: number; risky: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
        <span>{label}</span>
        <span>{valid}% valid</span>
      </div>
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-200 shadow-inner">
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

function formatCostPerThousand(price: number, credits: number) {
  if (!credits) return "$0.00";
  return `$${((price / credits) * 1000).toFixed(2)}`;
}
