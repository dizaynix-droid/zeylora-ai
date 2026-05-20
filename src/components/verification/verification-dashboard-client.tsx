"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Bell, CheckCircle2, CreditCard, Download, Loader2, MailCheck, ReceiptText, Settings, Shield, ShieldCheck, UploadCloud, UserCircle, XCircle } from "lucide-react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { trackEvent } from "@/lib/analytics/events";
import { VerifyAction, VerifyBadge, VerifyMetric, VerifyPanel } from "@/components/verify-ui/core";

type VerificationJob = {
  id: string;
  status: string;
  originalFilename: string | null;
  totalEmails: number;
  uniqueEmails: number;
  syntaxInvalidCount: number;
  processedCount: number;
  failedBatchCount: number;
  validCount: number;
  invalidCount: number;
  riskyCount: number;
  catchAllCount: number;
  disposableCount: number;
  unknownCount: number;
  creditsUsed: number;
  creditsReserved: number;
  providerKey: string;
  progressPercent: number;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
};

type Pagination = {
  page: number;
  totalPages: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  from: number;
  to: number;
};

type Package = {
  id: string;
  name: string;
  price: number;
  totalCredits: number;
  badgeText?: string;
};

type CreditTransaction = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};

const DRAFT_STORAGE_KEY = "zeylora_verification_draft";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_PASTE_EMAILS = 5_000;
const MAX_EMAILS_PER_JOB = 50_000;

