import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { appConfig } from "@/config/app";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Refund Policy",
  description: "Refund policy for Zeylora AI credit packs, paid clean exports, failed jobs, and support review.",
  path: "/refund-policy"
});

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Refunds"
      title="Refund Policy"
      description="Clear expectations for credit purchases, clean exports, failed jobs, and support review."
      sections={[
        {
          title: "Credit purchases",
          body: [
            "Zeylora AI sells credit packs that can be used to unlock watermark-free clean exports from completed previews.",
            "Free preview exports may include Zeylora AI watermark branding. Clean exports use credits and are delivered through private signed download links."
          ]
        },
        {
          title: "Paid credits",
          body: [
            "Credits may be used for watermark-free exports, higher quality downloads, or other paid features described at checkout.",
            "Unused paid credits may be eligible for review according to the final policy displayed at the time of purchase. Used credits for successfully generated exports are generally not refundable."
          ]
        },
        {
          title: "Failed AI jobs",
          body: [
            "If a paid clean export fails because of a system or provider error, the credit ledger supports admin-reviewed credit restoration.",
            "AI quality varies by image. Imperfect results caused by complex inputs, low-resolution files, hair, hands, shoes, reflective surfaces, or low contrast may not always qualify for a cash refund."
          ]
        },
        {
          title: "Support review",
          body: [
            `For payment or refund questions, contact ${appConfig.supportEmail} with your account email, job ID, payment details, and a short description of the issue.`
          ]
        }
      ]}
    />
  );
}
