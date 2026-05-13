import { LegalPage } from "@/components/legal/legal-page";
import { createCmsPageMetadata, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "About Zeylora AI";
const fallbackDescription = "Learn about Zeylora AI, an ecommerce product photo editing studio for sellers and creators.";

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
                  "Zeylora AI is built as an ecommerce product photo editor for sellers who need sharper, cleaner, marketplace-ready visuals.",
                  "The studio focuses on preview-first workflows, branded free previews, and credit-based clean exports."
                ]
              }
            ]
      }
    />
  );
}
