"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  Download,
  Headphones,
  ImageIcon,
  Search,
  Settings,
  Ticket,
  UserCircle,
  Wand2
} from "lucide-react";
import { MfaSettingsPanel } from "@/components/auth/mfa-settings-panel";
import { CleanExportButton } from "@/components/jobs/clean-export-button";
import { DownloadResultButton } from "@/components/jobs/download-result-button";
import { Card } from "@/components/ui/card";
import { type DashboardFilter } from "@/lib/dashboard/data";
import { createClient } from "@/lib/supabase/client";

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  from: number;
  to: number;
};

type DashboardJob = {
  id: string;
  status: string;
  toolName: string;
  toolSlug: string;
  creditCost: number;
  createdAt: string;
  statusLabel: string;
  summary: string;
  inputPreviewUrl: string | null;
  outputPreviewUrl: string | null;
  downloadUrl: string | null;
  cleanExportAvailable: boolean;
  cleanExportUnlocked: boolean;
  relatedTicketId: string | null;
};

type CreditTransaction = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};

type CreditPackage = {
  id: string;
  name: string;
  price: number;
  credits: number;
  bonusCredits: number;
  totalCredits: number;
  badgeText?: string;
};

type ToolOption = {
  name: string;
  slug: string;
};

type OverviewPayload = {
  ok: boolean;
  user?: {
    email: string;
    name: string | null;
    createdAt: string | null;
    creditBalance: number;
  };
  metrics?: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    cleanExportsUnlocked: number;
    openTickets: number;
  };
  error?: string;
};

type JobsPayload = {
  ok: boolean;
  jobs?: DashboardJob[];
  pagination?: Pagination;
  tools?: ToolOption[];
  error?: string;
};

type TransactionsPayload = {
  ok: boolean;
  creditTransactions?: CreditTransaction[];
  pagination?: Pagination | null;
  error?: string;
};

type PackagesPayload = {
  ok: boolean;
  packages?: CreditPackage[];
  error?: string;
};

type AsyncStatus = "loading" | "ready" | "error";

const JOB_FILTERS: Array<[DashboardFilter, string]> = [
  ["all", "All"],
  ["completed", "Completed"],
  ["failed", "Failed"],
  ["clean-export", "Clean export unlocked"],
  ["preview-only", "Preview only"]
];

