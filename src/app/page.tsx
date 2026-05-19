import { ArrowRight, Database, Download, MailCheck, ShieldCheck, UploadCloud } from "lucide-react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  VerifyAction,
  VerifyBadge,
  VerifyContainer,
  VerifyMetric,
  VerifyPageShell,
  VerifyPanel,
  VerifyTable
} from "@/components/verify-ui/core";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";

export default async function HomePage() {
  const packages = await getCreditPackagesForDisplay();
  const visiblePackages = packages.slice(0, 4);

  return (
    <>
      <SiteHeader />
      <VerifyPageShell>
        <section className="border-b border-slate-200 bg-white">
          <VerifyContainer className="grid gap-10 py-12 lg:grid-cols-[1fr_520px] lg:items-center lg:py-20">
            <div>
              <VerifyBadge tone="blue">Email verification infrastructure</VerifyBadge>
              <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-slate-950 md:text-7xl">
                Clean every list before it hits inboxes.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Upload CSV or TXT lists, remove invalid, risky, catch-all, and disposable emails, then export clean sender-ready segments for your next campaign.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <VerifyAction href="/auth/sign-in?next=/dashboard" className="h-12 px-6 text-base">
                  Start verifying
                  <ArrowRight size={18} />
                </VerifyAction>
                <VerifyAction href="/pricing" variant="secondary" className="h-12 px-6 text-base">
                  View pricing
                </VerifyAction>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <TrustPoint icon={ShieldCheck} label="Reduce bounce risk" />
                <TrustPoint icon={MailCheck} label="Protect sender reputation" />
                <TrustPoint icon={Download} label="Segmented CSV exports" />
              </div>
            </div>

            <VerifyPanel className="overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Verification report</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">campaign-may.csv</h2>
                  </div>
                  <VerifyBadge tone="green">Completed</VerifyBadge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-200">
                <ReportStat label="Uploaded" value="10,000" />
                <ReportStat label="Valid" value="8,412" tone="green" />
                <ReportStat label="Invalid" value="913" tone="red" />
                <ReportStat label="Risky removed" value="675" tone="amber" />
              </div>
              <VerifyTable className="rounded-none border-0 border-t border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {[
                      ["sarah@northstar.co", "Valid", "green"],
                      ["sales@company.com", "Catch-all", "amber"],
                      ["old-mail@dead-domain.test", "Invalid", "red"],
                      ["promo@tempmail.dev", "Disposable", "neutral"]
                    ].map(([email, status, tone]) => (
                      <tr key={email}>
                        <td className="max-w-[260px] truncate px-4 py-3 font-medium text-slate-900">{email}</td>
                        <td className="px-4 py-3">
                          <VerifyBadge tone={tone as "green" | "amber" | "red" | "neutral"}>{status}</VerifyBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </VerifyTable>
            </VerifyPanel>
          </VerifyContainer>
        </section>

        <section id="how-it-works" className="border-b border-slate-200 bg-[#f7f8fb]">
          <VerifyContainer className="py-14 lg:py-16">
            <div className="max-w-2xl">
              <VerifyBadge>Workflow</VerifyBadge>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-5xl">
                Upload, verify, export. No noisy tooling.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Step icon={UploadCloud} title="Upload or paste" copy="CSV, TXT, or manual paste. Zeylora detects emails, removes duplicates, and estimates required credits." />
              <Step icon={Database} title="Verify through provider" copy="Credits are reserved before verification. Provider cost and revenue snapshots are stored per job." />
              <Step icon={Download} title="Download clean files" copy="Export valid-only, invalid-only, risky/catch-all, disposable, or the full report CSV." />
            </div>
          </VerifyContainer>
        </section>

        <section id="results" className="border-b border-slate-200 bg-white">
          <VerifyContainer className="grid gap-8 py-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:py-16">
            <div>
              <VerifyBadge tone="blue">Deliverability operations</VerifyBadge>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-5xl">
                Know exactly what to remove before you send.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Zeylora is built for marketers, agencies, ecommerce owners, SaaS teams, and cold email operators who need cleaner lists and fewer wasted sends.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <VerifyMetric label="Valid rate" value="84.1%" note="Ready for campaign export" tone="green" />
              <VerifyMetric label="Bounce risk removed" value="1,588" note="Invalid, catch-all, risky, disposable" tone="amber" />
              <VerifyMetric label="Duplicate emails" value="312" note="Deduped before provider spend" tone="blue" />
              <VerifyMetric label="Download segments" value="5 CSVs" note="Valid, invalid, risky, disposable, full" />
            </div>
          </VerifyContainer>
        </section>

        <section id="pricing" className="bg-[#f7f8fb]">
          <VerifyContainer className="py-14 lg:py-16">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <VerifyBadge>Pricing</VerifyBadge>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-5xl">
                  1 credit verifies 1 email.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  Buy once, clean lists when you need them, and keep reports in your dashboard.
                </p>
              </div>
              <VerifyAction href="/pricing" variant="secondary">Open full pricing</VerifyAction>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {visiblePackages.map((pack) => (
                <VerifyPanel key={pack.id} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-semibold text-slate-950">{pack.name}</h3>
                    {pack.badgeText ? <VerifyBadge tone="blue">{pack.badgeText}</VerifyBadge> : null}
                  </div>
                  <p className="mt-3 min-h-16 text-sm leading-6 text-slate-600">{pack.description}</p>
                  <p className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-slate-950">${pack.price}</p>
                  <p className="mt-1 text-sm font-semibold text-blue-700">{pack.totalCredits.toLocaleString()} verifications</p>
                  <CheckoutButton
                    packageId={pack.id}
                    label={pack.key === "trial" ? "Start trial pack" : "Buy credits"}
                    className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700"
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

function ReportStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "green" | "amber" | "red" }) {
  const toneClass = tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : tone === "red" ? "text-rose-700" : "text-slate-950";
  return (
    <div className="bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Step({ icon: Icon, title, copy }: { icon: typeof UploadCloud; title: string; copy: string }) {
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
