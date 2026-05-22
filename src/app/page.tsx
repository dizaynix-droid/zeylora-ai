import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  DatabaseZap,
  Download,
  FileCheck2,
  MailCheck,
  ShieldCheck,
  UploadCloud,
  XCircle
} from "lucide-react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { HomepageListChecker } from "@/components/home/homepage-list-checker";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import {
  VerifyAction,
  VerifyBadge,
  VerifyContainer,
  VerifyPageShell,
  VerifyPanel
} from "@/components/verify-ui/core";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";
import { createMetadata } from "@/lib/seo";

type DisplayPackage = Awaited<ReturnType<typeof getCreditPackagesForDisplay>>[number];

export const metadata: Metadata = createMetadata({
  title: "Email Verification & Email Address Checker",
  description:
    "Fast email verification, email address checker, bulk email verifier, email list cleaning, duplicate removal, and clean CSV exports before you send.",
  path: "/"
});

export default async function HomePage() {
  const packages = await getCreditPackagesForDisplay();
  const heroPackages = getHeroOfferPackages(packages);
  const compactPackages = heroPackages.length ? heroPackages : packages.slice(0, 3);

  return (
    <>
      <SiteHeader />
      <VerifyPageShell className="bg-white">
        <section id="top" className="border-b border-slate-200 bg-white">
          <VerifyContainer className="grid gap-7 py-7 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:py-10">
            <div>
              <VerifyBadge tone="blue">Email verification and list cleaning</VerifyBadge>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.04] text-slate-950 sm:text-5xl lg:text-6xl">
                Email verification and email address checker for clean lists.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Check if email addresses are valid before you send. Upload a CSV/TXT list or paste emails, remove duplicates, verify unique addresses, and download valid, invalid, risky, disposable, and full CSV reports.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Use Zeylora as an email verifier, email validity checker, bulk email verifier, or email list verification workflow for campaigns, newsletters, CRMs, and agencies.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <VerifyAction href="#verify-list" className="h-12 px-5 text-base">
                  Check email list now
                  <ArrowRight size={18} />
                </VerifyAction>
                <VerifyAction href="#pricing" variant="secondary" className="h-12 px-5 text-base">
                  See pricing
                </VerifyAction>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <HeroPoint icon={MailCheck} text="1 unique email = 1 verification" />
                <HeroPoint icon={DatabaseZap} text="Duplicates removed before verification" />
                <HeroPoint icon={ShieldCheck} text="Reduce bounce risk before sending" />
                <HeroPoint icon={Download} text="Download clean CSV segments" />
              </div>

              {compactPackages.length ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {compactPackages.map((pack) => (
                    <MiniPlan key={pack.id} pack={pack} />
                  ))}
                </div>
              ) : null}
            </div>

            <div id="verify-list" className="scroll-mt-24">
              <HomepageListChecker />
            </div>
          </VerifyContainer>
        </section>

        <section className="border-b border-slate-200 bg-[#f7f8fb]">
          <VerifyContainer className="py-9 lg:py-12">
            <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
              <div>
                <VerifyBadge tone="green">Built for search intent</VerifyBadge>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  The checks buyers search for, in one workflow.
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Match the job to the list: verify a single address, check a pasted batch, or clean a bulk CSV before your next campaign.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <IntentCard icon={MailCheck} title="Email address checker" copy="Check email validity signals before an address enters your CRM or newsletter tool." />
                <IntentCard icon={DatabaseZap} title="Bulk email verifier" copy="Verify CSV/TXT lists and only count unique emails after duplicates are removed." />
                <IntentCard icon={FileCheck2} title="Email list verification" copy="Segment valid, invalid, risky, catch-all, disposable, duplicate, and full report CSVs." />
                <IntentCard icon={ShieldCheck} title="Check if email exists" copy="Review syntax, domain, disposable, catch-all, and deliverability signals before sending." />
              </div>
            </div>
          </VerifyContainer>
        </section>

        <section id="how-it-works" className="border-b border-slate-200 bg-white">
          <VerifyContainer className="py-9 lg:py-12">
            <div className="max-w-3xl">
              <VerifyBadge>Simple verification workflow</VerifyBadge>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Upload, verify, export.
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Keep the process direct for paid traffic: no subscription, no long setup, and no guessing which rows should be removed.
              </p>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <WorkflowStep icon={UploadCloud} title="1. Add your list" copy="Paste emails or upload CSV/TXT files. Zeylora parses addresses and removes duplicates." />
              <WorkflowStep icon={MailCheck} title="2. Verify unique emails" copy="Run validation checks and separate valid, risky, invalid, disposable, and catch-all results." />
              <WorkflowStep icon={Download} title="3. Download CSVs" copy="Export valid-only, invalid-only, risky/catch-all, disposable, and full reports." />
            </div>
          </VerifyContainer>
        </section>

        <section className="border-b border-slate-200 bg-[#f7f8fb]">
          <VerifyContainer className="py-9 lg:py-12">
            <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
              <div>
                <VerifyBadge tone="amber">Reduce campaign waste</VerifyBadge>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Clean the list before bounce risk damages performance.
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Invalid and risky addresses waste sends, distort campaign reporting, and can hurt sender reputation. Zeylora gives you export-ready segments before you launch.
                </p>
              </div>
              <VerifyPanel className="p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SegmentCard icon={CheckCircle2} title="Valid emails" copy="Ready for your next campaign export." tone="green" />
                  <SegmentCard icon={XCircle} title="Invalid emails" copy="Remove hard-bounce risk before sending." tone="red" />
                  <SegmentCard icon={ShieldCheck} title="Risky / catch-all" copy="Review uncertain addresses separately." tone="amber" />
                  <SegmentCard icon={FileCheck2} title="Full report" copy="Keep a row-level status file for your team." tone="blue" />
                </div>
              </VerifyPanel>
            </div>
          </VerifyContainer>
        </section>

        <section id="pricing" className="border-b border-slate-200 bg-white">
          <VerifyContainer className="py-9 lg:py-12">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <VerifyBadge>Usage based, no subscription</VerifyBadge>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Start with the right verification volume.
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  1 email verification checks 1 unique email. Buy once, clean your list, and export the CSV segments you need.
                </p>
              </div>
              <VerifyAction href="/pricing" variant="secondary">View all packages</VerifyAction>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {compactPackages.map((pack) => (
                <PricingCard key={pack.id} pack={pack} />
              ))}
            </div>
          </VerifyContainer>
        </section>

        <section className="bg-[#f7f8fb]">
          <VerifyContainer className="py-9 lg:py-12">
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <VerifyBadge tone="blue">Quick answers</VerifyBadge>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Email verification questions, answered fast.
                </h2>
              </div>
              <div className="grid gap-3">
                <FaqItem question="Can I check if an email address is valid?" answer="Yes. You can paste addresses or upload a CSV/TXT list, then review valid, invalid, risky, catch-all, disposable, and full report exports." />
                <FaqItem question="Do duplicates use extra verifications?" answer="No. Zeylora removes duplicates first, so 1 unique email equals 1 email verification." />
                <FaqItem question="Can I verify a bulk email list?" answer="Yes. Bulk email list verification works with CSV/TXT uploads and pasted lists. Larger lists are handled from the dashboard." />
                <FaqItem question="Do I need a subscription?" answer="No. Pricing is usage based, so you buy email verification volume when you need it." />
              </div>
            </div>
          </VerifyContainer>
        </section>
      </VerifyPageShell>
      <SiteFooter />
    </>
  );
}

