import { trackingEvents } from "@/config/tracking";
import { trackEvent as trackClientEvent } from "@/lib/analytics/track";

export const behaviorAnalyticsEvents = {
  landingView: "landing_view",
  uploadClick: "upload_click",
  authRequired: "auth_required",
  signupCompleted: "signup_completed",
  trialPackView: "trial_pack_view",
  toolPageView: "tool_page_view",
  uploadStarted: "upload_started",
  uploadCompleted: "upload_completed",
  previewGenerated: "preview_generated",
  previewDownloaded: "preview_downloaded",
  pricingView: "pricing_view",
  checkoutStarted: "checkout_started",
  checkoutCompleted: "checkout_completed",
  referralClick: "referral_click",
  referralSignup: "referral_signup",
  referralCheckout: "referral_checkout",
  referralPurchase: "referral_purchase",
  affiliateRewardCreated: "affiliate_reward_created",
  firstCleanExport: "first_clean_export",
  dashboardOpened: "dashboard_opened",
  cleanExportClicked: "clean_export_clicked",
  creditsPageView: "credits_page_view",
  ticketCreated: "ticket_created",
  providerFailed: "provider_failed",
  providerTimeout: "provider_timeout",
  storageError: "storage_error",
  paymentFailed: "payment_failed",
  webhookFailed: "webhook_failed"
} as const;

export type BehaviorAnalyticsEvent = (typeof behaviorAnalyticsEvents)[keyof typeof behaviorAnalyticsEvents];
export type AnalyticsEventName = BehaviorAnalyticsEvent | (typeof trackingEvents)[keyof typeof trackingEvents] | string;

export type AnalyticsPayload = {
  event: AnalyticsEventName;
  userId?: string | null;
  properties?: Record<string, unknown>;
};

export function trackEvent(payload: AnalyticsPayload) {
  trackClientEvent(payload);
}
