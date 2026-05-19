import { LegalPage } from "@/components/legal/legal-page";
import { createCmsPageMetadata, getDefaultCmsBody, getPublishedCmsPage } from "@/lib/cms/pages";

const fallbackTitle = "Refund Policy";
const fallbackDescription = "Refund policy for Zeylora AI usage-based email verification credits, unused balances, duplicate payments, and billing reviews.";

export function generateMetadata() {
  return createCmsPageMetadata({
    slug: "refund-policy",
    fallbackTitle,
    fallbackDescription,
    path: "/refund-policy"
  });
}

export default async function RefundPolicyPage() {
  const cmsPage = await getPublishedCmsPage("refund-policy");
  if (cmsPage) {
    return (
      <LegalPage
        eyebrow="Refunds"
        title={cmsPage.title}
        description={cmsPage.metaDescription}
        bodyMarkdown={cmsPage.bodyMarkdown}
        lastUpdated={cmsPage.updatedAt}
      />
    );
  }

  return (
    <LegalPage
      eyebrow="Refunds"
      title={fallbackTitle}
      description={fallbackDescription}
      bodyMarkdown={getDefaultCmsBody("refund-policy")}
    />
  );
}
