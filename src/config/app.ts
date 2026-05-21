export const appConfig = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || process.env.NEXT_PUBLIC_SITE_NAME || "Zeylora",
  productName: "Zeylora Verification",
  shortName: "Zeylora",
  description:
    "Zeylora is an email verification and list cleaning platform for reducing bounce rate, protecting sender reputation, and improving deliverability.",
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