export function DashboardClient({
  initialEmail,
  initialFilter
}: {
  initialEmail: string;
  initialFilter: DashboardFilter;
}) {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [overviewStatus, setOverviewStatus] = useState<AsyncStatus>("loading");
  const [activeFilter, setActiveFilter] = useState<DashboardFilter>(initialFilter);
  const [toolFilter, setToolFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsPayload, setJobsPayload] = useState<JobsPayload | null>(null);
  const [jobsStatus, setJobsStatus] = useState<AsyncStatus>("loading");
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsPayload, setTransactionsPayload] = useState<TransactionsPayload | null>(null);
  const [transactionsStatus, setTransactionsStatus] = useState<AsyncStatus>("loading");
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        const json = await fetchJsonFresh<OverviewPayload>("/api/v1/dashboard");
        if (!json?.ok) throw new Error(json?.error || "Dashboard overview could not be loaded.");
        if (!cancelled) {
          setOverview(json);
          setOverviewStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setOverviewStatus("error");
          setOverview({ ok: false, error: error instanceof Error ? error.message : "Dashboard overview could not be loaded." });
        }
      }
    }

    async function loadPackages() {
      try {
        const json = await fetchJsonFresh<PackagesPayload>("/api/v1/credits/packages");
        if (!cancelled && json?.ok) setPackages((json.packages || []).slice(0, 4));
      } catch {
        if (!cancelled) setPackages([]);
      }
    }

    void loadOverview();
    void loadPackages();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      setJobsStatus("loading");
      const params = new URLSearchParams({
        filter: activeFilter,
        page: String(jobsPage),
        pageSize: "10"
      });
      if (toolFilter !== "all") params.set("tool", toolFilter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      try {
        const json = await fetchJsonFresh<JobsPayload>(`/api/v1/dashboard/jobs?${params.toString()}`);
        if (!json?.ok) throw new Error(json?.error || "Dashboard jobs could not be loaded.");
        if (!cancelled) {
          setJobsPayload(json);
          setJobsStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setJobsStatus("error");
          setJobsPayload({ ok: false, error: error instanceof Error ? error.message : "Dashboard jobs could not be loaded." });
        }
      }
    }

    void loadJobs();
    return () => {
      cancelled = true;
    };
  }, [activeFilter, jobsPage, searchQuery, toolFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadTransactions() {
      setTransactionsStatus("loading");
      try {
        const json = await fetchJsonFresh<TransactionsPayload>(`/api/v1/dashboard/transactions?page=${transactionsPage}&pageSize=10`);
        if (!json?.ok) throw new Error(json?.error || "Credit transactions could not be loaded.");
        if (!cancelled) {
          setTransactionsPayload(json);
          setTransactionsStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setTransactionsStatus("error");
          setTransactionsPayload({ ok: false, error: error instanceof Error ? error.message : "Credit transactions could not be loaded." });
        }
      }
    }

    void loadTransactions();
    return () => {
      cancelled = true;
    };
  }, [transactionsPage]);

  const email = overview?.user?.email || initialEmail;
  const displayName = overview?.user?.name || "";
  const creditBalance = overview?.user?.creditBalance ?? 0;
  const jobs = useMemo(() => jobsPayload?.jobs ?? [], [jobsPayload?.jobs]);
  const tools = useMemo(() => jobsPayload?.tools ?? [], [jobsPayload?.tools]);
  const creditTransactions = useMemo(() => transactionsPayload?.creditTransactions ?? [], [transactionsPayload?.creditTransactions]);
  const metrics = overview?.metrics;
  const stats = [
    { label: "Credit balance", value: overviewStatus === "ready" ? String(creditBalance) : "...", icon: Coins },
    { label: "Recent edits", value: metrics ? String(metrics.totalJobs) : "...", icon: ImageIcon },
    { label: "Clean exports", value: metrics ? String(metrics.cleanExportsUnlocked) : "...", icon: Download },
    { label: "Open tickets", value: metrics ? String(metrics.openTickets) : "...", icon: Ticket },
    { label: "Failed jobs", value: metrics ? String(metrics.failedJobs) : "...", icon: AlertTriangle }
  ];

  function chooseFilter(filter: DashboardFilter) {
    setActiveFilter(filter);
    setJobsPage(1);
    window.history.replaceState(null, "", `/dashboard?filter=${filter}#jobs`);
  }

  async function saveDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    setSettingsMessage("Saving...");
    try {
      const json = await fetchJsonFresh<OverviewPayload>("/api/v1/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (!json?.ok) throw new Error(json?.error || "Could not save account settings.");
      setOverview((current) => ({
        ...(current || { ok: true }),
        ok: true,
        user: json.user || current?.user,
        metrics: current?.metrics
      }));
      setSettingsMessage("Saved.");
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Could not save account settings.");
    }
  }

  async function sendPasswordReset() {
    setSettingsMessage("Sending password reset email...");
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password?next=/dashboard%23settings")}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setSettingsMessage("Password reset email sent.");
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Could not send password reset email.");
    }
  }

  return (
    <>
      <section id="overview" className="scroll-mt-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-5">
              <stat.icon className="text-cyan" size={22} />
              <p className="mt-4 text-3xl font-black text-white">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-300">{stat.label}</p>
            </Card>
          ))}
        </div>
        <Card className="mt-5 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-cyan">Quick actions</p>
              <h2 className="mt-1 text-xl font-black text-white">Keep production moving.</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionLink href="/#upload" label="New edit" primary />
              <ActionLink href="/pricing" label="Buy credits" />
              <ActionLink href="/dashboard/support" label="Open support ticket" />
              <ActionLink href="/dashboard?filter=clean-export#jobs" label="View clean exports" />
            </div>
          </div>
        </Card>
      </section>

      <section id="credits" className="scroll-mt-8">
        <Card className="mt-5 overflow-hidden p-0">
          <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(32,211,255,.13),rgba(139,92,246,.08),rgba(255,255,255,.03))] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-cyan">Credits</p>
                <h2 className="mt-2 text-2xl font-black text-white">Credit balance and activity</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Credits power real processing and clean exports. Re-downloading an unlocked clean file does not charge again.
                </p>
              </div>
              <div className="rounded-2xl border border-cyan/25 bg-black/25 px-5 py-4 text-left shadow-glow md:text-right">
                <p className="text-xs font-black uppercase text-cyan">Available credits</p>
                <p className="mt-1 text-4xl font-black text-white">{overviewStatus === "ready" ? creditBalance : "..."}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-5 p-6 xl:grid-cols-[1fr_1.15fr]">
            <div>
              <h3 className="text-sm font-black text-white">Get credits</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {packages.length ? packages.map((pack) => (
                  <Link key={pack.id} href="/pricing" className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition hover:border-cyan/35 hover:bg-white/[0.07]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-white">{pack.name}</p>
                      {pack.badgeText ? <span className="rounded-full bg-cyan px-2 py-1 text-[10px] font-black uppercase text-ink">{pack.badgeText}</span> : null}
                    </div>
                    <p className="mt-2 text-2xl font-black text-white">${pack.price}</p>
                    <p className="mt-1 text-sm font-bold text-cyan">{pack.totalCredits} credits{pack.bonusCredits ? ` (${pack.bonusCredits} bonus)` : ""}</p>
                  </Link>
                )) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm text-slate-400">
                    Credit packs will appear here when pricing is configured.
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-white">Credit transaction history</h3>
                {transactionsPayload?.pagination ? <PaginationLabel pagination={transactionsPayload.pagination} /> : null}
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
                      <div className="text-right">
                        <p className={`text-sm font-black ${transaction.amount >= 0 ? "text-emerald" : "text-warning"}`}>
                          {transaction.amount >= 0 ? "+" : ""}{transaction.amount}
                        </p>
                        <p className="text-[10px] font-bold text-slate-500">Balance {transaction.balanceAfter}</p>
                      </div>
                    </div>
                  ))}
                  <PaginationControls pagination={transactionsPayload?.pagination || null} onPageChange={setTransactionsPage} />
                </div>
              ) : null}
              {transactionsStatus === "ready" && creditTransactions.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  No credit transactions yet. Buy the Starter Trial Pack when you are ready to process your first product photos.
                </p>
              ) : null}
              {transactionsStatus === "error" ? <ErrorBox message={transactionsPayload?.error || "Credit activity could not be loaded."} /> : null}
            </div>
          </div>
        </Card>
      </section>

      <section id="jobs" className="scroll-mt-8">
        <Card className="mt-5 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-cyan">Jobs</p>
              <h2 className="mt-2 text-xl font-black text-white">Edit history</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Newest first. Filter completed previews, failed jobs, clean exports, and tool-specific work without loading your full history.
              </p>
            </div>
            <p className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-400">{email}</p>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="flex flex-wrap gap-2">
              {JOB_FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseFilter(value)}
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${
                    activeFilter === value ? "bg-cyan text-ink" : "border border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  value={searchQuery}
                  onChange={(event) => {
                    setJobsPage(1);
                    setSearchQuery(event.target.value);
                  }}
                  placeholder="Search by tool, job ID, or YYYY-MM-DD"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#080d1f] pl-9 pr-3 text-sm text-white outline-none focus:border-cyan"
                />
              </label>
              <select
                value={toolFilter}
                onChange={(event) => {
                  setJobsPage(1);
                  setToolFilter(event.target.value);
                }}
                className="h-11 rounded-xl border border-white/10 bg-[#080d1f] px-3 text-sm font-bold text-white outline-none focus:border-cyan"
              >
                <option value="all">All tools</option>
                {tools.map((tool) => <option key={tool.slug} value={tool.slug}>{tool.name}</option>)}
              </select>
              <Link href="/#upload" className="inline-flex h-11 items-center justify-center rounded-full bg-zeylora-brand px-5 text-sm font-black text-white shadow-glow">
                New edit
              </Link>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            {jobsPayload?.pagination ? <PaginationLabel pagination={jobsPayload.pagination} /> : <span />}
            <PaginationControls pagination={jobsPayload?.pagination || null} onPageChange={setJobsPage} />
          </div>

          {jobsStatus === "loading" ? <JobsSkeleton /> : null}
          {jobsStatus === "ready" && jobs.length > 0 ? (
            <div className="mt-5 grid gap-4">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} creditBalance={creditBalance} />
              ))}
              <PaginationControls pagination={jobsPayload?.pagination || null} onPageChange={setJobsPage} />
            </div>
          ) : null}
          {jobsStatus === "ready" && jobs.length === 0 ? <JobsEmptyState /> : null}
          {jobsStatus === "error" ? <ErrorBox message={jobsPayload?.error || "Dashboard jobs could not be loaded."} /> : null}
        </Card>
      </section>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)]">
        <section id="payments" className="scroll-mt-8">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-cyan/10 text-cyan"><CreditCard size={18} /></span>
              <div>
                <p className="text-xs font-black uppercase text-cyan">Payments</p>
                <h2 className="mt-1 text-xl font-black text-white">Buy credits for clean exports</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Clean exports unlock watermark-free files. Re-downloading an already unlocked job does not charge credits again.
                </p>
                <Link href="/pricing" className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow">
                  Buy credits
                </Link>
              </div>
            </div>
          </Card>
        </section>

        <section id="settings" className="scroll-mt-8">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-cyan/10 text-cyan"><UserCircle size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase text-cyan">Settings</p>
                <h2 className="mt-1 text-xl font-black text-white">Account settings</h2>
                <div className="mt-4 grid gap-3">
                  <InfoRow label="Email" value={email} />
                  <InfoRow label="Login method" value="Email/password + Google" />
                  <InfoRow label="Last login" value="Tracked by Supabase Auth" />
                  <InfoRow label="Created" value={overview?.user?.createdAt ? formatDate(overview.user.createdAt) : "Loading..."} />
                  <InfoRow label="Credit balance" value={`${creditBalance} credits`} />
                  <InfoRow label="Support" value="support@zeylora.ai" />
                </div>
                <form onSubmit={saveDisplayName} className="mt-4 grid gap-2">
                  <label className="text-xs font-black uppercase text-slate-500">Display name</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      name="name"
                      defaultValue={displayName}
                      placeholder="Your name"
                      className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                    />
                    <button className="h-10 rounded-full bg-cyan px-4 text-sm font-black text-ink">Save</button>
                  </div>
                  {settingsMessage ? <p className="text-xs font-bold text-cyan">{settingsMessage}</p> : null}
                </form>
                <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Login & security</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void sendPasswordReset()}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-cyan/30 bg-cyan/10 px-3 py-2 text-center text-sm font-black leading-5 text-cyan transition hover:bg-cyan/15"
                    >
                      Send password reset
                    </button>
                  <span className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-emerald/20 bg-emerald/10 px-3 py-2 text-center text-sm font-black leading-5 text-emerald">
                      2FA available
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    Admin accounts should use a unique password. Optional authenticator-app 2FA is available below.
                  </p>
                </div>
                <MfaSettingsPanel />
                <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Session controls</p>
                  <p className="text-sm text-slate-300">Logout other sessions is prepared for a later session management phase.</p>
                  <p className="text-xs font-black uppercase text-slate-500">Notification preferences</p>
                  <p className="text-sm text-slate-300">Product updates and billing/support emails are prepared for a later preference center.</p>
                  <p className="text-xs font-black uppercase text-slate-500">Danger zone</p>
                  <p className="text-sm text-slate-300">To request account deletion, contact support from your ticket area.</p>
                </div>
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
    </>
  );
}

