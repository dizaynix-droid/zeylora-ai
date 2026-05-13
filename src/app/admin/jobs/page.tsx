import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminJobsData } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage() {
  await requireAdmin();
  const jobs = await getAdminJobsData();

  return (
    <AppShell area="admin" title="AI işlem kayıtları" description="Tüm tool run, provider, hata ve export kayıtlarını izle.">
      <AdminSection title="Recent jobs" description="Silme yok; sorunlu kayıtlar incelenir ve soft-delete politikası korunur.">
        <AdminTable>
          <table className="min-w-[980px] w-full divide-y divide-white/10 text-sm">
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
                  <td className="max-w-xs px-4 py-3 text-slate-400">{job.errorMessage || "-"}</td>
                  <td className="px-4 py-3 text-slate-400">{formatAdminDate(job.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>
    </AppShell>
  );
}

function Status({ status }: { status: string }) {
  if (status === "COMPLETED") return <AdminStatusPill tone="good">COMPLETED</AdminStatusPill>;
  if (status === "FAILED") return <AdminStatusPill tone="bad">FAILED</AdminStatusPill>;
  if (status === "PROCESSING" || status === "PENDING") return <AdminStatusPill tone="warn">{status}</AdminStatusPill>;
  return <AdminStatusPill>{status}</AdminStatusPill>;
}
