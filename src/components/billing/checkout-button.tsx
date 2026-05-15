"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

type CheckoutButtonProps = {
  packageId: string;
  label?: string;
  className?: string;
};

type CheckoutResponse = {
  ok: boolean;
  url?: string;
  checkoutUrl?: string;
  error?: string;
  code?: string;
};

export function CheckoutButton({ packageId, label = "Get credits", className }: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      console.info("[checkout-client]", { event: "started", packageId });
      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ packageId })
      });
      const payload = (await response.json().catch(() => null)) as CheckoutResponse | null;
      const checkoutUrl = payload?.url || payload?.checkoutUrl;

      console.info("[checkout-client]", {
        event: "response",
        packageId,
        status: response.status,
        ok: Boolean(payload?.ok),
        hasUrl: Boolean(checkoutUrl),
        code: payload?.code
      });

      if (response.status === 401 || payload?.code === "unauthenticated") {
        window.location.assign(`/auth/sign-in?next=${encodeURIComponent(`/pricing?checkoutPackage=${encodeURIComponent(packageId)}`)}`);
        return;
      }

      if (!response.ok || !payload?.ok || !checkoutUrl) {
        throw new Error(payload?.error || "Could not start checkout.");
      }

      window.location.href = checkoutUrl;
    } catch (checkoutError) {
      console.error("[checkout-client]", {
        event: "failed",
        packageId,
        message: checkoutError instanceof Error ? checkoutError.message : "Could not start checkout."
      });
      setError(checkoutError instanceof Error ? checkoutError.message : "Could not start checkout.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={startCheckout} disabled={isLoading} aria-busy={isLoading} className={className}>
        {isLoading ? <Loader2 className="mr-2 animate-spin" size={16} /> : <CreditCard className="mr-2" size={16} />}
        <span>{isLoading ? "Opening checkout..." : label}</span>
      </button>
      {error ? <p className="mt-2 text-xs font-semibold text-rose-200">{error}</p> : null}
    </div>
  );
}
