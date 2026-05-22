"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, CheckCircle2, CreditCard, Download, FileText, HelpCircle, Loader2, MailCheck, ReceiptText, Settings, Shield, ShieldCheck, Trash2, UploadCloud, UserCircle } from "lucide-react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { trackEvent } from "@/lib/analytics/events";
import { releaseMobileInputViewport } from "@/lib/dom/mobile-viewport";
import { VerifyAction, VerifyBadge, VerifyPanel } from "@/components/verify-ui/core";

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
  const [file, setFile] = useState<File | null>(null);
  const [emails, setEmails] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "running" | "error" | "success">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey());
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [transactionsStatus, setTransactionsStatus] = useState<"loading" | "ready" | "error">("loading");
  const displayCreditBalance = transactions[0]?.balanceAfter ?? creditBalance;

  const estimatedEmails = useMemo(() => {
    const matches = emails.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    return new Set(matches.map((item) => item.toLowerCase())).size;
  }, [emails]);

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
    if (searchParams.get("checkout") !== "success") return;

    const paymentId = searchParams.get("paymentId") || "";
    const value = Number(searchParams.get("value") || 0);
    const currency = (searchParams.get("currency") || "USD").toUpperCase();
    const credits = Number(searchParams.get("credits") || 0);
    const transactionId = paymentId || `checkout-${new Date().toISOString().slice(0, 10)}`;
    const dedupeKey = `zeylora_checkout_success_tracked:${transactionId}`;

    try {
      if (sessionStorage.getItem(dedupeKey) === "1" || localStorage.getItem(dedupeKey) === "1") {
        return;
      }
      sessionStorage.setItem(dedupeKey, "1");
      localStorage.setItem(dedupeKey, "1");
    } catch {
      // Tracking should still run if browser storage is blocked.
    }

    setMessage("Payment successful. Your verification balance is refreshing now.");
    setRefreshTick((tick) => tick + 1);

    const payload = {
      paymentId: paymentId || null,
      transaction_id: transactionId,
      transactionId,
      value: Number.isFinite(value) ? value : 0,
      currency,
      credits: Number.isFinite(credits) ? credits : 0,
      source: "stripe_success_redirect"
    };

    const timer = window.setTimeout(() => {
      trackEvent({
        event: "purchase",
        properties: payload
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [searchParams]);

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
    if (!file && estimatedEmails > displayCreditBalance) {
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
    releaseMobileInputViewport();
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
      if (payload?.job?.id) {
        releaseMobileInputViewport();
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
      setMessage("File selected. Click Verify email list to upload and start verification.");
    }
  }

  function onEmailsChange(value: string) {
    setEmails(value);
    setIdempotencyKey(createIdempotencyKey());
  }

  function clearSelectedFile() {
    setFile(null);
    setSubmitStatus("idle");
    setMessage("File cleared. You can paste emails manually or choose another CSV/TXT file.");
    setIdempotencyKey(createIdempotencyKey());
  }

  const postVerifyBalance = !file && estimatedEmails > 0 ? Math.max(0, displayCreditBalance - estimatedEmails) : null;

  return (
    <div className="grid gap-6">
      <WorkspaceCommandCenter creditBalance={displayCreditBalance} packageCount={packages.length} />

      <section id="verify" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <VerifyPanel className="overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5 md:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <VerifyBadge tone="blue">Verification workbench</VerifyBadge>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-4xl">Upload a list and get clean segments.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 md:text-base">
                  Upload CSV/TXT files or paste a small list. Zeylora parses, deduplicates, reserves credits, starts provider processing, and opens the job report.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/80 bg-white/80 p-3 shadow-[0_1px_2px_rgba(15,23,42,.04)] backdrop-blur md:min-w-[260px]">
                <InputEstimate label="Balance" value={displayCreditBalance.toLocaleString()} tone="blue" />
                <InputEstimate label="Paste max" value={MAX_PASTE_EMAILS.toLocaleString()} />
                <InputEstimate label="File max" value="25 MB" />
                <InputEstimate label="Job max" value={MAX_EMAILS_PER_JOB.toLocaleString()} />
              </div>
            </div>
          </div>

          <form onSubmit={submitVerification} className="grid gap-5 p-5 md:p-7">
            <label className="grid cursor-pointer gap-3 rounded-lg border border-dashed border-blue-300 bg-blue-50 p-8 text-center transition hover:bg-blue-100/70">
              <UploadCloud className="mx-auto text-blue-700" size={32} />
              <span className="text-lg font-semibold text-slate-950">{file ? file.name : "Choose CSV or TXT list"}</span>
              <span className="text-sm text-slate-500">
                {file ? `${formatBytes(file.size)} selected - ready to upload when you verify.` : "CSV/TXT supported up to 25 MB and 50,000 emails per job. Larger lists should be split or sent to support."}
              </span>
              <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFileChange} />
            </label>

            <DashboardFileStatus file={file} submitStatus={submitStatus} onClear={clearSelectedFile} />

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
              <InputEstimate label={postVerifyBalance == null ? "Available" : "Balance after"} value={(postVerifyBalance ?? displayCreditBalance).toLocaleString()} tone="blue" />
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
            {!file && estimatedEmails > 0 && estimatedEmails > displayCreditBalance ? (
              <p className="text-sm font-semibold text-amber-700">
                This pasted list needs {estimatedEmails.toLocaleString()} credits. Your current balance is {displayCreditBalance.toLocaleString()}.
              </p>
            ) : null}
          </form>
        </VerifyPanel>

        <div className="grid gap-5">
          <UploadGuidancePanel />
          <QuickCreditPanel creditBalance={displayCreditBalance} />
        </div>
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
              <p className="mt-2 text-3xl font-semibold tracking-tight text-blue-700">{displayCreditBalance.toLocaleString()}</p>
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
              <VerifyBadge>All packages</VerifyBadge>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">Choose the right verification volume.</h3>
            </div>
            <ReceiptText className="hidden text-slate-300 sm:block" size={28} />
          </div>
          <div className="mt-5 grid gap-3 2xl:grid-cols-2">
            {packages.map((pack) => (
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
            {packages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                Verification packages will appear here when pricing is configured.
              </div>
            ) : null}
          </div>
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
            <SettingRow label="Credits" value="One unique email reserves one credit when the job starts. Provider-processed attempts remain used; unprocessed credits are protected by the ledger." />
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

function WorkspaceCommandCenter({ creditBalance, packageCount }: { creditBalance: number; packageCount: number }) {
  return (
    <section id="overview" className="grid gap-4 xl:grid-cols-[minmax(360px,.9fr)_minmax(0,1.1fr)]">
      <VerifyPanel className="p-5 md:p-6">
        <WorkspaceReadyNotice creditBalance={creditBalance} />
      </VerifyPanel>
      <VerifyPanel className="p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <VerifyBadge>Workspace summary</VerifyBadge>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">Everything needed to verify a list, without loading history first.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Start a new upload here. Job history and CSV downloads now live on a dedicated page so the dashboard opens faster.
            </p>
          </div>
          <Link href="/dashboard/jobs" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
            Open job history
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric label="Credits" value={creditBalance.toLocaleString()} tone="blue" />
          <WorkspaceMetric label="Packages" value={packageCount.toLocaleString()} tone="green" />
          <WorkspaceMetric label="Paste max" value={MAX_PASTE_EMAILS.toLocaleString()} />
          <WorkspaceMetric label="Job max" value={MAX_EMAILS_PER_JOB.toLocaleString()} tone="amber" />
        </div>
      </VerifyPanel>
    </section>
  );
}

function WorkspaceReadyNotice({ creditBalance }: { creditBalance: number }) {
  const tone = creditBalance > 0 ? "green" : "amber";
  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
      <div className={`rounded-md p-3 ${tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
        {creditBalance > 0 ? <ShieldCheck size={24} /> : <CreditCard size={24} />}
      </div>
      <div>
        <VerifyBadge tone={creditBalance > 0 ? "green" : "amber"}>
          {creditBalance > 0 ? "Ready" : "Credits needed"}
        </VerifyBadge>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-slate-950">
          {creditBalance > 0 ? "Start cleaning your next email list." : "Add credits before starting a list."}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Upload CSV/TXT files up to 25 MB, keep public jobs at 50,000 emails or less, and download segmented CSV reports after processing.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={creditBalance > 0 ? "/dashboard#verify" : "/pricing"} className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
            {creditBalance > 0 ? "Upload list" : "Buy credits"}
          </Link>
          <Link href="/dashboard/jobs" className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            View history
          </Link>
        </div>
      </div>
    </div>
  );
}

function UploadGuidancePanel() {
  return (
    <VerifyPanel className="p-5 md:p-6">
      <VerifyBadge tone="blue">Upload rules</VerifyBadge>
      <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">Safe limits for real lists.</h3>
      <div className="mt-5 grid gap-3">
        <LimitRow label="Pasted lists" value={`${MAX_PASTE_EMAILS.toLocaleString()} emails`} />
        <LimitRow label="CSV/TXT upload" value="25 MB file size" />
        <LimitRow label="Public job limit" value={`${MAX_EMAILS_PER_JOB.toLocaleString()} emails`} />
      </div>
      <div className="mt-5 grid gap-3">
        <WorkflowStep icon={<FileText size={17} />} title="Server reads the list" text="Files are parsed and deduplicated server-side, so large uploads do not run inside the browser." />
        <WorkflowStep icon={<CreditCard size={17} />} title="Credit ledger protects balance" text="Credits are reserved at job start; unprocessed credits stay protected by the ledger." />
        <WorkflowStep icon={<Download size={17} />} title="Reports stay in history" text="Valid CSV, full report, and partial exports appear on completed or canceled jobs when saved results exist." />
      </div>
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <HelpCircle className="mt-0.5 shrink-0 text-amber-700" size={17} />
          <p className="text-sm font-semibold leading-6 text-amber-800">
            If the provider-side bulk job has already started, automatic cancellation can be blocked to avoid unsafe refunds and duplicate provider spend.
          </p>
        </div>
      </div>
    </VerifyPanel>
  );
}

function QuickCreditPanel({ creditBalance }: { creditBalance: number }) {
  return (
    <VerifyPanel id="credits" className="p-5 md:p-6">
      <VerifyBadge>Credits</VerifyBadge>
      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">Available balance</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-blue-700">{creditBalance.toLocaleString()}</p>
        <p className="mt-1 text-sm text-slate-600">1 credit verifies 1 unique email.</p>
      </div>
      <div className="mt-4 grid gap-2">
        <VerifyAction href="/dashboard#payments">View packages</VerifyAction>
        <VerifyAction href="/dashboard/jobs" variant="secondary">
          Job history
        </VerifyAction>
      </div>
    </VerifyPanel>
  );
}

function WorkspaceMetric({ label, value, tone = "neutral" }: { label: string; value: ReactNode; tone?: "neutral" | "blue" | "green" | "amber" | "red" }) {
  const color =
    tone === "blue"
      ? "text-blue-700"
      : tone === "green"
        ? "text-emerald-700"
        : tone === "amber"
          ? "text-amber-700"
          : tone === "red"
            ? "text-rose-700"
            : "text-slate-950";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
    </div>
  );
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function WorkflowStep({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mt-0.5 rounded-md bg-white p-2 text-blue-700">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-5 text-slate-600">{text}</p>
      </div>
    </div>
  );
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

function DashboardFileStatus({
  file,
  submitStatus,
  onClear
}: {
  file: File | null;
  submitStatus: "idle" | "running" | "error" | "success";
  onClear: () => void;
}) {
  if (!file) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <StatusDot state="idle" />
          No CSV/TXT file selected
        </div>
        <p className="mt-1 text-xs text-slate-500">Select a file above, or paste emails manually.</p>
      </div>
    );
  }

  const tooLarge = file.size > MAX_UPLOAD_BYTES;
  const invalidFormat = !looksLikeSupportedFile(file);
  const error = tooLarge || invalidFormat || submitStatus === "error";
  const uploading = submitStatus === "running";
  const progress = error ? 100 : uploading ? 62 : 100;
  const title = error ? "File needs attention" : uploading ? "Uploading and creating job..." : "File selected";
  const helper = tooLarge
    ? "Maximum upload size is 25 MB. Split the file and try again."
    : invalidFormat
      ? "Please choose a CSV or TXT file."
      : uploading
        ? "Keep this page open. You will be moved to the progress page when the job is created."
        : "Ready to upload. Click Verify email list to create the job.";

  return (
    <div className={`rounded-lg border p-4 ${error ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className={`flex items-center gap-2 text-sm font-semibold ${error ? "text-rose-700" : "text-emerald-700"}`}>
            <StatusDot state={error ? "error" : uploading ? "active" : "done"} />
            {title}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-slate-950">{file.name}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">{formatBytes(file.size)} - {file.type || "CSV/TXT file"}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {!error && !uploading ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={14} />
              Ready to upload
            </span>
          ) : null}
          {!uploading ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-950"
            >
              <Trash2 size={13} />
              Clear
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full transition-all duration-700 ${error ? "bg-rose-500" : "bg-emerald-500"} ${uploading ? "animate-pulse" : ""}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className={`mt-2 text-xs font-semibold ${error ? "text-rose-700" : "text-emerald-700"}`}>{helper}</p>
    </div>
  );
}

function StatusDot({ state }: { state: "idle" | "active" | "done" | "error" }) {
  const className =
    state === "done"
      ? "bg-emerald-500"
      : state === "active"
        ? "animate-pulse bg-blue-500"
        : state === "error"
          ? "bg-rose-500"
          : "bg-slate-300";
  return <span className={`inline-block size-2.5 rounded-full ${className}`} />;
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

function formatBytes(value: number | null | undefined) {
  if (!value) return "0 KB";
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024)).toLocaleString()} KB`;
}
