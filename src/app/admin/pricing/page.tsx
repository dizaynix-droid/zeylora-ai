import type { InputHTMLAttributes, ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminPricingData } from "@/lib/admin/data";
import {
  createCreditPackageAction,
  deleteCreditPackageAction,
  syncLaunchCreditPackagesAction,
  updateCreditPackageAction
} from "@/lib/admin/actions";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

type AdminPricingSearchParams = {
  saved?: string;
  deleted?: string;
  error?: string;
};

export default async function AdminPricingPage({
  searchParams
}: {
  searchParams?: Promise<AdminPricingSearchParams>;
}) {
  const params = await searchParams;
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
      description="Public fiyat kartları buradaki aktif paketlerden beslenir. Değişiklik sonrası ana sayfa ve /pricing otomatik güncellenir."
    >
      {params?.saved ? <Notice tone="good">Kaydedildi: {decodeURIComponent(params.saved)}</Notice> : null}
      {params?.deleted ? <Notice tone="warn">Paket pasife alındı: {decodeURIComponent(params.deleted)}</Notice> : null}
      {params?.error ? <Notice tone="bad">İşlem tamamlanamadı. Alanları kontrol edip tekrar deneyin.</Notice> : null}

      <AdminSection
        title="Yeni paket ekle"
        description="İkinci, üçüncü ve dördüncü paketlerde bonus kredi kullan. Public alanda sadece ACTIVE paketler sort sırasına göre görünür."
      >
        <form action={createCreditPackageAction} className="grid gap-3 lg:grid-cols-6">
          <AdminInput name="name" placeholder="Paket adı" defaultValue="Yeni Paket" />
          <AdminInput name="baseCredits" type="number" placeholder="Ana kredi" defaultValue="50" />
          <AdminInput name="bonusCredits" type="number" placeholder="Bonus" defaultValue="10" />
          <AdminInput name="price" type="number" step="0.01" placeholder="Fiyat" defaultValue="49" />
          <AdminInput name="sortOrder" type="number" placeholder="Sıra" defaultValue="5" />
          <select
            name="status"
            defaultValue="ACTIVE"
            className="h-11 rounded-xl border border-white/10 bg-[#101525] px-3 text-sm font-bold text-white outline-none focus:border-cyan"
          >
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Pasif</option>
            <option value="SUSPENDED">Askıda</option>
          </select>
          <AdminInput name="badgeText" placeholder="Rozet, örn. Popüler" />
          <AdminInput name="stripePriceId" placeholder="stripe_price_id" />
          <AdminInput name="featureFlagKey" placeholder="pricing_pack_custom" />
          <AdminInput name="audience" placeholder="Hedef kitle" className="lg:col-span-3" />
          <textarea
            name="description"
            placeholder="Public fiyat kartı açıklaması"
            className="min-h-20 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan lg:col-span-5"
          />
          <label className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-slate-200">
            <input name="highlight" type="checkbox" className="size-4 accent-cyan" />
            Öne çıkar
          </label>
          <button className="h-11 rounded-full bg-zeylora-brand text-sm font-black text-white shadow-glow transition hover:brightness-110 lg:col-span-6">
            Yeni paketi ekle
          </button>
        </form>
      </AdminSection>

      <AdminSection
        title="Kredi paketleri"
        description="Ana verification kredisi + bonus toplamı kullanıcıya teslim edilir. Launch paketleri Trial, Starter, Growth ve Business sırasıyla yönetilir."
        action={
          <form action={syncLaunchCreditPackagesAction}>
            <button className="h-10 rounded-full border border-cyan/30 bg-cyan/10 px-4 text-sm font-black text-cyan transition hover:bg-cyan/15">
              Launch paketlerini senkronize et
            </button>
          </form>
        }
      >
        <AdminTable>
          <table className="min-w-[1320px] w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3">Kredi</th>
                <th className="px-4 py-3">Fiyat</th>
                <th className="px-4 py-3">Public copy</th>
                <th className="px-4 py-3">Stripe</th>
                <th className="px-4 py-3">Son güncelleme</th>
                <th className="px-4 py-3">Kontrol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {packages.map((pack) => {
                const baseCredits = Math.max(0, pack.credits);
                const bonusCredits = Math.max(0, "bonusCredits" in pack ? Number(pack.bonusCredits) : 0);
                const totalCredits = baseCredits + bonusCredits;

                return (
                  <tr key={pack.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-black text-white">{pack.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{pack.featureFlagKey || "özellik anahtarı yok"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <PackageStatus status={pack.status} />
                        {pack.highlight ? <AdminStatusPill tone="good">Öne çıkan</AdminStatusPill> : null}
                        {pack.badgeText ? <AdminStatusPill tone="neutral">{pack.badgeText}</AdminStatusPill> : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-2xl font-black text-white">{totalCredits}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {baseCredits} ana{bonusCredits ? ` + ${bonusCredits} hediye` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      ${Number(pack.price).toFixed(2)} {pack.currency.toUpperCase()}
                    </td>
                    <td className="max-w-sm px-4 py-4 text-xs leading-5 text-slate-400">
                      <p className="font-bold text-slate-300">{pack.audience || "Hedef kitle yok"}</p>
                      <p className="mt-1">{pack.description || "Açıklama yok"}</p>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-400">{pack.stripePriceId || "Henüz yok"}</td>
                    <td className="px-4 py-4 text-slate-400">{formatAdminDate(pack.updatedAt)}</td>
                    <td className="px-4 py-4">
                      <form action={updateCreditPackageAction} className="grid gap-2">
                        <input type="hidden" name="packageId" value={pack.id} />
                        <AdminInput name="name" defaultValue={pack.name} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <AdminInput name="baseCredits" type="number" min="1" step="1" defaultValue={baseCredits} placeholder="Ana kredi" />
                          <AdminInput name="bonusCredits" type="number" min="0" step="1" defaultValue={bonusCredits} placeholder="Hediye kredi" />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <AdminInput name="price" type="number" min="1" step="0.01" defaultValue={Number(pack.price)} />
                          <AdminInput name="sortOrder" type="number" step="1" defaultValue={pack.sortOrder} />
                        </div>
                        <AdminInput name="badgeText" defaultValue={pack.badgeText || ""} placeholder="Popüler / En avantajlı" />
                        <AdminInput name="stripePriceId" defaultValue={pack.stripePriceId || ""} placeholder="stripe_price_id" />
                        <AdminInput name="featureFlagKey" defaultValue={pack.featureFlagKey || ""} placeholder="pricing_pack_creator" />
                        <AdminInput name="audience" defaultValue={pack.audience || ""} placeholder="Hedef kitle" />
                        <textarea
                          name="description"
                          defaultValue={pack.description || ""}
                          placeholder="Public kart açıklaması"
                          className="min-h-20 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan"
                        />
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                          <select
                            name="status"
                            defaultValue={pack.status}
                            className="h-10 rounded-xl border border-white/10 bg-[#101525] px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                          >
                            <option value="ACTIVE">Aktif</option>
                            <option value="INACTIVE">Pasif</option>
                            <option value="SUSPENDED">Askıda</option>
                          </select>
                          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-slate-200">
                            <input name="highlight" type="checkbox" defaultChecked={Boolean(pack.highlight)} className="size-4 accent-cyan" />
                            Öne çıkar
                          </label>
                        </div>
                        <button className="h-10 rounded-full bg-zeylora-brand text-sm font-black text-white shadow-glow transition hover:brightness-110">
                          Kaydet
                        </button>
                      </form>
                      <form action={deleteCreditPackageAction} className="mt-2">
                        <input type="hidden" name="packageId" value={pack.id} />
                        <button className="h-9 w-full rounded-full border border-rose-400/30 bg-rose-400/10 text-xs font-black text-rose-200 transition hover:bg-rose-400/15">
                          Paketi pasife al / sil
                        </button>
                      </form>
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
  if (status === "ACTIVE") return <AdminStatusPill tone="good">Aktif</AdminStatusPill>;
  if (status === "SUSPENDED") return <AdminStatusPill tone="warn">Askıda</AdminStatusPill>;
  return <AdminStatusPill tone="bad">Pasif</AdminStatusPill>;
}

function AdminInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan ${className}`}
    />
  );
}

function Notice({ tone, children }: { tone: "good" | "bad" | "warn"; children: ReactNode }) {
  const styles = {
    good: "border-emerald/30 bg-emerald/10 text-emerald",
    bad: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    warn: "border-amber/30 bg-amber/10 text-amber"
  };

  return (
    <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-black ${styles[tone]}`}>
      {children}
    </div>
  );
}
