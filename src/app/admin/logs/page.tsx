import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminLogsData } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
  await requireAdmin();
  const logs = await getAdminLogsData();

  return (
    <AppShell area="admin" title="Audit kayıtları" description="Önemli admin aksiyonları ve sistem değişiklikleri.">
      <AdminSection title="Admin audit trail" description="Kredi ve tool değişiklikleri burada kayıt altında tutulur.">
        <AdminTable>
          <table className="min-w-[820px] w-full divide-y divide-white/10 text-sm">
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
                  <td className="px-4 py-3 font-bold text-white">{log.adminUser?.email || "system"}</td>
                  <td className="px-4 py-3 text-cyan">{log.action}</td>
                  <td className="px-4 py-3 text-slate-300">{log.entityType} {log.entityId ? `/${log.entityId.slice(0, 8)}` : ""}</td>
                  <td className="px-4 py-3 text-slate-400">{formatAdminDate(log.createdAt)}</td>
                </tr>
              ))}
              {logs.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Henüz audit kaydı yok.</td></tr> : null}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>
    </AppShell>
  );
}
