"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { VerifyBadge, VerifyPanel } from "@/components/verify-ui/core";
import { createClient } from "@/lib/supabase/client";

type Status = "loading" | "ready" | "verifying" | "success" | "error";

type TotpFactor = {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
};

export function MfaChallengeForm({ next = "/dashboard" }: { next?: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Checking account security...");

  useEffect(() => {
    let cancelled = false;

    async function loadFactor() {
      try {
        const supabase = createClient();
        const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal.error) throw aal.error;

        if (aal.data.currentLevel === "aal2" || aal.data.nextLevel !== "aal2") {
          window.location.assign(getSafeNextPath(next));
          return;
        }

        const factors = await supabase.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        const totpFactor = factors.data.totp[0] || null;

        if (!totpFactor) {
          throw new Error("No active authenticator app was found for this account.");
        }

        if (!cancelled) {
          setFactor(totpFactor as TotpFactor);
          setStatus("ready");
          setMessage("Enter the 6-digit code from your authenticator app.");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "The MFA verification screen could not be opened.");
        }
      }
    }

    void loadFactor();

    return () => {
      cancelled = true;
    };
  }, [next]);

  async function verifyMfa() {
    if (!factor) return;
    const safeCode = normalizeTotpCode(code);

    if (!/^\d{6}$/.test(safeCode)) {
      setStatus("ready");
      setMessage("Enter your 6-digit verification code.");
      return;
    }

    setStatus("verifying");
    setMessage("Verifying code...");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: safeCode
      });

      if (error) throw error;

      setStatus("success");
      setMessage("Verified. Opening your dashboard...");
      window.location.assign(getSafeNextPath(next));
    } catch (error) {
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "The code is invalid or expired. Try again with a new code.");
    }
  }

  const busy = status === "loading" || status === "verifying";

  return (
    <VerifyPanel className="mx-auto max-w-lg p-5 sm:p-7">
        <span className="grid size-12 place-items-center rounded-lg bg-blue-50 text-blue-700">
          <ShieldCheck size={22} />
        </span>
        <div className="mt-5">
          <VerifyBadge tone="blue">Account security</VerifyBadge>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">Two-factor authentication</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          MFA is enabled on your account. Enter the code from Google Authenticator, Authy, 1Password, or Microsoft Authenticator to continue.
        </p>

        <div className="mt-6 grid gap-3">
          <label htmlFor="mfa-code" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            6-digit code
          </label>
          <input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(normalizeTotpCode(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void verifyMfa();
              }
            }}
            placeholder="123456"
            maxLength={6}
            disabled={busy}
            className="h-14 w-full rounded-md border border-slate-300 bg-white px-4 text-center text-lg font-semibold tracking-[0.24em] text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void verifyMfa()}
            disabled={busy || !factor}
            className="inline-flex h-12 w-full items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? <Loader2 className="mr-2 animate-spin" size={18} /> : null}
            Verify and continue
          </button>
        </div>

        <p className={`mt-4 text-sm font-semibold ${status === "error" ? "text-rose-700" : status === "success" ? "text-emerald-700" : "text-slate-600"}`}>
          {message}
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/auth/sign-in" className="text-blue-700 transition hover:text-blue-800">Use a different account</Link>
          <form action="/auth/sign-out" method="post">
            <button className="text-slate-500 transition hover:text-slate-950">Sign out</button>
          </form>
        </div>
    </VerifyPanel>
  );
}

function normalizeTotpCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function getSafeNextPath(nextPath: string) {
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/dashboard";
  }

  return nextPath;
}
