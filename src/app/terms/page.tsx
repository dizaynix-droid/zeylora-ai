import { LegalPage } from "@/components/legal/legal-page";
import { createCmsPageMetadata, getDefaultCmsBody, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "Terms of Service";
const fallbackDescription = "Terms for using Zeylora AI email verification, list cleaning, usage-based credits, CSV exports, and account access.";

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
      title={fallbackTitle}
      description={fallbackDescription}
      bodyMarkdown={getDefaultCmsBody("terms")}
    />
  );
}
