import type { Metadata } from "next";
import { AdGroupLandingPage, type AdGroupLandingContent } from "@/components/landing/ad-group-landing-page";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Email Verification Service",
  description:
    "Email verification service for checking valid, invalid, risky, catch-all, and disposable emails before you send. Upload lists and export clean CSV segments.",
  path: "/email-verification"
});

const content: AdGroupLandingContent = {
  badge: "Email verification service",
  headline: "Email verification before your campaign sends.",
  intro:
    "Verify emails before they enter your next campaign. Upload a CSV/TXT file or paste addresses, remove duplicates, check unique emails, and download clean result segments.",
  supportCopy:
    "Built for teams that need an email verification service to reduce bounce risk, protect sender reputation, and keep CRM or newsletter lists cleaner before sending.",
  primaryCta: "Verify emails now",
  secondaryCta: "Create free account",
  proofPoints: [
    "1 unique email = 1 verification",
    "Duplicate removal before checks",
    "Valid, invalid, risky, disposable exports",
    "Usage based, no subscription"
  ],
  intentTitle: "A focused email verification workflow for clean list exports.",
  intentCopy:
    "This page is built for people searching for email verification: list checks, duplicate removal, result categories, and CSV exports in one place.",
  intentCards: [
    {
      icon: "mail",
      title: "Verify email addresses",
      copy: "Check syntax, domains, risky signals, disposable addresses, and deliverability status before sending."
    },
    {
      icon: "database",
      title: "Clean uploaded lists",
      copy: "Upload CSV/TXT files, deduplicate rows, and verify only unique addresses so your verification count is clear."
    },
    {
      icon: "file",
      title: "Export CSV segments",
      copy: "Download valid, invalid, risky/catch-all, disposable, and full report files for campaign prep."
    },
    {
      icon: "shield",
      title: "Protect sender reputation",
      copy: "Reduce avoidable hard bounces before they damage delivery and campaign reporting."
    }
  ],
  riskTitle: "Bad email data gets expensive after you send.",
  riskCopy:
    "Invalid and risky emails waste budget, inflate metrics, and can hurt deliverability. Verify first, then send to the cleanest segment.",
  faq: [
    {
      question: "What does email verification check?",
      answer: "Zeylora checks syntax, duplicate rows, domain signals, disposable addresses, risky/catch-all status, and result categories for CSV export."
    },
    {
      question: "Do duplicate emails use extra verifications?",
      answer: "No. Duplicates are removed first, so one unique email uses one verification."
    },
    {
      question: "Can I download the verified results?",
      answer: "Yes. You can export valid, invalid, risky/catch-all, disposable, and full report CSV files."
    },
    {
      question: "Do I need a subscription?",
      answer: "No. Zeylora is usage based, so you buy email verifications when you need them."
    }
  ]
};

export default async function EmailVerificationPage() {
  const packages = await getCreditPackagesForDisplay();
  return <AdGroupLandingPage content={content} packages={packages} />;
}
