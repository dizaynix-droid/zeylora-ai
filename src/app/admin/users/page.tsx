import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminUsersData } from "@/lib/admin/data";
import { adjustUserCreditsAction } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await getAdminUsersData();

  return (
    <AppShell
      area="admin"
      title="Kullanıcı yönetimi"
      description="Kullanıcıları, kredi bakiyelerini ve son işlem özetlerini güvenli şekilde takip et."
    >
      <AdminSection
        title="Kullanıcılar"
        description="Manuel kredi ekleme/çıkarma işlemleri audit log ve credit transaction olarak kaydedilir."
      >
        <AdminTable>
          <table className="min-w-[1280px] w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Kredi</th>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Kayıt</th>
                <th className="px-4 py-3">Kredi düzenle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {users.map((user) => (
                <tr key={user.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-black text-white">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.name || "İsim yok"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {user.jobs.map((job) => (
                        <span key={job.id} className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                          {job.tool.name}: {job.status}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <AdminStatusPill tone={user.role === "ADMIN" ? "good" : "neutral"}>{user.role}</AdminStatusPill>
                    <p className="mt-2 text-xs text-slate-500">{user.status}</p>
                  </td>
                  <td className="px-4 py-4 text-2xl font-black text-white">{user.creditBalance}</td>
                  <td className="px-4 py-4 text-slate-300">
                    <p>{user._count.jobs} job</p>
                    <p className="text-xs text-slate-500">{user._count.creditTransactions} credit tx</p>
                  </td>
                  <td className="px-4 py-4 text-slate-400">{formatAdminDate(user.createdAt)}</td>
                  <td className="px-4 py-4">
                    <form action={adjustUserCreditsAction} className="grid gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <input
                        name="amount"
                        type="number"
                        step="1"
                        placeholder="+10 / -5"
                        className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                      />
                      <input
                        name="note"
                        placeholder="Not"
                        className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-cyan"
                      />
                      <button className="h-10 rounded-full bg-zeylora-brand text-sm font-black text-white shadow-glow transition hover:brightness-110">
                        Uygula
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>
    </AppShell>
  );
}
