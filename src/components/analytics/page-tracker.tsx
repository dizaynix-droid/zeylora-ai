"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent, trackPageViewForPath } from "@/lib/analytics/track";

export function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    window.zeyloraTrack = (event, properties) => trackEvent({ event, properties });
    trackPageViewForPath(pathname || "/");
  }, [pathname, searchParams]);

  return null;
}
