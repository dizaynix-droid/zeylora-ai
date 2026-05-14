import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { createEmergencyBackupSnapshotAction, pauseAllProvidersAction } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminSystemData } from "@/lib/admin/data";
import { emailProviderPlaceholders, emailTemplateDefinitions } from "@/lib/email/foundation";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const data = await getAdminSystemData();

  return (
    <AppShell area="admin" title="Sistem ve acil durum" description="Canlı operasyon, environment, backup ve emergency kontrol merkezi.">
      {params?.saved ? (
        <div className="mb-4 rounded-2xl border border-emerald/30 bg-emerald/10 px-4 py-3 text-sm font-black text-emerald">
          İşlem tamamlandı: {params.saved}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="Database" ready={data.env.database} note="DATABASE_URL" />
        <StatusCard label="Supabase" ready={data.env.supabase} note="Auth public env" />
        <StatusCard label="R2 Storage" ready={data.env.r2} note="Bucket + access keys" />
        <StatusCard label="Stripe" ready={data.env.stripe} note="Secret + webhook" />
        <StatusCard label="Email" ready={data.env.resend || data.env.postmark || data.env.smtp} note="Resend/Postmark/SMTP" />
        <StatusCard label="Maintenance" ready={!data.operations.maintenanceMode} note={data.operations.maintenanceMode ? "Bakım modu açık" : "Site açık"} invert />
        <StatusCard label="Upload" ready={data.operations.uploadsEnabled} note="Acil kapatma anahtarı" />
        <StatusCard label="Clean export" ready={data.operations.cleanExportsEnabled} note="Kredili temiz export" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <AdminSection title="Deployment bilgisi" description="Vercel ve environment durumunu hızlı kontrol et.">
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="Ortam" value={data.deployment.vercelEnv || data.env.nodeEnv} />
            <Info label="Site URL" value={data.env.siteUrl || "NEXT_PUBLIC_SITE_URL eksik"} />
            <Info label="Commit" value={data.deployment.vercelGitCommitSha || "local/unknown"} />
            <Info label="Deploy zamanı" value={data.deployment.deployTimestamp || "env yok"} />
          </div>
        </AdminSection>

        <AdminSection title="Acil kontroller" description="Kriz anında önce ayarlardan upload/preview/export kapat; gerekiyorsa providerları duraklat.">
          <div className="grid gap-3">
            <a href="/admin/settings" className="rounded-2xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm font-black text-cyan">
              Emergency toggles aç
            </a>
            <form action={pauseAllProvidersAction}>
              <button className="w-full rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-black text-rose-200">
                Tüm providerları duraklat
              </button>
            </form>
          </div>
        </AdminSection>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AdminSection title="Provider sağlık durumu" description="Bugünkü job sayısı, hata oranı ve tahmini maliyet.">
          <AdminTable>
            <table className="min-w-[760px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Sağlık</th>
                  <th className="px-4 py-3">Bugün job</th>
                  <th className="px-4 py-3">Hata</th>
                  <th className="px-4 py-3">Maliyet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.providers.map((provider) => (
                  <tr key={provider.providerKey}>
                    <td className="px-4 py-3 font-black text-white">{provider.name}</td>
                    <td className="px-4 py-3"><Health status={provider.health} /></td>
                    <td className="px-4 py-3 text-slate-300">{provider.jobsToday}</td>
                    <td className="px-4 py-3 text-rose-200">{provider.failedToday} ({Math.round(provider.failureRate * 100)}%)</td>
                    <td className="px-4 py-3 text-amber">${provider.estimatedCostToday.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>

        <AdminSection
          title="Backup ve recovery durumu"
          description="Kritik veriler, R2 export, ledger doğrulama ve restore hazırlığı tek yerden izlenir."
          action={<a href="/admin/recovery" className="rounded-full border border-cyan/30 bg-cyan/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan">Recovery paneli</a>}
        >
          <div className="grid gap-3">
            {data.backup.statusItems.slice(0, 4).map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm font-black text-white">{item.value}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{item.note}</p>
                  </div>
                  <BackupStatus status={item.status} />
                </div>
              </div>
            ))}
            <form action={createEmergencyBackupSnapshotAction} className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3">
              <input type="hidden" name="confirmation" value="CREATE_BACKUP" />
              <button className="w-full rounded-full bg-zeylora-brand px-4 py-3 text-sm font-black text-white shadow-glow transition hover:brightness-110">
                Create emergency backup snapshot
              </button>
              <p className="mt-2 text-xs font-bold leading-5 text-amber-100/80">
                Private R2 içine JSON + CSV snapshot kaydeder. Secret, token veya signed URL export edilmez.
              </p>
            </form>
            {data.backup.criticalWarnings.length > 0 ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">
                {data.backup.criticalWarnings[0]}
              </div>
            ) : null}
          </div>
        </AdminSection>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AdminSection title="Email/notification hazırlığı" description="Şu an spam göndermemek için mimari hazır, gönderim ayardan kontrollü açılır.">
          <div className="grid gap-3">
            <Info label="Email gönderimi" value={data.operations.emailsEnabled ? "Aktif" : "Kapalı"} />
            <Info label="Resend" value={data.email.resendConfigured ? "Yapılandırıldı" : "RESEND_API_KEY eksik"} />
            <Info label="From" value={data.email.fromConfigured ? process.env.EMAIL_FROM || "Tanımlı" : "EMAIL_FROM eksik"} />
            <Info label="Support email" value={data.operations.supportEmail} />
            <Info label="Billing email" value={data.operations.billingEmail} />
            <Info
              label="Son başarılı email"
              value={data.email.lastSuccessfulEmail ? `${data.email.lastSuccessfulEmail.templateKey} · ${formatAdminDate(data.email.lastSuccessfulEmail.sentAt || data.email.lastSuccessfulEmail.createdAt)}` : "Henüz yok"}
            />
            <Info
              label="Başarısız email"
              value={`${data.email.failedEmailCount} adet${data.email.lastFailedEmail?.errorMessage ? ` · ${data.email.lastFailedEmail.errorMessage}` : ""}`}
            />
            <form action="/api/v1/email/test" method="post">
              <button className="h-11 w-full rounded-full bg-zeylora-brand text-sm font-black text-white shadow-glow transition hover:brightness-110">
                Admin test email gönder
              </button>
            </form>
            <div className="grid gap-2">
              {emailProviderPlaceholders.map((provider) => (
                <div key={provider.key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                  <div>
                    <p className="font-black text-white">{provider.name}</p>
                    <p className="text-xs text-slate-500">{provider.envKeys.join(", ")}</p>
                  </div>
                  <AdminStatusPill tone={provider.configured ? "good" : "warn"}>{provider.configured ? "Hazır" : "Eksik"}</AdminStatusPill>
                </div>
              ))}
            </div>
          </div>
        </AdminSection>

        <AdminSection title="Email template temeli" description="Welcome, ticket reply, ödeme ve kredi bildirim şablonları için operasyon listesi.">
          <div className="grid gap-2">
            {emailTemplateDefinitions.map((template) => (
              <div key={template.key} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <p className="font-black text-white">{template.name}</p>
                <p className="mt-1 text-xs font-bold text-cyan">{template.eventType}</p>
                <p className="mt-1 text-sm leading-5 text-slate-400">{template.description}</p>
              </div>
            ))}
          </div>
        </AdminSection>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AdminSection title="Son admin aksiyonları" description="Audit trail kısa görünüm.">
          <div className="grid gap-2">
            {data.recentAdminActions.map((action) => (
              <Info key={action.id} label={action.action} value={`${action.adminUser?.email || "system"} · ${formatAdminDate(action.createdAt)}`} />
            ))}
          </div>
        </AdminSection>
        <AdminSection title="Security / abuse olayları" description="Rate limit, abuse block ve upload engelleme olayları.">
          <div className="grid gap-2">
            {data.recentSecurityEvents.map((event) => (
              <Info key={event.id} label={event.action} value={formatAdminDate(event.createdAt)} />
            ))}
            {data.recentSecurityEvents.length === 0 ? <p className="text-sm font-bold text-slate-400">Yakın zamanda security olayı yok.</p> : null}
          </div>
        </AdminSection>
      </div>

      <div className="mt-4">
        <AdminSection title="Cloudflare / Edge launch notları" description="API entegrasyonu yok; canlı domain bağlanırken uygulanacak öneriler.">
          <Checklist
            items={[
              "Cloudflare proxy ON ve SSL Full/Strict",
              "Bot Fight Mode veya Turnstile değerlendirmesi",
              "Basic WAF: admin/auth/upload/job endpointleri için anomali kontrolü",
              "Rate limit: /api/v1/uploads ve /api/v1/jobs/* için IP/user bazlı limit",
              "Static asset ve public showcase image cache policy",
              "DNS: root + www + Vercel CNAME/A kayıtları doğrulandı"
            ]}
          />
        </AdminSection>
      </div>
    </AppShell>
  );
}

function StatusCard({ label, ready, note, invert = false }: { label: string; ready: boolean; note: string; invert?: boolean }) {
  const good = invert ? ready : ready;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan">{label}</p>
          <p className="mt-2 text-sm font-bold text-slate-300">{note}</p>
        </div>
        <AdminStatusPill tone={good ? "good" : "warn"}>{good ? "Hazır" : "Kontrol"}</AdminStatusPill>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 break-all text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function Health({ status }: { status: string }) {
  if (status === "HEALTHY") return <AdminStatusPill tone="good">Sağlıklı</AdminStatusPill>;
  if (status === "DEGRADED") return <AdminStatusPill tone="warn">Dikkat</AdminStatusPill>;
  return <AdminStatusPill tone="bad">Devre dışı</AdminStatusPill>;
}

function BackupStatus({ status }: { status: "HAZIR" | "UYARI" | "KRITIK" }) {
  if (status === "HAZIR") return <AdminStatusPill tone="good">Hazır</AdminStatusPill>;
  if (status === "UYARI") return <AdminStatusPill tone="warn">Uyarı</AdminStatusPill>;
  return <AdminStatusPill tone="bad">Kritik</AdminStatusPill>;
}

function Checklist({ items }: { items: string[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-300">
          □ {item}
        </div>
      ))}
    </div>
  );
}
