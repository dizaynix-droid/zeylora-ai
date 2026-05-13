export const appConfig = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || process.env.NEXT_PUBLIC_SITE_NAME || "Zeylora AI",
  shortName: "Zeylora",
  description:
    "Zeylora AI is a cinematic AI photo editing platform for enhancing, restoring, transforming, and exporting professional-quality images with credits.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  defaultLocale: "en",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@zeylora.ai",
  legalCompanyName: "Company Name",
  social: {
    x: "",
    instagram: "",
    youtube: ""
  }
} as const;
