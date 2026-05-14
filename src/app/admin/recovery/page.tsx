import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { createEmergencyBackupSnapshotAction } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { getBackupRecoveryData } from "@/lib/admin/backup";

export const dynamic = "force-dynamic";

export default async function AdminRecoveryPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const data = await getBackupRecoveryData();

  return (
    <AppShell
      area="admin"
      title="Yedekleme ve felaket kurtarma"
      description="Kredi, ödeme, job, ticket ve provider snapshot verilerini güvenli şekilde izleme ve acil export merkezi."
    >
      {params?.saved ? (
        <div className="mb-4 rounded-2xl border border-emerald/30 bg-emerald/10 px-4 py-3 text-sm font-black text-emerald">
          Backup işlemi tamamlandı: {params.saved}
        </div>
      ) : null}
      {params?.error ? (
        <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-black text-rose-100">
          İşlem tamamlanamadı: {params.error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.statusItems.map((item) => (
          <AdminMetricCard
            key={item.label}
            label={item.label}
            value={item.status}
            note={`${item.value} · ${item.note}`}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <AdminSection title="Acil backup snapshot" description="Kritik DB state JSON + CSV olarak private R2 içine yazılır. Secret, token, şifre ve signed URL export edilmez.">
          <form action={createEmergencyBackupSnapshotAction} className="grid gap-3">
            <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Onay kodu
              <input
                name="confirmation"
                required
                placeholder="CREATE_BACKUP"
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition focus:border-cyan"
              />
            </label>
            <button className="rounded-full bg-zeylora-brand px-5 py-3 text-sm font-black text-white shadow-glow transition hover:brightness-110">
              Create emergency backup snapshot
            </button>
            <p className="text-xs font-bold leading-5 text-slate-400">
              Bu işlem restore yapmaz. Sadece kritik kullanıcı, bakiye, ödeme, kredi hareketi, ticket, job ve provider snapshot verilerini yedekler.
            </p>
          </form>
        </AdminSection>

        <AdminSection title="Kritik uyarılar" description="Ödeme/kredi/R2 tarafında restore öncesi incelenmesi gereken riskler.">
          {data.criticalWarnings.length > 0 ? (
            <div className="grid gap-2">
              {data.criticalWarnings.map((warning) => (
                <div key={warning} className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-100">
                  {warning}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald/30 bg-emerald/10 px-4 py-3 text-sm font-black text-emerald">
              Kritik backup/ledger uyarısı görünmüyor.
            </div>
          )}
        </AdminSection>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <AuditCard title="Stripe güvenlik audit" rows={[
          ["Duplicate credit", data.audit.stripe.counts.duplicateCredits],
          ["Payment without transaction", data.audit.stripe.counts.paymentsWithoutTransaction],
          ["Transaction without payment", data.audit.stripe.counts.transactionsWithoutPayment],
          ["Negative balance", data.audit.stripe.counts.negativeBalances],
          ["Invalid snapshots", data.audit.stripe.counts.invalidSnapshots]
        ]} />
        <AuditCard title="Credit ledger kontrolü" rows={[
          ["Kontrol edilen kullanıcı", data.audit.creditLedger.checkedUsers],
          ["Bakiye uyuşmazlığı", data.audit.creditLedger.mismatchCount],
          ["Limit uyarısı", data.audit.creditLedger.truncated ? "1000 kullanıcı ile sınırlı" : "Tamamlandı"]
        ]} />
        <AuditCard title="R2 object kontrolü" rows={[
          ["R2 env", data.audit.r2.configured ? "Hazır" : "Eksik"],
          ["Output eksik completed job", data.audit.r2.counts.completedMissingOutput],
          ["Storage key eksik medya", data.audit.r2.counts.mediaWithoutKey],
          ["Signed URL hata örneği", data.audit.r2.counts.brokenSignedUrls]
        ]} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <AdminSection title="Son backup eventleri" description="Emergency snapshot, integrity check ve ileride otomatik backup kayıtları burada görünür.">
          <AdminTable>
            <table className="min-w-[860px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Tip</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Başlangıç</th>
                  <th className="px-4 py-3">Bitiş</th>
                  <th className="px-4 py-3">Boyut</th>
                  <th className="px-4 py-3">Lokasyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.backupEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 font-black text-white">{event.type}</td>
                    <td className="px-4 py-3"><EventStatus status={event.status} /></td>
                    <td className="px-4 py-3 text-slate-300">{formatAdminDate(event.startedAt)}</td>
                    <td className="px-4 py-3 text-slate-300">{formatAdminDate(event.completedAt)}</td>
                    <td className="px-4 py-3 text-slate-300">{event.fileSize ? formatBytes(event.fileSize) : "-"}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-400">{event.storageLocation ? "private R2" : event.errorMessage || "-"}</td>
                  </tr>
                ))}
                {data.backupEvents.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm font-bold text-slate-400" colSpan={6}>Henüz backup event yok.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>

        <AdminSection title="Restore test geçmişi" description="Canlı DB üzerine otomatik restore yok. Test restore staging ortamında manuel doğrulanmalı.">
          <div className="grid gap-2">
            {data.restoreTests.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-white">{event.type}</p>
                  <EventStatus status={event.status} />
                </div>
                <p className="mt-1 text-sm font-bold text-slate-400">{formatAdminDate(event.completedAt || event.startedAt)}</p>
              </div>
            ))}
            {data.restoreTests.length === 0 ? (
              <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">
                Restore testi henüz kaydedilmemiş. İlk test staging Supabase projesinde yapılmalı.
              </p>
            ) : null}
          </div>
        </AdminSection>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Playbook title="Kurtarma playbook" items={[
          "1. Yeni işlem kabulünü kapat: Ayarlar > upload, preview, clean export ve checkout kapat.",
          "2. Vercel Deployments ekranından son sağlıklı deployment'a rollback yap.",
          "3. Supabase dashboard üzerinden PITR/daily backup restore seçeneğini staging ortamında doğrula.",
          "4. R2 bucket içinde backup key ve result/upload objelerini kontrol et.",
          "5. Stripe Dashboard ile başarılı checkout session ve PaymentIntent kayıtlarını dışa aktar.",
          "6. CreditTransaction ledger toplamını User.creditBalance ile karşılaştır.",
          "7. Restore sonrası admin/recovery audit ekranını tekrar çalıştır."
        ]} />
        <Playbook title="Stripe ve bakiye mutabakatı" items={[
          "Başarılı Payment status=PAID ama PURCHASE transaction yoksa kullanıcıya kredi teslim edilmemiş olabilir.",
          "Aynı paymentId için birden fazla PURCHASE transaction varsa çift kredi riski vardır.",
          "User.creditBalance negatifse clean export veya admin adjustment akışı incelenmeli.",
          "Stripe event/session idempotency logları WebhookLog ekranından kontrol edilmeli.",
          "Manuel düzeltme gerekiyorsa admin credit adjustment notuna ödeme/ticket id ekle."
        ]} />
        <Playbook title="Supabase restore notları" items={[
          "Canlı DB üstüne direkt restore yapmadan önce staging projesinde smoke test yap.",
          "Restore sonrası Prisma migration durumu ve yeni migration dosyalarını tekrar doğrula.",
          "Auth user kayıtları ile public.User profilleri eşleşiyor mu kontrol et.",
          "Admin whitelist ve MFA erişimi canlıda tekrar test edilmeli."
        ]} />
        <Playbook title="R2 recovery notları" items={[
          "R2 bucket versioning/lifecycle politikalarını Cloudflare panelinden doğrula.",
          "Backup export dosyaları private path altında tutulur: backups/emergency/YYYY-MM-DD/...",
          "Signed URL üretimi çalışıyorsa obje erişim anahtarları doğru demektir.",
          "Full orphan object tespiti için ileride R2 Inventory veya scheduled scanner eklenecek."
        ]} />
      </div>
    </AppShell>
  );
}

function AuditCard({ title, rows }: { title: string; rows: Array<[string, string | number]> }) {
  return (
    <AdminSection title={title}>
      <div className="grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
            <p className="text-sm font-bold text-slate-400">{label}</p>
            <p className="text-sm font-black text-white">{value}</p>
          </div>
        ))}
      </div>
    </AdminSection>
  );
}

function Playbook({ title, items }: { title: string; items: string[] }) {
  return (
    <AdminSection title={title}>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-bold leading-6 text-slate-300">
            {item}
          </div>
        ))}
      </div>
    </AdminSection>
  );
}

function EventStatus({ status }: { status: string }) {
  if (status === "COMPLETED") return <AdminStatusPill tone="good">Tamamlandı</AdminStatusPill>;
  if (status === "WARNING") return <AdminStatusPill tone="warn">Uyarı</AdminStatusPill>;
  if (status === "FAILED") return <AdminStatusPill tone="bad">Hatalı</AdminStatusPill>;
  return <AdminStatusPill tone="neutral">{status}</AdminStatusPill>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
