"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function JobAutoRefresh({
  enabled,
  intervalMs = 5000
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [enabled, intervalMs, router]);

  return null;
}
