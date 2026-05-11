"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Loader2, Mail, Sparkles } from "lucide-react";

type WaitlistState = "idle" | "loading" | "success" | "duplicate" | "error";

type WaitlistResponse = {
  ok: boolean;
  duplicate?: boolean;
  message?: string;
  error?: string;
};

const interestOptions = [
  "Background Remover",
  "Photo Enhancer",
  "HD Upscale",
  "Marketplace Crop",
  "Product Shadow",
  "AI Relight"
] as const;

export function EarlyAccess() {
  const [email, setEmail] = useState("");
  const [selectedTool, setSelectedTool] = useState<(typeof interestOptions)[number]>("Background Remover");
  const [state, setState] = useState<WaitlistState>("idle");
  const [message, setMessage] = useState("Join early access for launch updates and clean export testing.");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("Joining early access...");

    try {
      const response = await fetch("/api/v1/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          source: "homepage_early_access",
          metadata: {
            landingPage: "/",
            selectedTool
          }
        })
      });
      const payload = (await response.json().catch(() => null)) as WaitlistResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Please enter a valid email address.");
      }

      setState(payload.duplicate ? "duplicate" : "success");
      setMessage(payload.message || "You are on the early access list.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  const isLoading = state === "loading";
  const isSuccess = state === "success" || state === "duplicate";

  return (
    <section className="section-shell py-12 md:py-20">
      <div className="premium-ring rounded-[2rem]">
        <div className="glass-panel overflow-hidden rounded-[2rem] p-5 md:p-7">
          <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="eyebrow">
                <Sparkles size={14} />
                Early access
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
                Join early access for premium product photo exports.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">
                Get launch updates, product workflow improvements, and first access to clean export testing for ecommerce teams.
              </p>
              <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                {["Launch updates", "Clean export testing", "Seller workflow notes"].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2">
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span className="font-semibold">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={(event) => void handleSubmit(event)} className="rounded-3xl border border-white/10 bg-black/25 p-4 md:p-5">
              <label className="text-xs font-black uppercase text-slate-400" htmlFor="waitlist-email">
                Work email
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    id="waitlist-email"
                    type="email"
                    suppressHydrationWarning
                    required
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (state !== "idle") {
                        setState("idle");
                        setMessage("Join early access for launch updates and clean export testing.");
                      }
                    }}
                    placeholder="you@store.com"
                    className="h-12 w-full rounded-full border border-white/10 bg-white/[0.06] pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-zeylora-brand px-5 text-sm font-black text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      Joining...
                    </>
                  ) : (
                    "Get Early Access"
                  )}
                </button>
              </div>

              <div className="mt-4">
                <p className="text-xs font-black uppercase text-slate-500">Main workflow</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {interestOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedTool(option)}
                      className={`h-9 rounded-full px-3 text-xs font-black transition ${
                        selectedTool === option
                          ? "bg-cyan text-ink"
                          : "border border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <p className={`mt-4 text-sm font-semibold ${isSuccess ? "text-emerald" : state === "error" ? "text-danger" : "text-slate-400"}`}>
                {message}
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
