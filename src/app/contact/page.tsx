import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { appConfig } from "@/config/app";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Contact",
  description: "Contact Zeylora AI for support, privacy, refunds, provider issues, and launch questions.",
  path: "/contact"
});

export default function ContactPage() {
  return (
    <LegalPage
      eyebrow="Contact"
      title="Contact Zeylora AI"
      description="Use this page for support, legal, privacy, refund, and launch readiness questions."
      sections={[
        {
          title: "Support email",
          body: [
            `Support placeholder: ${appConfig.supportEmail}. Replace this with the production support email before going live.`,
            "For faster support, include your account email, the tool used, job ID if available, and a short description of the issue."
          ]
        },
        {
          title: "Common support topics",
          body: [
            "AI result quality can vary by image. Please include the input type and what looked wrong in the output.",
            "Uploads and exports use private storage and temporary signed URLs. Do not share signed links publicly if they contain sensitive images.",
            "For paid credit questions, include the payment email, order details, and related job ID when available."
          ]
        }
      ]}
    />
  );
}
