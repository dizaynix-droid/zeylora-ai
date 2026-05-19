import { LegalPage } from "@/components/legal/legal-page";
import { createCmsPageMetadata, getDefaultCmsBody, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "About Zeylora AI | Email Verification Platform";
const fallbackDescription = "Learn how Zeylora AI helps businesses verify email addresses, clean lists, reduce bounce risk, and protect sender reputation.";

export function generateMetadata() {
  return createCmsPageMetadata({
    slug: "about",
    fallbackTitle,
    fallbackDescription,
    path: "/about"
  });
}

export default async function AboutPage() {
  const cmsPage = await getPublishedCmsPage("about");
  return (
    <LegalPage
      eyebrow="About"
      title={cmsPage?.title || fallbackTitle}
      description={cmsPage?.metaDescription || fallbackDescription}
      bodyMarkdown={cmsPage?.bodyMarkdown || getDefaultCmsBody("about")}
      lastUpdated={cmsPage?.updatedAt}
    />
  );
}
