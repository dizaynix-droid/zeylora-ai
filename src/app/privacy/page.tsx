import { LegalPage } from "@/components/legal/legal-page";
import { createCmsPageMetadata, getDefaultCmsBody, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "Privacy Policy";
const fallbackDescription = "How Zeylora AI handles account data, billing metadata, uploaded email lists, verification results, support messages, and privacy requests.";

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
      title={fallbackTitle}
      description={fallbackDescription}
      bodyMarkdown={getDefaultCmsBody("privacy")}
    />
  );
}
