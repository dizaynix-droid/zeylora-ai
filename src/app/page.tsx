import { ArrowRight, CheckCircle2, ClipboardList, Download, FileText, MailCheck, ShieldCheck, UploadCloud, XCircle } from "lucide-react";
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

const sampleEmails = ["sarah@northstar.co", "ops@agency.io", "old-mail@dead-domain.test"];

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
                Upload your email list and clean it before you send.
              </h1>
              <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
                Find invalid, risky, catch-all, disposable, and duplicate emails before they damage your bounce rate or sender reputation.
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

            <VerificationWidget />
          </VerifyContainer>
        </section>

        <section id="how-it-works" className="border-b border-slate-200 bg-[#f7f8fb]">
          <VerifyContainer className="py-12 lg:py-16">
            <div className="mx-auto max-w-3xl text-center">
              <VerifyBadge>Verification workflow</VerifyBadge>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                From raw list to clean segments in three steps.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Zeylora is built around the job you actually need done: inspect a list, verify the addresses, and download the clean files.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <WorkflowStep
                icon={UploadCloud}
                title="Upload list"
                copy="Drop a CSV/TXT file or paste emails. Zeylora detects addresses, removes duplicates, and estimates required credits before processing."
              />
              <WorkflowStep
                icon={MailCheck}
                title="Verify emails"
                copy="Run provider-backed checks for valid, invalid, risky, catch-all, disposable, unknown, and duplicate emails."
              />
              <WorkflowStep
                icon={Download}
                title="Download results"
                copy="Export valid-only, invalid-only, risky/catch-all, disposable, or a full report with status columns."
              />
            </div>
          </VerifyContainer>
        </section>

        <section id="results" className="border-b border-slate-200 bg-white">
          <VerifyContainer className="grid gap-8 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:py-16">
            <div>
              <VerifyBadge tone="green">List quality report</VerifyBadge>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                See exactly what should be removed before the campaign goes out.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Your dashboard keeps every verification job, export, credit transaction, and provider result organized for marketing teams, agencies, SaaS teams, and cold email operators.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <VerifyMetric label="Valid addresses" value="8,412" note="Ready for sending" tone="green" />
              <VerifyMetric label="Invalid removed" value="913" note="Hard bounce risk" tone="red" />
              <VerifyMetric label="Risky / catch-all" value="675" note="Review before sending" tone="amber" />
              <VerifyMetric label="Duplicates" value="312" note="Deduped before verification" tone="blue" />
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

function VerificationWidget() {
  return (
    <VerifyPanel className="overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">List checker</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Check list quality</h2>
          </div>
          <VerifyBadge tone="green">Ready</VerifyBadge>
        </div>
      </div>

      <div className="grid gap-4 p-5">
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-white text-blue-700 shadow-sm">
            <FileText size={22} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-950">Drop CSV or TXT file</p>
          <p className="mt-1 text-xs text-slate-500">or browse from your device</p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Paste emails</label>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
            {sampleEmails.map((email) => (
              <p key={email} className="font-mono text-sm leading-6 text-slate-700">
                {email}
              </p>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MiniResult label="Valid" value="84%" tone="green" />
          <MiniResult label="Invalid" value="9%" tone="red" />
          <MiniResult label="Risky" value="7%" tone="amber" />
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">Estimate required credits</p>
              <p className="mt-1 text-sm text-slate-700">10,000 unique emails = 10,000 credits</p>
            </div>
            <ClipboardList className="text-blue-700" size={22} />
          </div>
        </div>

        <VerifyAction href="/auth/sign-in?next=/dashboard" className="h-12 w-full text-base">
          Check list quality
          <ArrowRight size={18} />
        </VerifyAction>
      </div>

      <VerifyTable className="rounded-none border-x-0 border-b-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Sample result</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <SampleRow email="sarah@northstar.co" status="Valid" tone="green" />
            <SampleRow email="sales@company.com" status="Catch-all" tone="amber" />
            <SampleRow email="old-mail@dead-domain.test" status="Invalid" tone="red" />
          </tbody>
        </table>
      </VerifyTable>
    </VerifyPanel>
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

function MiniResult({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "red" }) {
  const Icon = tone === "green" ? CheckCircle2 : tone === "red" ? XCircle : ShieldCheck;
  const color = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-rose-700" : "text-amber-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <Icon className={color} size={18} />
      <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
    </div>
  );
}

function SampleRow({ email, status, tone }: { email: string; status: string; tone: "green" | "amber" | "red" }) {
  return (
    <tr>
      <td className="max-w-[220px] truncate px-4 py-3 font-medium text-slate-900">{email}</td>
      <td className="px-4 py-3">
        <VerifyBadge tone={tone}>{status}</VerifyBadge>
      </td>
    </tr>
  );
}
