import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { createMetadata } from "@/lib/seo";

export const cmsPageDefinitions = [
  {
    slug: "privacy",
    label: "Privacy Policy",
    metaTitle: "Privacy Policy | Zeylora AI",
    metaDescription: "How Zeylora AI handles account data, billing metadata, uploaded email lists, verification results, support messages, and privacy requests.",
    status: "PUBLISHED"
  },
  {
    slug: "terms",
    label: "Terms of Service",
    metaTitle: "Terms of Service | Zeylora AI",
    metaDescription: "Terms for using Zeylora AI email verification, list cleaning, usage-based credits, CSV exports, and account access.",
    status: "PUBLISHED"
  },
  {
    slug: "refund-policy",
    label: "Refund Policy",
    metaTitle: "Refund Policy | Zeylora AI",
    metaDescription: "Refund policy for Zeylora AI usage-based email verification credits, unused balances, duplicate payments, and billing reviews.",
    status: "PUBLISHED"
  },
  {
    slug: "contact",
    label: "Contact Page",
    metaTitle: "Contact Zeylora AI | Email Verification Support",
    metaDescription: "Contact Zeylora AI for email verification support, billing questions, bulk volume needs, enterprise usage, and privacy requests.",
    status: "PUBLISHED"
  },
  {
    slug: "about",
    label: "About Page",
    metaTitle: "About Zeylora AI | Email Verification Platform",
    metaDescription: "Learn how Zeylora AI helps businesses verify email addresses, clean lists, reduce bounce risk, and protect sender reputation.",
    status: "DRAFT"
  },
  {
    slug: "faq",
    label: "FAQ Page",
    metaTitle: "FAQ | Email Verification and List Cleaning",
    metaDescription: "Frequently asked questions about Zeylora AI email verification credits, bulk list cleaning, verification statuses, CSV exports, and deliverability.",
    status: "DRAFT"
  }
] as const;

export type AdminCmsPageRecord = {
  id: string | null;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  bodyMarkdown: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: Date | null;
  exists: boolean;
};

export type PublishedCmsPage = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  bodyMarkdown: string;
  updatedAt: Date;
};

export async function getAdminCmsPages(): Promise<AdminCmsPageRecord[]> {
  noStore();
  const pages = await prisma.page.findMany({
    where: { deletedAt: null, language: "en" },
    orderBy: [{ slug: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      metaTitle: true,
      metaDescription: true,
      contentJson: true,
      status: true,
      updatedAt: true
    }
  });

  const bySlug = new Map(pages.map((page) => [page.slug, page]));

  return cmsPageDefinitions.map((definition) => {
    const page = bySlug.get(definition.slug);
    if (!page) {
      return {
        id: null,
        slug: definition.slug,
        title: definition.label,
        metaTitle: definition.metaTitle,
        metaDescription: definition.metaDescription,
        bodyMarkdown: getDefaultCmsBody(definition.slug),
        status: definition.status,
        updatedAt: null,
        exists: false
      };
    }

    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      bodyMarkdown: extractBodyMarkdown(page.contentJson),
      status: page.status,
      updatedAt: page.updatedAt,
      exists: true
    };
  });
}

export async function getPublishedCmsPage(slug: string): Promise<PublishedCmsPage | null> {
  noStore();
  const page = await prisma.page.findFirst({
    where: {
      slug,
      language: "en",
      status: "PUBLISHED",
      deletedAt: null
    },
    select: {
      slug: true,
      title: true,
      metaTitle: true,
      metaDescription: true,
      contentJson: true,
      updatedAt: true
    }
  });

  if (!page) return null;

  const bodyMarkdown = extractBodyMarkdown(page.contentJson);
  if (containsLegacyPhotoEditorCopy([page.title, page.metaTitle, page.metaDescription, bodyMarkdown].join("\n"))) {
    return null;
  }

  return {
    slug: page.slug,
    title: page.title,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    bodyMarkdown,
    updatedAt: page.updatedAt
  };
}

export async function createCmsPageMetadata({
  slug,
  fallbackTitle,
  fallbackDescription,
  path
}: {
  slug: string;
  fallbackTitle: string;
  fallbackDescription: string;
  path: string;
}): Promise<Metadata> {
  const page = await getPublishedCmsPage(slug);
  return createMetadata({
    title: page?.metaTitle || fallbackTitle,
    description: page?.metaDescription || fallbackDescription,
    path
  });
}

export function extractBodyMarkdown(contentJson: unknown) {
  if (!contentJson || typeof contentJson !== "object") return "";
  const value = (contentJson as { bodyMarkdown?: unknown }).bodyMarkdown;
  return typeof value === "string" ? value : "";
}

