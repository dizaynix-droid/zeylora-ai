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
