import Link from "next/link";
import { ArrowRight, Download, MailCheck, ShieldCheck, UploadCloud, Zap } from "lucide-react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Card } from "@/components/ui/card";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";

export default async function HomePage() {
  const packages = await getCreditPackagesForDisplay();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-premium-radial">
        <section className="section-shell grid gap-10 pb-14 pt-12 md:pb-20 md:pt-20 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-center">
          <div>
            <p className="eyebrow">Email verification / list cleaning SaaS</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-white md:text-7xl">
              Clean your email list before you send.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Upload CSV or TXT lists, remove invalid, risky, catch-all, and disposable emails, then download clean segmented results before your next campaign.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/sign-up?next=/dashboard"
                className="inline-flex h-14 items-center justify-center rounded-full bg-zeylora-brand px-7 text-base font-black text-white shadow-glow transition hover:brightness-110"
              >
                Start cleaning your list
                <ArrowRight className="ml-2" size={18} />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-7 text-base font-black text-white transition hover:bg-white/10"
              >
                View verification credits
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <TrustPoint icon={ShieldCheck} label="Reduce bounce risk" />
              <TrustPoint icon={MailCheck} label="Protect sender reputation" />
              <TrustPoint icon={Download} label="Download segmented CSVs" />
            </div>
          </div>

          <Card className="p-5 md:p-6">
            <div className="rounded-3xl border border-white/10 bg-[#07101d] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan">Live verification report</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Campaign-list.csv</h2>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-200">Cleaned</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <ResultStat label="Uploaded" value="10,000" />
                <ResultStat label="Valid" value="8,412" tone="good" />
                <ResultStat label="Invalid" value="913" tone="bad" />
                <ResultStat label="Risky removed" value="675" tone="warn" />
              </div>
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
                {[
                  ["valid", "sarah@brand.com", "VALID"],
                  ["invalid", "old-mail@dead-domain.test", "INVALID"],
                  ["catch", "sales@company.com", "CATCH-ALL"],
                  ["disposable", "promo@tempmail.dev", "DISPOSABLE"]
                ].map(([tone, email, status]) => (
                  <div key={email} className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/10 bg-white/[0.035] px-4 py-3 last:border-b-0">
                    <span className="truncate text-sm font-bold text-white">{email}</span>
                    <span className={statusClass(tone)}>{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>

        <section id="how-it-works" className="section-shell py-10 md:py-16">
          <div className="grid gap-4 md:grid-cols-3">
            <Step icon={UploadCloud} title="Upload or paste" copy="CSV, TXT, or manual paste. Zeylora extracts and deduplicates emails automatically." />
            <Step icon={Zap} title="Verify in bulk" copy="Credits are reserved before verification. Provider cost and revenue snapshots are stored per job." />
            <Step icon={Download} title="Download clean results" copy="Export valid-only, invalid-only, risky/catch-all, disposable, or the full report CSV." />
          </div>
        </section>

        <section id="results" className="section-shell py-10 md:py-16">
          <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
            <div>
              <p className="eyebrow">Built for serious senders</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
                Protect deliverability before the campaign goes out.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Marketers, agencies, ecommerce owners, SaaS teams, and cold email operators can clean lists before sending, reduce bounces, and keep sender reputation healthier.
              </p>
            </div>
            <Card className="p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <Breakdown label="Valid" value="84.1%" color="bg-emerald-400" />
                <Breakdown label="Invalid" value="9.1%" color="bg-rose-400" />
                <Breakdown label="Risky / catch-all" value="4.8%" color="bg-amber-300" />
                <Breakdown label="Disposable / unknown" value="2.0%" color="bg-slate-400" />
              </div>
            </Card>
          </div>
        </section>

        <section id="pricing" className="section-shell py-10 md:py-16">
          <div className="max-w-3xl">
            <p className="eyebrow">Pricing</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
              1 credit = 1 email verification.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Buy once, clean lists when you need them, and keep every report in your dashboard.
            </p>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {packages.map((pack) => (
              <Card key={pack.id} className={pack.highlight ? "premium-ring p-5" : "p-5"}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-black text-white">{pack.name}</h3>
                  {pack.badgeText ? <span className="rounded-full bg-cyan px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-ink">{pack.badgeText}</span> : null}
                </div>
                <p className="mt-3 min-h-16 text-sm leading-6 text-slate-300">{pack.description}</p>
                <p className="mt-5 text-4xl font-black text-white">${pack.price}</p>
                <p className="mt-1 text-sm font-black text-cyan">{pack.totalCredits.toLocaleString()} verifications</p>
                <CheckoutButton
                  packageId={pack.id}
                  label={pack.key === "trial" ? "Start with Trial" : "Buy credits"}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-cyan text-sm font-black text-ink transition hover:bg-cyan/90"
                />
              </Card>
            ))}
          </div>
        </section>

        <section className="section-shell pb-16 pt-8 md:pb-24">
          <Card className="p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="eyebrow">Security and privacy</p>
                <h2 className="mt-3 text-3xl font-black text-white">Private files, signed downloads, and credit-ledger safety.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Uploads and exports stay private, downloads use signed URLs, and verification jobs store fixed cost/revenue snapshots for reliable reporting.
                </p>
              </div>
              <Link href="/auth/sign-up?next=/dashboard" className="inline-flex h-12 items-center justify-center rounded-full bg-zeylora-brand px-6 text-sm font-black text-white shadow-glow">
                Create account
              </Link>
            </div>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function TrustPoint({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <span className="rounded-xl bg-cyan/15 p-2 text-cyan">
        <Icon size={18} />
      </span>
      <span className="text-sm font-black text-white">{label}</span>
    </div>
  );
}

function ResultStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : tone === "warn" ? "text-amber-200" : "text-white";
  return (
    <div className="rounded-2xl bg-white/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function Step({ icon: Icon, title, copy }: { icon: typeof UploadCloud; title: string; copy: string }) {
  return (
    <Card className="p-6">
      <div className="rounded-2xl bg-cyan/15 p-3 text-cyan w-fit">
        <Icon size={24} />
      </div>
      <h3 className="mt-5 text-2xl font-black text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{copy}</p>
    </Card>
  );
}

function Breakdown({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-white">{label}</p>
        <p className="text-sm font-black text-cyan">{value}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${color}`} style={{ width: value }} />
      </div>
    </div>
  );
}

function statusClass(tone: string) {
  const base = "rounded-full px-2 py-1 text-[10px] font-black";
  if (tone === "valid") return `${base} bg-emerald-400/15 text-emerald-200`;
  if (tone === "invalid") return `${base} bg-rose-400/15 text-rose-200`;
  if (tone === "catch") return `${base} bg-amber-300/15 text-amber-100`;
  return `${base} bg-slate-400/15 text-slate-200`;
}
