import type { Metadata } from "next";
import { AdGroupLandingPage, type AdGroupLandingContent } from "@/components/landing/ad-group-landing-page";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Bulk Email Verifier",
  description:
    "Bulk email verifier for CSV and TXT lists. Remove duplicates, verify unique email addresses, and export valid, invalid, risky, disposable, and full reports.",
  path: "/bulk-email-verifier"
});

const content: AdGroupLandingContent = {
  badge: "Bulk email verifier",
  headline: "Bulk email verifier for CSV and TXT lists.",
  intro:
    "Upload a bulk email list, remove duplicate addresses, verify each unique email, and export clean CSV segments before you send.",
  supportCopy:
    "Use Zeylora when you need a bulk email verifier for campaign lists, CRM exports, newsletter databases, and agency workflows.",
  primaryCta: "Verify bulk list",
  secondaryCta: "Start with free verifications",
  proofPoints: [
    "CSV/TXT list upload",
    "Duplicates removed before billing",
    "Up to 50,000 emails per public job",
    "Clean CSV downloads"
  ],
  intentTitle: "Built for list uploads, not one-by-one checks.",
  intentCopy:
    "Bulk email verification needs a workflow that can parse files, count unique emails, reserve the right verification volume, and export usable segments.",
  intentCards: [
    {
      icon: "database",
      title: "Bulk CSV/TXT verification",
      copy: "Upload marketing lists, CRM exports, or newsletter files and let the server parse the list safely."
    },
    {
      icon: "mail",
      title: "Unique email counting",
      copy: "Zeylora deduplicates first, then calculates the exact verification count for the job."
    },
    {
      icon: "shield",
      title: "Risk and catch-all review",
      copy: "Separate uncertain results from valid addresses instead of deleting everything blindly."
    },
    {
      icon: "file",
      title: "Segmented exports",
      copy: "Download valid-only, invalid-only, risky/catch-all, disposable, and full report CSVs."
    }
  ],
  riskTitle: "Bulk sends amplify bad data fast.",
  riskCopy:
    "One dirty bulk list can create a wave of bounces. Verify the list first so your campaign starts with cleaner, segmented data.",
  faq: [
    {
      question: "Can I upload a CSV file?",
      answer: "Yes. Zeylora supports CSV and TXT uploads from the dashboard, plus pasted lists for smaller batches."
    },
    {
      question: "How many verifications does a bulk list need?",
      answer: "One unique email uses one verification. Duplicate rows are removed before the job is charged."
    },
    {
      question: "What is the current public job limit?",
      answer: "The current public job limit is 50,000 emails. Larger lists should be split or handled with support."
    },
    {
      question: "Can I export results by status?",
      answer: "Yes. You can download separate CSV files for valid, invalid, risky/catch-all, disposable, and full report results."
    }
  ]
};

export default async function BulkEmailVerifierPage() {
  const packages = await getCreditPackagesForDisplay();
  return <AdGroupLandingPage content={content} packages={packages} />;
}
