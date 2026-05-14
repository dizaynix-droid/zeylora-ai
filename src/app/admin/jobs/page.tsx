import { AppShell } from "@/components/layout/app-shell";
import { AdminPaginationControls, AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminJobsData, normalizeAdminPage } from "@/lib/admin/data";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage({
  searchParams
}: {
  searchParams?: Promise<{ status?: string; tool?: string; user?: string; page?: string }>;
}) {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const params = await searchParams;
  const status = params?.status === "completed" || params?.status === "failed" ? params.status : "all";
  const page = normalizeAdminPage(params?.page);
  const dataStartedAt = adminPerfNow();
  const data = await getAdminJobsData({ status, tool: params?.tool, user: params?.user, page });
  const jobs = data.items;
  logAdminPerf("page./admin/jobs", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    page,
    status,
    hasTool: Boolean(params?.tool),
    hasUser: Boolean(params?.user),
    resultCount: jobs.length
  });

  return (
    <AppShell area="admin" title="AI işlem kayıtları" description="Tüm tool run, provider, hata ve export kayıtlarını izle.">
      <AdminSection title="Son işlemler" description="Silme yok; sorunlu kayıtlar incelenir ve soft-delete politikası korunur.">
        <form className="mb-4 grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 md:grid-cols-[180px_220px_1fr_auto]">
          <select name="status" defaultValue={status} className="h-10 rounded-xl border border-white/10 bg-[#080d1f] px-3 text-sm font-bold text-white outline-none focus:border-cyan">
            <option value="all">Tüm durumlar</option>
            <option value="completed">Tamamlandı</option>
            <option value="failed">Hatalı</option>
          </select>
          <input name="tool" defaultValue={params?.tool || ""} placeholder="Araç slug" className="h-10 rounded-xl border border-white/10 bg-[#080d1f] px-3 text-sm text-white outline-none focus:border-cyan" />
          <input name="user" defaultValue={params?.user || ""} placeholder="Kullanıcı email" className="h-10 rounded-xl border border-white/10 bg-[#080d1f] px-3 text-sm text-white outline-none focus:border-cyan" />
          <button className="h-10 rounded-full bg-cyan px-5 text-sm font-black text-ink transition hover:bg-cyan/90">Filtrele</button>
        </form>
        <div className="mb-3">
          <AdminPaginationControls
            basePath="/admin/jobs"
            params={{ status, tool: params?.tool, user: params?.user }}
            pagination={data.pagination}
          />
        </div>
        <AdminTable>
          <table className="min-w-[1280px] w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Araç</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Kullanıcı</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Süre</th>
                <th className="px-4 py-3">Hata</th>
                <th className="px-4 py-3">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-3 font-black text-white">{job.tool.name}</td>
                  <td className="px-4 py-3"><Status status={job.status} /></td>
                  <td className="px-4 py-3 text-slate-300">{job.user?.email || "-"}</td>
                  <td className="px-4 py-3 text-slate-300">{job.providerKey}</td>
                  <td className="px-4 py-3 text-slate-300">{job.processingTimeMs ? `${job.processingTimeMs}ms` : "-"}</td>
                  <td className="max-w-sm px-4 py-3 text-slate-400">
                    {job.errorMessage ? (
                      <details>
                        <summary className="cursor-pointer truncate text-rose-200">{job.errorMessage.slice(0, 72)}</summary>
                        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs text-slate-300">{job.errorMessage}</pre>
                      </details>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatAdminDate(job.createdAt)}</td>
                </tr>
              ))}
              {jobs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Bu filtreyle job bulunamadı.</td></tr>
              ) : null}
            </tbody>
          </table>
        </AdminTable>
        <div className="mt-3">
          <AdminPaginationControls
            basePath="/admin/jobs"
            params={{ status, tool: params?.tool, user: params?.user }}
            pagination={data.pagination}
          />
        </div>
      </AdminSection>
    </AppShell>
  );
}

function Status({ status }: { status: string }) {
  if (status === "COMPLETED") return <AdminStatusPill tone="good">Tamamlandı</AdminStatusPill>;
  if (status === "FAILED") return <AdminStatusPill tone="bad">Hatalı</AdminStatusPill>;
  if (status === "PROCESSING") return <AdminStatusPill tone="warn">İşleniyor</AdminStatusPill>;
  if (status === "PENDING") return <AdminStatusPill tone="warn">Bekliyor</AdminStatusPill>;
  return <AdminStatusPill>{status}</AdminStatusPill>;
}
