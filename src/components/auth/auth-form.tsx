"use client";

import { type FormEvent, useState } from "react";
import { KeyRound, Loader2, Mail, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

type AuthMode = "signin" | "signup";

export function AuthForm({ authStatus, authError, next = "/dashboard" }: { authStatus?: string; authError?: string; next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(authStatus === "retry" ? "error" : "idle");
  const [message, setMessage] = useState(
    authStatus === "retry"
      ? authError || "Your sign-in could not be completed. Sign in with your email and password to continue."
      : authStatus === "password-reset"
      ? "Check your email for a secure password reset link."
      : "Sign in to save edits, downloads, credits, and dashboard history."
  );
  const configured = isSupabaseAuthConfigured();

  async function handleGoogleAuth() {
    if (!configured) {
      setStatus("error");
      setMessage("Supabase Auth is not configured yet.");
      return;
    }

    setStatus("loading");
    setMessage("Opening Google sign-in...");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeNextPath(next))}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account"
        }
      }
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  async function handlePasswordAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!configured) {
      setStatus("error");
      setMessage("Supabase Auth is not configured yet. Add the Supabase URL and publishable key.");
      return;
    }

    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setStatus("loading");
    setMessage(mode === "signup" ? "Creating your account..." : "Signing you in...");

    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeNextPath(next))}`;
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo
            }
          })
        : await supabase.auth.signInWithPassword({
            email,
            password
          });

    if (result.error) {
      setStatus("error");
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setStatus("success");
      setMessage("Account created. Check your email if confirmation is enabled, then sign in with your password.");
      return;
    }

    setStatus("success");
    setMessage("Signed in. Opening your workspace...");
    window.location.assign(getSafeNextPath(next));
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
          Secure sessions unlock uploads, AI jobs, dashboard history, downloads, ratings, and credits.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-2">
          {[
            ["signin", "Sign in"],
            ["signup", "Sign up"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value as AuthMode);
                if (status !== "loading") {
                  setStatus("idle");
                  setMessage("Sign in to save edits, downloads, credits, and dashboard history.");
                }
              }}
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
          disabled={status === "loading" || !configured}
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm font-black text-white transition hover:border-cyan/40 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? <Loader2 className="mr-2 animate-spin" size={18} /> : <span className="mr-2 text-lg">G</span>}
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          or use email
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={(event) => void handlePasswordAuth(event)}>
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
              autoComplete="email"
              className="h-12 w-full rounded-full border border-white/10 bg-white/[0.06] pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan/60"
            />
          </div>

          <label htmlFor="auth-password" className="mt-4 block text-xs font-black uppercase text-slate-400">
            Password
          </label>
          <div className="relative mt-2">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
                {mode === "signup" ? "Creating..." : "Signing in..."}
              </>
            ) : mode === "signup" ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void handlePasswordReset(email, next, setStatus, setMessage)}
          disabled={status === "loading"}
          className="mt-3 text-sm font-bold text-cyan transition hover:text-white disabled:opacity-60"
        >
          Forgot password?
        </button>

        <p className={`mt-4 text-sm font-semibold ${status === "success" ? "text-emerald" : status === "error" ? "text-danger" : "text-slate-400"}`}>
          {message}
        </p>
      </div>
    </div>
  );
}

async function handlePasswordReset(
  email: string,
  next: string,
  setStatus: (status: "idle" | "loading" | "success" | "error") => void,
  setMessage: (message: string) => void
) {
  if (!isSupabaseAuthConfigured()) {
    setStatus("error");
    setMessage("Supabase Auth is not configured yet.");
    return;
  }
  if (!email.trim()) {
    setStatus("error");
    setMessage("Enter your email first, then request a password reset link.");
    return;
  }

  setStatus("loading");
  setMessage("Sending password reset link...");
  const supabase = createClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password?next=" + encodeURIComponent(getSafeNextPath(next)))}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo
  });

  if (error) {
    setStatus("error");
    setMessage(error.message);
    return;
  }

  setStatus("success");
  setMessage("Check your email for a secure password reset link.");
}

function getSafeNextPath(next: string) {
  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}
