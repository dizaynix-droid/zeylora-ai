"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MfaStatus = "loading" | "disabled" | "enabled" | "setup" | "busy" | "error";

type TotpFactor = {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

export function MfaSettingsPanel() {
  const [status, setStatus] = useState<MfaStatus>("loading");
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [message, setMessage] = useState("MFA durumu kontrol ediliyor...");

  const isBusy = status === "loading" || status === "busy";
  const enabledLabel = useMemo(() => {
    if (!factor) return "Devre disi";
    return factor.friendly_name || "Authenticator app";
  }, [factor]);

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    setStatus("loading");
    setMessage("MFA durumu kontrol ediliyor...");

    try {
      const verified = await getVerifiedTotpFactor();
      setFactor(verified);
      setEnrollment(null);
      setSetupCode("");
      setDisableCode("");
      setStatus(verified ? "enabled" : "disabled");
      setMessage(verified ? "Iki adimli dogrulama aktif." : "Iki adimli dogrulama henuz aktif degil.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "MFA durumu okunamadi.");
    }
  }

  async function startEnrollment() {
    setStatus("busy");
    setMessage("QR kod hazirlaniyor...");

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Zeylora AI"
      });

      if (error) throw error;
      if (!data?.totp?.qr_code || !data.totp.secret) {
        throw new Error("QR kod olusturulamadi. Lutfen tekrar deneyin.");
      }

      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri
      });
      setSetupCode("");
      setStatus("setup");
      setMessage("QR kodu authenticator uygulamana okut, sonra 6 haneli kodu gir.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "MFA kurulumu baslatilamadi.");
    }
  }

  async function verifyEnrollment() {
    if (!enrollment) return;
    const code = normalizeTotpCode(setupCode);

    if (!isValidTotpCode(code)) {
      setMessage("6 haneli dogrulama kodunu gir.");
      return;
    }

    setStatus("busy");
    setMessage("Kod dogrulaniyor...");

    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId: enrollment.factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.data.id,
        code
      });
      if (verify.error) throw verify.error;

      setMessage("Iki adimli dogrulama aktif edildi.");
      await refreshStatus();
    } catch (error) {
      setStatus("setup");
      setMessage(error instanceof Error ? error.message : "Kod dogrulanamadi. Kod suresi dolduysa yeni kodla tekrar dene.");
    }
  }

  async function cancelEnrollment() {
    const factorId = enrollment?.factorId;
    setEnrollment(null);
    setSetupCode("");

    if (factorId) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId }).catch(() => null);
    }

    await refreshStatus();
  }

  async function disableMfa() {
    if (!factor) return;
    const code = normalizeTotpCode(disableCode);

    if (!isValidTotpCode(code)) {
      setMessage("Kapatmak icin guncel 6 haneli authenticator kodunu gir.");
      return;
    }

    setStatus("busy");
    setMessage("MFA kapatiliyor...");

    try {
      const supabase = createClient();
      const verify = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code
      });
      if (verify.error) throw verify.error;

      const unenroll = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (unenroll.error) throw unenroll.error;

      setMessage("Iki adimli dogrulama kapatildi.");
      await refreshStatus();
    } catch (error) {
      setStatus("enabled");
      setMessage(error instanceof Error ? error.message : "MFA kapatilamadi. Kodunu kontrol edip tekrar dene.");
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-cyan/20 bg-cyan/[0.045] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-cyan">Two-Factor Authentication</p>
          <h3 className="mt-1 text-lg font-black text-white">Iki adimli dogrulama</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Google Authenticator, Authy, 1Password veya Microsoft Authenticator ile hesabi ekstra guvene al.
          </p>
        </div>
        <span className={`inline-flex h-9 shrink-0 items-center justify-center rounded-full px-3 text-xs font-black uppercase ${
          factor ? "bg-emerald/10 text-emerald" : "bg-white/[0.06] text-slate-300"
        }`}>
          {factor ? <ShieldCheck className="mr-2" size={15} /> : <ShieldOff className="mr-2" size={15} />}
          {factor ? "Aktif" : "Kapali"}
        </span>
      </div>

      {status === "setup" && enrollment ? (
        <div className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[180px_1fr]">
          <div className="rounded-2xl bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qrCode} alt="Zeylora AI TOTP QR code" className="h-auto w-full" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">1. QR kodu tara</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">Authenticator uygulamana ekledikten sonra uygulamadaki 6 haneli kodu gir.</p>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Manuel secret</p>
              <p className="mt-1 break-all font-mono text-xs font-bold text-slate-200">{enrollment.secret}</p>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={setupCode}
                onChange={(event) => setSetupCode(normalizeTotpCode(event.target.value))}
                placeholder="123456"
                maxLength={6}
                className="h-11 min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-center text-sm font-black tracking-[0.2em] text-white outline-none focus:border-cyan"
              />
              <button
                type="button"
                onClick={() => void verifyEnrollment()}
                disabled={isBusy}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow disabled:opacity-60"
              >
                {isBusy ? <Loader2 className="mr-2 animate-spin" size={16} /> : null}
                Aktif et
              </button>
              <button
                type="button"
                onClick={() => void cancelEnrollment()}
                disabled={isBusy}
                className="h-11 rounded-2xl border border-white/10 px-4 text-sm font-black text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
              >
                Vazgec
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {status !== "setup" ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-white">{factor ? enabledLabel : "MFA kapali"}</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {factor ? "Girislerde authenticator kodu istenecek." : "Kurulum opsiyonel. Canli trafik oncesi admin hesaplari icin ozellikle onerilir."}
              </p>
            </div>
            {!factor ? (
              <button
                type="button"
                onClick={() => void startEnrollment()}
                disabled={isBusy}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow disabled:opacity-60"
              >
                {isBusy ? <Loader2 className="mr-2 animate-spin" size={16} /> : null}
                MFA kur
              </button>
            ) : null}
          </div>

          {factor ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={disableCode}
                onChange={(event) => setDisableCode(normalizeTotpCode(event.target.value))}
                placeholder="Kapatmak icin 6 haneli kod"
                maxLength={6}
                className="h-11 min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-white outline-none focus:border-cyan"
              />
              <button
                type="button"
                onClick={() => void disableMfa()}
                disabled={isBusy}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-danger/30 bg-danger/10 px-4 text-sm font-black text-danger transition hover:bg-danger/15 disabled:opacity-60"
              >
                {isBusy ? <Loader2 className="mr-2 animate-spin" size={16} /> : null}
                MFA kapat
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className={`mt-3 text-sm font-semibold ${status === "error" ? "text-danger" : "text-slate-300"}`}>{message}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">Kurtarma kodlari sonraki guvenlik fazinda eklenecek; simdilik authenticator uygulamana erisimini kaybetmemeye dikkat et.</p>
    </div>
  );
}

async function getVerifiedTotpFactor() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error) throw error;

  return (data.totp[0] || null) as TotpFactor | null;
}

function normalizeTotpCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function isValidTotpCode(value: string) {
  return /^\d{6}$/.test(value);
}
