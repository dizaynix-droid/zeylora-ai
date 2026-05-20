import type { InputHTMLAttributes, ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill, formatAdminDate } from "@/components/admin/admin-ui";
import { deactivateProviderSettingAction, upsertProviderSettingAction } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminProviderMonitoringData } from "@/lib/admin/data";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

type ProviderSearchParams = {
  saved?: string;
  deleted?: string;
  error?: string;
};

export default async function AdminProvidersPage({
  searchParams
}: {
  searchParams?: Promise<ProviderSearchParams>;
}) {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const params = await searchParams;
  const dataStartedAt = adminPerfNow();
  const providers = await getSafeProviders();

  logAdminPerf("page./admin/providers [admin-perf]", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    resultCount: providers.length
  });

  return (
    <AppShell
      area="admin"
      title="Provider yönetimi"
      description="Email verification sağlayıcılarını yönet. 1 müşteri doğrulaması = 1 provider email doğrulaması mantığıyla maliyet ve kapasite takip edilir."
    >
      {params?.saved ? <Notice tone="good">Provider kaydedildi: {decodeURIComponent(params.saved)}</Notice> : null}
      {params?.deleted ? <Notice tone="warn">Provider pasife alındı: {decodeURIComponent(params.deleted)}</Notice> : null}
      {params?.error ? <Notice tone="bad">Provider kaydedilemedi. Zorunlu alanları kontrol edin.</Notice> : null}

      <AdminSection
        title="Yeni provider ekle"
        description="MillionVerifier veya alternatif email doğrulama sağlayıcısını ekle. API key gösterilmez; kaydedilirse sadece bağlantı durumu takip edilir."
      >
        <form action={upsertProviderSettingAction} className="grid gap-3 lg:grid-cols-12">
          <AdminInput className="lg:col-span-2" name="name" placeholder="MillionVerifier" />
          <AdminInput className="lg:col-span-2" name="providerKey" placeholder="millionverifier" />
          <AdminInput className="lg:col-span-2" name="apiBaseUrl" placeholder="API URL" />
          <AdminInput className="lg:col-span-2" name="apiKey" type="password" placeholder="API key" />
          <AdminInput className="lg:col-span-2" name="envKeyName" placeholder="ENV key opsiyonel" />
          <select name="status" defaultValue="ACTIVE" className={`${inputClass} lg:col-span-2`}>
            <option value="ACTIVE">Aktif</option>
            <option value="PAUSED">Duraklatıldı</option>
            <option value="DISABLED">Devre dışı</option>
          </select>
          <input type="hidden" name="providerType" value="email-verification" />
          <AdminInput className="lg:col-span-2" name="estimatedCostPerRun" type="number" min="0" step="0.000001" placeholder="Email başı maliyet" />
          <AdminInput className="lg:col-span-1" name="estimatedCostCurrency" defaultValue="usd" />
          <AdminInput className="lg:col-span-2" name="dailyBudgetLimit" type="number" min="0" step="0.01" placeholder="Günlük bütçe" />
          <AdminInput className="lg:col-span-2" name="monthlyBudgetLimit" type="number" min="0" step="0.01" placeholder="Aylık bütçe" />
          <AdminInput className="lg:col-span-1" name="priority" type="number" step="1" defaultValue="10" placeholder="Öncelik" />
          <select name="budgetEnforcementMode" defaultValue="NOTIFY_ONLY" className={`${inputClass} lg:col-span-2`}>
            <option value="NOTIFY_ONLY">Sadece bildir</option>
            <option value="PAUSE_PROVIDER">Provider duraklat</option>
            <option value="BLOCK_JOBS">İşleri engelle</option>
          </select>
          <AdminInput className="lg:col-span-2" name="notes" placeholder="Not" />
          <button className="h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 lg:col-span-12">
            Provider ekle
          </button>
        </form>
      </AdminSection>

      <div className="mt-5 grid gap-4">
        {providers.map((provider) => (
          <AdminSection
            key={provider.providerKey}
            title={provider.name}
            description={`${provider.providerKey} · Bugün ${provider.jobsToday.toLocaleString()} iş · ${provider.completedToday.toLocaleString()} tamamlandı · ${provider.failedToday.toLocaleString()} hata`}
            action={
              <div className="flex flex-wrap gap-2">
                <EnvStatus configured={provider.configured} stored={provider.apiKeyStored} />
                <ProviderStatus status={provider.status} />
                <Health status={provider.health} />
              </div>
            }
          >
            <form action={upsertProviderSettingAction} className="grid gap-3 lg:grid-cols-12">
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="providerType" value="email-verification" />
              <AdminInput className="lg:col-span-2" name="name" defaultValue={provider.name} placeholder="Ad" />
              <AdminInput className="lg:col-span-2" name="providerKey" defaultValue={provider.providerKey} placeholder="slug" />
              <AdminInput className="lg:col-span-2" name="apiBaseUrl" defaultValue={provider.apiBaseUrl || ""} placeholder="API URL" />
              <AdminInput className="lg:col-span-2" name="apiKey" type="password" placeholder={provider.apiKeyStored ? "Yeni key girersen değişir" : "API key"} />
              <AdminInput className="lg:col-span-2" name="envKeyName" defaultValue={provider.envKeyName || ""} placeholder="ENV key" />
              <select name="status" defaultValue={recordStatusToForm(provider.status)} className={`${inputClass} lg:col-span-2`}>
                <option value="ACTIVE">Aktif</option>
                <option value="PAUSED">Duraklatıldı</option>
                <option value="DISABLED">Devre dışı</option>
              </select>
              <AdminInput className="lg:col-span-2" name="estimatedCostPerRun" type="number" min="0" step="0.000001" defaultValue={toInputNumber(provider.estimatedCostPerRun)} placeholder="Email başı maliyet" />
              <AdminInput className="lg:col-span-1" name="estimatedCostCurrency" defaultValue={provider.estimatedCostCurrency || "usd"} />
              <AdminInput className="lg:col-span-2" name="dailyBudgetLimit" type="number" min="0" step="0.01" defaultValue={toInputNumber(provider.dailyBudgetLimit)} placeholder="Günlük bütçe" />
              <AdminInput className="lg:col-span-2" name="monthlyBudgetLimit" type="number" min="0" step="0.01" defaultValue={toInputNumber(provider.monthlyBudgetLimit)} placeholder="Aylık bütçe" />
              <AdminInput className="lg:col-span-1" name="priority" type="number" step="1" defaultValue={provider.priority} placeholder="Öncelik" />
              <select name="budgetEnforcementMode" defaultValue={provider.budgetEnforcementMode} className={`${inputClass} lg:col-span-2`}>
                <option value="NOTIFY_ONLY">Sadece bildir</option>
                <option value="PAUSE_PROVIDER">Provider duraklat</option>
                <option value="BLOCK_JOBS">İşleri engelle</option>
              </select>
              <AdminInput className="lg:col-span-2" name="notes" defaultValue={provider.notes || ""} placeholder="Not" />
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 lg:col-span-8">
                Email başı maliyet boş bırakılırsa MillionVerifier için sistem otomatik varsayılan maliyeti kullanır. Sadece gerçek satın alma maliyetin farklıysa buradan override et.
              </div>
              <button className="h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 lg:col-span-4">
                Kaydet
              </button>
            </form>
            {provider.id ? (
              <form action={deactivateProviderSettingAction} className="mt-3">
                <input type="hidden" name="providerId" value={provider.id} />
                <button className="h-10 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100">
                  Providerı pasife al
                </button>
              </form>
            ) : null}
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
              <Info label="Bugünkü tahmini maliyet" value={formatMoney(provider.estimatedCostToday)} />
              <Info label="Failure rate" value={`${(provider.failureRate * 100).toFixed(1)}%`} />
              <Info label="Email başı maliyet" value={formatMoney(provider.estimatedCostPerRun, provider.estimatedCostCurrency)} />
              <Info label="Son güncelleme" value={provider.updatedAt ? formatAdminDate(provider.updatedAt) : "DB kaydı yok"} />
            </div>
          </AdminSection>
        ))}
      </div>
    </AppShell>
  );
}

