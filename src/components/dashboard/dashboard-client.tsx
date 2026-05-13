"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Coins, CreditCard, Download, ImageIcon, Settings, Sparkles, UserCircle, Wand2 } from "lucide-react";
import { CleanExportButton } from "@/components/jobs/clean-export-button";
import { DownloadResultButton } from "@/components/jobs/download-result-button";
import { Card } from "@/components/ui/card";
import { futureTools } from "@/config/future-tools";
import { type DashboardFilter } from "@/lib/dashboard/data";

type DashboardJob = {
  id: string;
  status: string;
  toolName: string;
  creditCost: number;
  createdAt: string;
  statusLabel: string;
  summary: string;
  inputPreviewUrl: string | null;
  outputPreviewUrl: string | null;
  downloadUrl: string | null;
};

type CreditTransaction = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};

type AsyncStatus = "loading" | "ready" | "error";

type CreditsPayload = {
  ok: boolean;
  creditBalance?: number;
  lowCreditThreshold?: number;
  timing?: Record<string, number>;
  error?: string;
};

type JobsPayload = {
  ok: boolean;
  jobs?: DashboardJob[];
  timing?: Record<string, number>;
  error?: string;
};

type TransactionsPayload = {
  ok: boolean;
  creditTransactions?: CreditTransaction[];
  timing?: Record<string, number>;
  error?: string;
};

const requestCache = new Map<string, { createdAt: number; promise: Promise<unknown> }>();
const REQUEST_CACHE_TTL_MS = 10_000;

