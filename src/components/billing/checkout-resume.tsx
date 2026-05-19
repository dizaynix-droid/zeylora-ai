"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type CheckoutResponse = {
  ok: boolean;
  url?: string;
  checkoutUrl?: string;
  error?: string;
  code?: string;
};

export function CheckoutResume({ packageId }: { packageId?: string }) {
  const [message, setMessage] = useState<string | null>(packageId ? "Checking your account..." : null);

  useEffect(() => {
    if (!packageId) return;

    let cancelled = false;
    const selectedPackageId = packageId;

    async function resumeCheckout() {
      try {
        const authResponse = await fetch("/api/auth/me", { cache: "no-store" });
        const authPayload = (await authResponse.json().catch(() => null)) as { authenticated?: boolean } | null;

        if (!authResponse.ok || !authPayload?.authenticated) {
          window.location.assign(`/auth/sign-in?next=${encodeURIComponent(`/pricing?checkoutPackage=${encodeURIComponent(selectedPackageId)}`)}`);
          return;
        }

        if (cancelled) return;
        setMessage("Opening secure checkout...");
        const params = new URLSearchParams(window.location.search);
        const resumeVerification = params.get("resumeVerification") === "1";

        const checkoutResponse = await fetch("/api/v1/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ packageId: selectedPackageId, resumeVerification })
        });
        const checkoutPayload = (await checkoutResponse.json().catch(() => null)) as CheckoutResponse | null;
        const checkoutUrl = checkoutPayload?.url || checkoutPayload?.checkoutUrl;

        if (checkoutResponse.status === 401 || checkoutPayload?.code === "unauthenticated") {
          window.location.assign(`/auth/sign-in?next=${encodeURIComponent(`/pricing?checkoutPackage=${encodeURIComponent(selectedPackageId)}`)}`);
          return;
        }

        if (!checkoutResponse.ok || !checkoutPayload?.ok || !checkoutUrl) {
          throw new Error(checkoutPayload?.error || "Could not start checkout.");
        }

        window.location.assign(checkoutUrl);
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "Could not start checkout. Please choose a package again.");
      }
    }

    void resumeCheckout();

    return () => {
      cancelled = true;
    };
  }, [packageId]);

  if (!packageId || !message) return null;

  return (
    <div className="mb-5 rounded-2xl border border-cyan/25 bg-cyan/10 px-4 py-3 text-sm font-bold text-cyan">
      <span className="inline-flex items-center gap-2">
        <Loader2 size={16} className="animate-spin" />
        {message}
      </span>
    </div>
  );
}
