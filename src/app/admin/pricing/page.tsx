import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { creditPackages } from "@/config/pricing";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminPricingData } from "@/lib/admin/data";
import { syncLaunchCreditPackagesAction, updateCreditPackageAction } from "@/lib/admin/actions";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const dataStartedAt = adminPerfNow();
  const packages = await getAdminPricingData();
  logAdminPerf("page./admin/pricing", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    resultCount: packages.length
  });

  return (
    <AppShell
      area="admin"
      title="Fiyatlama ve kredi paketleri"
      description="Starter, Creator, Pro Seller ve ileride eklenecek özel paketlerin yönetim temeli."
    >
      <AdminSection
        title="Credit packs"
        description="Base + bonus kredi toplamı kullanıcıya teslim edilen kredidir. Creator, Pro Seller ve Business paketlerinde launch bonus kredileri hazır."
        action={
          <form action={syncLaunchCreditPackagesAction}>
            <button className="h-10 rounded-full border border-cyan/30 bg-cyan/10 px-4 text-sm font-black text-cyan transition hover:bg-cyan/15">
              Sync launch packages
            </button>
          </form>
        }
      >
        <AdminTable>
          <table className="min-w-[1180px] w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3">Kredi</th>
                <th className="px-4 py-3">Fiyat</th>
                <th className="px-4 py-3">Stripe</th>
                <th className="px-4 py-3">Son güncelleme</th>
                <th className="px-4 py-3">Kontrol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {packages.map((pack) => {
                const isDbRecord = !["starter", "creator", "pro-seller", "business"].includes(pack.id);
                const fallback = creditPackages.find((item) => item.name === pack.name || item.featureFlagKey === pack.featureFlagKey);
                const bonusCredits = fallback ? Math.max(0, Math.min(fallback.bonusCredits, pack.credits)) : 0;
                const baseCredits = Math.max(0, pack.credits - bonusCredits);
                return (
                  <tr key={pack.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-black text-white">{pack.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{pack.featureFlagKey || "feature flag yok"}</p>
                      <div className="mt-2"><PackageStatus status={pack.status} /></div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-2xl font-black text-white">{pack.credits}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {baseCredits} base{bonusCredits ? ` + ${bonusCredits} bonus` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-300">${Number(pack.price).toFixed(2)} {pack.currency.toUpperCase()}</td>
                    <td className="px-4 py-4 text-xs text-slate-400">{pack.stripePriceId || "Henüz yok"}</td>
                    <td className="px-4 py-4 text-slate-400">{formatAdminDate(pack.updatedAt)}</td>
                    <td className="px-4 py-4">
                      {isDbRecord ? (
                        <form action={updateCreditPackageAction} className="grid gap-2">
                          <input type="hidden" name="packageId" value={pack.id} />
                          <input
                            name="name"
                            defaultValue={pack.name}
                            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                          />
                          <input
                            name="baseCredits"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={baseCredits}
                            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                            placeholder="Base credits"
                          />
                          <p className="-mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Base credits</p>
                          <input
                            name="bonusCredits"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={bonusCredits}
                            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                            placeholder="Bonus credits"
                          />
                          <p className="-mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan">Bonus gift credits</p>
                          <input
                            name="price"
                            type="number"
                            min="1"
                            step="0.01"
                            defaultValue={Number(pack.price)}
                            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                          />
                          <input
                            name="sortOrder"
                            type="number"
                            step="1"
                            defaultValue={pack.sortOrder}
                            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                            placeholder="Sort order"
                          />
                          <input
                            name="stripePriceId"
                            defaultValue={pack.stripePriceId || ""}
                            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                            placeholder="stripe_price_id"
                          />
                          <input
                            name="featureFlagKey"
                            defaultValue={pack.featureFlagKey || ""}
                            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                            placeholder="pricing_pack_creator"
                          />
                          <select
                            name="status"
                            defaultValue={pack.status}
                            className="h-10 rounded-xl border border-white/10 bg-[#101525] px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                            <option value="SUSPENDED">SUSPENDED</option>
                          </select>
                          <button className="h-10 rounded-full bg-zeylora-brand text-sm font-black text-white shadow-glow transition hover:brightness-110">
                            Kaydet
                          </button>
                        </form>
                      ) : (
                        <p className="max-w-xs text-sm leading-6 text-slate-400">
                          Bu paket config fallback olarak gösteriliyor. Seed/migration sonrası DB kaydı üzerinden düzenlenebilir.
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>
    </AppShell>
  );
}

function PackageStatus({ status }: { status: string }) {
  if (status === "ACTIVE") return <AdminStatusPill tone="good">ACTIVE</AdminStatusPill>;
  if (status === "SUSPENDED") return <AdminStatusPill tone="warn">SUSPENDED</AdminStatusPill>;
  return <AdminStatusPill tone="bad">{status}</AdminStatusPill>;
}
