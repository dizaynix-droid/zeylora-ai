import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { appConfig } from "@/config/app";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Refund Policy",
  description: "Refund policy for future Zeylora AI credit packs, paid exports, failed jobs, and support review.",
  path: "/refund-policy"
});

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Refunds"
      title="Refund Policy"
      description="Payments are not active yet. This page prepares clear refund expectations for future credit packs and paid exports."
      sections={[
        {
          title: "Current payment status",
          body: [
            "Zeylora AI does not currently process live payments or paid checkout. Pricing cards are a preview for future credit packs and plans.",
            "Free exports may include watermarked Zeylora AI branding. Watermark-free exports are planned for future paid credits or plans."
          ]
        },
        {
          title: "Future paid credits",
          body: [
            "When paid credits launch, credits may be used for watermark-free exports, higher quality downloads, or other paid features described at checkout.",
            "Unused paid credits may be eligible for review according to the final policy displayed at the time of purchase. Used credits for successfully generated exports are generally not refundable."
          ]
        },
        {
          title: "Failed AI jobs",
          body: [
            "If future paid jobs fail because of a system or provider error, the credit ledger is designed to support automatic refunds or admin-reviewed credit restoration.",
            "AI quality varies by image. Imperfect results caused by complex inputs, low-resolution files, hair, hands, shoes, reflective surfaces, or low contrast may not always qualify for a cash refund."
          ]
        },
        {
          title: "Support review",
          body: [
            `For future payment or refund questions, contact ${appConfig.supportEmail} with your account email, job ID, and a short description of the issue. Replace this placeholder before launch.`
          ]
        }
      ]}
    />
  );
}
