"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Download, Loader2, MailCheck, ShieldCheck, UploadCloud, XCircle } from "lucide-react";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { VerifyBadge, VerifyMetric, VerifyPanel } from "@/components/verify-ui/core";

type VerificationJob = {
  id: string;
  status: string;
  originalFilename: string | null;
  totalEmails: number;
  uniqueEmails: number;
  validCount: number;
  invalidCount: number;
  riskyCount: number;
  catchAllCount: number;
  disposableCount: number;
  unknownCount: number;
  creditsUsed: number;
  providerKey: string;
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

export function VerificationDashboardClient({
  creditBalance,
  packages
}: {
  email: string;
  creditBalance: number;
  packages: Package[];
}) {
  const [jobs, setJobs] = useState<VerificationJob[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsStatus, setJobsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [file, setFile] = useState<File | null>(null);
  const [emails, setEmails] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "running" | "error" | "success">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const estimatedEmails = useMemo(() => {
    const matches = emails.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    return new Set(matches.map((item) => item.toLowerCase())).size;
  }, [emails]);

  useEffect(() => {
    let cancelled = false;
    async function loadJobs() {
      setJobsStatus("loading");
      try {
        const response = await fetch(`/api/v1/verification/jobs?page=${jobsPage}&pageSize=10`, { cache: "no-store" });
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
  }, [jobsPage, submitStatus]);

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitStatus === "running") return;
    setSubmitStatus("running");
    setMessage(null);

    const formData = new FormData();
    if (file) formData.set("file", file);
    if (emails.trim()) formData.set("emails", emails);

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
      setMessage("List verified. Your segmented CSV exports are ready in history.");
      setFile(null);
      setEmails("");
      setJobsPage(1);
    } catch (error) {
      setSubmitStatus("error");
      setMessage(error instanceof Error ? error.message : "Verification failed.");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
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
                Zeylora deduplicates your list, reserves credits, verifies through MillionVerifier, then creates segmented downloads.
              </p>
            </div>
          </div>

          <form onSubmit={submitVerification} className="mt-6 grid gap-4">
            <label className="grid cursor-pointer gap-3 rounded-lg border border-dashed border-blue-300 bg-blue-50 p-6 text-center transition hover:bg-blue-100/70">
              <UploadCloud className="mx-auto text-blue-700" size={32} />
              <span className="text-lg font-semibold text-slate-950">{file ? file.name : "Choose CSV or TXT list"}</span>
              <span className="text-sm text-slate-500">Maximum 10MB. CSV column detection is automatic.</span>
              <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFileChange} />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Paste emails manually</span>
              <textarea
                value={emails}
                onChange={(event) => setEmails(event.target.value)}
                rows={8}
                placeholder="founder@example.com&#10;ops@example.com&#10;marketing@example.com"
                className="min-h-44 rounded-md border border-slate-300 bg-white p-4 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
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

function JobRow({ job }: { job: VerificationJob }) {
  const completed = job.status === "COMPLETED";
  const failed = job.status === "FAILED";

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
          <Count label="Valid" value={job.validCount} tone="good" />
          <Count label="Invalid" value={job.invalidCount} tone="bad" />
          <Count label="Risky" value={job.riskyCount + job.catchAllCount} tone="warn" />
          <Count label="Disposable" value={job.disposableCount} tone="warn" />
          <Count label="Credits" value={job.creditsUsed || job.uniqueEmails} />
        </div>
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