export function getDefaultCmsBody(slug: string) {
  return defaultCmsBodies[slug] ?? defaultCmsBodies.about;
}

function containsLegacyPhotoEditorCopy(content: string) {
  const normalized = content.toLowerCase();
  return [
    "ai photo",
    "photo editing",
    "product photo",
    "background remover",
    "image generation",
    "creative assets",
    "visual editing",
    "ecommerce photo",
    "editing tools",
    "watermark-free",
    "uploaded images",
    "generated images"
  ].some((phrase) => normalized.includes(phrase));
}

const defaultCmsBodies: Record<string, string> = {
  about: `## What Zeylora AI does

Zeylora AI is an email verification and list cleaning platform for teams that need cleaner contact data before they send campaigns.

Businesses, marketers, agencies, ecommerce teams, and SaaS companies use Zeylora AI to verify email addresses, reduce bounce risk, detect invalid or risky emails, protect sender reputation, and prepare cleaner CSV exports.

## Who it is for

- Newsletter and lifecycle marketing teams cleaning subscriber lists
- Agencies preparing client email data before campaigns
- Ecommerce operators validating customer or lead lists
- SaaS and sales teams checking CRM exports before outreach
- Operators who need segmented results such as valid, invalid, risky, catch-all, disposable, and unknown

## Why email verification matters

Sending to invalid, disposable, risky, or unreachable addresses can waste budget, increase bounce rates, and harm sender reputation. Verification helps teams identify risky records before sending so they can work with cleaner data and make better campaign decisions.

Verification improves list quality, but it does not guarantee inbox placement. Final deliverability also depends on sender reputation, DNS setup, sending platform, content quality, recipient servers, and sending behavior.

## Usage-based credits

Zeylora AI uses verification credits. **1 credit verifies 1 email address.** Customers buy credits once and use them as needed. No subscription is required unless a subscription option is added in the future.

## Clean CSV exports

After verification, users can download segmented CSV exports such as valid-only, invalid-only, risky or catch-all, disposable, and full report files. The goal is simple: upload a list, verify it, and export cleaner campaign data.

## Trust and data handling

Uploaded email lists are processed to provide verification services. We do not sell uploaded email lists. Users should only upload email data they have the legal right to process.`,

  faq: `## What is Zeylora AI?

Zeylora AI is a usage-based email verification and list cleaning platform. It helps teams verify email addresses, reduce bounce risk, detect risky or disposable emails, and download cleaner CSV exports before campaigns.

## What is email verification?

Email verification checks whether an email address appears valid, reachable, risky, disposable, catch-all, invalid, or unknown. The goal is to improve list quality before sending.

## How many emails does 1 credit verify?

**1 credit verifies 1 email address.** Zeylora AI counts and deduplicates emails before verification so you can estimate how many credits a list needs.

## Do I need a subscription?

No. Zeylora AI is usage based. You can buy verification credits once and use them as needed. No subscription is required unless we add optional subscription plans in the future.

## What results can I download?

Completed jobs can include segmented CSV exports such as valid emails, invalid emails, risky or catch-all emails, disposable emails, unknown results, duplicates, and a full report with verification statuses.

## Can I verify bulk email lists?

Yes. Zeylora AI is designed for CSV, TXT, and pasted email lists. Large files may be processed in background batches so you can track progress without keeping a browser request open.

## What statuses can appear in reports?

Common statuses include valid, invalid, risky, catch-all, disposable, unknown, and duplicate. Provider-specific labels may be normalized into these categories for cleaner reporting.

## Can verification guarantee inbox placement?

No. Email verification helps reduce bounce risk and improve list quality, but inbox placement is never guaranteed. Deliverability also depends on sender reputation, DNS records, email content, sending platform, sending volume, and recipient mail servers.

## How fast does verification work?

Small lists can process quickly. Larger lists may be queued and verified in batches to protect reliability, provider limits, and account safety.

## Do unused credits expire?

Unused paid credits are intended to remain available unless a package-specific term, promotion, abuse policy, or future product rule says otherwise.

## Is my uploaded data secure?

Uploaded lists are used to provide verification services. We do not sell uploaded email lists. Access to exports should be controlled through account access and private download links where available.

## Can I contact support for large volume?

Yes. For larger verification volumes or operational questions, contact support through the contact page or your dashboard.`,

  privacy: `## Privacy Policy

This Privacy Policy explains how Zeylora AI handles data for email verification, email validation, list cleaning, bounce reduction, and deliverability-related workflows.

## Information we may process

We may process account information, billing and payment metadata, uploaded email lists, verification results, usage logs, analytics events, support messages, and technical information needed to operate and protect the service.

## Uploaded email lists

Uploaded email lists are used to provide verification services, including parsing, deduplication, provider checks, status classification, reporting, and CSV export generation.

We do not sell uploaded email lists. Users should only upload email data they have the legal right to process.

## Verification results

Verification results may include statuses such as valid, invalid, risky, catch-all, disposable, unknown, duplicate, and provider-related metadata. These results are informational and should be reviewed before campaign decisions.

## Payments and billing

Payments may be handled by third-party processors such as Stripe. We may store payment metadata such as payment status, package, credit delivery, transaction references, and billing support details. We do not store full card numbers.

## Service providers

Zeylora AI may use third-party infrastructure and verification providers to operate the service, process email verification jobs, store exports, deliver transactional emails, manage authentication, and process payments.

## Security and retention

We use operational safeguards intended to protect account access, uploaded data, verification results, and exports. Retention periods may vary based on account activity, legal requirements, abuse prevention, billing records, and product operations.

## Your responsibilities

You are responsible for ensuring that any email data you upload was collected and processed lawfully and that your use of Zeylora AI complies with applicable privacy, marketing, and data protection rules.

## Privacy requests

You may contact us for privacy questions, access requests, deletion requests, or data handling questions through the contact page or support email.`,

  terms: `## Terms of Service

These Terms govern your use of Zeylora AI, an email verification, email validation, list cleaning, bounce reduction, and deliverability support platform.

## Account and access

You are responsible for your account, login credentials, uploaded data, billing activity, and actions taken through your account.

## Legal right to process data

You must have the legal right to upload, verify, process, and export any email list or contact data you submit to Zeylora AI.

## Acceptable use

You may not use Zeylora AI for spam, phishing, fraud, harassment, unlawful activity, credential attacks, abusive automation, harmful unsolicited campaigns, or any use that violates applicable laws or platform policies.

We may suspend or restrict accounts for abuse, suspicious activity, chargebacks, policy violations, unlawful use, or attempts to harm the service.

## Verification results

Verification results are informational. Zeylora AI helps reduce bounce risk and improve list quality, but we do not guarantee inbox placement, deliverability, campaign performance, or revenue outcomes.

Final deliverability depends on sender reputation, domain setup, DNS records, sending infrastructure, email content, recipient servers, and sending behavior.

## Credits and billing

Zeylora AI uses usage-based verification credits. **1 credit is consumed per email verification attempt.** Credits are not a subscription unless an optional subscription product is added in the future.

Credit packages, prices, and included verification amounts are shown at checkout. You should review the package details before purchase.

## Bulk processing and availability

Large lists may be processed in batches or queued for reliability. Provider availability, rate limits, latency, and verification statuses may vary.

## Exports

Completed jobs may provide CSV exports such as valid-only, invalid-only, risky or catch-all, disposable, duplicate, unknown, and full report files. You are responsible for how exported data is used.

## Changes

We may update the service, pricing, policies, or these Terms as the product evolves. Continued use of the service means you accept the current terms.`,

  "refund-policy": `## Refund Policy

Zeylora AI sells usage-based email verification credits. This policy explains how refunds may be reviewed for credit purchases, billing errors, duplicate payments, and verification processing.

## Used credits

Used credits are generally non-refundable. A credit is considered used when verification processing begins for an email address or verification attempt.

## Unused credits

Unused paid credits may be reviewed for refund eligibility case by case. Refunds are not guaranteed and may depend on payment status, usage, account history, abuse checks, and applicable payment processor rules.

## Processing has started

Refunds are generally not guaranteed after verification processing begins, because provider costs and system resources may already be consumed.

## Duplicate payments and billing errors

Duplicate payments, accidental charges, or clear billing errors may be reviewed by support. Please include your account email, payment date, package, and any Stripe receipt or transaction reference available.

## Failed jobs

If a verification job fails because of a system or provider issue, we may restore credits or review the case through support. Credit restoration does not always mean a cash refund.

## Chargebacks

Chargebacks may result in account suspension, credit holds, or additional verification before account access is restored.

## Promotional credits

Promotional, bonus, manual, referral, or complimentary credits are not cash-refundable.

## Contact

For refund or billing questions, contact support with your account email and payment details.`,

  contact: `## Contact Zeylora AI

Use this page to contact Zeylora AI for email verification support, billing questions, verification result questions, bulk volume needs, enterprise usage, privacy requests, or account help.

## Support topics

- Account access and login support
- Billing, credit package, or payment questions
- Verification job questions
- CSV export and result interpretation
- Bulk verification volume and enterprise usage
- Privacy or data handling requests
- Provider or processing issues

## What to include

For faster support, include your account email, package or payment reference if relevant, verification job ID if available, and a short description of the issue.

## Large volume

If you need higher verification capacity or recurring operational usage, contact us for larger volume options and workflow guidance.`
};
