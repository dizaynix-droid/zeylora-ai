import type { TrackingEvent } from "@/config/tracking";
import { prisma } from "@/lib/db";

export function trackServerEvent(event: TrackingEvent | string, properties: Record<string, unknown> = {}) {
  const metadata = JSON.parse(JSON.stringify(properties || {}));
  const userId = typeof properties.userId === "string" ? properties.userId : null;
  const sessionId = typeof properties.sessionId === "string" ? properties.sessionId : null;
  const anonymousId = typeof properties.anonymousId === "string" ? properties.anonymousId : null;
  const page = typeof properties.page === "string" ? properties.page : null;
  const country = typeof properties.country === "string" ? properties.country : null;
  const device = typeof properties.device === "string" ? properties.device : null;

  void Promise.all([
    prisma.analyticsEvent.create({
      data: {
        event,
        userId,
        sessionId,
        anonymousId,
        source: "server",
        page,
        country,
        device,
        metadataJson: metadata
      }
    }),
    prisma.adminLog.create({
      data: {
        action: `analytics.${event}`,
        entityType: "AnalyticsEvent",
        metadataJson: metadata
      }
    })
  ]).catch(() => undefined);

  if (process.env.NODE_ENV === "development") {
    console.info("[analytics-server-event]", { event, properties });
  }
}
