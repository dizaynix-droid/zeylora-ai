import { LegalPage } from "@/components/legal/legal-page";
import { appConfig } from "@/config/app";
import { createCmsPageMetadata, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "Contact";
const fallbackDescription = "Contact Zeylora AI for support, privacy, refunds, provider issues, and launch questions.";

export function generateMetadata() {
  return createCmsPageMetadata({
    slug: "contact",
    fallbackTitle,
    fallbackDescription,
    path: "/contact"
  });
}

export default async function ContactPage() {
  const cmsPage = await getPublishedCmsPage("contact");
  if (cmsPage) {
    return (
      <LegalPage
        eyebrow="Contact"
        title={cmsPage.title}
        description={cmsPage.metaDescription}
        bodyMarkdown={cmsPage.bodyMarkdown}
        lastUpdated={cmsPage.updatedAt}
      />
    );
  }

  return (
    <LegalPage
      eyebrow="Contact"
      title="Contact Zeylora AI"
      description="Use this page for support, legal, privacy, refund, and launch readiness questions."
      sections={[
        {
          title: "Support email",
          body: [
            `Support placeholder: ${appConfig.supportEmail}. Replace this with the production support email before going live.`,
            "For faster support, include your account email, the tool used, job ID if available, and a short description of the issue."
          ]
        },
        {
          title: "Common support topics",
          body: [
            "AI result quality can vary by image. Please include the input type and what looked wrong in the output.",
            "Uploads and exports use private storage and temporary signed URLs. Do not share signed links publicly if they contain sensitive images.",
            "For paid credit questions, include the payment email, order details, and related job ID when available."
          ]
        }
      ]}
    />
  );
}
