import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { businessFoundation } from "@/config/business";
import { previewProtectionStrategy } from "@/config/preview-protection";
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
    <AppShell area="admin" title="Lansman ayarları" description="Preview, export, abuse protection ve launch configuration görünümü.">
      {params?.saved ? (
        <div className="mb-4 rounded-2xl border border-emerald/30 bg-emerald/10 px-4 py-3 text-sm font-black text-emerald">
          Kaydedildi: {params.saved === "tracking" ? "tracking ayarları" : "operasyon ayarları"}.
        </div>
      ) : null}
      <AdminSection title="Operasyon ayarları" description="Owner'ın sık değişen site ayarları. Public metadata/env fallback hâlâ korunur.">
        <form action={updateOperationalSettingsAction} className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <TrackingInput label="Marka adı" name="brandName" defaultValue={operations.brandName} placeholder="Zeylora AI" note="Admin kontrollü marka gösterim değeri." />
            <TrackingInput label="Destek email" name="supportEmail" defaultValue={operations.supportEmail} placeholder="support@zeylora.ai" note="Legal/contact ve toplu kredi destek adresi." />
            <TrackingInput label="Fatura email" name="billingEmail" defaultValue={operations.billingEmail} placeholder="billing@zeylora.ai" note="Ödeme, fatura ve kredi bildirimleri için operasyon adresi." />
            <TrackingInput label="Varsayılan para birimi" name="defaultCurrency" defaultValue={operations.defaultCurrency} placeholder="USD" note="Public fiyatlama varsayılan para birimi." />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <ToggleSetting label="Bakım modu" name="maintenanceMode" defaultChecked={operations.maintenanceMode} note="Global bakım modu anahtarı." />
            <ToggleSetting label="Upload" name="uploadsEnabled" defaultChecked={operations.uploadsEnabled} note="Acil durumda yükleme akışını kapatır." />
            <ToggleSetting label="Preview" name="previewEnabled" defaultChecked={operations.previewEnabled} note="Preview üretimine izin ver." />
            <ToggleSetting label="Clean export" name="cleanExportsEnabled" defaultChecked={operations.cleanExportsEnabled} note="Clean export erişimini kontrol eder." />
            <ToggleSetting label="Checkout" name="checkoutEnabled" defaultChecked={operations.checkoutEnabled} note="Paid checkout görünürlüğünü kontrol eder." />
            <ToggleSetting label="Kayıt" name="registrationEnabled" defaultChecked={operations.registrationEnabled} note="Yeni hesap kaydına izin ver." />
            <ToggleSetting label="Email bildirimleri" name="emailsEnabled" defaultChecked={operations.emailsEnabled} note="Resend/Postmark/SMTP hazır olana kadar kapalı tutulabilir." />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <NumberSetting label="Upload MB" name="uploadMaxSizeMb" defaultValue={operations.uploadMaxSizeMb} />
            <NumberSetting label="Misafir/dk" name="guestPreviewPerMinute" defaultValue={operations.guestPreviewPerMinute} />
            <NumberSetting label="Misafir/saat" name="guestPreviewPerHour" defaultValue={operations.guestPreviewPerHour} />
            <NumberSetting label="Kullanıcı iş/dk" name="userJobsPerMinute" defaultValue={operations.userJobsPerMinute} />
            <NumberSetting label="Kullanıcı iş/gün" name="userJobsPerDay" defaultValue={operations.userJobsPerDay} />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <NumberSetting
              label="1 kredi tahmini USD"
              name="estimatedCreditUsdValue"
              defaultValue={operations.estimatedCreditUsdValue}
              step="0.01"
              note="Bu değer tahmini gelir/kâr hesaplamaları için kullanılır. Job tamamlanınca snapshot alınır; eski işler sonradan değişmez."
            />
          </div>
          <button className="h-11 w-fit rounded-full bg-zeylora-brand px-5 text-sm font-black text-white shadow-glow transition hover:brightness-110">
            Operasyon ayarlarını kaydet
          </button>
        </form>
      </AdminSection>
      <div className="mt-5">
      <AdminSection title="Pazarlama ve tracking" description="Reklam, analytics ve domain doğrulama kodlarını kod değiştirmeden yönet. Sadece public tracking ID/meta content değerleri gir.">
        <form action={updateMarketingTrackingSettingsAction} className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <TrackingInput label="GA4 Measurement ID" name="ga4MeasurementId" defaultValue={tracking.ga4MeasurementId} placeholder="G-XXXXXXXXXX" note="Google Analytics page_view ve event takibi." />
            <TrackingInput label="Google Ads Conversion ID" name="googleAdsConversionId" defaultValue={tracking.googleAdsConversionId} placeholder="AW-XXXXXXXXXX" note="Google Ads base tag için." />
            <TrackingInput label="Google Ads Conversion Label" name="googleAdsConversionLabel" defaultValue={tracking.googleAdsConversionLabel} placeholder="abc123..." note="Purchase conversion helper için saklanır." />
            <TrackingInput label="Meta Pixel ID" name="metaPixelId" defaultValue={tracking.metaPixelId} placeholder="1234567890" note="PageView, InitiateCheckout ve custom eventler." />
            <TrackingInput label="TikTok Pixel ID" name="tiktokPixelId" defaultValue={tracking.tiktokPixelId} placeholder="CXXXXXXXXXXXX" note="Opsiyonel TikTok pixel." />
            <TrackingInput label="Pinterest Tag ID" name="pinterestTagId" defaultValue={tracking.pinterestTagId} placeholder="261xxxxxxxxxx" note="Opsiyonel Pinterest tag." />
            <TrackingInput label="Google Search Console" name="googleSearchConsoleVerification" defaultValue={tracking.googleSearchConsoleVerification} placeholder="meta content value" note="google-site-verification content değeri." />
            <TrackingInput label="Bing Webmaster" name="bingWebmasterVerification" defaultValue={tracking.bingWebmasterVerification} placeholder="meta content value" note="msvalidate.01 content değeri." />
            <TrackingInput label="Facebook Domain Verification" name="facebookDomainVerification" defaultValue={tracking.facebookDomainVerification} placeholder="meta content value" note="facebook-domain-verification content değeri." />
          </div>

          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-black text-amber-100">Özel scriptler</p>
                <p className="mt-1 text-sm leading-6 text-amber-100/75">
                  Yanlış script siteyi bozabilir. Sadece güvenilir platformlardan alınan public tracking kodlarını kullan.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-black text-white">
                <input type="checkbox" name="customScriptsEnabled" defaultChecked={tracking.customScriptsEnabled} className="size-4 accent-cyan" />
                Özel scriptleri aktif et
              </label>
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <TrackingTextarea label="Özel head script" name="customHeadScript" defaultValue={tracking.customHeadScript} />
              <TrackingTextarea label="Özel body/footer script" name="customBodyScript" defaultValue={tracking.customBodyScript} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="h-11 rounded-full bg-zeylora-brand px-5 text-sm font-black text-white shadow-glow transition hover:brightness-110">
              Tracking ayarlarını kaydet
            </button>
            <TrackingStatus label="GA4" configured={Boolean(tracking.ga4MeasurementId)} />
            <TrackingStatus label="Meta" configured={Boolean(tracking.metaPixelId)} />
            <TrackingStatus label="Google verification" configured={Boolean(tracking.googleSearchConsoleVerification)} />
          </div>
        </form>
      </AdminSection>
      </div>
      <div className="mt-5">
      <AdminSection title="Export ayarları" description="Bu alan sonraki fazda DB-backed SiteSetting editörüne dönüşecek.">
        <div className="grid gap-3 md:grid-cols-2">
          <Setting label="Free watermark" value={businessFoundation.exports.freeWatermarkEnabled ? "Aktif" : "Pasif"} />
          <Setting label="Paid export" value={businessFoundation.exports.paidExportMode} />
          <Setting label="Kredi zorunluluğu" value={businessFoundation.credits.enforcementEnabled ? "Aktif" : "Pasif"} />
          <Setting label="Preview protection" value={previewProtectionStrategy.mode} />
        </div>
      </AdminSection>
      </div>
      <div className="mt-5">
        <AdminSection title="Abuse koruması" description="In-memory guard launch için geçici; public traffic için Redis/Upstash önerilir.">
          <div className="grid gap-3 md:grid-cols-3">
            <Setting label="Upload limiti" value={`${businessFoundation.abuseProtection.uploadMaxRequests}/dk`} />
            <Setting label="Job limiti" value={`${businessFoundation.abuseProtection.jobMaxRequests}/dk`} />
            <Setting label="Cooldown" value={`${businessFoundation.abuseProtection.cooldownMs}ms`} />
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}

function TrackingInput({
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
    <label className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-cyan">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-[#080d1f] px-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan"
      />
      <span className="mt-2 block text-xs leading-5 text-slate-500">{note}</span>
    </label>
  );
}

function TrackingTextarea({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label>
      <span className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={6}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-[#080d1f] p-3 font-mono text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-amber-200/50"
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
    <label className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-cyan">{label}</span>
        <input name={name} type="checkbox" defaultChecked={defaultChecked} className="size-4 accent-cyan" />
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
    <label className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-cyan">{label}</span>
      <input
        name={name}
        type="number"
        min="0"
        step={step}
        defaultValue={defaultValue}
        className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-[#080d1f] px-3 text-sm font-bold text-white outline-none focus:border-cyan"
      />
      {note ? <span className="mt-2 block text-xs leading-5 text-slate-500">{note}</span> : null}
    </label>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <div className="mt-3"><AdminStatusPill tone="neutral">{value}</AdminStatusPill></div>
    </div>
  );
}