export function DashboardClient({
  initialEmail,
  initialFilter
}: {
  initialEmail: string;
  initialFilter: DashboardFilter;
}) {
  const [activeFilter, setActiveFilter] = useState<DashboardFilter>(initialFilter);
  const [credits, setCredits] = useState<CreditsPayload | null>(null);
  const [creditsStatus, setCreditsStatus] = useState<AsyncStatus>("loading");
  const [jobsPayload, setJobsPayload] = useState<JobsPayload | null>(null);
  const [jobsStatus, setJobsStatus] = useState<AsyncStatus>("loading");
  const [transactionsPayload, setTransactionsPayload] = useState<TransactionsPayload | null>(null);
  const [transactionsStatus, setTransactionsStatus] = useState<AsyncStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    let transactionFallbackTimer: number | null = null;

    async function loadCredits() {
      const startedAt = performance.now();
      try {
        const json = await fetchJsonCached<CreditsPayload>("dashboard:credits", "/api/v1/dashboard/credits");

        if (!json?.ok) {
          throw new Error(json?.error || "Credit data could not be loaded.");
        }

        if (!cancelled) {
          setCredits(json);
          setCreditsStatus("ready");
          if (process.env.NODE_ENV === "development") {
            console.info("[credits-client-timing]", {
              status: "ready",
              clientFetchMs: Math.round(performance.now() - startedAt),
              creditBalance: json.creditBalance ?? 0,
              serverTiming: json.timing,
              source: json.timing?.cacheHit ? "memory" : "server"
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          setCreditsStatus("error");
          setCredits({
            ok: false,
            error: error instanceof Error ? error.message : "Credit data could not be loaded."
          });
        }
      }
    }

    async function loadTransactions() {
      const startedAt = performance.now();
      transactionFallbackTimer = window.setTimeout(() => {
        if (!cancelled) {
          setTransactionsPayload({
            ok: true,
            creditTransactions: [],
            timing: {
              timeoutFallback: 1
            }
          });
          setTransactionsStatus("ready");
          if (process.env.NODE_ENV === "development") {
            console.warn("[transactions-client-timing]", {
              status: "timeout_fallback",
              clientFetchMs: Math.round(performance.now() - startedAt),
              items: 0,
              source: "client_empty_fallback"
            });
          }
        }
      }, 1200);

      try {
        const json = await fetchJsonCached<TransactionsPayload>("dashboard:transactions", "/api/v1/dashboard/transactions");

        if (!json?.ok) {
          throw new Error(json?.error || "Credit transactions could not be loaded.");
        }

        if (!cancelled) {
          if (transactionFallbackTimer) window.clearTimeout(transactionFallbackTimer);
          setTransactionsPayload(json);
          setTransactionsStatus("ready");
          if (process.env.NODE_ENV === "development") {
            console.info("[transactions-client-timing]", {
              status: "ready",
              clientFetchMs: Math.round(performance.now() - startedAt),
              items: json.creditTransactions?.length ?? 0,
              serverTiming: json.timing,
              source: json.timing?.cacheHit ? "memory" : "server"
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          if (transactionFallbackTimer) window.clearTimeout(transactionFallbackTimer);
          setTransactionsStatus("error");
          setTransactionsPayload({
            ok: false,
            error: error instanceof Error ? error.message : "Credit transactions could not be loaded."
          });
        }
      }
    }

    void loadCredits();
    window.setTimeout(() => {
      if (!cancelled) void loadTransactions();
    }, 150);

    return () => {
      cancelled = true;
      if (transactionFallbackTimer) window.clearTimeout(transactionFallbackTimer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const startedAt = performance.now();

    async function loadJobs() {
      setJobsStatus("loading");

      try {
        const json = await fetchJsonFresh<JobsPayload>(
          `/api/v1/dashboard/jobs?filter=${activeFilter}&t=${Date.now()}`
        );

        if (!json?.ok) {
          throw new Error(json?.error || "Dashboard jobs could not be loaded.");
        }

        if (!cancelled) {
          setJobsPayload(json);
          setJobsStatus("ready");
          if (process.env.NODE_ENV === "development") {
            console.info("[jobs-client-timing]", {
              status: "ready",
              clientFetchMs: Math.round(performance.now() - startedAt),
              items: json.jobs?.length ?? 0,
              serverTiming: json.timing,
              source: json.timing?.cacheHit ? "memory" : "server"
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          setJobsStatus("error");
          setJobsPayload({
            ok: false,
            error: error instanceof Error ? error.message : "Dashboard jobs could not be loaded."
          });
        }
      }
    }

    void loadJobs();

    return () => {
      cancelled = true;
    };
  }, [activeFilter]);

  const email = initialEmail;
  const jobs = useMemo(() => jobsPayload?.jobs ?? [], [jobsPayload?.jobs]);
  const creditTransactions = useMemo(
    () => transactionsPayload?.creditTransactions ?? [],
    [transactionsPayload?.creditTransactions]
  );
  const completedJobs = useMemo(() => jobs.filter((job) => job.status === "COMPLETED"), [jobs]);
  const stats = [
    { label: "Credit balance", value: creditsStatus === "ready" ? String(credits?.creditBalance ?? 0) : "…", icon: Coins },
    { label: "Recent edits", value: jobsStatus === "ready" ? String(jobs.length) : "…", icon: ImageIcon },
    { label: "Ready downloads", value: jobsStatus === "ready" ? String(completedJobs.length) : "…", icon: Download },
    { label: "Live tools", value: "6", icon: Sparkles }
  ];

  function chooseFilter(filter: DashboardFilter) {
    setActiveFilter(filter);
    window.history.replaceState(null, "", `/dashboard?filter=${filter}#jobs`);
  }

  return (
    <>
      <section id="overview" className="scroll-mt-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-5">
              <stat.icon className="text-cyan" size={22} />
              <p className="mt-4 text-3xl font-black text-white">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-300">{stat.label}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="credits" className="scroll-mt-8">
        <Card className="mt-5 overflow-hidden p-0">
          <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(32,211,255,.13),rgba(139,92,246,.08),rgba(255,255,255,.03))] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-cyan">Credits</p>
                <h2 className="mt-2 text-2xl font-black text-white">Credit balance and activity</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Preview edits for free with Zeylora branding. Use credits when you are ready to download clean watermark-free files.
                </p>
                <Link
                  href="/pricing"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-cyan/25 bg-cyan/10 px-4 text-sm font-black text-cyan transition hover:bg-cyan hover:text-ink"
                >
                  View credit packs
                </Link>
              </div>
              <div className="rounded-2xl border border-cyan/25 bg-black/25 px-5 py-4 text-left shadow-glow md:text-right">
                <p className="text-xs font-black uppercase text-cyan">Available credits</p>
                <p className="mt-1 text-4xl font-black text-white">
                  {creditsStatus === "ready" ? credits?.creditBalance ?? 0 : "…"}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-5 p-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="grid gap-3">
              <CreditInfo label="Background Remover" value="2 credits required" />
              <CreditInfo label="Photo Enhancer" value="3 credits required" />
              <CreditInfo label="HD Upscale" value="2 credits required" />
              <CreditInfo label="Marketplace Crop" value="1 credit required" />
              <CreditInfo label="Product Shadow" value="1 credit required" />
              <CreditInfo label="AI Relight" value="1 credit required" />
              <CreditInfo label="Free exports" value="Watermarked preview files" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-white">Recent credit activity</h3>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-black uppercase text-slate-400">
                  Live
                </span>
              </div>
              {transactionsStatus === "loading" ? <CreditActivitySkeleton /> : null}
              {transactionsStatus === "ready" && creditTransactions.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {creditTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2">
                      <div>
                        <p className="text-xs font-black uppercase text-slate-300">{formatTransactionType(transaction.type)}</p>
                        <p className="text-xs text-slate-500">{transaction.note || formatDate(transaction.createdAt)}</p>
                      </div>
                      <p className={`text-sm font-black ${transaction.amount >= 0 ? "text-emerald" : "text-warning"}`}>
                        {transaction.amount >= 0 ? "+" : ""}{transaction.amount}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              {transactionsStatus === "ready" && creditTransactions.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  No credit transactions yet. Buy credits when you are ready to download clean files; preview edits remain available with Zeylora branding.
                </p>
              ) : null}
              {transactionsStatus === "error" ? (
                <p className="mt-3 rounded-xl border border-danger/25 bg-danger/10 p-3 text-xs font-semibold text-white">
                  {transactionsPayload?.error || "Credit activity could not be loaded."}
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      </section>

      <section id="jobs" className="scroll-mt-8">
        <Card className="mt-5 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-cyan">Jobs</p>
              <h2 className="mt-2 text-xl font-black text-white">Recent AI jobs</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Inspect recent previews, compare input/output thumbnails, and download finished exports from secure signed links.
              </p>
            </div>
            <p className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-400">
              {email}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              ["all", "All"],
              ["completed", "Completed"],
              ["failed", "Failed"]
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => chooseFilter(value as DashboardFilter)}
                className={`rounded-full px-4 py-2 text-xs font-black transition ${
                  activeFilter === value
                    ? "bg-cyan text-ink"
                    : "border border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {jobsStatus === "loading" ? <JobsSkeleton /> : null}
          {jobsStatus === "ready" && jobs.length > 0 ? (
            <div className="mt-5 grid gap-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 lg:grid-cols-[340px_1fr_auto] lg:items-center"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <PreviewImage url={job.inputPreviewUrl} label="Input" alt="Input image thumbnail" />
                    <PreviewImage url={job.outputPreviewUrl} label="Output" alt="Generated result thumbnail" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-cyan">{job.toolName}</p>
                    <h3 className="mt-1 text-lg font-black text-white">{job.statusLabel}</h3>
                    <p className="mt-1 text-sm text-slate-400">{job.summary}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">Created {formatDate(job.createdAt)}</p>
                  </div>
                  {job.downloadUrl ? (
                    <div className="grid gap-2">
                      <CleanExportButton
                        jobId={job.id}
                        creditsRequired={job.creditCost}
                        className="inline-flex h-10 w-full items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow lg:w-auto"
                      />
                      <DownloadResultButton
                        href={job.downloadUrl}
                        label="Download preview"
                        className="inline-flex h-10 w-full items-center justify-center rounded-full border border-white/15 px-4 text-sm font-black text-white transition hover:bg-white/10 lg:w-auto"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {jobsStatus === "ready" && jobs.length === 0 ? (
            <div className="mt-5 grid min-h-56 place-items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-6 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-cyan/10 text-cyan">
                  <Wand2 size={20} />
                </span>
                <h3 className="mt-4 text-lg font-black text-white">No product edits yet</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
                  Upload a product photo from the homepage to create your first ecommerce-ready edit.
                </p>
                <Link
                  href="/#upload"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow"
                >
                  Start an edit
                </Link>
              </div>
            </div>
          ) : null}
          {jobsStatus === "error" ? (
            <p className="mt-5 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm font-semibold text-white">
              {jobsPayload?.error || "Dashboard jobs could not be loaded."}
            </p>
          ) : null}
        </Card>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section id="payments" className="scroll-mt-8">
          <Card className="h-full p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-cyan/10 text-cyan">
                <CreditCard size={18} />
              </span>
              <div>
                <p className="text-xs font-black uppercase text-cyan">Payments</p>
                <h2 className="mt-1 text-xl font-black text-white">Buy credits for clean exports</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Credits unlock watermark-free exports for completed previews. Your watermarked preview downloads remain available for free.
                </p>
                <Link
                  href="/pricing"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow"
                >
                  Buy credits
                </Link>
              </div>
            </div>
          </Card>
        </section>

        <section id="settings" className="scroll-mt-8">
          <Card className="h-full p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-cyan/10 text-cyan">
                <UserCircle size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase text-cyan">Settings</p>
                <h2 className="mt-1 text-xl font-black text-white">Account settings</h2>
                <p className="mt-2 truncate rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-300">
                  {email}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Profile, billing preferences, and notification settings are coming soon.
                </p>
                <form action="/auth/sign-out" method="post">
                  <button className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-white/15 px-4 text-sm font-black text-white transition hover:bg-white/10">
                    <Settings className="mr-2" size={16} />
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </Card>
        </section>
      </div>

      <Card className="mt-5 p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-cyan/10 text-cyan">
            <Sparkles size={18} />
          </span>
          <div>
            <p className="text-xs font-black uppercase text-cyan">Tool category</p>
            <h2 className="mt-1 text-xl font-black text-white">Enhance</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Photo Enhancer and HD Upscale are active. Next planned workflows include {futureTools.map((tool) => tool.name).join(", ")}.
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}

function PreviewImage({ url, label, alt }: { url: string | null; label: string; alt: string }) {
  return (
    <div className="relative aspect-[5/4] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="h-full w-full object-contain" loading="lazy" decoding="async" />
      ) : (
        <div className="grid h-full place-items-center text-xs font-bold text-slate-500">No preview</div>
      )}
      <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black uppercase text-white backdrop-blur">
        {label}
      </span>
    </div>
  );
}

function CreditInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  );
}

function JobsSkeleton() {
  return (
    <div className="mt-5 grid gap-4">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 lg:grid-cols-[260px_1fr_auto] lg:items-center">
          <div className="grid grid-cols-2 gap-2">
            <div className="aspect-[4/3] animate-pulse rounded-xl bg-white/10" />
            <div className="aspect-[4/3] animate-pulse rounded-xl bg-white/10" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-28 animate-pulse rounded-lg bg-white/10" />
            <div className="h-6 w-44 animate-pulse rounded-lg bg-white/10" />
            <div className="h-4 w-64 max-w-full animate-pulse rounded-lg bg-white/10" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function CreditActivitySkeleton() {
  return (
    <div className="mt-3 grid gap-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-white/10" />
      ))}
    </div>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(date));
}

function formatTransactionType(type: string) {
  if (type === "FREE_TRIAL") return "legacy credit grant";
  if (type === "USE") return "AI job deduction";
  if (type === "REFUND") return "credit refund";
  return type.replaceAll("_", " ").toLowerCase();
}

async function fetchJsonCached<T>(key: string, url: string): Promise<T> {
  const cached = requestCache.get(key);
  const now = Date.now();

  if (cached && now - cached.createdAt < REQUEST_CACHE_TTL_MS) {
    return cached.promise as Promise<T>;
  }

  const promise = fetch(url, {
    credentials: "same-origin"
  }).then(async (response) => {
    const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

    if (response.status === 401) {
      window.location.href = "/auth/sign-in?next=/dashboard";
      return {
        ok: false,
        error: "unauthorized"
      } as T;
    }

    if (!response.ok) {
      throw new Error(json?.error || "Request failed.");
    }

    return json as T;
  });

  requestCache.set(key, {
    createdAt: now,
    promise
  });

  promise.catch(() => {
    requestCache.delete(key);
  });

  return promise;
}

async function fetchJsonFresh<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store"
  });
  const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (response.status === 401) {
    window.location.href = "/auth/sign-in?next=/dashboard";
    return {
      ok: false,
      error: "unauthorized"
    } as T;
  }

  if (!response.ok) {
    throw new Error(json?.error || "Request failed.");
  }

  return json as T;
}
