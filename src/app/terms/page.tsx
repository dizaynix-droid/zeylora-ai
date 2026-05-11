import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { appConfig } from "@/config/app";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Terms of Service",
  description: "Terms for using Zeylora AI uploads, AI edits, free watermarked exports, and future paid credits.",
  path: "/terms"
});

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of Service"
      description="These terms set clear expectations for using Zeylora AI, uploading images, generating AI edits, and downloading exports."
      sections={[
        {
          title: "Use of the service",
          body: [
            "You are responsible for the images you upload and must have the rights or permission needed to process them.",
            "You may not use Zeylora AI to upload illegal, abusive, unsafe, infringing, or harmful content. We may restrict accounts or jobs that appear abusive or risky."
          ]
        },
        {
          title: "AI results",
          body: [
            "Zeylora AI provides AI-assisted image editing. We do not guarantee that every result will be perfect, commercially suitable, or free from artifacts.",
            "Preview and generated images should be reviewed by you before use in advertisements, ecommerce listings, or public campaigns."
          ]
        },
        {
          title: "Providers and processing",
          body: [
            "The service may use third-party AI and infrastructure providers, including PhotoRoom, Replicate, Supabase, Cloudflare R2, or similar services.",
            "Provider availability, latency, quality, model behavior, and accepted input formats can vary. If a provider fails, the service may retry, fallback, or return a friendly error."
          ]
        },
        {
          title: "Exports and branding",
          body: [
            "Free exports may include Zeylora AI watermark branding. Watermark-free exports are planned for future paid credits or plans.",
            "Do not remove or misrepresent Zeylora AI branding from free exports in a way that violates these terms or future plan rules."
          ]
        },
        {
          title: "Contact",
          body: [
            `Questions about these terms can be sent to ${appConfig.supportEmail}. Update this placeholder before production launch.`
          ]
        }
      ]}
    />
  );
}
