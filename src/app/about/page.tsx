import { LegalPage } from "@/components/legal/legal-page";
import { createCmsPageMetadata, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "About Zeylora";
const fallbackDescription = "Learn about Zeylora, an email verification and list cleaning platform for serious senders.";

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
      bodyMarkdown={cmsPage?.bodyMarkdown}
      lastUpdated={cmsPage?.updatedAt}
      sections={
        cmsPage
          ? undefined
          : [
              {
                title: "Product focus",
                body: [
                  "Zeylora is built for marketers, agencies, ecommerce teams, SaaS operators, and cold email users who need cleaner email lists before sending.",
                  "The platform focuses on credit-based bulk verification, private uploads, segmented CSV exports, and operational reporting."
                ]
              }
            ]
      }
    />
  );
}
