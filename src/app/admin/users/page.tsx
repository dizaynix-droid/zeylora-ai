import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminUsersData } from "@/lib/admin/data";
import { adjustUserCreditsAction } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; filter?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const filter = params?.filter === "with-credits" || params?.filter === "with-jobs" || params?.filter === "recent"
    ? params.filter
    : "all";
  const query = params?.q || "";
  const users = await getAdminUsersData({ query, filter });

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
        <form className="mb-4 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 md:flex-row md:items-center">
          <input
            name="q"
            defaultValue={query}
            placeholder="Email veya isim ara"
            className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#080d1f] px-3 text-sm text-white outline-none focus:border-cyan"
          />
          <select
            name="filter"
            defaultValue={filter}
            className="h-10 rounded-xl border border-white/10 bg-[#080d1f] px-3 text-sm font-bold text-white outline-none focus:border-cyan"
          >
            <option value="all">All users</option>
            <option value="with-credits">With credits</option>
            <option value="with-jobs">With jobs</option>
            <option value="recent">Recent signups</option>
          </select>
          <button className="h-10 rounded-full bg-cyan px-5 text-sm font-black text-ink transition hover:bg-cyan/90">
            Filter
          </button>
        </form>
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
                  <td className="px-4 py-3">
                    <p className="font-black text-white">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.name || "İsim yok"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusPill tone={user.role === "ADMIN" ? "good" : "neutral"}>{user.role}</AdminStatusPill>
                    <p className="mt-2 text-xs text-slate-500">{user.status}</p>
                  </td>
                  <td className="px-4 py-3 text-2xl font-black text-white">{user.creditBalance}</td>
                  <td className="px-4 py-3 text-slate-300">
                    <p>{user._count.jobs} job</p>
                    <p className="text-xs text-slate-500">{user._count.creditTransactions} credit tx</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatAdminDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <form action={adjustUserCreditsAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      {[10, 25, 50, -10].map((amount) => (
                        <button
                          key={amount}
                          name="amount"
                          value={amount}
                          className="h-8 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-black text-white transition hover:bg-white/10"
                        >
                          {amount > 0 ? `+${amount}` : amount}
                        </button>
                      ))}
                      <input
                        name="amount"
                        type="number"
                        step="1"
                        placeholder="+10 / -5"
                        className="h-9 w-24 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                      />
                      <input
                        name="note"
                        placeholder="Not optional"
                        className="h-9 w-40 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-cyan"
                      />
                      <button className="h-9 rounded-full bg-zeylora-brand px-4 text-xs font-black text-white shadow-glow transition hover:brightness-110">
                        Uygula
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Filtreye uygun kullanıcı yok.</td></tr>
              ) : null}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>
    </AppShell>
  );
}
