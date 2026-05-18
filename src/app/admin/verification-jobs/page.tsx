import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { AdminPaginationControls, AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminVerificationJobsPage({
  searchParams
}: {
  searchParams?: Promise<{ status?: string; user?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params?.page || 1));
  const status = params?.status || "all";
  const user = params?.user?.trim() || "";
  const where = {
    deletedAt: null,
    ...(status !== "all" ? { status: status as never } : {}),
    ...(user
      ? {
          user: {
            email: {
              contains: user,
              mode: "insensitive" as const
            }
          }
        }
      : {})
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
        providerKey: true,
        originalFilename: true,
        uniqueEmails: true,
        validCount: true,
        invalidCount: true,
        riskyCount: true,
        catchAllCount: true,
        disposableCount: true,
        creditsUsed: true,
        providerCostAtRun: true,
        estimatedRevenueAtRun: true,
        estimatedProfitAtRun: true,
        errorMessage: true,
        createdAt: true,
        user: {
          select: {
            email: true
          }
        }
      }
    }),
    prisma.verificationJob.count({ where })
  ]);
  const pagination = createPagination(page, PAGE_SIZE, total);

  return (
    <AppShell area="admin" title="Doğrulama işleri" description="Email list cleaning job, provider, maliyet ve hata kayıtlarını izle.">
      <AdminSection title="Verification job kayıtları" description="Varsayılan olarak son 25 kayıt gelir; filtreler server-side çalışır.">
        <form className="mb-4 grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 md:grid-cols-[180px_1fr_auto]">
          <select name="status" defaultValue={status} className="h-10 rounded-xl border border-white/10 bg-[#080d1f] px-3 text-sm font-bold text-white outline-none focus:border-cyan">
            <option value="all">Tüm durumlar</option>
            <option value="COMPLETED">Tamamlandı</option>
            <option value="FAILED">Hatalı</option>
            <option value="PROCESSING">İşleniyor</option>
            <option value="QUEUED">Sırada</option>
          </select>
          <input name="user" defaultValue={user} placeholder="Kullanıcı email" className="h-10 rounded-xl border border-white/10 bg-[#080d1f] px-3 text-sm text-white outline-none focus:border-cyan" />
          <button className="h-10 rounded-full bg-cyan px-5 text-sm font-black text-ink transition hover:bg-cyan/90">Filtrele</button>
        </form>
        <AdminPaginationControls basePath="/admin/verification-jobs" params={{ status, user }} pagination={pagination} />
        <AdminTable>
          <table className="mt-3 min-w-[1280px] w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Kullanıcı</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Valid / Risk</th>
                <th className="px-4 py-3">Kredi</th>
                <th className="px-4 py-3">Kâr snapshot</th>
                <th className="px-4 py-3">Hata</th>
                <th className="px-4 py-3">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/jobs/${job.id}`} className="font-black text-cyan hover:text-white">{job.id.slice(0, 8)}</Link>
                    <p className="text-xs text-slate-500">{job.originalFilename || "paste"}</p>
                  </td>
                  <td className="px-4 py-3"><Status status={job.status} /></td>
                  <td className="px-4 py-3 text-slate-300">{job.user.email}</td>
                  <td className="px-4 py-3 text-slate-300">{job.uniqueEmails.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-300">{job.validCount.toLocaleString()} / {(job.invalidCount + job.riskyCount + job.catchAllCount + job.disposableCount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-300">{job.creditsUsed.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-300">
                    ${Number(job.estimatedProfitAtRun || 0).toFixed(4)}
                    <p className="text-xs text-slate-500">cost ${Number(job.providerCostAtRun || 0).toFixed(4)}</p>
                  </td>
                  <td className="max-w-sm truncate px-4 py-3 text-slate-400">{job.errorMessage || "-"}</td>
                  <td className="px-4 py-3 text-slate-400">{formatAdminDate(job.createdAt)}</td>
                </tr>
              ))}
              {jobs.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Kayıt yok.</td></tr> : null}
            </tbody>
          </table>
        </AdminTable>
        <div className="mt-3">
          <AdminPaginationControls basePath="/admin/verification-jobs" params={{ status, user }} pagination={pagination} />
        </div>
      </AdminSection>
    </AppShell>
  );
}

function Status({ status }: { status: string }) {
  if (status === "COMPLETED") return <AdminStatusPill tone="good">Tamamlandı</AdminStatusPill>;
  if (status === "FAILED") return <AdminStatusPill tone="bad">Hatalı</AdminStatusPill>;
  if (status === "PROCESSING") return <AdminStatusPill tone="warn">İşleniyor</AdminStatusPill>;
  if (status === "QUEUED") return <AdminStatusPill tone="warn">Sırada</AdminStatusPill>;
  return <AdminStatusPill>{status}</AdminStatusPill>;
}

function createPagination(page: number, pageSize: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    from: total === 0 ? 0 : (page - 1) * pageSize + 1,
    to: Math.min(total, page * pageSize)
  };
}
