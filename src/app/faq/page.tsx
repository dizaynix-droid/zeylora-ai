import { LegalPage } from "@/components/legal/legal-page";
import { createCmsPageMetadata, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "Zeylora FAQ";
const fallbackDescription = "Frequently asked questions about Zeylora email verification credits, CSV uploads, and segmented exports.";

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
      bodyMarkdown={cmsPage?.bodyMarkdown}
      lastUpdated={cmsPage?.updatedAt}
      sections={
        cmsPage
          ? undefined
          : [
              {
                title: "How verification credits work",
                body: [
                  "1 credit verifies 1 unique email address. Zeylora counts and deduplicates emails before processing so you can estimate credit usage clearly.",
                  "Completed jobs include segmented downloads such as valid-only, invalid-only, risky/catch-all, disposable, and full report CSV files."
                ]
              }
            ]
      }
    />
  );
}
