import type { LucideIcon } from "lucide-react";
import {
  Activity,
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
  Radio,
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

export default async function HomePage() {
  const packages = await getCreditPackagesForDisplay();
  const compactPackages = packages.slice(0, 4);

  return (
    <>
      <SiteHeader />
      <VerifyPageShell>
        <section className="relative isolate overflow-hidden border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_52%,#eef5ff_100%)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,.13),transparent_34%),radial-gradient(circle_at_82%_16%,rgba(14,165,233,.16),transparent_30%),linear-gradient(rgba(15,23,42,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.035)_1px,transparent_1px)] bg-[size:auto,auto,44px_44px,44px_44px]" />
          <div className="pointer-events-none absolute left-1/2 top-12 h-72 w-[min(900px,90vw)] -translate-x-1/2 rounded-full bg-blue-200/30 blur-3xl" />

          <VerifyContainer className="relative py-10 sm:py-12 lg:py-16">
            <div className="mx-auto max-w-5xl text-center">
              <VerifyBadge tone="blue" className="shadow-sm">
                Email verification infrastructure
              </VerifyBadge>
              <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-7xl">
                Bad email lists silently destroy campaign ROI.
              </h1>
              <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                Verify every address before it damages inbox placement, burns campaign budget, or lowers sender reputation.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <VerifyAction href="#verify-list" className="h-12 px-6 text-base shadow-lg shadow-blue-600/20">
                  Verify a list now
                  <ArrowRight size={18} />
                </VerifyAction>
                <VerifyAction href="#live-demo" variant="secondary" className="h-12 px-6 text-base">
                  See live engine
                </VerifyAction>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-slate-600">
                <AudiencePill icon={Users2} label="Marketers" />
                <AudiencePill icon={Building2} label="Agencies" />
                <AudiencePill icon={DatabaseZap} label="B2B operators" />
                <AudiencePill icon={MailCheck} label="SaaS GTM teams" />
              </div>
            </div>

            <HeroActivityStrip />

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HeroPromise icon={FileCheck2} title="Free pre-check" text="Estimate list size and credit need before you process." />
              <HeroPromise icon={MailCheck} title="1 credit = 1 email" text="Only unique addresses are counted after deduplication." />
              <HeroPromise icon={ShieldCheck} title="Reputation-first" text="Isolate invalid, disposable, risky, and catch-all emails." />
              <HeroPromise icon={Download} title="Clean CSV exports" text="Download valid-only, risky, invalid, and full reports." />
            </div>

            <div id="verify-list" className="mt-6 grid gap-5 xl:grid-cols-[1.02fr_.98fr] xl:items-start">
              <div className="relative">
                <div className="absolute -inset-3 rounded-2xl bg-white/60 blur-xl" />
                <div className="relative rounded-2xl border border-white/70 bg-white/75 p-2 shadow-[0_24px_80px_rgba(15,23,42,.12)] backdrop-blur-xl">
                  <HomepageListChecker />
                </div>
              </div>
              <VerificationEnginePanel />
            </div>
          </VerifyContainer>
        </section>

        <section id="live-demo" className="border-b border-slate-200 bg-white">
          <VerifyContainer className="py-12 lg:py-16">
            <div className="mx-auto max-w-3xl text-center">
              <VerifyBadge tone="blue">Operational proof</VerifyBadge>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                The dashboard shows exactly what your campaign gained.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Zeylora reports deliverability score, valid rate, bounce risk, duplicate removal, and segmented export readiness in one operator-friendly view.
              </p>
            </div>
            <div className="mt-8">
              <DashboardPreview />
            </div>
          </VerifyContainer>
        </section>

        <section id="results" className="border-b border-slate-200 bg-[#f7f8fb]">
          <VerifyContainer className="grid gap-8 py-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:py-16">
            <div>
              <VerifyBadge tone="green">Deliverability improvement</VerifyBadge>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                See the bounce risk disappear before you spend on sending.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Upload a messy list, isolate the addresses that hurt deliverability, then export clean segments for CRMs, cold email tools, and newsletter platforms.
              </p>
              <div className="mt-6 grid gap-3">
                <OutcomePoint icon={TrendingDown} label="Reduce wasted sends and bounce penalties." />
                <OutcomePoint icon={ShieldCheck} label="Protect sender reputation before a campaign goes live." />
                <OutcomePoint icon={MailCheck} label="Improve inbox placement by keeping risky mail out." />
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
                  How much list cleaning can save before you send.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Every invalid address spends sending capacity, weakens domain trust, and hides the real campaign result. Zeylora turns that risk into a clear pre-send decision.
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

        <section className="border-b border-slate-200 bg-[#f7f8fb]">
          <VerifyContainer className="py-12 lg:py-16">
            <div className="mx-auto max-w-3xl text-center">
              <VerifyBadge tone="green">Trust and control</VerifyBadge>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                Built for teams that protect sender reputation seriously.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Verification should feel operationally safe: private uploads, controlled exports, signed downloads, and provider-backed checks without subscription pressure.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <TrustBlock icon={ShieldCheck} title="Private uploads" copy="Lists stay scoped to your account and verification workspace." />
              <TrustBlock icon={KeyRound} title="Signed download links" copy="CSV exports are delivered through controlled private links." />
              <TrustBlock icon={Globe2} title="GDPR-friendly workflow" copy="Designed around list hygiene, export control, and minimal operational exposure." />
              <TrustBlock icon={FileCheck2} title="Export control" copy="Download valid, invalid, risky, disposable, duplicate, and full report segments." />
              <TrustBlock icon={DatabaseZap} title="Provider-backed checks" copy="MillionVerifier-first architecture with future provider fallback support." />
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
                  Buy verification volume, not another subscription.
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  1 credit verifies 1 email. Start with a small list, then scale to higher-volume campaign hygiene when the numbers make sense.
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

function HeroActivityStrip() {
  const items = [
    ["Upload received", "CSV/TXT"],
    ["Duplicates removed", "before credits"],
    ["Credits estimated", "unique emails"],
    ["Risk segments", "valid / risky / invalid"],
    ["Exports prepared", "clean CSV"]
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

function VerificationEnginePanel() {
  return (
    <div className="grid gap-4">
      <VerifyPanel className="relative overflow-hidden border-white/80 bg-white/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,.12)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Radio size={16} className="animate-pulse text-emerald-600" />
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Live verification engine</p>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">campaign-leads-may.csv</h2>
          </div>
          <VerifyBadge tone="green">Scanning now</VerifyBadge>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[.82fr_1.18fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Deliverability score</p>
            <div className="mx-auto mt-4 grid size-40 place-items-center rounded-full bg-[conic-gradient(#2563eb_0_328deg,#dbeafe_328deg_360deg)] p-3 shadow-inner">
              <div className="grid size-32 place-items-center rounded-full bg-white shadow-sm">
                <div className="text-center">
                  <p className="text-5xl font-semibold tracking-[-0.06em] text-slate-950">91</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Ready</p>
                </div>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-[91%] rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500" />
            </div>
          </div>

          <div className="grid content-between gap-4">
            <BeforeAfterRow label="Raw list quality" valid={58} invalid={24} risky={18} />
            <BeforeAfterRow label="Verified export quality" valid={86} invalid={3} risky={11} />
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Verification progress</p>
                <span className="text-sm font-semibold text-blue-700">72%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 shadow-[0_0_18px_rgba(37,99,235,.35)]" />
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">MX, SMTP, disposable, catch-all, duplicate checks</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <EngineStat label="Valid" value="18,642" tone="green" />
          <EngineStat label="Risky isolated" value="2,184" tone="amber" />
          <EngineStat label="Invalid blocked" value="5,209" tone="red" />
        </div>
      </VerifyPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <VerifyPanel className="p-4 shadow-[0_16px_50px_rgba(15,23,42,.08)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Verification activity</p>
            <Activity size={16} className="text-blue-700" />
          </div>
          <div className="mt-4 grid gap-2">
            {[
              ["MX records confirmed", "4,812"],
              ["Duplicates removed", "312"],
              ["Catch-all detected", "624"],
              ["Disposable domains blocked", "189"]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                  {label}
                </span>
                <span className="text-sm font-semibold text-blue-700">{value}</span>
              </div>
            ))}
          </div>
        </VerifyPanel>

        <VerifyPanel className="overflow-hidden p-4 shadow-[0_16px_50px_rgba(15,23,42,.08)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Bounce risk curve</p>
            <TrendingDown size={16} className="text-emerald-700" />
          </div>
          <div className="mt-4 flex h-28 items-end gap-2">
            {[76, 71, 66, 51, 43, 35, 24, 18].map((height, index) => (
              <div key={height} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-cyan-400 shadow-[0_8px_22px_rgba(37,99,235,.18)]"
                  style={{ height: `${height}%`, opacity: 0.7 + index * 0.035 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Raw import</span>
            <span className="text-emerald-700">-74% risk</span>
          </div>
        </VerifyPanel>

        <VerifyPanel className="p-4 shadow-[0_16px_50px_rgba(15,23,42,.08)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Export segments</p>
            <Download size={16} className="text-blue-700" />
          </div>
          <div className="mt-4 grid gap-2">
            {[
              ["Valid-only CSV", "18,642"],
              ["Risk review CSV", "2,184"],
              ["Blocked CSV", "5,209"],
              ["Full report", "26,035"]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm font-semibold text-slate-800">{label}</span>
                <span className="text-sm font-semibold text-slate-950">{value}</span>
              </div>
            ))}
          </div>
        </VerifyPanel>
      </div>

      <VerifyPanel className="overflow-hidden p-4 shadow-[0_16px_50px_rgba(15,23,42,.08)]">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <DatabaseZap size={16} className="text-blue-700" />
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Provider-backed workflow</p>
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">From raw list to clean exports without guessing.</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Zeylora extracts unique addresses, reserves one verification per email, checks provider signals, and prepares segmented CSV downloads for campaign teams.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <MiniReadout label="Provider" value="MillionVerifier" />
            <MiniReadout label="Mode" value="Queued + safe" />
            <MiniReadout label="Credits" value="1 / email" />
          </div>
        </div>
      </VerifyPanel>
    </div>
  );
}

function MiniReadout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function EngineStat({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "red" }) {
  const toneClass =
    tone === "green" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : tone === "amber" ? "text-amber-700 bg-amber-50 border-amber-100" : "text-rose-700 bg-rose-50 border-rose-100";
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.1em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{value}</p>
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

function DashboardPreview() {
  return (
    <VerifyPanel className="overflow-hidden shadow-[0_22px_70px_rgba(15,23,42,.08)]">
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

        <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Before / after list quality</p>
            <div className="mt-4 grid gap-4">
              <BeforeAfterRow label="Before cleaning" valid={58} invalid={24} risky={18} />
              <BeforeAfterRow label="After cleaning" valid={86} invalid={3} risky={11} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <SegmentCard label="Valid export" value="18,642" tone="green" />
              <SegmentCard label="Risk review" value="2,184" tone="amber" />
              <SegmentCard label="Blocked" value="5,209" tone="red" />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Live activity</p>
              <div className="mt-4 grid gap-2">
                {[
                  ["Scanning MX records", "done"],
                  ["Duplicates removed", "312"],
                  ["Catch-all detected", "624"],
                  ["Disposable domains blocked", "189"]
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />
                      {label}
                    </span>
                    <span className="text-sm font-semibold text-blue-700">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Bounce risk curve</p>
                <span className="text-sm font-semibold text-emerald-700">Down 74%</span>
              </div>
              <div className="mt-4 flex h-24 items-end gap-2">
                {[78, 72, 65, 55, 43, 31, 22, 16].map((height) => (
                  <div key={height} className="flex-1 rounded-t-md bg-gradient-to-t from-blue-600 to-cyan-400" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </VerifyPanel>
  );
}

function SegmentCard({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "red" }) {
  const color = tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-rose-700";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold tracking-[-0.02em] ${color}`}>{value}</p>
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
