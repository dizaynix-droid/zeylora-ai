export const businessFoundation = {
  credits: {
    freeTrialCredits: 0,
    lowCreditThreshold: 5,
    enforcementEnabled: true,
    transactionsEnabled: true
  },
  exports: {
    freeWatermarkEnabled: true,
    freeWatermarkText: "Made with Zeylora AI",
    paidExportMode: "Paid credits unlock watermark-free, full-quality exports."
  },
  abuseProtection: {
    enabled: true,
    uploadWindowMs: 60_000,
    uploadMaxRequests: 10,
    jobWindowMs: 60_000,
    jobMaxRequests: 10,
    jobDailyMaxRequests: 100,
    guestPreviewWindowMs: 60_000,
    guestPreviewMaxRequests: 3,
    guestPreviewHourlyWindowMs: 3_600_000,
    guestPreviewHourlyMaxRequests: 15,
    cooldownMs: 0,
    blockEmptyUserAgent: true
  },
  adminPlaceholders: {
    creditAdjustments: "Future admin action for manually adding or removing credits.",
    pricingManagement: "Future admin screen for editing credit packs and feature flags.",
    paymentReview: "Future admin table for Stripe, Paddle, or LemonSqueezy payment events."
  }
} as const;
