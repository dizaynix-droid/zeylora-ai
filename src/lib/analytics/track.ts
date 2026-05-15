import { analyticsConfig } from "@/config/analytics";
import type { AnalyticsPayload } from "@/lib/analytics/events";

type ClientAnalyticsContext = {
  sessionId: string;
  anonymousId: string;
  firstVisit: boolean;
  returningVisitor: boolean;
  sessionStartedAt: number;
  trafficSource: string;
  utm: Record<string, string>;
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
  if (typeof window === "undefined") return;

  const context = getClientAnalyticsContext();
  const properties = {
    ...(payload.userId ? { userId: payload.userId } : {}),
    ...payload.properties,
    sessionDurationSeconds: Math.max(0, Math.round((Date.now() - context.sessionStartedAt) / 1000)),
    firstVisit: context.firstVisit,
    returningVisitor: context.returningVisitor,
    trafficSource: context.trafficSource,
    ...context.utm
  };

  fireExternalAnalytics(payload.event, properties);
  fireMarketingPixels(payload.event, properties);
  enqueueInternalAnalytics({
    event: payload.event,
    userId: payload.userId ?? null,
    sessionId: context.sessionId,
    anonymousId: context.anonymousId,
    page: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    referrer: document.referrer || null,
    source: "client",
    metadata: properties
  });

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

export function trackPageViewForPath(pathname: string) {
  const event = getPageEvent(pathname);
  trackEvent({
    event,
    properties: {
      path: pathname
    }
  });
}

function getPageEvent(pathname: string) {
  if (pathname === "/") return "landing_view";
  if (pathname === "/pricing") return "pricing_view";
  if (pathname.startsWith("/dashboard")) {
    if (pathname.includes("credits")) return "credits_page_view";
    return "dashboard_opened";
  }
  if (pathname.startsWith("/tools")) return "tool_page_view";
  return "page_view";
}

function getClientAnalyticsContext(): ClientAnalyticsContext {
  const now = Date.now();
  const anonymousId = getOrCreateStoredId("zeylora_anonymous_id");
  const existingFirstSeen = localStorage.getItem("zeylora_first_seen_at");
  const firstVisit = !existingFirstSeen;
  if (!existingFirstSeen) localStorage.setItem("zeylora_first_seen_at", String(now));
  const session = getOrCreateSession();

  return {
    anonymousId,
    sessionId: session.id,
    sessionStartedAt: session.startedAt,
    firstVisit,
    returningVisitor: Boolean(existingFirstSeen),
    trafficSource: getTrafficSource(),
    utm: getUtmParams()
  };
}

function getOrCreateStoredId(key: string) {
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

function getOrCreateSession() {
  const sessionKey = "zeylora_session";
  const raw = sessionStorage.getItem(sessionKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { id?: string; startedAt?: number };
      if (parsed.id && parsed.startedAt) return { id: parsed.id, startedAt: parsed.startedAt };
    } catch {
      // Ignore malformed session storage.
    }
  }

  const session = { id: crypto.randomUUID(), startedAt: Date.now() };
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
  return session;
}

function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const value = params.get(key);
    if (value) utm[key] = value.slice(0, 120);
  }
  return utm;
}

function getTrafficSource() {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source");
  if (utmSource) return utmSource.slice(0, 120);
  if (!document.referrer) return "direct";
  try {
    return new URL(document.referrer).hostname.replace(/^www\./, "").slice(0, 120);
  } catch {
    return "referral";
  }
}

function enqueueInternalAnalytics(payload: {
  event: string;
  userId: string | null;
  sessionId: string;
  anonymousId: string;
  source: string;
  page: string;
  referrer: string | null;
  metadata: Record<string, unknown>;
}) {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/v1/analytics/track", blob);
    return;
  }

  void fetch("/api/v1/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => undefined);
}

function fireExternalAnalytics(event: string, properties: Record<string, unknown>) {
  if (analyticsConfig.posthog.enabled) {
    window.posthog?.capture(event, properties);
  }

  if (analyticsConfig.plausible.enabled) {
    window.plausible?.(event, { props: properties });
  }

  if (analyticsConfig.ga4.enabled) {
    window.gtag?.("event", event, properties);
  }
}

function fireMarketingPixels(event: string, properties: Record<string, unknown>) {
  if (event === "page_view" || event === "landing_view") {
    window.fbq?.("track", "PageView");
    return;
  }

  if (event === "signup" || event === "signup_completed") {
    window.fbq?.("track", "CompleteRegistration", properties);
  }

  if (event === "checkout_started") {
    window.fbq?.("track", "InitiateCheckout", properties);
    window.ttq?.track?.("InitiateCheckout", properties);
    window.pintrk?.("track", "checkout", properties);
  }

  if (event === "clean_export_clicked" || event === "watermark_free_export") {
    window.fbq?.("trackCustom", "CleanExport", properties);
  }

  if (event === "purchase" || event === "checkout_completed") {
    window.fbq?.("track", "Purchase", properties);
    window.ttq?.track?.("CompletePayment", properties);
    window.pintrk?.("track", "checkout", properties);
  }
}
