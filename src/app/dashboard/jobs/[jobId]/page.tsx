import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { JobAutoRefresh } from "@/components/verification/job-auto-refresh";
import { JobCancelButton } from "@/components/verification/job-cancel-button";
import { VerifyPanel } from "@/components/verify-ui/core";
import { getCurrentSessionUser } from "@/lib/auth/current-user";
import { requireMfaIfNeeded } from "@/lib/auth/mfa";
import { prisma } from "@/lib/db";
import { createMetadata } from "@/lib/seo";
import { createPrivateDownloadUrl } from "@/lib/storage/s3-client";

export const metadata: Metadata = createMetadata({
  title: "Verification Report",
  description: "Email verification job report and CSV exports.",
  path: "/dashboard/jobs",
  noIndex: true
});

const RESULT_PAGE_SIZE = 50;

export default async function VerificationJobPage({
  params,
  searchParams
}: {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) redirect("/auth/sign-in?next=/dashboard");
  await requireMfaIfNeeded("/dashboard");

  const { jobId } = await params;
  const query = await searchParams;
  const page = Math.max(1, Number(query?.page || 1));
  const skip = (page - 1) * RESULT_PAGE_SIZE;

  const appUser = await prisma.user.findFirst({
    where: {
      OR: [{ id: sessionUser.id }, { email: sessionUser.email }],
      deletedAt: null
    },
    select: { id: true }
  });

  if (!appUser) redirect("/auth/sign-in?next=/dashboard");

  const [job, resultTotal] = await Promise.all([
    prisma.verificationJob.findFirst({
      where: {
        id: jobId,
        userId: appUser.id,
        deletedAt: null
      },
      select: {
        id: true,
        providerKey: true,
        originalFilename: true,
        status: true,
        totalEmails: true,
        uniqueEmails: true,
        duplicateCount: true,
        syntaxInvalidCount: true,
        processedCount: true,
        failedBatchCount: true,
        progressPercent: true,
        creditsUsed: true,
        creditsReserved: true,
        validCount: true,
        invalidCount: true,
        riskyCount: true,
        catchAllCount: true,
        disposableCount: true,
        unknownCount: true,
        validExportStorageKey: true,
        invalidExportStorageKey: true,
        riskyExportStorageKey: true,
        fullReportStorageKey: true,
        errorMessage: true,
        metadataJson: true,
        results: {
          orderBy: { createdAt: "asc" },
          skip,
          take: RESULT_PAGE_SIZE,
          select: {
            email: true,
            status: true,
            reason: true,
            domain: true
          }
        }
      }
    }),
    prisma.verificationEmailResult.count({ where: { verificationJobId: jobId } })
  ]);

  if (!job) notFound();

  const totalPages = Math.max(1, Math.ceil(resultTotal / RESULT_PAGE_SIZE));
  const downloadable = ["COMPLETED", "PARTIAL_FAILED", "CANCELED", "CANCELLED"].includes(job.status);
  const downloadLinks = downloadable ? await buildDownloadLinks(job) : [];
  const active = job.status === "QUEUED" || job.status === "PROCESSING";
  const providerStarted = hasProviderFile(job.metadataJson);
  const canCancel = job.status === "QUEUED" && !providerStarted && job.processedCount === 0;

  return (
    <AppShell
      area="dashboard"
      title="Verification report"
      description="Review deliverability breakdown and download segmented CSV exports."
    >
      <JobAutoRefresh enabled={active} jobId={job.id} />
      <div className="grid min-w-0 max-w-full overflow-x-hidden gap-5">
        <VerifyPanel className="min-w-0 max-w-full overflow-hidden p-4 sm:p-5 md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">{job.providerKey}</p>
              <h2 className="mt-2 break-words text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-3xl">{job.originalFilename || "Pasted email list"}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {job.status} · {job.uniqueEmails.toLocaleString()} unique emails · {job.creditsUsed || job.creditsReserved} credits
              </p>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <Link href="/dashboard#jobs" className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                Back to history
              </Link>
              <Link href={`/dashboard/support?jobId=${job.id}`} className="inline-flex min-h-10 items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                Contact support
              </Link>
              {canCancel ? <JobCancelButton jobId={job.id} /> : null}
            </div>
          </div>

          <div className="mt-6 grid min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Total" value={job.totalEmails} />
            <Metric label="Unique" value={job.uniqueEmails} />
            <Metric label="Duplicates" value={job.duplicateCount} />
            <Metric label="Credits required" value={job.creditsReserved || job.uniqueEmails} />
          </div>

          <div className="mt-3 grid min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Processed" value={job.processedCount || resultTotal} />
            <Metric label="Valid" value={job.validCount} tone="good" />
            <Metric label="Invalid" value={job.invalidCount} tone="bad" />
            <Metric label="Risky" value={job.riskyCount + job.catchAllCount} tone="warn" />
            <Metric label="Disposable" value={job.disposableCount} tone="warn" />
            <Metric label="Failed" value={job.failedBatchCount + job.syntaxInvalidCount} tone={job.failedBatchCount + job.syntaxInvalidCount > 0 ? "bad" : undefined} />
          </div>

          {active ? (
            <div className="mt-6 min-w-0 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex min-w-0 items-center justify-between gap-3 text-sm font-semibold text-blue-900">
                <span>{job.status === "QUEUED" ? "Queued for worker processing" : "Processing in safe chunks"}</span>
                <span className="shrink-0">{Math.max(0, Math.min(100, job.progressPercent || 0))}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${Math.max(5, Math.min(100, job.progressPercent || 5))}%` }}
                />
              </div>
              <p className="mt-3 max-w-full break-words text-sm leading-6 text-blue-900/75">
                <span className="sm:hidden">Zeylora verifies the list in the background and refreshes this report automatically.</span>
                <span className="hidden sm:inline">Large lists do not run inside the browser request. Zeylora verifies this list in background chunks, nudges the worker while this page is open, and refreshes this report automatically.</span>
              </p>
            </div>
          ) : null}

          {(job.status === "FAILED" || job.status === "CANCELED" || job.status === "CANCELLED") && job.errorMessage ? (
            <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
              {job.errorMessage}
            </div>
          ) : null}

          {downloadLinks.length > 0 ? (
            <div className="mt-6 grid min-w-0 max-w-full gap-3 sm:flex sm:flex-wrap">
              {downloadLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  className="inline-flex h-11 w-full min-w-0 max-w-full items-center justify-center rounded-md bg-blue-600 px-3 text-center text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto sm:px-5"
                >
                  <Download className="mr-2 shrink-0" size={16} />
                  <span className="min-w-0 truncate">{link.label}</span>
                </a>
              ))}
            </div>
          ) : null}
        </VerifyPanel>

        <VerifyPanel className="min-w-0 max-w-full overflow-hidden p-4 sm:p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">Result rows</p>
            <p className="text-sm font-semibold text-slate-500">
              Showing {resultTotal === 0 ? 0 : skip + 1}-{Math.min(resultTotal, skip + RESULT_PAGE_SIZE)} of {resultTotal}
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:hidden">
            {job.results.length > 0 ? (
              job.results.map((result) => (
                <div key={result.email} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="break-all text-sm font-semibold text-slate-950">{result.email}</p>
                  <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <MobileResultField label="Status" value={result.status} />
                    <MobileResultField label="Domain" value={result.domain || "-"} />
                    <MobileResultField label="Reason" value={result.reason || "-"} wide />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Results will appear here as soon as verification starts processing.
              </div>
            )}
          </div>
          <div className="mt-4 hidden max-w-full overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="py-3">Email</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Domain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {job.results.map((result) => (
                  <tr key={result.email}>
                    <td className="py-3 font-semibold text-slate-950">{result.email}</td>
                    <td>{result.status}</td>
                    <td>{result.reason || "-"}</td>
                    <td>{result.domain || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resultTotal > RESULT_PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <PageLink jobId={job.id} page={page - 1} disabled={page <= 1}>Previous</PageLink>
              <span className="text-sm font-semibold text-slate-500">Page {page} / {totalPages}</span>
              <PageLink jobId={job.id} page={page + 1} disabled={page >= totalPages}>Next</PageLink>
            </div>
          ) : null}
        </VerifyPanel>
      </div>
    </AppShell>
  );
}

function hasProviderFile(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const value = metadata as { providerFileId?: unknown; millionVerifierFileId?: unknown };
  return Boolean(value.providerFileId || value.millionVerifierFileId);
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : "text-slate-950";
  return (
    <div className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <p className="break-words text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500 sm:text-xs sm:tracking-[0.08em]">{label}</p>
      <p className={`mt-2 break-words text-2xl font-semibold sm:text-3xl ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function MobileResultField({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 max-w-full rounded-md border border-slate-200 bg-white p-2 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-xs font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PageLink({ jobId, page, disabled, children }: { jobId: string; page: number; disabled: boolean; children: string }) {
  return (
    <Link
      href={`/dashboard/jobs/${jobId}?page=${page}`}
      aria-disabled={disabled}
      className={`rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 ${disabled ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}
    >
      {children}
    </Link>
  );
}

async function buildDownloadLinks(job: {
  validExportStorageKey: string | null;
  invalidExportStorageKey: string | null;
  riskyExportStorageKey: string | null;
  fullReportStorageKey: string | null;
}) {
  const links = [
    ["Valid only", job.validExportStorageKey, "valid-emails.csv"],
    ["Invalid only", job.invalidExportStorageKey, "invalid-emails.csv"],
    ["Risky / catch-all", job.riskyExportStorageKey, "risky-emails.csv"],
    ["Full report", job.fullReportStorageKey, "full-report.csv"]
  ] as const;

  return Promise.all(
    links
      .filter(([, key]) => Boolean(key))
      .map(async ([label, key, filename]) => ({
        label,
        url: await createPrivateDownloadUrl(key as string, filename, 900)
      }))
  );
}
