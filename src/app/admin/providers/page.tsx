import type { InputHTMLAttributes } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { upsertProviderSettingAction } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminProviderMonitoringData } from "@/lib/admin/data";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";

export const dynamic = "force-dynamic";

type ProviderSearchParams = {
  saved?: string;
  error?: string;
};

const providerTypes = ["replicate", "photoroom", "removebg", "local-sharp", "other"] as const;

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
  const providers = await getAdminProviderMonitoringData();

  logAdminPerf("page./admin/providers", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    resultCount: providers.length
  });

  return (
    <AppShell area="admin" title="Sağlayıcı yönetimi" description="Provider durumları, env kontrolü, bütçe ve tahmini maliyet ayarları.">
      {params?.saved ? (
        <div className="mb-4 rounded-2xl border border-emerald/30 bg-emerald/10 px-4 py-3 text-sm font-black text-emerald">
          Sağlayıcı kaydedildi: {decodeURIComponent(params.saved)}
        </div>
      ) : null}
      {params?.error ? (
        <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-black text-rose-200">
          Sağlayıcı kaydedilemedi. Zorunlu alanları kontrol edin.
        </div>
      ) : null}

      <div className="mb-4 rounded-2xl border border-cyan/20 bg-cyan/10 px-4 py-3 text-sm font-semibold leading-6 text-cyan">
        API anahtarları Vercel Environment Variables içinde saklanır. Bu sayfa secret değerlerini göstermez veya DB’ye yazmaz; sadece env key adını ve var/yok durumunu kontrol eder.
        Durum alanı şu an operasyon/raporlama içindir; provider yürütme akışını otomatik kapatmaz.
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {providers.map((provider) => (
          <div key={provider.providerKey} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-white">{provider.name}</p>
                <p className="mt-1 text-xs text-slate-500">{provider.providerKey}</p>
              </div>
              <Health status={provider.health} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold text-slate-400">
              <span>Job: <b className="text-white">{provider.jobsToday}</b></span>
              <span>Hata: <b className="text-rose-200">{provider.failedToday}</b></span>
              <span>Maliyet: <b className="text-amber">${provider.estimatedCostToday.toFixed(4)}</b></span>
            </div>
          </div>
        ))}
      </div>

      <AdminSection title="Yeni sağlayıcı ekle" description="Yeni provider veya local işlem motoru için operasyon kaydı oluştur.">
        <form action={upsertProviderSettingAction} className="grid gap-3 lg:grid-cols-6">
          <AdminInput name="name" placeholder="Sağlayıcı adı" defaultValue="New Provider" />
          <AdminInput name="providerKey" placeholder="slug, örn. replicate" defaultValue="new-provider" />
          <select name="providerType" defaultValue="other" className={inputClass}>
            {providerTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <AdminInput name="envKeyName" placeholder="ENV_KEY_NAME" />
          <AdminInput name="priority" type="number" step="1" defaultValue="100" placeholder="Öncelik" />
          <select name="status" defaultValue="DISABLED" className={inputClass}>
            <option value="ACTIVE">Aktif</option>
            <option value="PAUSED">Duraklatıldı</option>
            <option value="DISABLED">Devre dışı</option>
          </select>
          <AdminInput name="estimatedCostPerRun" type="number" min="0" step="0.0001" placeholder="İşlem maliyeti" />
          <AdminInput name="estimatedCostCurrency" defaultValue="usd" placeholder="usd" />
          <AdminInput name="dailyBudgetLimit" type="number" min="0" step="0.01" placeholder="Günlük bütçe" />
          <AdminInput name="monthlyBudgetLimit" type="number" min="0" step="0.01" placeholder="Aylık bütçe" />
          <select name="budgetEnforcementMode" defaultValue="NOTIFY_ONLY" className={inputClass}>
            <option value="NOTIFY_ONLY">Sadece bildir</option>
            <option value="PAUSE_PROVIDER">Provider duraklat</option>
            <option value="PAUSE_TOOLS">Araçları duraklat</option>
            <option value="BLOCK_JOBS">Job engelle</option>
          </select>
          <input name="notes" placeholder="Not" className={`${inputClass} lg:col-span-2`} />
          <button className="h-11 rounded-full bg-zeylora-brand text-sm font-black text-white shadow-glow transition hover:brightness-110 lg:col-span-6">
            Sağlayıcı ekle
          </button>
        </form>
      </AdminSection>

      <div className="mt-4">
        <AdminSection title="Provider operasyon tablosu" description="Öncelik, bütçe, env durumu ve tahmini varsayılan maliyetler.">
          <AdminTable>
            <table className="min-w-[1500px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Sağlayıcı</th>
                  <th className="px-4 py-3">Env durumu</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Bütçe</th>
                  <th className="px-4 py-3">Varsayılan maliyet</th>
                  <th className="px-4 py-3">Son güncelleme</th>
                  <th className="px-4 py-3">Kontrol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {providers.map((provider) => (
                  <tr key={provider.providerKey} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-black text-white">{provider.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{provider.providerKey} • {provider.providerType}</p>
                      <p className="mt-2 text-xs font-bold text-slate-500">{provider.dbBacked ? "DB kaydı var" : "Runtime varsayılanı; kaydetmeden DB’ye yazılmaz"}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{provider.notes || "Not yok"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <EnvStatus configured={provider.configured} />
                      <p className="mt-2 font-mono text-xs text-slate-500">{provider.envKeyName || "local/env gerekmez"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <ProviderStatus status={provider.status} />
                      <p className="mt-2 text-xs text-slate-500">Öncelik: {provider.priority}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      <p>Günlük: {formatMoney(provider.dailyBudgetLimit)}</p>
                      <p>Aylık: {formatMoney(provider.monthlyBudgetLimit)}</p>
                      <p className="text-xs text-slate-500">Kullanım: {formatMoney(provider.monthlyBudgetUsed)}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{budgetModeLabel(provider.budgetEnforcementMode)}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {formatMoney(provider.estimatedCostPerRun, provider.estimatedCostCurrency)}
                      <p className="mt-1 text-xs text-slate-500">Tool maliyeti varsa bunu ezer.</p>
                    </td>
                    <td className="px-4 py-4 text-slate-400">{provider.updatedAt ? formatAdminDate(provider.updatedAt) : "Henüz kaydedilmedi"}</td>
                    <td className="px-4 py-4">
                      <form action={upsertProviderSettingAction} className="grid min-w-[460px] gap-2">
                        <input type="hidden" name="providerId" value={provider.id} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <AdminInput name="name" defaultValue={provider.name} placeholder="Ad" />
                          <AdminInput name="providerKey" defaultValue={provider.providerKey} placeholder="slug" />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <select name="providerType" defaultValue={provider.providerType} className={inputClass}>
                            {providerTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                          </select>
                          <AdminInput name="envKeyName" defaultValue={provider.envKeyName || ""} placeholder="ENV_KEY" />
                          <AdminInput name="priority" type="number" step="1" defaultValue={provider.priority} placeholder="Öncelik" />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <AdminInput name="estimatedCostPerRun" type="number" min="0" step="0.0001" defaultValue={toInputNumber(provider.estimatedCostPerRun)} placeholder="Run maliyeti" />
                          <AdminInput name="estimatedCostCurrency" defaultValue={provider.estimatedCostCurrency || "usd"} placeholder="usd" />
                          <select name="status" defaultValue={recordStatusToForm(provider.status)} className={inputClass}>
                            <option value="ACTIVE">Aktif</option>
                            <option value="PAUSED">Duraklatıldı</option>
                            <option value="DISABLED">Devre dışı</option>
                          </select>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <AdminInput name="dailyBudgetLimit" type="number" min="0" step="0.01" defaultValue={toInputNumber(provider.dailyBudgetLimit)} placeholder="Günlük bütçe" />
                          <AdminInput name="monthlyBudgetLimit" type="number" min="0" step="0.01" defaultValue={toInputNumber(provider.monthlyBudgetLimit)} placeholder="Aylık bütçe" />
                          <select name="budgetEnforcementMode" defaultValue={provider.budgetEnforcementMode} className={inputClass}>
                            <option value="NOTIFY_ONLY">Sadece bildir</option>
                            <option value="PAUSE_PROVIDER">Provider duraklat</option>
                            <option value="PAUSE_TOOLS">Araçları duraklat</option>
                            <option value="BLOCK_JOBS">Job engelle</option>
                          </select>
                        </div>
                        <input name="notes" defaultValue={provider.notes || ""} placeholder="Not" className={inputClass} />
                        <button className="h-10 rounded-full bg-zeylora-brand text-sm font-black text-white shadow-glow transition hover:brightness-110">
                          Kaydet
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>
      </div>
    </AppShell>
  );
}

function AdminInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}

function EnvStatus({ configured }: { configured: boolean }) {
  return <AdminStatusPill tone={configured ? "good" : "warn"}>{configured ? "Hazır" : "Eksik"}</AdminStatusPill>;
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

function recordStatusToForm(status: string) {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "SUSPENDED") return "PAUSED";
  return "DISABLED";
}

function budgetModeLabel(value: string) {
  if (value === "PAUSE_PROVIDER") return "Provider duraklat";
  if (value === "PAUSE_TOOLS") return "Araçları duraklat";
  if (value === "BLOCK_JOBS") return "Job engelle";
  return "Sadece bildir";
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
    maximumFractionDigits: 4
  }).format(amount);
}

const inputClass = "h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan";