function JobCard({ job, creditBalance }: { job: DashboardJob; creditBalance: number }) {
  const isCompleted = job.status === "COMPLETED";
  const isFailed = job.status === "FAILED";

  return (
    <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 xl:grid-cols-[300px_1fr_auto] xl:items-center">
      <div className="grid grid-cols-2 gap-2">
        <PreviewImage url={job.inputPreviewUrl} label="Input" alt="Input image thumbnail" />
        <PreviewImage url={job.outputPreviewUrl} label="Output" alt="Generated result thumbnail" />
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-black uppercase text-cyan">{job.toolName}</p>
          <StatusPill status={job.status} />
          {job.cleanExportUnlocked ? <span className="rounded-full bg-emerald/10 px-2 py-1 text-[10px] font-black uppercase text-emerald">Clean unlocked</span> : null}
        </div>
        <h3 className="mt-2 text-lg font-black text-white">{job.statusLabel}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{job.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
          <span>Created {formatDate(job.createdAt)}</span>
          <span>Cost {job.creditCost} credits</span>
          <span>Job {job.id.slice(0, 8)}</span>
        </div>
      </div>
      <div className="grid gap-2 xl:min-w-52">
        {isFailed ? (
          <Link
            href={`/dashboard/support?jobId=${job.id}`}
            className="inline-flex h-10 items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow"
          >
            <Headphones className="mr-2" size={16} />
            Contact support
          </Link>
        ) : null}
        {isCompleted && job.cleanExportAvailable ? (
          <CleanExportButton
            jobId={job.id}
            creditsRequired={job.creditCost}
            creditBalance={creditBalance}
            initialUnlocked={job.cleanExportUnlocked}
            className="inline-flex h-10 w-full items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow"
          />
        ) : null}
        {job.downloadUrl && !isFailed ? (
          <DownloadResultButton
            href={job.downloadUrl}
            label="Download preview"
            className="inline-flex h-10 w-full items-center justify-center rounded-full border border-white/15 px-4 text-sm font-black text-white transition hover:bg-white/10"
          />
        ) : null}
        {job.relatedTicketId ? (
          <Link href={`/dashboard/support?saved=${job.relatedTicketId}`} className="text-center text-xs font-bold text-cyan hover:text-white">
            View related ticket
          </Link>
        ) : null}
      </div>
    </div>
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
      <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black uppercase text-white backdrop-blur">{label}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles =
    status === "COMPLETED" ? "bg-emerald/10 text-emerald" :
    status === "FAILED" ? "bg-rose-400/10 text-rose-200" :
    "bg-cyan/10 text-cyan";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${styles}`}>{status}</span>;
}

function PaginationControls({ pagination, onPageChange }: { pagination: Pagination | null; onPageChange: (page: number) => void }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={!pagination.hasPrevious}
        onClick={() => onPageChange(pagination.page - 1)}
        className="inline-flex h-9 items-center gap-1 rounded-full border border-white/10 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={14} />
        Previous
      </button>
      <span className="rounded-full bg-white/[0.06] px-3 py-2 text-xs font-black text-slate-300">
        Page {pagination.page} / {pagination.totalPages}
      </span>
      <button
        type="button"
        disabled={!pagination.hasNext}
        onClick={() => onPageChange(pagination.page + 1)}
        className="inline-flex h-9 items-center gap-1 rounded-full border border-white/10 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function PaginationLabel({ pagination }: { pagination: Pagination }) {
  return <p className="text-xs font-bold text-slate-500">Showing {pagination.from}-{pagination.to} of {pagination.total}</p>;
}

function ActionLink({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-black transition ${
        primary ? "bg-zeylora-brand text-white shadow-glow" : "border border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-200">{value}</p>
    </div>
  );
}

function JobsEmptyState() {
  return (
    <div className="mt-5 grid min-h-56 place-items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-6 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-cyan/10 text-cyan"><Wand2 size={20} /></span>
        <h3 className="mt-4 text-lg font-black text-white">No matching edits</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">Try another filter or upload a product photo to create a new edit.</p>
        <Link href="/#upload" className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow">
          Start an edit
        </Link>
      </div>
    </div>
  );
}

function JobsSkeleton() {
  return (
    <div className="mt-5 grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 xl:grid-cols-[300px_1fr_auto] xl:items-center">
          <div className="grid grid-cols-2 gap-2">
            <div className="aspect-[5/4] animate-pulse rounded-xl bg-white/10" />
            <div className="aspect-[5/4] animate-pulse rounded-xl bg-white/10" />
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
      {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-white/10" />)}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <p className="mt-5 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm font-semibold text-white">{message}</p>;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(date));
}

function formatTransactionType(type: string) {
  if (type === "FREE_TRIAL") return "legacy credit grant";
  if (type === "USE") return "clean export";
  if (type === "PURCHASE") return "credit purchase";
  if (type === "REFUND") return "credit refund";
  return type.replaceAll("_", " ").toLowerCase();
}

async function fetchJsonFresh<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init
  });
  const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (response.status === 401) {
    window.location.href = "/auth/sign-in?next=/dashboard";
    return { ok: false, error: "unauthorized" } as T;
  }

  if (!response.ok) {
    throw new Error(json?.error || "Request failed.");
  }

  return json as T;
}
