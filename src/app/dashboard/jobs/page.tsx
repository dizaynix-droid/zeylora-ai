import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Loader2, MailCheck, XCircle } from "lucide-react";
import type { VerificationJobStatus } from "@prisma/client";
import { AppShell } from "@/components/layout/app-shell";
import { JobDownloadButton } from "@/components/verification/job-download-button";
import { VerifyBadge, VerifyPanel } from "@/components/verify-ui/core";
import { getCurrentSessionUser } from "@/lib/auth/current-user";
import { requireMfaIfNeeded } from "@/lib/auth/mfa";
import { prisma } from "@/lib/db";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Verification Jobs",
  description: "Email verification job history, progress, and CSV exports.",
  path: "/dashboard/jobs",
  noIndex: true
});

const PAGE_SIZE = 10;
const STATUS_FILTERS: Array<{ label: string; value: "all" | VerificationJobStatus }> = [
  { label: "All", value: "all" },
  { label: "Running", value: "PROCESSING" },
  { label: "Queued", value: "QUEUED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Needs review", value: "FAILED" },
  { label: "Partial", value: "PARTIAL_FAILED" }
];

export default async function VerificationJobsPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string; status?: string }>;
}) {
  const startedAt = Date.now();
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) redirect("/auth/sign-in?next=/dashboard/jobs");
  await requireMfaIfNeeded("/dashboard/jobs");

  const query = await searchParams;
  const page = Math.max(1, Number(query?.page || 1));
  const status = normalizeStatus(query?.status);

  const appUser = await prisma.user.findFirst({
    where: {
      OR: [{ id: sessionUser.id }, { email: sessionUser.email }],
      deletedAt: null
    },
    select: { id: true }
  });

  if (!appUser) redirect("/auth/sign-in?next=/dashboard/jobs");

  const where = {
    userId: appUser.id,
    deletedAt: null,
    ...(status === "all" ? {} : { status })
  };

  const [jobs, total] = await Promise.all([
    prisma.verificationJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        sourceType: true,
        originalFilename: true,
        totalEmails: true,
        uniqueEmails: true,
        syntaxInvalidCount: true,
        processedCount: true,
        failedBatchCount: true,
        validCount: true,
        invalidCount: true,
        riskyCount: true,
        catchAllCount: true,
        disposableCount: true,
        unknownCount: true,
        creditsReserved: true,
        creditsUsed: true,
        progressPercent: true,
        createdAt: true,
        completedAt: true,
        errorMessage: true,
        validExportStorageKey: true,
        invalidExportStorageKey: true,
        riskyExportStorageKey: true,
        fullReportStorageKey: true
      }
    }),
    prisma.verificationJob.count({ where })
  ]);

  if (process.env.NODE_ENV === "development" || process.env.ADMIN_PERF_LOGS === "true") {
    console.info("[dashboard-perf] page./dashboard/jobs", {
      totalMs: Date.now() - startedAt,
      page,
      status,
      resultCount: jobs.length,
      total
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  const runningCount = jobs.filter((job) => job.status === "QUEUED" || job.status === "PROCESSING").length;
  const downloadableCount = jobs.filter((job) => isDownloadable(job)).length;

  return (
    <AppShell
      area="dashboard"
      title="Verification job history"
      description="Review recent verification work, open detailed reports, and download segmented CSV exports."
    >
      <div className="grid gap-5">
        <VerifyPanel className="p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <VerifyBadge tone="blue">Job history</VerifyBadge>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-slate-950">Recent verification jobs are separated from the main dashboard.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                This page loads paginated history only when you need it, keeping the main verification workspace faster.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard#verify" className="inline-flex min-h-10 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Verify list
              </Link>
              <Link href="/dashboard" className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                Dashboard
              </Link>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Showing" value={total === 0 ? "0" : `${from}-${to}`} />
            <MiniMetric label="Total jobs" value={total.toLocaleString()} tone="blue" />
            <MiniMetric label="Ready downloads" value={downloadableCount.toLocaleString()} tone={runningCount > 0 ? "amber" : "green"} />
          </div>
        </VerifyPanel>

        <VerifyPanel className="p-4 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => (
                <Link
                  key={filter.value}
                  href={filter.value === "all" ? "/dashboard/jobs" : `/dashboard/jobs?status=${filter.value}`}
                  className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                    status === filter.value
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {filter.label}
                </Link>
              ))}
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {total === 0 ? "No jobs found" : `Showing ${from}-${to} of ${total}`}
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            {jobs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <MailCheck className="mx-auto text-blue-700" size={34} />
                <p className="mt-3 text-lg font-semibold text-slate-950">No verification jobs yet</p>
                <p className="mt-2 text-sm text-slate-500">Upload a CSV or paste emails from the dashboard to create your first report.</p>
                <Link href="/dashboard#verify" className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Start verification
                </Link>
              </div>
            ) : null}
            {jobs.map((job) => (
              <JobHistoryCard key={job.id} job={job} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between gap-3">
              <PageLink page={page - 1} status={status} disabled={page <= 1}>Previous</PageLink>
              <span className="text-sm font-semibold text-slate-500">Page {page} / {totalPages}</span>
              <PageLink page={page + 1} status={status} disabled={page >= totalPages}>Next</PageLink>
            </div>
          ) : null}
        </VerifyPanel>
      </div>
    </AppShell>
  );
}

