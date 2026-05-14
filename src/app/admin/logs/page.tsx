import { AppShell } from "@/components/layout/app-shell";
import { AdminPaginationControls, AdminSection, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminLogsData, normalizeAdminPage } from "@/lib/admin/data";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const params = await searchParams;
  const page = normalizeAdminPage(params?.page);
  const dataStartedAt = adminPerfNow();
  const data = await getAdminLogsData({ page });
  const logs = data.items;
  logAdminPerf("page./admin/logs", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    page,
    resultCount: logs.length
  });

  return (
    <AppShell area="admin" title="Audit kayıtları" description="Önemli admin aksiyonları ve sistem değişiklikleri.">
      <AdminSection title="Admin işlem geçmişi" description="Kredi ve araç değişiklikleri burada kayıt altında tutulur.">
        <div className="mb-3">
          <AdminPaginationControls basePath="/admin/logs" pagination={data.pagination} />
        </div>
        <AdminTable>
          <table className="min-w-[1040px] w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Aksiyon</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 font-bold text-white">{log.adminUser?.email || "sistem"}</td>
                  <td className="px-4 py-3 text-cyan">{log.action}</td>
                  <td className="px-4 py-3 text-slate-300">{log.entityType} {log.entityId ? `/${log.entityId.slice(0, 8)}` : ""}</td>
                  <td className="px-4 py-3 text-slate-400">{formatAdminDate(log.createdAt)}</td>
                </tr>
              ))}
              {logs.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Henüz audit kaydı yok.</td></tr> : null}
            </tbody>
          </table>
        </AdminTable>
        <div className="mt-3">
          <AdminPaginationControls basePath="/admin/logs" pagination={data.pagination} />
        </div>
      </AdminSection>
    </AppShell>
  );
}
