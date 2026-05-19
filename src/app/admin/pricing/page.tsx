import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill, formatAdminDate } from "@/components/admin/admin-ui";
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
      title="Paket yönetimi"
      description="Müşteriye satılan şey kredi değil doğrulama hakkıdır: 1 email = 1 doğrulama hakkı. Public fiyatlandırma aktif paketlerden beslenir."
    >
      {params?.saved ? <Notice tone="good">Kaydedildi: {decodeURIComponent(params.saved)}</Notice> : null}
      {params?.deleted ? <Notice tone="warn">Paket pasife alındı: {decodeURIComponent(params.deleted)}</Notice> : null}
      {params?.error ? <Notice tone="bad">İşlem tamamlanamadı. Alanları kontrol edip tekrar deneyin.</Notice> : null}

      <AdminSection
        title="Hızlı paket ekle"
        description="Paket adı, doğrulama adedi, fiyat, rozet ve açıklamayı gir. Stripe price ID boşsa checkout otomatik price_data fallback kullanır."
        action={
          <form action={syncLaunchCreditPackagesAction}>
            <button className="h-10 rounded-md border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
              Final paketleri senkronize et
            </button>
          </form>
        }
      >
        <form action={createCreditPackageAction} className="grid gap-3 lg:grid-cols-12">
          <AdminInput className="lg:col-span-2" name="name" placeholder="Starter" />
          <AdminInput className="lg:col-span-2" name="baseCredits" type="number" min="1" step="1" placeholder="1000 doğrulama" />
          <AdminInput className="lg:col-span-1" name="bonusCredits" type="number" min="0" step="1" placeholder="Bonus" defaultValue="0" />
          <AdminInput className="lg:col-span-1" name="price" type="number" min="1" step="0.01" placeholder="9" />
          <AdminInput className="lg:col-span-1" name="sortOrder" type="number" step="1" placeholder="1" />
          <AdminInput className="lg:col-span-2" name="badgeText" placeholder="Most Popular" />
          <select name="status" defaultValue="ACTIVE" className={`${inputClass} lg:col-span-1`}>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Pasif</option>
            <option value="SUSPENDED">Askıda</option>
          </select>
          <label className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 lg:col-span-2">
            <input name="highlight" type="checkbox" className="size-4 accent-blue-600" />
            Öne çıkar
          </label>
          <AdminInput className="lg:col-span-3" name="audience" placeholder="Kimler için? Örn. küçük kampanyalar" />
          <AdminInput className="lg:col-span-3" name="stripePriceId" placeholder="stripe_price_id opsiyonel" />
          <AdminInput className="lg:col-span-3" name="featureFlagKey" placeholder="pricing_pack_custom" />
          <AdminTextarea className="lg:col-span-3" name="description" placeholder="Public kart açıklaması" />
          <button className="h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 lg:col-span-12">
            Paketi ekle
          </button>
        </form>
      </AdminSection>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {packages.map((pack) => {
          const baseCredits = Math.max(0, pack.credits);
          const bonusCredits = Math.max(0, Number(pack.bonusCredits || 0));
          const totalCredits = baseCredits + bonusCredits;

          return (
            <AdminSection
              key={pack.id}
              title={pack.name}
              description={`${totalCredits.toLocaleString()} doğrulama hakkı · $${Number(pack.price).toFixed(2)} ${pack.currency.toUpperCase()} · Son güncelleme ${formatAdminDate(pack.updatedAt)}`}
              action={
                <div className="flex flex-wrap gap-2">
                  <PackageStatus status={pack.status} />
                  {pack.highlight ? <AdminStatusPill tone="good">Öne çıkan</AdminStatusPill> : null}
                  {pack.badgeText ? <AdminStatusPill tone="neutral">{pack.badgeText}</AdminStatusPill> : null}
                </div>
              }
            >
              <form action={updateCreditPackageAction} className="grid gap-3 md:grid-cols-12">
                <input type="hidden" name="packageId" value={pack.id} />
                <AdminInput className="md:col-span-4" name="name" defaultValue={pack.name} placeholder="Paket adı" />
                <AdminInput className="md:col-span-2" name="baseCredits" type="number" min="1" step="1" defaultValue={baseCredits} placeholder="Doğrulama" />
                <AdminInput className="md:col-span-2" name="bonusCredits" type="number" min="0" step="1" defaultValue={bonusCredits} placeholder="Bonus" />
                <AdminInput className="md:col-span-2" name="price" type="number" min="1" step="0.01" defaultValue={Number(pack.price)} placeholder="Fiyat" />
                <AdminInput className="md:col-span-2" name="sortOrder" type="number" step="1" defaultValue={pack.sortOrder} placeholder="Sıra" />
                <AdminInput className="md:col-span-4" name="audience" defaultValue={pack.audience || ""} placeholder="Hedef kitle" />
                <AdminInput className="md:col-span-3" name="badgeText" defaultValue={pack.badgeText || ""} placeholder="Rozet" />
                <AdminInput className="md:col-span-3" name="stripePriceId" defaultValue={pack.stripePriceId || ""} placeholder="Stripe price ID" />
                <AdminInput className="md:col-span-2" name="featureFlagKey" defaultValue={pack.featureFlagKey || ""} placeholder="Key" />
                <AdminTextarea className="md:col-span-8" name="description" defaultValue={pack.description || ""} placeholder="Açıklama" />
                <select name="status" defaultValue={pack.status} className={`${inputClass} md:col-span-2`}>
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Pasif</option>
                  <option value="SUSPENDED">Askıda</option>
                </select>
                <label className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 md:col-span-2">
                  <input name="highlight" type="checkbox" defaultChecked={Boolean(pack.highlight)} className="size-4 accent-blue-600" />
                  Öne çıkar
                </label>
                <button className="h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 md:col-span-8">
                  Kaydet
                </button>
              </form>
              <form action={deleteCreditPackageAction} className="mt-3">
                <input type="hidden" name="packageId" value={pack.id} />
                <button className="h-10 w-full rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100">
                  Paketi pasife al / sil
                </button>
              </form>
            </AdminSection>
          );
        })}
      </div>
    </AppShell>
  );
}

function PackageStatus({ status }: { status: string }) {
  if (status === "ACTIVE") return <AdminStatusPill tone="good">Aktif</AdminStatusPill>;
  if (status === "SUSPENDED") return <AdminStatusPill tone="warn">Askıda</AdminStatusPill>;
  return <AdminStatusPill tone="bad">Pasif</AdminStatusPill>;
}

function AdminInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}

function AdminTextarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} min-h-10 py-2 ${className}`} />;
}

function Notice({ tone, children }: { tone: "good" | "bad" | "warn"; children: ReactNode }) {
  const styles = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    bad: "border-rose-200 bg-rose-50 text-rose-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700"
  };

  return <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-semibold ${styles[tone]}`}>{children}</div>;
}

const inputClass = "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500";
