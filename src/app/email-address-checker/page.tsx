import type { Metadata } from "next";
import { AdGroupLandingPage, type AdGroupLandingContent } from "@/components/landing/ad-group-landing-page";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Email Address Checker",
  description:
    "Email address checker for validating pasted emails or uploaded lists. Check email validity, remove duplicates, and export clean CSV reports.",
  path: "/email-address-checker"
});

const content: AdGroupLandingContent = {
  badge: "Email address checker",
  headline: "Email address checker for valid campaign lists.",
  intro:
    "Check whether email addresses are valid before they reach your campaign. Paste addresses or upload a list, verify unique emails, and download segmented CSV reports.",
  supportCopy:
    "Use Zeylora as an email address checker, email validity checker, or list cleaning workflow when you need clean data before sending.",
  primaryCta: "Check email addresses",
  secondaryCta: "Create free account",
  proofPoints: [
    "Check email validity signals",
    "Paste or upload lists",
    "Disposable and risky detection",
    "Full report CSV export"
  ],
  intentTitle: "For people searching to check email addresses.",
  intentCopy:
    "This landing page keeps the promise clear: add emails, check validity signals, and export usable results without a long setup.",
  intentCards: [
    {
      icon: "mail",
      title: "Email validity checker",
      copy: "Review syntax, domain, disposable, catch-all, and deliverability signals for each unique address."
    },
    {
      icon: "database",
      title: "Paste or upload",
      copy: "Start with pasted emails on the landing page, or upload CSV/TXT files from the dashboard."
    },
    {
      icon: "shield",
      title: "Reduce bounce risk",
      copy: "Find invalid and risky addresses before they create avoidable delivery issues."
    },
    {
      icon: "file",
      title: "Clean result exports",
      copy: "Download CSV segments for valid, invalid, risky/catch-all, disposable, and full report data."
    }
  ],
  riskTitle: "Checking emails first keeps bad rows out of your send.",
  riskCopy:
    "A quick email address check can catch invalid, disposable, duplicate, and risky entries before they waste campaign budget.",
  faq: [
    {
      question: "Can I check one email address?",
      answer: "Yes. You can paste one address or a batch of addresses. Zeylora will parse and verify the unique emails."
    },
    {
      question: "Can I check a list of email addresses?",
      answer: "Yes. Paste a smaller list or upload CSV/TXT files from the dashboard for bulk verification."
    },
    {
      question: "Will duplicates be counted twice?",
      answer: "No. Duplicate addresses are removed first, so one unique email equals one verification."
    },
    {
      question: "What reports do I get?",
      answer: "You can export valid, invalid, risky/catch-all, disposable, and full report CSV files after verification."
    }
  ]
};

export default async function EmailAddressCheckerPage() {
  const packages = await getCreditPackagesForDisplay();
  return <AdGroupLandingPage content={content} packages={packages} />;
}
