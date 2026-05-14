import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { businessFoundation } from "@/config/business";
import { previewProtectionStrategy } from "@/config/preview-protection";
import { updateMarketingTrackingSettingsAction, updateOperationalSettingsAction } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { getMarketingTrackingSettings } from "@/lib/settings/marketing";
import { getOperationalSettings } from "@/lib/settings/operations";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [tracking, operations] = await Promise.all([
    getMarketingTrackingSettings({ bypassCache: true }),
    getOperationalSettings({ bypassCache: true })
  ]);

  return (
    <AppShell area="admin" title="Lansman ayarları" description="Preview, export, abuse protection ve launch configuration görünümü.">
      <AdminSection title="Operational settings" description="Owner'ın sık değişen site ayarları. Public metadata/env fallback hâlâ korunur.">
        <form action={updateOperationalSettingsAction} className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <TrackingInput label="Brand name" name="brandName" defaultValue={operations.brandName} placeholder="Zeylora AI" note="Admin-managed brand display value for future CMS-controlled surfaces." />
            <TrackingInput label="Support email" name="supportEmail" defaultValue={operations.supportEmail} placeholder="support@zeylora.ai" note="Legal/contact and bulk-credit support address." />
            <TrackingInput label="Default currency" name="defaultCurrency" defaultValue={operations.defaultCurrency} placeholder="USD" note="Default public pricing currency." />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <ToggleSetting label="Maintenance mode" name="maintenanceMode" defaultChecked={operations.maintenanceMode} note="Future global maintenance switch." />
            <ToggleSetting label="Previews" name="previewEnabled" defaultChecked={operations.previewEnabled} note="Allow preview generation." />
            <ToggleSetting label="Clean exports" name="cleanExportsEnabled" defaultChecked={operations.cleanExportsEnabled} note="Controls future clean export availability." />
            <ToggleSetting label="Checkout" name="checkoutEnabled" defaultChecked={operations.checkoutEnabled} note="Controls future paid checkout visibility." />
            <ToggleSetting label="Registration" name="registrationEnabled" defaultChecked={operations.registrationEnabled} note="Allow new account registrations." />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <NumberSetting label="Upload MB" name="uploadMaxSizeMb" defaultValue={operations.uploadMaxSizeMb} />
            <NumberSetting label="Guest/min" name="guestPreviewPerMinute" defaultValue={operations.guestPreviewPerMinute} />
            <NumberSetting label="Guest/hour" name="guestPreviewPerHour" defaultValue={operations.guestPreviewPerHour} />
            <NumberSetting label="User jobs/min" name="userJobsPerMinute" defaultValue={operations.userJobsPerMinute} />
            <NumberSetting label="User jobs/day" name="userJobsPerDay" defaultValue={operations.userJobsPerDay} />
          </div>
          <button className="h-11 w-fit rounded-full bg-zeylora-brand px-5 text-sm font-black text-white shadow-glow transition hover:brightness-110">
            Save operational settings
          </button>
        </form>
      </AdminSection>
      <div className="mt-5">
      <AdminSection title="Marketing & tracking" description="Reklam, analytics ve domain verification kodlarını kod değiştirmeden yönet. Sadece public tracking ID/meta content değerleri gir.">
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
                <p className="text-sm font-black text-amber-100">Custom scripts</p>
                <p className="mt-1 text-sm leading-6 text-amber-100/75">
                  Yanlış script siteyi bozabilir. Sadece güvenilir platformlardan alınan public tracking kodlarını kullan.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-black text-white">
                <input type="checkbox" name="customScriptsEnabled" defaultChecked={tracking.customScriptsEnabled} className="size-4 accent-cyan" />
                Enable custom scripts
              </label>
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <TrackingTextarea label="Custom head script" name="customHeadScript" defaultValue={tracking.customHeadScript} />
              <TrackingTextarea label="Custom body/footer script" name="customBodyScript" defaultValue={tracking.customBodyScript} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="h-11 rounded-full bg-zeylora-brand px-5 text-sm font-black text-white shadow-glow transition hover:brightness-110">
              Save tracking settings
            </button>
            <TrackingStatus label="GA4" configured={Boolean(tracking.ga4MeasurementId)} />
            <TrackingStatus label="Meta" configured={Boolean(tracking.metaPixelId)} />
            <TrackingStatus label="Google verification" configured={Boolean(tracking.googleSearchConsoleVerification)} />
          </div>
        </form>
      </AdminSection>
      </div>
      <div className="mt-5">
      <AdminSection title="Export settings" description="Bu alan sonraki fazda DB-backed SiteSetting editörüne dönüşecek.">
        <div className="grid gap-3 md:grid-cols-2">
          <Setting label="Free watermark" value={businessFoundation.exports.freeWatermarkEnabled ? "Enabled" : "Disabled"} />
          <Setting label="Paid export" value={businessFoundation.exports.paidExportMode} />
          <Setting label="Credit enforcement" value={businessFoundation.credits.enforcementEnabled ? "Enabled" : "Disabled"} />
          <Setting label="Preview protection" value={previewProtectionStrategy.mode} />
        </div>
      </AdminSection>
      </div>
      <div className="mt-5">
        <AdminSection title="Abuse protection" description="In-memory guard launch için geçici; public traffic için Redis/Upstash önerilir.">
          <div className="grid gap-3 md:grid-cols-3">
            <Setting label="Upload limit" value={`${businessFoundation.abuseProtection.uploadMaxRequests}/min`} />
            <Setting label="Job limit" value={`${businessFoundation.abuseProtection.jobMaxRequests}/min`} />
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
  return <AdminStatusPill tone={configured ? "good" : "neutral"}>{label}: {configured ? "configured" : "missing"}</AdminStatusPill>;
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

function NumberSetting({ label, name, defaultValue }: { label: string; name: string; defaultValue: number }) {
  return (
    <label className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-cyan">{label}</span>
      <input
        name={name}
        type="number"
        min="0"
        step="1"
        defaultValue={defaultValue}
        className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-[#080d1f] px-3 text-sm font-bold text-white outline-none focus:border-cyan"
      />
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
