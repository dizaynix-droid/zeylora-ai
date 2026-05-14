import type { TrackingEvent } from "@/config/tracking";
import { prisma } from "@/lib/db";

export function trackServerEvent(event: TrackingEvent, properties: Record<string, unknown> = {}) {
  void prisma.adminLog
    .create({
      data: {
        action: `analytics.${event}`,
        entityType: "AnalyticsEvent",
        metadataJson: JSON.parse(JSON.stringify(properties || {}))
      }
    })
    .catch(() => undefined);

  if (process.env.NODE_ENV === "development") {
    console.info("[analytics-server-event]", { event, properties });
  }
}
