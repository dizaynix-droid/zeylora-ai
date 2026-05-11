"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

type CallbackState = "loading" | "confirmed" | "error";

export function AuthCallback() {
  const [state, setState] = useState<CallbackState>("loading");
  const [message, setMessage] = useState("Confirming your secure session...");
  const [nextPath, setNextPath] = useState("/dashboard");

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      const currentUrl = new URL(window.location.href);
      const resolvedNextPath = getSafeNextPath(currentUrl.searchParams.get("next"));
      setNextPath(resolvedNextPath);

      if (!isSupabaseAuthConfigured()) {
        setState("error");
        setMessage("Supabase Auth is not configured yet.");
        return;
      }

      const supabase = createClient();
      const code = currentUrl.searchParams.get("code");
      const searchError = currentUrl.searchParams.get("error_description") || currentUrl.searchParams.get("error");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashError = hashParams.get("error_description") || hashParams.get("error");

      if (process.env.NODE_ENV === "development") {
        console.info("[auth/callback] started", {
          hasCode: Boolean(code),
          hasHash: Boolean(window.location.hash),
          nextPath: resolvedNextPath,
          searchError,
          hashError
        });
      }

      if (searchError || hashError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[auth/callback] provider returned error", searchError || hashError);
        }
        if (!cancelled) {
          setState("error");
          setMessage(searchError || hashError || "We could not confirm this sign-in link.");
        }
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("[auth/callback] code exchange failed", error.message);
          }
          if (!cancelled) {
            setState("error");
            setMessage(error.message);
          }
          return;
        }
      }

      const {
        data: { session },
        error
      } = await supabase.auth.getSession();

      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[auth/callback] session lookup failed", error.message);
        }
        if (!cancelled) {
          setState("error");
          setMessage(error.message);
        }
        return;
      }

      if (session) {
        if (process.env.NODE_ENV === "development") {
          console.info("[auth/callback] session confirmed", {
            userId: session.user.id,
            email: session.user.email,
            nextPath: resolvedNextPath
          });
        }

        if (!cancelled) {
          setState("confirmed");
          setMessage("Email confirmed. Taking you to your dashboard...");
          window.setTimeout(() => {
            window.location.replace(resolvedNextPath);
          }, 450);
        }
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.warn("[auth/callback] no session after callback", {
          hasCode: Boolean(code),
          hasHash: Boolean(window.location.hash)
        });
      }

      if (!cancelled) {
        setState("confirmed");
        setMessage("Email confirmed. Continue to your dashboard.");
      }
    }

    void completeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="premium-ring mx-auto max-w-xl rounded-[2rem]">
      <div className="glass-panel rounded-[2rem] p-6 text-center md:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-cyan/10 text-cyan">
          {state === "loading" ? <Loader2 className="animate-spin" size={24} /> : state === "confirmed" ? <CheckCircle2 size={24} /> : <MailCheck size={24} />}
        </span>
        <p className="eyebrow mx-auto mt-5 justify-center">Secure sign-in</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
          {state === "error" ? "We could not finish sign-in." : "Email confirmation received."}
        </h1>
        <p className={`mx-auto mt-3 max-w-md text-sm font-semibold leading-6 ${state === "error" ? "text-danger" : "text-slate-300"}`}>
          {message}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={nextPath}
            className="inline-flex h-11 items-center justify-center rounded-full bg-zeylora-brand px-5 text-sm font-black text-white shadow-glow"
          >
            Continue to dashboard
          </Link>
          {state === "error" ? (
            <Link
              href={`/auth/sign-in?next=${encodeURIComponent(nextPath)}&authStatus=retry`}
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm font-black text-white"
            >
              Send a new link
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getSafeNextPath(next: string | null) {
  if (!next?.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}
