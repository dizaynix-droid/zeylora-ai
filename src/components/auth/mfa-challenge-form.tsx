"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
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
  const [message, setMessage] = useState("Hesap guvenligi kontrol ediliyor...");

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
          throw new Error("Bu hesap icin aktif authenticator bulunamadi.");
        }

        if (!cancelled) {
          setFactor(totpFactor as TotpFactor);
          setStatus("ready");
          setMessage("Authenticator uygulamandaki 6 haneli kodu gir.");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "MFA dogrulama ekrani acilamadi.");
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
      setMessage("Lutfen 6 haneli dogrulama kodunu gir.");
      return;
    }

    setStatus("verifying");
    setMessage("Kod dogrulaniyor...");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: safeCode
      });

      if (error) throw error;

      setStatus("success");
      setMessage("Dogrulandi. Dashboard aciliyor...");
      window.location.assign(getSafeNextPath(next));
    } catch (error) {
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "Kod hatali veya suresi doldu. Yeni kodla tekrar dene.");
    }
  }

  const busy = status === "loading" || status === "verifying";

  return (
    <div className="premium-ring mx-auto max-w-lg rounded-[2rem]">
      <div className="glass-panel rounded-[2rem] p-5 sm:p-7">
        <span className="grid size-12 place-items-center rounded-2xl bg-cyan/10 text-cyan">
          <ShieldCheck size={22} />
        </span>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-cyan">Account security</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Iki adimli dogrulama</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Hesabinda MFA aktif. Devam etmek icin Google Authenticator, Authy, 1Password veya Microsoft Authenticator kodunu gir.
        </p>

        <div className="mt-6 grid gap-3">
          <label htmlFor="mfa-code" className="text-xs font-black uppercase text-slate-400">
            6 haneli kod
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
            className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-center text-lg font-black tracking-[0.24em] text-white outline-none transition placeholder:text-slate-600 focus:border-cyan/60 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void verifyMfa()}
            disabled={busy || !factor}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-zeylora-brand px-5 text-sm font-black text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? <Loader2 className="mr-2 animate-spin" size={18} /> : null}
            Dogrula ve devam et
          </button>
        </div>

        <p className={`mt-4 text-sm font-semibold ${status === "error" ? "text-danger" : status === "success" ? "text-emerald" : "text-slate-300"}`}>
          {message}
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/auth/sign-in" className="text-cyan transition hover:text-white">Farkli hesapla giris yap</Link>
          <form action="/auth/sign-out" method="post">
            <button className="text-slate-400 transition hover:text-white">Oturumu kapat</button>
          </form>
        </div>
      </div>
    </div>
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
