import { LegalPage } from "@/components/legal/legal-page";
import { createCmsPageMetadata, getDefaultCmsBody, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "Contact Zeylora AI | Email Verification Support";
const fallbackDescription = "Contact Zeylora AI for email verification support, billing questions, bulk volume needs, enterprise usage, and privacy requests.";

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
      title={fallbackTitle}
      description={fallbackDescription}
      bodyMarkdown={getDefaultCmsBody("contact")}
    />
  );
}
