export const trackingEvents = {
  pageView: "page_view",
  uploadStarted: "upload_started",
  toolSelected: "tool_selected",
  jobStarted: "job_started",
  jobCompleted: "job_completed",
  jobFailed: "job_failed",
  signup: "signup",
  checkoutStarted: "checkout_started",
  checkoutCompleted: "checkout_completed",
  purchase: "purchase",
  creditUsed: "credit_used",
  creditsSpent: "credits_spent",
  downloadResult: "download_result",
  presetSelected: "preset_selected",
  watermarkFreeExport: "watermark_free_export",
  abuseBlocked: "abuse_blocked",
  rateLimited: "rate_limited"
} as const;

export type TrackingEvent = (typeof trackingEvents)[keyof typeof trackingEvents];
