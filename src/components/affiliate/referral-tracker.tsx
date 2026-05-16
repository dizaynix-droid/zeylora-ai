"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function ReferralTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;
    const key = `zeylora_ref_tracked:${ref}:${window.location.pathname}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    void fetch("/api/v1/affiliate/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref,
        page: window.location.pathname + window.location.search,
        referrer: document.referrer,
        utm: Object.fromEntries(Array.from(searchParams.entries()).filter(([name]) => name.startsWith("utm_")))
      })
    }).catch(() => undefined);
  }, [searchParams]);

  return null;
}
