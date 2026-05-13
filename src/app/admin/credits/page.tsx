import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminSection, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminCreditsData } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminCreditsPage() {
  await requireAdmin();
  const data = await getAdminCreditsData();

  return (
    <AppShell
      area="admin"
      title="Kredi ekonomisi"
      description="Kredi hareketleri, manuel düzenlemeler, kullanım ve iade kayıtları."
    >
      <div className="grid gap-4 md:grid-cols-4">
        {data.totals.map((total) => (
          <AdminMetricCard
            key={total.type}
            label={total.type}
            value={total._sum.amount ?? 0}
            note={`${total._count._all} transaction`}
          />
        ))}
      </div>

      <div className="mt-5">
        <AdminSection
          title="Son kredi hareketleri"
          description="Admin ayarları, paid clean export kesintileri, refund ve purchase kayıtları burada görünür."
        >
          <AdminTable>
            <table className="min-w-[900px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Kullanıcı</th>
                  <th className="px-4 py-3">Tip</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Bakiye</th>
                  <th className="px-4 py-3">Not</th>
                  <th className="px-4 py-3">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 font-bold text-white">{tx.user.email}</td>
                    <td className="px-4 py-3 text-cyan">{tx.type}</td>
                    <td className={tx.amount >= 0 ? "px-4 py-3 font-black text-emerald-200" : "px-4 py-3 font-black text-rose-200"}>{tx.amount}</td>
                    <td className="px-4 py-3 text-slate-300">{tx.balanceAfter}</td>
                    <td className="px-4 py-3 text-slate-400">{tx.note || tx.aiJob?.tool.name || "-"}</td>
                    <td className="px-4 py-3 text-slate-400">{formatAdminDate(tx.createdAt)}</td>
                  </tr>
                ))}
                {data.transactions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Kredi hareketi yok.</td></tr>
                ) : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>
      </div>
    </AppShell>
  );
}
