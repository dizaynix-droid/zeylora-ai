"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function JobAutoRefresh({
  enabled,
  jobId,
  intervalMs = 5000
}: {
  enabled: boolean;
  jobId?: string;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;

    async function refreshJob() {
      if (jobId) {
        await fetch(`/api/v1/verification/jobs/${jobId}/resume`, {
          method: "POST",
          cache: "no-store"
        }).catch(() => null);
      }
      if (!stopped) router.refresh();
    }

    void refreshJob();
    const interval = window.setInterval(() => {
      void refreshJob();
    }, intervalMs);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [enabled, intervalMs, jobId, router]);

  return null;
}
