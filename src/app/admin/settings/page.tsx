import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { updateMarketingTrackingSettingsAction, updateOperationalSettingsAction } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { getMarketingTrackingSettings } from "@/lib/settings/marketing";
import { getOperationalSettings } from "@/lib/settings/operations";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const [tracking, operations] = await Promise.all([
    getMarketingTrackingSettings({ bypassCache: true }),
    getOperationalSettings({ bypassCache: true })
  ]);

  return (
    <AppShell
      area="admin"
      title="Ayarlar"
      description="Email doğrulama operasyonu, checkout, kayıt, limitler, tracking ve destek bilgilerini buradan yönet."
    >
      {params?.saved ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Kaydedildi: {params.saved === "tracking" ? "pazarlama ve tracking ayarları" : "operasyon ayarları"}.
        </div>
      ) : null}

      <AdminSection
        title="Email doğrulama operasyonu"
        description="Bu ayarlar canlı verification akışını kontrol eder. 1 email = 1 doğrulama hakkı mantığına göre çalışır."
      >
        <form action={updateOperationalSettingsAction} className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <TextSetting label="Marka adı" name="brandName" defaultValue={operations.brandName} placeholder="Zeylora" note="Public site ve email şablonlarında kullanılan marka adı." />
            <TextSetting label="Destek email" name="supportEmail" defaultValue={operations.supportEmail} placeholder="support@zeylora.ai" note="Contact, ticket ve footer destek adresi." />
            <TextSetting label="Fatura email" name="billingEmail" defaultValue={operations.billingEmail} placeholder="billing@zeylora.ai" note="Ödeme ve fatura bildirimleri için operasyon adresi." />
            <TextSetting label="Para birimi" name="defaultCurrency" defaultValue={operations.defaultCurrency} placeholder="USD" note="Paket fiyatlarında varsayılan para birimi." />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ToggleSetting label="Bakım modu" name="maintenanceMode" defaultChecked={operations.maintenanceMode} note="Acil durumda public akışı durdurmak için." />
            <ToggleSetting label="Liste yükleme" name="uploadsEnabled" defaultChecked={operations.uploadsEnabled} note="CSV/TXT ve paste doğrulama girişini aç/kapat." />
            <ToggleSetting label="Doğrulama motoru" name="previewEnabled" defaultChecked={operations.previewEnabled} note="MillionVerifier/provider doğrulama işlerini aç/kapat." />
            <ToggleSetting label="Sonuç export" name="cleanExportsEnabled" defaultChecked={operations.cleanExportsEnabled} note="Valid/invalid/risky CSV indirme erişimi." />
            <ToggleSetting label="Checkout" name="checkoutEnabled" defaultChecked={operations.checkoutEnabled} note="Stripe kredi paketi satın alma akışını aç/kapat." />
            <ToggleSetting label="Yeni kayıt" name="registrationEnabled" defaultChecked={operations.registrationEnabled} note="Yeni kullanıcı kayıtlarını aç/kapat." />
            <ToggleSetting label="Email bildirimleri" name="emailsEnabled" defaultChecked={operations.emailsEnabled} note="Resend transactional email gönderimini aç/kapat." />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <NumberSetting label="Max dosya MB" name="uploadMaxSizeMb" defaultValue={operations.uploadMaxSizeMb} note="Tek CSV/TXT dosyası için üst limit." />
            <NumberSetting label="Misafir/dk" name="guestPreviewPerMinute" defaultValue={operations.guestPreviewPerMinute} note="Login öncesi pre-check limiti." />
            <NumberSetting label="Misafir/saat" name="guestPreviewPerHour" defaultValue={operations.guestPreviewPerHour} note="Login öncesi saatlik pre-check limiti." />
            <NumberSetting label="Kullanıcı iş/dk" name="userJobsPerMinute" defaultValue={operations.userJobsPerMinute} note="Doğrulama job başlatma dakika limiti." />
            <NumberSetting label="Kullanıcı iş/gün" name="userJobsPerDay" defaultValue={operations.userJobsPerDay} note="Doğrulama job başlatma günlük limiti." />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <NumberSetting
              label="1 doğrulama tahmini USD"
              name="estimatedCreditUsdValue"
              defaultValue={operations.estimatedCreditUsdValue}
              step="0.0001"
              note="Raporlarda gelir/kâr tahmini için kullanılır. Provider maliyeti ayrı olarak provider sayfasından girilir."
            />
            <InfoCard title="Büyük liste notu" value="Queue gerekli" note="100K+ listeler request içinde değil, chunk/background worker ile işlenmeli." tone="warn" />
            <InfoCard title="Ekonomi kuralı" value="1 email = 1 hak" note="Müşteri tarafında 1 doğrulama hakkı, provider tarafında 1 email sorgusu demektir." />
          </div>

          <button className="h-11 w-fit rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700">
            Operasyon ayarlarını kaydet
          </button>
        </form>
      </AdminSection>

      <div className="mt-5">
        <AdminSection
          title="Reklam, analytics ve domain doğrulama"
          description="Sadece public tracking ID ve meta doğrulama değerleri saklanır. Secret/API key bu alana girilmemeli."
        >
          <form action={updateMarketingTrackingSettingsAction} className="grid gap-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <TextSetting label="GA4 Measurement ID" name="ga4MeasurementId" defaultValue={tracking.ga4MeasurementId} placeholder="G-XXXXXXXXXX" note="Google Analytics page_view ve funnel event takibi." />
              <TextSetting label="Google Ads Conversion ID" name="googleAdsConversionId" defaultValue={tracking.googleAdsConversionId} placeholder="AW-XXXXXXXXXX" note="Google Ads base tag için." />
              <TextSetting label="Google Ads Conversion Label" name="googleAdsConversionLabel" defaultValue={tracking.googleAdsConversionLabel} placeholder="abc123..." note="Purchase conversion helper için." />
              <TextSetting label="Meta Pixel ID" name="metaPixelId" defaultValue={tracking.metaPixelId} placeholder="1234567890" note="PageView ve checkout eventleri için." />
              <TextSetting label="TikTok Pixel ID" name="tiktokPixelId" defaultValue={tracking.tiktokPixelId} placeholder="CXXXXXXXXXXXX" note="Opsiyonel TikTok pixel." />
              <TextSetting label="Pinterest Tag ID" name="pinterestTagId" defaultValue={tracking.pinterestTagId} placeholder="261xxxxxxxxxx" note="Opsiyonel Pinterest tag." />
              <TextSetting label="Google Search Console" name="googleSearchConsoleVerification" defaultValue={tracking.googleSearchConsoleVerification} placeholder="meta content value" note="google-site-verification content değeri." />
              <TextSetting label="Bing Webmaster" name="bingWebmasterVerification" defaultValue={tracking.bingWebmasterVerification} placeholder="meta content value" note="msvalidate.01 content değeri." />
              <TextSetting label="Facebook domain verification" name="facebookDomainVerification" defaultValue={tracking.facebookDomainVerification} placeholder="meta content value" note="facebook-domain-verification content değeri." />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Özel script alanı</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    Yanlış script siteyi bozabilir. Sadece güvenilir reklam/analytics platformlarından gelen public scriptleri kullan.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <input type="checkbox" name="customScriptsEnabled" defaultChecked={tracking.customScriptsEnabled} className="size-4 accent-blue-600" />
                  Özel scriptleri aktif et
                </label>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                <TextAreaSetting label="Özel head script" name="customHeadScript" defaultValue={tracking.customHeadScript} />
                <TextAreaSetting label="Özel body/footer script" name="customBodyScript" defaultValue={tracking.customBodyScript} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button className="h-11 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700">
                Tracking ayarlarını kaydet
              </button>
              <TrackingStatus label="GA4" configured={Boolean(tracking.ga4MeasurementId)} />
              <TrackingStatus label="Meta" configured={Boolean(tracking.metaPixelId)} />
              <TrackingStatus label="Search Console" configured={Boolean(tracking.googleSearchConsoleVerification)} />
            </div>
          </form>
        </AdminSection>
      </div>

      <div className="mt-5">
        <AdminSection title="Canlı operasyon kontrolü" description="Reklama çıkmadan önce hızlı kontrol listesi.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard title="Provider" value="MillionVerifier" note="API durumu Provider Yönetimi sayfasından kontrol edilir." />
            <InfoCard title="Paket mantığı" value="Doğrulama hakkı" note="Paketlerde kredi yerine doğrulama adedi gösterilir." />
            <InfoCard title="Raporlama" value="Email başı maliyet" note="Provider maliyeti / satın alınan API kotası ile girilmeli." />
            <InfoCard title="Büyük listeler" value="Chunk işlem" note="1M liste için background queue zorunlu; senkron request yeterli değil." tone="warn" />
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}