export function VerificationDashboardClient({
  email,
  creditBalance,
  packages
}: {
  email: string;
  creditBalance: number;
  packages: Package[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<VerificationJob[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsStatus, setJobsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [file, setFile] = useState<File | null>(null);
  const [emails, setEmails] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "running" | "error" | "success">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey());
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [transactionsStatus, setTransactionsStatus] = useState<"loading" | "ready" | "error">("loading");

  const estimatedEmails = useMemo(() => {
    const matches = emails.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    return new Set(matches.map((item) => item.toLowerCase())).size;
  }, [emails]);

  useEffect(() => {
    let cancelled = false;
    async function loadJobs() {
      setJobsStatus("loading");
      try {
        const response = await fetch(`/api/v1/verification/jobs?page=${jobsPage}&pageSize=5`, { cache: "no-store" });
        const payload = await response.json();
        if (!payload?.ok) throw new Error(payload?.error || "Jobs could not be loaded.");
        if (!cancelled) {
          setJobs(payload.jobs || []);
          setPagination(payload.pagination || null);
          setJobsStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setJobsStatus("error");
          setMessage(error instanceof Error ? error.message : "Jobs could not be loaded.");
        }
      }
    }
    void loadJobs();
    return () => {
      cancelled = true;
    };
  }, [jobsPage, submitStatus, refreshTick]);

  useEffect(() => {
    const hasActiveJob = jobs.some((job) => job.status === "QUEUED" || job.status === "PROCESSING");
    if (!hasActiveJob) return;
    const interval = window.setInterval(() => {
      setRefreshTick((tick) => tick + 1);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [jobs]);

  useEffect(() => {
    let cancelled = false;
    async function loadTransactions() {
      setTransactionsStatus("loading");
      try {
        const response = await fetch("/api/v1/dashboard/transactions?page=1&pageSize=6", { cache: "no-store" });
        const payload = await response.json();
        if (!payload?.ok) throw new Error(payload?.error || "Transactions could not be loaded.");
        if (!cancelled) {
          setTransactions(payload.creditTransactions || []);
          setTransactionsStatus("ready");
        }
      } catch {
        if (!cancelled) setTransactionsStatus("error");
      }
    }
    void loadTransactions();
    return () => {
      cancelled = true;
    };
  }, [submitStatus, refreshTick]);

  useEffect(() => {
    if (draftRestored || searchParams.get("resumeVerification") !== "1") return;
    setDraftRestored(true);

    const raw =
      sessionStorage.getItem(DRAFT_STORAGE_KEY) ||
      localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      setMessage("Verification workspace is ready. Upload or paste your list to continue.");
      return;
    }

    try {
      const draft = JSON.parse(raw) as {
        sourceText?: string;
        fileName?: string | null;
        uniqueEmails?: number;
        truncated?: boolean;
      };
      if (!draft.sourceText?.trim()) return;
      setEmails(draft.sourceText);
      setFile(null);
      setIdempotencyKey(createIdempotencyKey());
      setMessage(
        draft.truncated
          ? "Your large list draft was partially restored. Review it before starting verification."
          : `Draft restored${draft.fileName ? ` from ${draft.fileName}` : ""}. You can start verification now.`
      );
      trackEvent({
        event: "homepage_verification_resume",
        properties: {
          restored: true,
          uniqueEmails: draft.uniqueEmails ?? null,
          fileName: draft.fileName ?? null
        }
      });
      document.getElementById("verify")?.scrollIntoView({ block: "start", behavior: "smooth" });
    } catch {
      setMessage("We could not restore the saved draft. Please paste or upload the list again.");
    }
  }, [draftRestored, searchParams]);

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitStatus === "running") return;
    if (file && file.size > MAX_UPLOAD_BYTES) {
      setSubmitStatus("error");
      setMessage("This file is too large. Maximum upload size is 25 MB. Please split your list into smaller files and try again.");
      return;
    }
    if (file && !looksLikeSupportedFile(file)) {
      setSubmitStatus("error");
      setMessage("We could not read this file. Please upload a CSV or TXT file with one email per row.");
      return;
    }
    if (!file && estimatedEmails > creditBalance) {
      setSubmitStatus("error");
      setMessage(`You need ${estimatedEmails.toLocaleString()} verification credits for this list. Please buy more credits to continue.`);
      return;
    }
    if (!file && estimatedEmails > MAX_PASTE_EMAILS) {
      setSubmitStatus("error");
      setMessage(`Paste verification supports up to ${MAX_PASTE_EMAILS.toLocaleString()} emails at once. Please upload a CSV/TXT file for larger lists.`);
      return;
    }
    if (!file && estimatedEmails > MAX_EMAILS_PER_JOB) {
      setSubmitStatus("error");
      setMessage(`This list contains more emails than the current job limit. Please upload up to ${MAX_EMAILS_PER_JOB.toLocaleString()} emails per job or contact support for larger volume.`);
      return;
    }
    setSubmitStatus("running");
    setMessage(null);

    const formData = new FormData();
    if (file) formData.set("file", file);
    if (emails.trim()) formData.set("emails", emails);
    formData.set("idempotencyKey", idempotencyKey);

    try {
      const response = await fetch("/api/v1/verification/jobs", {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 402 || payload?.code === "insufficient_credits") {
        throw new Error(payload?.error || "You need more credits to verify this list.");
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Verification failed.");
      }
      setSubmitStatus("success");
      setMessage("Verification job queued. Large lists are processed safely in chunks; opening progress now.");
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setFile(null);
      setEmails("");
      setIdempotencyKey(createIdempotencyKey());
      setJobsPage(1);
      if (payload?.job?.id) {
        router.push(`/dashboard/jobs/${payload.job.id}`);
      }
    } catch (error) {
      setSubmitStatus("error");
      setMessage(getFriendlyVerificationError(error));
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setIdempotencyKey(createIdempotencyKey());
    if (!nextFile) return;
    if (nextFile.size > MAX_UPLOAD_BYTES) {
      setSubmitStatus("error");
      setMessage("This file is too large. Maximum upload size is 25 MB. Please split your list into smaller files and try again.");
    } else if (!looksLikeSupportedFile(nextFile)) {
      setSubmitStatus("error");
      setMessage("We could not read this file. Please upload a CSV or TXT file with one email per row.");
    } else {
      setSubmitStatus("idle");
      setMessage(null);
    }
  }

  function onEmailsChange(value: string) {
    setEmails(value);
    setIdempotencyKey(createIdempotencyKey());
  }

  const completedJobs = jobs.filter((job) => job.status === "COMPLETED");
  const totalVerified = completedJobs.reduce((sum, job) => sum + job.uniqueEmails, 0);
  const validRate =
    totalVerified > 0 ? Math.round((completedJobs.reduce((sum, job) => sum + job.validCount, 0) / totalVerified) * 100) : 0;
  const riskyRemoved = completedJobs.reduce((sum, job) => sum + job.invalidCount + job.riskyCount + job.catchAllCount + job.disposableCount, 0);

  return (
    <div className="grid gap-5">
      <section id="overview" className="grid gap-3 md:grid-cols-4">
        <VerifyMetric label="Credits" value={creditBalance.toLocaleString()} note="1 credit = 1 email verification" tone="blue" />
        <VerifyMetric label="Verified emails" value={totalVerified.toLocaleString()} note="From recent jobs" />
        <VerifyMetric label="Valid rate" value={`${validRate}%`} note="Deliverable list quality" tone="green" />
        <VerifyMetric label="Risk removed" value={riskyRemoved.toLocaleString()} note="Invalid, risky, catch-all, disposable" tone="amber" />
      </section>

      <section id="verify" className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <VerifyPanel className="p-5 md:p-7">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-blue-50 p-3 text-blue-700">
              <UploadCloud size={24} />
            </div>
            <div>
              <VerifyBadge tone="blue">Verify list</VerifyBadge>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">Upload CSV/TXT or paste emails.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Zeylora deduplicates your list, reserves credits, runs email verification checks, then creates segmented downloads.
              </p>
            </div>
          </div>

          <form onSubmit={submitVerification} className="mt-6 grid gap-4">
            <label className="grid cursor-pointer gap-3 rounded-lg border border-dashed border-blue-300 bg-blue-50 p-6 text-center transition hover:bg-blue-100/70">
              <UploadCloud className="mx-auto text-blue-700" size={32} />
              <span className="text-lg font-semibold text-slate-950">{file ? file.name : "Choose CSV or TXT list"}</span>
              <span className="text-sm text-slate-500">CSV/TXT supported up to 25 MB and 50,000 emails per job. Larger lists should be split or sent to support.</span>
              <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFileChange} />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Paste emails manually</span>
              <textarea
                value={emails}
                onChange={(event) => onEmailsChange(event.target.value)}
                rows={8}
                placeholder="founder@example.com&#10;ops@example.com&#10;marketing@example.com"
                className="min-h-44 rounded-md border border-slate-300 bg-white p-4 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              {file ? <span className="text-xs font-semibold text-slate-500">File upload will be used for this job. Clear the selected file to verify pasted emails instead.</span> : null}
            </label>

            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
              <InputEstimate label="Detected now" value={file ? "File selected" : estimatedEmails.toLocaleString()} />
              <InputEstimate label="Credits needed" value={file ? "Calculated after upload" : estimatedEmails.toLocaleString()} />
              <InputEstimate label="Available" value={creditBalance.toLocaleString()} tone="blue" />
            </div>

            <button
              type="submit"
              disabled={submitStatus === "running" || (!file && estimatedEmails === 0)}
              className="inline-flex h-12 items-center justify-center rounded-md bg-blue-600 px-6 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitStatus === "running" ? <Loader2 className="mr-2 animate-spin" size={18} /> : <MailCheck className="mr-2" size={18} />}
              Verify email list
            </button>
            {message ? (
              <p className={`text-sm font-semibold ${submitStatus === "error" ? "text-rose-700" : "text-emerald-700"}`}>{message}</p>
            ) : null}
            {!file && estimatedEmails > 0 && estimatedEmails > creditBalance ? (
              <p className="text-sm font-semibold text-amber-700">
                This pasted list needs {estimatedEmails.toLocaleString()} credits. Your current balance is {creditBalance.toLocaleString()}.
              </p>
            ) : null}
          </form>
        </VerifyPanel>

        <VerifyPanel id="credits" className="p-5 md:p-6">
          <VerifyBadge>Credits / Billing</VerifyBadge>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Buy verification credits</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Credits are spent only when verification starts. Failed jobs are refunded automatically.
          </p>
          <div className="mt-5 grid gap-3">
            {packages.slice(0, 3).map((pack) => (
              <div key={pack.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">{pack.name}</p>
                    <p className="text-sm font-semibold text-blue-700">{pack.totalCredits.toLocaleString()} verifications</p>
                  </div>
                  <p className="text-xl font-semibold text-slate-950">${pack.price}</p>
                </div>
                <CheckoutButton
                  packageId={pack.id}
                  label="Buy credits"
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700"
                />
              </div>
            ))}
          </div>
          <Link href="/pricing" className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800">
            View all packages
          </Link>
        </VerifyPanel>
      </section>

      <section id="payments" className="grid gap-5 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
        <VerifyPanel className="p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-blue-50 p-3 text-blue-700">
              <CreditCard size={22} />
            </div>
            <div>
              <VerifyBadge tone="blue">Payments</VerifyBadge>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Billing workspace</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Buy verification credits, then use them for bulk email checks. One credit verifies one unique email address.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Current balance</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-blue-700">{creditBalance.toLocaleString()}</p>
              <p className="mt-1 text-sm text-slate-500">Available verification credits</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Billing model</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">Pay once</p>
              <p className="mt-1 text-sm text-slate-500">No subscription. Credits stay in your account.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <VerifyAction href="/pricing">Open pricing</VerifyAction>
            <VerifyAction href="/dashboard/support" variant="secondary">
              Billing support
            </VerifyAction>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <VerifyBadge>Credit ledger</VerifyBadge>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-950">Recent credit activity</h3>
              </div>
              <ReceiptText className="text-slate-300" size={24} />
            </div>
            <div className="mt-4 grid gap-2">
              {transactionsStatus === "loading" ? <p className="text-sm font-semibold text-slate-500">Loading credit activity...</p> : null}
              {transactionsStatus === "error" ? <p className="text-sm font-semibold text-rose-700">Credit activity could not be loaded.</p> : null}
              {transactionsStatus === "ready" && transactions.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">No credit activity yet.</p>
              ) : null}
              {transactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </div>
          </div>
        </VerifyPanel>

        <VerifyPanel className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <VerifyBadge>Recommended packages</VerifyBadge>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">Continue verification without leaving the workflow.</h3>
            </div>
            <ReceiptText className="hidden text-slate-300 sm:block" size={28} />
          </div>
          <div className="mt-5 grid gap-3">
            {packages.slice(0, 4).map((pack) => (
              <div key={pack.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-950">{pack.name}</p>
                    {pack.badgeText ? <VerifyBadge tone="green">{pack.badgeText}</VerifyBadge> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{pack.totalCredits.toLocaleString()} email verifications</p>
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  <p className="text-lg font-semibold text-slate-950">${pack.price}</p>
                  <CheckoutButton
                    packageId={pack.id}
                    label="Buy"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                  />
                </div>
              </div>
            ))}
          </div>
        </VerifyPanel>
      </section>

      <section id="jobs">
        <VerifyPanel className="p-4 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <VerifyBadge>Jobs / History</VerifyBadge>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Recent verification jobs</h2>
            </div>
            {pagination ? (
              <p className="text-sm font-medium text-slate-500">
                Showing {pagination.from}-{pagination.to} of {pagination.total}
              </p>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3">
            {jobsStatus === "loading" ? <p className="text-sm font-semibold text-slate-500">Loading jobs...</p> : null}
            {jobsStatus === "ready" && jobs.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
                <ShieldCheck className="mx-auto text-blue-700" size={34} />
                <p className="mt-3 text-lg font-semibold text-slate-950">No verification jobs yet</p>
                <p className="mt-2 text-sm text-slate-500">Upload a CSV or paste emails to create your first clean list.</p>
              </div>
            ) : null}
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>

          {pagination && pagination.totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setJobsPage((page) => Math.max(1, page - 1))}
                disabled={!pagination.hasPrevious}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40"
              >
                Previous
              </button>
              <p className="text-sm font-medium text-slate-500">
                Page {pagination.page} / {pagination.totalPages}
              </p>
              <button
                type="button"
                onClick={() => setJobsPage((page) => page + 1)}
                disabled={!pagination.hasNext}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </VerifyPanel>
      </section>

      <section id="settings" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <VerifyPanel className="p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-slate-100 p-3 text-slate-700">
              <UserCircle size={22} />
            </div>
            <div>
              <VerifyBadge>Account settings</VerifyBadge>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Account and security</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Your verification jobs, billing history, and downloads are tied to this account.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <SettingRow icon={<MailCheck size={18} />} label="Account email" value={email} />
            <SettingRow icon={<Shield size={18} />} label="Security" value="Password reset and MFA are managed through your account sign-in flow." />
            <SettingRow icon={<Bell size={18} />} label="Notifications" value="Verification, billing, and support email preferences are prepared for this workspace." />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <VerifyAction href="/auth/sign-in?mode=reset" variant="secondary">
              Password reset
            </VerifyAction>
            <VerifyAction href="/dashboard/support" variant="secondary">
              Contact support
            </VerifyAction>
          </div>
        </VerifyPanel>

        <VerifyPanel className="p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-slate-100 p-3 text-slate-700">
              <Settings size={22} />
            </div>
            <div>
              <VerifyBadge>Workspace preferences</VerifyBadge>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">Verification defaults</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Zeylora automatically deduplicates uploaded lists, estimates credit need, and keeps segmented CSV exports in job history.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <SettingRow label="Default workflow" value="Upload list, remove duplicates, verify unique emails, export valid/risky/invalid segments." />
            <SettingRow label="Credits" value="One unique email uses one verification credit when the job starts." />
            <SettingRow label="Support" value="Open a support ticket from the dashboard when a job fails or billing needs review." />
          </div>

          <form action="/auth/sign-out" method="post" className="mt-5">
            <button className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Sign out
            </button>
          </form>
        </VerifyPanel>
      </section>
    </div>
  );
}

function getFriendlyVerificationError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.toLowerCase().includes("expected pattern")) {
    return "We could not start verification from this browser session. Refresh the page and try again; if it repeats, contact support.";
  }
  if (message.toLowerCase().includes("failed to fetch")) {
    return "Network connection dropped before verification started. Please try again.";
  }
  return message || "Verification could not be started. Please try again.";
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function looksLikeSupportedFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".txt");
}

function SettingRow({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      {icon ? <div className="mt-0.5 text-slate-500">{icon}</div> : null}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm font-medium leading-6 text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function InputEstimate({ label, value, tone }: { label: string; value: string; tone?: "blue" }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-[-0.02em] ${tone === "blue" ? "text-blue-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: CreditTransaction }) {
  const positive = transaction.amount >= 0;
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-950">{transactionLabel(transaction.type)}</p>
          <span className={positive ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-rose-700"}>
            {positive ? "+" : ""}{transaction.amount.toLocaleString()}
          </span>
        </div>
        <p className="mt-1 truncate text-xs font-medium text-slate-500">{transaction.note || "Credit activity"}</p>
      </div>
      <div className="text-left sm:text-right">
        <p className="text-xs font-semibold text-slate-500">{formatShortDate(transaction.createdAt)}</p>
        <p className="mt-1 text-xs font-semibold text-blue-700">Balance {transaction.balanceAfter.toLocaleString()}</p>
      </div>
    </div>
  );
}

function JobRow({ job }: { job: VerificationJob }) {
  const completed = job.status === "COMPLETED";
  const failed = job.status === "FAILED";
  const active = job.status === "QUEUED" || job.status === "PROCESSING";

  return (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <VerifyBadge tone={completed ? "green" : failed ? "red" : "blue"}>
            {completed ? <CheckCircle2 className="mr-1" size={13} /> : failed ? <XCircle className="mr-1" size={13} /> : <Loader2 className="mr-1 animate-spin" size={13} />}
            {job.status}
          </VerifyBadge>
          <p className="text-sm font-medium text-slate-500">{new Date(job.createdAt).toLocaleString()}</p>
          {job.originalFilename ? <p className="text-sm font-medium text-slate-600">{job.originalFilename}</p> : null}
        </div>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-6">
          <Count label="Unique" value={job.uniqueEmails} />
          <Count label="Processed" value={job.processedCount} />
          <Count label="Valid" value={job.validCount} tone="good" />
          <Count label="Invalid" value={job.invalidCount} tone="bad" />
          <Count label="Risky" value={job.riskyCount + job.catchAllCount} tone="warn" />
          <Count label="Failed" value={job.failedBatchCount + job.syntaxInvalidCount} tone={job.failedBatchCount + job.syntaxInvalidCount > 0 ? "bad" : undefined} />
        </div>
        {active ? (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              <span>{job.status === "QUEUED" ? "Queued for processing" : "Processing in chunks"}</span>
              <span>{Math.max(0, Math.min(100, job.progressPercent || 0))}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${Math.max(5, Math.min(100, job.progressPercent || 5))}%` }}
              />
            </div>
          </div>
        ) : null}
        {job.errorMessage ? (
          <p className="mt-3 inline-flex items-center text-sm font-semibold text-rose-700">
            <AlertCircle className="mr-2" size={15} />
            {job.errorMessage}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Link href={`/dashboard/jobs/${job.id}`} className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50">
          View report
        </Link>
        {failed ? (
          <Link href={`/dashboard/support?jobId=${job.id}`} className="inline-flex h-10 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100">
            Get help
          </Link>
        ) : null}
        {completed ? (
          <>
            <DownloadLink jobId={job.id} type="valid" label="Valid CSV" />
            <DownloadLink jobId={job.id} type="full" label="Full report" />
          </>
        ) : null}
      </div>
    </div>
  );
}

function transactionLabel(type: string) {
  if (type === "PURCHASE") return "Credit purchase";
  if (type === "USE") return "Verification usage";
  if (type === "REFUND") return "Credit refund";
  if (type === "ADMIN_ADJUSTMENT") return "Account adjustment";
  if (type === "REFERRAL_REWARD") return "Partner reward";
  if (type === "FREE_TRIAL") return "Trial credits";
  return type.replaceAll("_", " ").toLowerCase();
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function Count({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : "text-slate-950";
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function DownloadLink({ jobId, type, label }: { jobId: string; type: string; label: string }) {
  async function download() {
    const response = await fetch(`/api/v1/verification/jobs/${jobId}/download?type=${type}`, { cache: "no-store" });
    const payload = await response.json();
    if (payload?.url) window.location.href = payload.url;
  }

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
    >
      <Download className="mr-2" size={15} />
      {label}
    </button>
  );
}
