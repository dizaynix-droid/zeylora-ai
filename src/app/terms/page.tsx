import { LegalPage } from "@/components/legal/legal-page";
import { appConfig } from "@/config/app";
import { createCmsPageMetadata, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "Terms of Service";
const fallbackDescription = "Terms for using Zeylora AI uploads, AI edits, free watermarked previews, paid credits, and clean exports.";

export function generateMetadata() {
  return createCmsPageMetadata({
    slug: "terms",
    fallbackTitle,
    fallbackDescription,
    path: "/terms"
  });
}

export default async function TermsPage() {
  const cmsPage = await getPublishedCmsPage("terms");
  if (cmsPage) {
    return (
      <LegalPage
        eyebrow="Terms"
        title={cmsPage.title}
        description={cmsPage.metaDescription}
        bodyMarkdown={cmsPage.bodyMarkdown}
        lastUpdated={cmsPage.updatedAt}
      />
    );
  }

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
            "Free preview exports may include Zeylora AI watermark branding. Watermark-free clean exports require credits unless a promotion states otherwise.",
            "Do not remove or misrepresent Zeylora AI branding from free previews in a way that violates these terms."
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
