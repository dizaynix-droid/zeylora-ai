export const analyticsConfig = {
  posthog: {
    enabled: process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "true",
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY || "",
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com"
  },
  plausible: {
    enabled: process.env.NEXT_PUBLIC_PLAUSIBLE_ENABLED === "true",
    domain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || ""
  },
  ga4: {
    enabled: process.env.NEXT_PUBLIC_GA4_ENABLED === "true",
    measurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || ""
  }
} as const;
