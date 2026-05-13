import type { TrackingEvent } from "@/config/tracking";
import { analyticsConfig } from "@/config/analytics";

export type AnalyticsPayload = {
  event: TrackingEvent;
  userId?: string;
  properties?: Record<string, unknown>;
};

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
    };
    plausible?: (event: string, options?: { props?: Record<string, unknown> }) => void;
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: { track?: (event: string, properties?: Record<string, unknown>) => void };
    pintrk?: (...args: unknown[]) => void;
    zeyloraTrack?: (event: string, properties?: Record<string, unknown>) => void;
    zeyloraTrackSignup?: () => void;
    zeyloraTrackLogin?: () => void;
    zeyloraTrackPreviewGenerated?: () => void;
    zeyloraTrackCleanExport?: () => void;
    zeyloraTrackCheckoutStarted?: () => void;
    zeyloraTrackPurchase?: (value?: number, currency?: string) => void;
  }
}

export function trackEvent(payload: AnalyticsPayload) {
  if (typeof window === "undefined") {
    return;
  }

  const properties = {
    ...(payload.userId ? { userId: payload.userId } : {}),
    ...payload.properties
  };

  if (analyticsConfig.posthog.enabled) {
    window.posthog?.capture(payload.event, properties);
  }

  if (analyticsConfig.plausible.enabled) {
    window.plausible?.(payload.event, { props: properties });
  }

  if (analyticsConfig.ga4.enabled) {
    window.gtag?.("event", payload.event, properties);
  }

  fireMarketingPixels(payload.event, properties);

  if (process.env.NODE_ENV === "development") {
    console.info("[analytics-event]", { event: payload.event, properties });
  }

  window.dispatchEvent(
    new CustomEvent("app:track", {
      detail: {
        event: payload.event,
        properties
      }
    })
  );
}

function fireMarketingPixels(event: string, properties: Record<string, unknown>) {
  if (event === "page_view") {
    window.fbq?.("track", "PageView");
    return;
  }

  if (event === "signup") {
    window.fbq?.("track", "CompleteRegistration", properties);
  }

  if (event === "checkout_started") {
    window.fbq?.("track", "InitiateCheckout", properties);
    window.ttq?.track?.("InitiateCheckout", properties);
    window.pintrk?.("track", "checkout", properties);
  }

  if (event === "watermark_free_export") {
    window.fbq?.("trackCustom", "CleanExport", properties);
  }

  if (event === "purchase") {
    window.fbq?.("track", "Purchase", properties);
    window.ttq?.track?.("CompletePayment", properties);
    window.pintrk?.("track", "checkout", properties);
  }
}
