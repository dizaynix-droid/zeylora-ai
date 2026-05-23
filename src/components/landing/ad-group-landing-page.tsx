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
import { businessFoundation } from "@/config/business";

type DisplayPackage = {
  id: string;
  key: string;
  name: string;
  price: number;
  totalCredits: number;
  description: string;
  badgeText?: string | null;
  highlight?: boolean;
};

export type AdGroupLandingContent = {
  badge: string;
  headline: string;
  intro: string;
  supportCopy: string;
  primaryCta: string;
  secondaryCta: string;
  proofPoints: string[];
  intentTitle: string;
  intentCopy: string;
  intentCards: Array<{
    icon: "mail" | "database" | "shield" | "file";
    title: string;
    copy: string;
  }>;
  riskTitle: string;
  riskCopy: string;
  faq: Array<{
    question: string;
    answer: string;
  }>;
};

const FREE_VERIFICATION_LIMIT = businessFoundation.credits.freeTrialCredits;

export function AdGroupLandingPage({
  content,
  packages
}: {
  content: AdGroupLandingContent;
  packages: DisplayPackage[];
}) {
  const compactPackages = packages.slice(0, 3);

  return (
    <>
      <SiteHeader />
      <VerifyPageShell className="bg-white">
        <section id="top" className="border-b border-slate-200 bg-white">
          <VerifyContainer className="grid gap-7 py-7 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:py-10">
            <div>
              <VerifyBadge tone="blue">{content.badge}</VerifyBadge>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.04] text-slate-950 sm:text-5xl lg:text-6xl">
                {content.headline}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">{content.intro}</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{content.supportCopy}</p>
              {FREE_VERIFICATION_LIMIT > 0 ? (
                <p className="mt-3 max-w-2xl rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold leading-6 text-blue-800">
                  Start free with {FREE_VERIFICATION_LIMIT.toLocaleString()} email verifications. No subscription required.
                </p>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <VerifyAction href="#verify-list" className="h-12 px-5 text-base">
                  {content.primaryCta}
                  <ArrowRight size={18} />
                </VerifyAction>
                <VerifyAction href="/auth/sign-in?mode=signup&next=/dashboard%23verify" variant="secondary" className="h-12 px-5 text-base">
                  {content.secondaryCta}
                </VerifyAction>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {content.proofPoints.map((point, index) => (
                  <HeroPoint key={point} icon={proofIcons[index % proofIcons.length]} text={point} />
                ))}
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
                <VerifyBadge tone="green">Focused workflow</VerifyBadge>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {content.intentTitle}
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600">{content.intentCopy}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {content.intentCards.map((card) => (
                  <IntentCard key={card.title} icon={intentIcons[card.icon]} title={card.title} copy={card.copy} />
                ))}
              </div>
            </div>
          </VerifyContainer>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <VerifyContainer className="py-9 lg:py-12">
            <div className="max-w-3xl">
              <VerifyBadge>Simple workflow</VerifyBadge>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Upload, verify, export.
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Keep paid traffic focused on one job: add a list, verify unique emails, and download CSV segments before your next send.
              </p>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <WorkflowStep icon={UploadCloud} title="1. Add emails" copy="Paste addresses or upload CSV/TXT files. Zeylora parses rows and removes duplicates." />
              <WorkflowStep icon={MailCheck} title="2. Verify unique emails" copy="Check syntax, domain, disposable, risky, catch-all, and deliverability signals." />
              <WorkflowStep icon={Download} title="3. Download CSVs" copy="Export valid-only, invalid-only, risky/catch-all, disposable, and full reports." />
            </div>
          </VerifyContainer>
        </section>

        <section className="border-b border-slate-200 bg-[#f7f8fb]">
          <VerifyContainer className="py-9 lg:py-12">
            <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
              <div>
                <VerifyBadge tone="amber">Campaign protection</VerifyBadge>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {content.riskTitle}
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600">{content.riskCopy}</p>
              </div>
              <VerifyPanel className="p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SegmentCard icon={CheckCircle2} title="Valid emails" copy="Ready for campaign export." tone="green" />
                  <SegmentCard icon={XCircle} title="Invalid emails" copy="Remove hard-bounce risk." tone="red" />
                  <SegmentCard icon={ShieldCheck} title="Risky / catch-all" copy="Review uncertain addresses separately." tone="amber" />
                  <SegmentCard icon={FileCheck2} title="Full report" copy="Keep row-level status for your team." tone="blue" />
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
                  Before you verify emails.
                </h2>
              </div>
              <div className="grid gap-3">
                {content.faq.map((item) => (
                  <FaqItem key={item.question} question={item.question} answer={item.answer} />
                ))}
              </div>
            </div>
          </VerifyContainer>
        </section>
      </VerifyPageShell>
      <SiteFooter />
    </>
  );
}

const proofIcons = [MailCheck, DatabaseZap, ShieldCheck, Download];

const intentIcons: Record<AdGroupLandingContent["intentCards"][number]["icon"], LucideIcon> = {
  database: DatabaseZap,
  file: FileCheck2,
  mail: MailCheck,
  shield: ShieldCheck
};

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

function formatCostPerThousand(price: number, verifications: number) {
  if (!verifications) return "$0.00";
  return `$${((price / verifications) * 1000).toFixed(2)}`;
}