async function getSafeProviders() {
  try {
    return await getAdminProviderMonitoringData();
  } catch (error) {
    console.error("[admin-page-failed]", {
      page: "/admin/providers",
      widget: "providers.list",
      error: error instanceof Error ? error.message : "Unknown provider error"
    });
    return [];
  }
}

function AdminInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}

function Notice({ tone, children }: { tone: "good" | "bad" | "warn"; children: ReactNode }) {
  const styles = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    bad: "border-rose-200 bg-rose-50 text-rose-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700"
  };
  return <div className={`mb-4 rounded-lg border px-4 py-3 text-sm font-semibold ${styles[tone]}`}>{children}</div>;
}

function EnvStatus({ configured, stored }: { configured: boolean; stored?: boolean }) {
  return <AdminStatusPill tone={configured ? "good" : "warn"}>{configured ? (stored ? "Key kayıtlı" : "ENV hazır") : "Key eksik"}</AdminStatusPill>;
}

function ProviderStatus({ status }: { status: string }) {
  if (status === "ACTIVE") return <AdminStatusPill tone="good">Aktif</AdminStatusPill>;
  if (status === "SUSPENDED") return <AdminStatusPill tone="warn">Duraklatıldı</AdminStatusPill>;
  return <AdminStatusPill tone="bad">Devre dışı</AdminStatusPill>;
}

function Health({ status }: { status: string }) {
  if (status === "HEALTHY") return <AdminStatusPill tone="good">Sağlıklı</AdminStatusPill>;
  if (status === "DEGRADED") return <AdminStatusPill tone="warn">Dikkat</AdminStatusPill>;
  return <AdminStatusPill tone="bad">Kapalı</AdminStatusPill>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function recordStatusToForm(status: string) {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "SUSPENDED") return "PAUSED";
  return "DISABLED";
}

function toInputNumber(value: unknown) {
  const amount = Number(value?.toString?.() || value || 0);
  return amount ? String(amount) : "";
}

function formatMoney(value: unknown, currency = "usd") {
  const amount = Number(value?.toString?.() || value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 6
  }).format(amount);
}

const inputClass = "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500";
