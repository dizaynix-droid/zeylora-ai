import { LegalPage } from "@/components/legal/legal-page";
import { appConfig } from "@/config/app";
import { createCmsPageMetadata, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "Privacy Policy";
const fallbackDescription = "How Zeylora AI handles uploads, AI processing, private storage, providers, and account data.";

export function generateMetadata() {
  return createCmsPageMetadata({
    slug: "privacy",
    fallbackTitle,
    fallbackDescription,
    path: "/privacy"
  });
}

export default async function PrivacyPage() {
  const cmsPage = await getPublishedCmsPage("privacy");
  if (cmsPage) {
    return (
      <LegalPage
        eyebrow="Privacy"
        title={cmsPage.title}
        description={cmsPage.metaDescription}
        bodyMarkdown={cmsPage.bodyMarkdown}
        lastUpdated={cmsPage.updatedAt}
      />
    );
  }

  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      description="This policy explains how Zeylora AI handles uploaded images, account data, AI processing, and private result storage."
      sections={[
        {
          title: "Information we collect",
          body: [
            "We may collect account information such as your email address, authentication provider, and basic profile details when you sign in.",
            "When you use Zeylora AI, we process images you upload, generated results, AI job metadata, ratings, waitlist submissions, and technical logs needed to operate the service."
          ]
        },
        {
          title: "AI image processing",
          body: [
            "Uploaded images may be sent to third-party AI providers such as PhotoRoom, Replicate, or future configured providers so the requested edit can be generated.",
            "AI results can vary and may not be perfect. Complex details such as hair, hands, shoes, reflective materials, low contrast, or low-resolution inputs may produce imperfect output."
          ]
        },
        {
          title: "Storage and signed URLs",
          body: [
            "Uploads and generated results are stored privately using S3-compatible storage such as Cloudflare R2. The app uses temporary signed URLs for previews and downloads instead of exposing raw storage paths.",
            "Temporary files and generated results may be deleted or expired according to future retention policies, abuse controls, storage limits, or user/admin actions."
          ]
        },
        {
          title: "Free and paid exports",
          body: [
            "Free exports may include Zeylora AI watermark branding, including a subtle protected watermark pattern and badge.",
            "Future paid credits or plans are intended to unlock watermark-free and full-quality exports, subject to the pricing and refund terms available at the time of purchase."
          ]
        },
        {
          title: "Contact",
          body: [
            `For privacy questions, contact ${appConfig.supportEmail}. Replace this placeholder with your production support address before launch.`
          ]
        }
      ]}
    />
  );
}
