"use client";

import { useEffect } from "react";
import { trackingEvents } from "@/config/tracking";
import { trackEvent } from "@/lib/analytics/events";

export function TrialPackTracker({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    trackEvent({
      event: trackingEvents.trialPackView,
      properties: {
        packageKey: "starter-trial",
        price: 7.99,
        credits: 10
      }
    });
  }, [enabled]);

  return null;
}