function JobHistoryCard({
  job
}: {
  job: {
    id: string;
    status: VerificationJobStatus;
    sourceType: string;
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
    creditsReserved: number;
    creditsUsed: number;
    progressPercent: number;
    createdAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
    validExportStorageKey: string | null;
    invalidExportStorageKey: string | null;
    riskyExportStorageKey: string | null;
    fullReportStorageKey: string | null;
  };
}) {
  const completed = job.status === "COMPLETED";
  const canceled = job.status === "CANCELED" || job.status === "CANCELLED";
  const failed = job.status === "FAILED" || job.status === "PARTIAL_FAILED";
  const active = job.status === "QUEUED" || job.status === "PROCESSING";
  const downloadable = isDownloadable(job);
  const progress = Math.max(active ? 5 : 0, Math.min(100, job.progressPercent || (completed ? 100 : 0)));
  const credits = job.creditsUsed || job.creditsReserved || job.uniqueEmails;

  return (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <VerifyBadge tone={completed ? "green" : failed || canceled ? "red" : active ? "blue" : "neutral"}>
            {completed ? <CheckCircle2 className="mr-1" size={13} /> : failed || canceled ? <XCircle className="mr-1" size={13} /> : active ? <Loader2 className="mr-1 animate-spin" size={13} /> : null}
            {formatStatus(job.status)}
          </VerifyBadge>
          <span className="text-sm font-semibold text-slate-500">{formatDate(job.createdAt)}</span>
          <span className="truncate text-sm font-semibold text-slate-600">{job.originalFilename || (job.sourceType === "paste" ? "Pasted email list" : "Email list")}</span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <Count label="Unique" value={job.uniqueEmails} />
          <Count label="Processed" value={job.processedCount} />
          <Count label="Valid" value={job.validCount} tone="good" />
          <Count label="Invalid" value={job.invalidCount} tone="bad" />
          <Count label="Risky" value={job.riskyCount + job.catchAllCount} tone="warn" />
          <Count label="Credits" value={credits} />
        </div>

        {active ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              <span>{job.status === "QUEUED" ? "Queued" : "Processing in chunks"}</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        {job.syntaxInvalidCount > 0 || job.failedBatchCount > 0 ? (
          <p className="mt-3 text-sm font-semibold text-amber-700">
            Syntax errors {job.syntaxInvalidCount.toLocaleString()} · batch errors {job.failedBatchCount.toLocaleString()}
          </p>
        ) : null}
        {job.errorMessage ? <p className="mt-3 text-sm font-semibold text-rose-700">{job.errorMessage}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2 lg:max-w-80 lg:justify-end">
        <Link href={`/dashboard/jobs/${job.id}`} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
          View report
        </Link>
        {failed ? (
          <Link href={`/dashboard/support?jobId=${job.id}`} className="inline-flex min-h-10 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100">
            Get help
          </Link>
        ) : null}
        {downloadable && job.validExportStorageKey ? <JobDownloadButton jobId={job.id} type="valid" label="Valid CSV" /> : null}
        {downloadable && job.fullReportStorageKey ? <JobDownloadButton jobId={job.id} type="full" label="Full report" variant="secondary" /> : null}
      </div>
    </div>
  );
}

function PageLink({
  page,
  status,
  disabled,
  children
}: {
  page: number;
  status: "all" | VerificationJobStatus;
  disabled: boolean;
  children: string;
}) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (status !== "all") params.set("status", status);
  const href = params.size > 0 ? `/dashboard/jobs?${params.toString()}` : "/dashboard/jobs";

  return (
    <Link
      href={href}
      aria-disabled={disabled}
      className={`rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 ${disabled ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}
    >
      {children}
    </Link>
  );
}

function MiniMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "blue" | "green" | "amber" }) {
  const color = tone === "blue" ? "text-blue-700" : tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-slate-950";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
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

function normalizeStatus(value: string | undefined): "all" | VerificationJobStatus {
  const allowed = new Set(STATUS_FILTERS.map((filter) => filter.value));
  return allowed.has(value as VerificationJobStatus) ? (value as VerificationJobStatus) : "all";
}

function isDownloadable(job: { status: VerificationJobStatus; fullReportStorageKey: string | null; processedCount: number }) {
  return Boolean(job.fullReportStorageKey) && ["COMPLETED", "PARTIAL_FAILED", "CANCELED", "CANCELLED"].includes(job.status) && job.processedCount > 0;
}

function formatStatus(status: VerificationJobStatus) {
  return status.replaceAll("_", " ").toLowerCase();
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}
