import type { TrackingEvent } from "@/config/tracking";

export function trackServerEvent(event: TrackingEvent, properties: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "development") {
    console.info("[analytics-server-event]", { event, properties });
  }
}
