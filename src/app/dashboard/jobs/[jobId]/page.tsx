import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
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
        uniqueEmails: true,
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
  const downloadLinks = job.status === "COMPLETED" ? await buildDownloadLinks(job) : [];

  return (
    <AppShell
      area="dashboard"
      title="Verification report"
      description="Review deliverability breakdown and download segmented CSV exports."
    >
      <div className="grid gap-5">
        <VerifyPanel className="p-5 md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">{job.providerKey}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">{job.originalFilename || "Pasted email list"}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {job.status} · {job.uniqueEmails.toLocaleString()} unique emails · {job.creditsUsed || job.creditsReserved} credits
              </p>
            </div>
            <Link href="/dashboard#jobs" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              Back to history
            </Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-6">
            <Metric label="Unique" value={job.uniqueEmails} />
            <Metric label="Valid" value={job.validCount} tone="good" />
            <Metric label="Invalid" value={job.invalidCount} tone="bad" />
            <Metric label="Risky" value={job.riskyCount + job.catchAllCount} tone="warn" />
            <Metric label="Disposable" value={job.disposableCount} tone="warn" />
            <Metric label="Unknown" value={job.unknownCount} />
          </div>

          {downloadLinks.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-3">
              {downloadLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Download className="mr-2" size={16} />
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </VerifyPanel>

        <VerifyPanel className="p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">Result rows</p>
            <p className="text-sm font-semibold text-slate-500">
              Showing {resultTotal === 0 ? 0 : skip + 1}-{Math.min(resultTotal, skip + RESULT_PAGE_SIZE)} of {resultTotal}
            </p>
          </div>
          <div className="mt-4 overflow-x-auto">
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

function Metric({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : "text-slate-950";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${color}`}>{value.toLocaleString()}</p>
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
