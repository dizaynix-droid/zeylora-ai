"use client";

import { type FormEvent, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { VerifyBadge, VerifyPanel } from "@/components/verify-ui/core";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

export function UpdatePasswordForm({ next = "/dashboard" }: { next?: string }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("Enter a new password for your Zeylora account.");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseAuthConfigured()) {
      setStatus("error");
      setMessage("Supabase Auth is not configured yet.");
      return;
    }

    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setStatus("loading");
    setMessage("Updating password...");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("success");
    setMessage("Password updated. Opening your workspace...");
    window.location.assign(getSafeNextPath(next));
  }

  return (
    <VerifyPanel className="mx-auto max-w-xl p-5 sm:p-6 md:p-8">
        <VerifyBadge tone="blue">Account security</VerifyBadge>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
          Set a new password.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Use a strong password. Admin accounts should use a unique password and prepare for mandatory 2FA later.
        </p>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-5">
          <label htmlFor="new-password" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            New password
          </label>
          <div className="relative mt-2">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              className="h-12 w-full rounded-md border border-slate-300 bg-white pl-11 pr-4 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "loading" ? <Loader2 className="mr-2 animate-spin" size={18} /> : null}
            Update password
          </button>
        </form>
        <p className={`mt-4 text-sm font-semibold ${status === "success" ? "text-emerald-700" : status === "error" ? "text-rose-700" : "text-slate-500"}`}>
          {message}
        </p>
    </VerifyPanel>
  );
}

function getSafeNextPath(next: string) {
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}