function HeroPoint({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
      <Icon size={16} className="shrink-0 text-blue-700" />
      <span>{text}</span>
    </div>
  );
}

function MiniPlan({ pack }: { pack: DisplayPackage }) {
  return (
    <a href="#pricing" className="rounded-md border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:bg-blue-50">
      <p className="text-sm font-semibold text-slate-950">{pack.name}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">${pack.price}</p>
      <p className="mt-1 text-xs font-semibold text-blue-700">{pack.totalCredits.toLocaleString()} email verifications</p>
    </a>
  );
}

function IntentCard({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return (
    <VerifyPanel className="p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-blue-50 p-2 text-blue-700">
          <Icon size={18} />
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
        </div>
      </div>
    </VerifyPanel>
  );
}

function WorkflowStep({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return (
    <VerifyPanel className="p-5">
      <div className="w-fit rounded-md bg-blue-50 p-3 text-blue-700">
        <Icon size={21} />
      </div>
      <h3 className="mt-4 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
    </VerifyPanel>
  );
}

function SegmentCard({
  icon: Icon,
  title,
  copy,
  tone
}: {
  icon: LucideIcon;
  title: string;
  copy: string;
  tone: "green" | "red" | "amber" | "blue";
}) {
  const color =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "red"
        ? "bg-rose-50 text-rose-700"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700"
          : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <span className={`inline-flex rounded-md p-2 ${color}`}>
        <Icon size={18} />
      </span>
      <h3 className="mt-3 text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}

function PricingCard({ pack }: { pack: DisplayPackage }) {
  return (
    <VerifyPanel className={`flex h-full flex-col p-5 ${pack.highlight ? "border-blue-300 bg-blue-50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xl font-semibold text-slate-950">{pack.name}</h3>
        {pack.highlight || pack.key === "scale" ? <VerifyBadge tone="blue">Most popular</VerifyBadge> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{pack.description}</p>
      <p className="mt-5 text-4xl font-semibold tracking-tight text-slate-950">${pack.price}</p>
      <p className="mt-2 text-sm font-semibold text-blue-700">{pack.totalCredits.toLocaleString()} email verifications</p>
      <p className="mt-1 text-xs font-semibold uppercase text-slate-500">
        {formatCostPerThousand(pack.price, pack.totalCredits)} per 1k
      </p>
      <CheckoutButton
        packageId={pack.id}
        label="Buy email verifications"
        className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
      />
    </VerifyPanel>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <VerifyPanel className="p-4">
      <h3 className="text-base font-semibold text-slate-950">{question}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{answer}</p>
    </VerifyPanel>
  );
}

function getHeroOfferPackages(packages: DisplayPackage[]) {
  const preferredKeys = ["starter", "growth", "scale"];
  return preferredKeys
    .map((key) => packages.find((pack) => pack.key === key))
    .filter((pack): pack is DisplayPackage => Boolean(pack));
}

function formatCostPerThousand(price: number, verifications: number) {
  if (!verifications) return "$0.00";
  return `$${((price / verifications) * 1000).toFixed(2)}`;
}
