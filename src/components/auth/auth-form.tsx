"use client";

import { type FormEvent, useMemo, useState } from "react";
import { ArrowRight, Loader2, Mail, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

type AuthMode = "magic" | "signup";

export function AuthForm({ authStatus, next = "/dashboard" }: { authStatus?: string; next?: string }) {
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<AuthMode>("magic");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(authStatus === "retry" ? "error" : "idle");
  const [message, setMessage] = useState(
    authStatus === "retry"
      ? "Your email was confirmed, but we could not start a session. Send a fresh login link to continue."
      : "Sign in to save edits, downloads, credits, and dashboard history."
  );
  const configured = isSupabaseAuthConfigured();
  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", next);
    return url.toString();
  }, [next]);

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!configured) {
      setStatus("error");
      setMessage("Supabase Auth is not configured yet. Add the Supabase URL and publishable key.");
      return;
    }

    setStatus("loading");
    setMessage("Sending secure sign-in link...");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true
      }
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("success");
    setMessage(mode === "signup" ? "Check your email to confirm and sign in." : "Check your email for your login link.");
  }

  async function handleGoogleAuth() {
    if (!configured) {
      setStatus("error");
      setMessage("Supabase Auth is not configured yet. Add the Supabase URL and publishable key.");
      return;
    }

    setStatus("loading");
    setMessage("Opening Google sign-in...");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo
      }
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  return (
    <div className="premium-ring mx-auto max-w-xl rounded-[2rem]">
      <div className="glass-panel rounded-[2rem] p-4 sm:p-5 md:p-7">
        <p className="eyebrow">
          <Sparkles size={14} />
          Zeylora account
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
          Sign in to your product photo workspace.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Secure sessions unlock uploads, AI jobs, dashboard history, downloads, ratings, and future credits.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-2">
          {[
            ["magic", "Sign in"],
            ["signup", "Sign up"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value as AuthMode)}
              className={`h-10 rounded-full text-sm font-black transition ${
                mode === value ? "bg-cyan text-ink" : "text-slate-300 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleGoogleAuth()}
          disabled={status === "loading"}
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Continue with Google
          <ArrowRight className="ml-2" size={17} />
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-black uppercase text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          Magic link
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={(event) => void handleEmailAuth(event)}>
          <label htmlFor="auth-email" className="text-xs font-black uppercase text-slate-400">
            Email address
          </label>
          <div className="relative mt-2">
            <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              id="auth-email"
              type="email"
              suppressHydrationWarning
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@store.com"
              className="h-12 w-full rounded-full border border-white/10 bg-white/[0.06] pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan/60"
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-zeylora-brand px-5 text-sm font-black text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={18} />
                Sending...
              </>
            ) : (
              "Send Magic Link"
            )}
          </button>
        </form>

        <p className={`mt-4 text-sm font-semibold ${status === "success" ? "text-emerald" : status === "error" ? "text-danger" : "text-slate-400"}`}>
          {message}
        </p>
      </div>
    </div>
  );
}
