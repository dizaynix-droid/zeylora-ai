import { LegalPage } from "@/components/legal/legal-page";
import { createCmsPageMetadata, getDefaultCmsBody, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "FAQ | Email Verification and List Cleaning";
const fallbackDescription = "Frequently asked questions about Zeylora AI email verification credits, bulk list cleaning, verification statuses, CSV exports, and deliverability.";

export function generateMetadata() {
  return createCmsPageMetadata({
    slug: "faq",
    fallbackTitle,
    fallbackDescription,
    path: "/faq"
  });
}

export default async function FaqPage() {
  const cmsPage = await getPublishedCmsPage("faq");
  return (
    <LegalPage
      eyebrow="FAQ"
      title={cmsPage?.title || fallbackTitle}
      description={cmsPage?.metaDescription || fallbackDescription}
      bodyMarkdown={cmsPage?.bodyMarkdown || getDefaultCmsBody("faq")}
      lastUpdated={cmsPage?.updatedAt}
    />
  );
}
