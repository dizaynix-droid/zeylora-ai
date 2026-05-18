import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { getCurrentSessionUser } from "@/lib/auth/current-user";
import { requireMfaIfNeeded } from "@/lib/auth/mfa";
import { prisma } from "@/lib/db";
import { createPrivateDownloadUrl } from "@/lib/storage/s3-client";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Verification Report",
  description: "Email verification job report and CSV exports.",
  path: "/dashboard/jobs",
  noIndex: true
});

export default async function VerificationJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) redirect("/auth/sign-in?next=/dashboard");
  await requireMfaIfNeeded("/dashboard");

  const { jobId } = await params;
  const appUser = await prisma.user.findFirst({
    where: {
      OR: [{ id: sessionUser.id }, { email: sessionUser.email }],
      deletedAt: null
    },
    select: { id: true }
  });

  if (!appUser) redirect("/auth/sign-in?next=/dashboard");

  const job = await prisma.verificationJob.findFirst({
    where: {
      id: jobId,
      userId: appUser.id,
      deletedAt: null
    },
    include: {
      results: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          email: true,
          status: true,
          reason: true,
          domain: true
        }
      }
    }
  });

  if (!job) notFound();

  const downloadLinks = job.status === "COMPLETED" ? await buildDownloadLinks(job) : [];

  return (
    <AppShell
      area="dashboard"
      title="Verification report"
      description="Review deliverability breakdown and download segmented CSV exports."
    >
      <div className="grid gap-5">
        <Card className="p-5 md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="eyebrow">{job.providerKey}</p>
              <h2 className="mt-2 text-3xl font-black text-white">{job.originalFilename || "Pasted email list"}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-400">
                {job.status} · {job.uniqueEmails.toLocaleString()} unique emails · {job.creditsUsed || job.creditsReserved} credits
              </p>
            </div>
            <Link href="/dashboard#jobs" className="rounded-full border border-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/10">
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
                  className="inline-flex h-11 items-center justify-center rounded-full bg-cyan px-5 text-sm font-black text-ink hover:bg-cyan/90"
                >
                  <Download className="mr-2" size={16} />
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="p-5 md:p-6">
          <p className="eyebrow">Sample rows</p>
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
              <tbody className="divide-y divide-white/10 text-slate-300">
                {job.results.map((result) => (
                  <tr key={result.email}>
                    <td className="py-3 font-bold text-white">{result.email}</td>
                    <td>{result.status}</td>
                    <td>{result.reason || "-"}</td>
                    <td>{result.domain || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : tone === "warn" ? "text-amber-200" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value.toLocaleString()}</p>
    </div>
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