function TextSetting({
  label,
  name,
  defaultValue,
  placeholder,
  note
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  note: string;
}) {
  return (
    <label className="rounded-lg border border-slate-200 bg-white p-4">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-3 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
      <span className="mt-2 block text-xs leading-5 text-slate-500">{note}</span>
    </label>
  );
}

function TextAreaSetting({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-900">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={6}
        className="mt-2 w-full rounded-md border border-amber-200 bg-white p-3 font-mono text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
        placeholder="<script>...</script>"
      />
    </label>
  );
}

function TrackingStatus({ label, configured }: { label: string; configured: boolean }) {
  return <AdminStatusPill tone={configured ? "good" : "neutral"}>{label}: {configured ? "hazır" : "eksik"}</AdminStatusPill>;
}

function ToggleSetting({
  label,
  name,
  defaultChecked,
  note
}: {
  label: string;
  name: string;
  defaultChecked: boolean;
  note: string;
}) {
  return (
    <label className="rounded-lg border border-slate-200 bg-white p-4">
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
        <input name={name} type="checkbox" defaultChecked={defaultChecked} className="size-4 accent-blue-600" />
      </span>
      <span className="mt-2 block text-xs leading-5 text-slate-500">{note}</span>
    </label>
  );
}

function NumberSetting({
  label,
  name,
  defaultValue,
  step = "1",
  note
}: {
  label: string;
  name: string;
  defaultValue: number;
  step?: string;
  note?: string;
}) {
  return (
    <label className="rounded-lg border border-slate-200 bg-white p-4">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      <input
        name={name}
        type="number"
        min="0"
        step={step}
        defaultValue={defaultValue}
        className="mt-3 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
      {note ? <span className="mt-2 block text-xs leading-5 text-slate-500">{note}</span> : null}
    </label>
  );
}

function InfoCard({
  title,
  value,
  note,
  tone = "neutral"
}: {
  title: string;
  value: string;
  note: string;
  tone?: "neutral" | "warn";
}) {
  return (
    <div className={tone === "warn" ? "rounded-lg border border-amber-200 bg-amber-50 p-4" : "rounded-lg border border-slate-200 bg-slate-50 p-4"}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
    </div>
  );
}
