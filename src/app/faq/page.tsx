import { LegalPage } from "@/components/legal/legal-page";
import { createCmsPageMetadata, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "Zeylora AI FAQ";
const fallbackDescription = "Frequently asked questions about Zeylora AI previews, credits, exports, and product photo workflows.";

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
                title: "How previews and credits work",
                body: [
                  "You can generate branded previews first. Credits are spent when you unlock a watermark-free clean export.",
                  "If a clean export is already unlocked for a job, re-downloading it should not charge credits again."
                ]
              }
            ]
      }
    />
  );
}
