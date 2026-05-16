"use client";

import { useEffect } from "react";
import { trackingEvents } from "@/config/tracking";
import { trackEvent } from "@/lib/analytics/events";

export function TrialPackTracker({
  enabled,
  price,
  credits
}: {
  enabled: boolean;
  price: number;
  credits: number;
}) {
  useEffect(() => {
    if (!enabled) return;

    trackEvent({
      event: trackingEvents.trialPackView,
      properties: {
        packageKey: "starter-trial",
        price,
        credits
      }
    });
  }, [credits, enabled, price]);

  return null;
}
