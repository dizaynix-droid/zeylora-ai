import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminAffiliateData } from "@/lib/affiliate/data";
import { manualAffiliateRewardAction, updateAffiliateProfileAction, updateAffiliateSettingsAction } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage() {
  await requireAdmin();
  const data = await getAdminAffiliateData();
  const samplePayment = 50;
  const sampleCredits = Math.floor((samplePayment * (data.settings.defaultRewardPercent / 100)) / data.settings.estimatedCreditUsdValue);

  return (
    <AppShell area="admin" title="Partner programı" description="Zeylora Creator Program, referral ödülleri, komisyon ayarları ve fraud kontrolleri.">
      <div className="grid gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <AdminMetricCard label="Tıklama" value={data.summary.clicks} />
        <AdminMetricCard label="Signup" value={data.summary.signups} />
        <AdminMetricCard label="Ödeme dönüşümü" value={data.summary.paidReferrals} />
        <AdminMetricCard label="Referred revenue" value={`$${data.summary.referredRevenue.toFixed(2)}`} />
        <AdminMetricCard label="Dağıtılan kredi" value={data.summary.rewardCredits} />
        <AdminMetricCard label="Şüpheli" value={data.summary.suspiciousCount} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <AdminSection title="Komisyon kuralları" description="Ödüller v1 içinde yalnızca platform kredisi olarak verilir. Nakit ödeme yok.">
          <form action={updateAffiliateSettingsAction} className="grid gap-3">
            <label className="flex items-center gap-2 text-sm font-black text-white">
              <input name="enabled" type="checkbox" defaultChecked={data.settings.enabled} />
              Affiliate sistemi aktif
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Varsayılan %" name="defaultRewardPercent" defaultValue={data.settings.defaultRewardPercent} />
              <Field label="Minimum ödeme ($)" name="minimumPaymentAmount" defaultValue={data.settings.minimumPaymentAmount} />
              <Field label="1 kredi USD değeri" name="estimatedCreditUsdValue" defaultValue={data.settings.estimatedCreditUsdValue} step="0.01" />
              <Field label="Ödül gecikmesi gün" name="rewardDelayDays" defaultValue={data.settings.rewardDelayDays} />
              <Field label="Ödeme başı max kredi" name="maxRewardCreditsPerPayment" defaultValue={data.settings.maxRewardCreditsPerPayment} />
              <Field label="Aylık max kredi" name="maxMonthlyRewardCreditsPerAffiliate" defaultValue={data.settings.maxMonthlyRewardCreditsPerAffiliate} />
            </div>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Ödül kapsamı
              <select name="rewardScope" defaultValue={data.settings.rewardScope} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold normal-case tracking-normal text-white">
                <option value="ALL_PAYMENTS">Tüm başarılı ödemeler</option>
                <option value="FIRST_PAYMENT_ONLY">Sadece ilk ödeme</option>
              </select>
            </label>
            <div className="rounded-2xl border border-cyan/20 bg-cyan/10 p-4 text-sm font-bold text-cyan">
              Örnek: $50 ödeme → yaklaşık {sampleCredits} kredi ödül. Snapshot eski ödülleri değiştirmez.
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {data.settings.tiers.map((tier) => (
                <div key={tier.key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <label className="mb-2 flex items-center gap-2 text-sm font-black text-white">
                    <input name={`${tier.key}Active`} type="checkbox" defaultChecked={tier.active} />
                    {tier.name}
                  </label>
                  <input type="hidden" name={`${tier.key}Name`} defaultValue={tier.name} />
                  <Field label="%" name={`${tier.key}RewardPercent`} defaultValue={tier.rewardPercent} />
                  <Field label="Paid referral" name={`${tier.key}RequiredPaidReferrals`} defaultValue={tier.requiredPaidReferrals} />
                  <Field label="Revenue şartı" name={`${tier.key}RequiredReferredRevenue`} defaultValue={tier.requiredReferredRevenue} />
                  <Field label="Aylık cap" name={`${tier.key}MonthlyCapCredits`} defaultValue={tier.monthlyCapCredits} />
                </div>
              ))}
            </div>
            <button className="h-11 rounded-full bg-zeylora-brand text-sm font-black text-white shadow-glow">Kaydet</button>
          </form>
        </AdminSection>

        <AdminSection title="Son referral ödülleri" description="Başarılı payment sonrası oluşan kredi ödülleri.">
          <AdminTable>
            <table className="min-w-[760px] w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr><th className="px-4 py-3">Affiliate</th><th className="px-4 py-3">Referred</th><th className="px-4 py-3">Kredi</th><th className="px-4 py-3">%</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3">Tarih</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.recentRewards.map((reward) => (
                  <tr key={reward.id}>
                    <td className="px-4 py-3 font-bold text-white">{reward.affiliateUser.email}</td>
                    <td className="px-4 py-3 text-slate-300">{reward.referredUser.email}</td>
                    <td className="px-4 py-3 text-cyan">+{reward.rewardCredits}</td>
                    <td className="px-4 py-3 text-slate-300">{Number(reward.rewardPercentSnapshot)}%</td>
                    <td className="px-4 py-3"><AdminStatusPill tone={reward.status === "DELIVERED" ? "good" : "neutral"}>{reward.status}</AdminStatusPill></td>
                    <td className="px-4 py-3 text-slate-400">{formatAdminDate(reward.createdAt)}</td>
                  </tr>
                ))}
                {data.recentRewards.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Henüz referral ödülü yok.</td></tr> : null}
              </tbody>
            </table>
          </AdminTable>
        </AdminSection>
      </div>

      <div className="mt-4">
        <AdminSection title="Affiliate hesapları" description="Affiliate durumunu, override komisyonu, aylık cap ve fraud notlarını yönet.">
          <div className="grid gap-4">
            {data.profiles.map((profile) => (
              <div key={profile.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr_.7fr]">
                  <div>
                    <p className="text-lg font-black text-white">{profile.user.email}</p>
                    <p className="mt-1 text-sm font-bold text-cyan">/{profile.referralCode}</p>
                    <p className="mt-2 text-xs font-bold text-slate-400">
                      {profile.totalClicks} click · {profile.totalSignups} signup · {profile.totalPaidReferrals} paid · {profile.totalRewardCredits} kredi
                    </p>
                  </div>
                  <form action={updateAffiliateProfileAction} className="grid gap-2 md:grid-cols-4">
                    <input type="hidden" name="profileId" value={profile.id} />
                    <select name="status" defaultValue={profile.status} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white">
                      <option value="ACTIVE">Aktif</option>
                      <option value="FROZEN">Dondur</option>
                      <option value="SUSPICIOUS">Şüpheli</option>
                      <option value="DISABLED">Devre dışı</option>
                    </select>
                    <input name="customRewardPercent" type="number" step="0.01" placeholder="Özel %" defaultValue={profile.customRewardPercent ? Number(profile.customRewardPercent) : ""} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white" />
                    <input name="customMonthlyCapCredits" type="number" placeholder="Özel aylık cap" defaultValue={profile.customMonthlyCapCredits || ""} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white" />
                    <input name="fraudNotes" placeholder="Fraud notu" defaultValue={profile.fraudNotes || ""} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white" />
                    <label className="text-xs font-bold text-slate-300"><input name="freezeRewards" type="checkbox" defaultChecked={profile.freezeRewards} /> Ödülü dondur</label>
                    <label className="text-xs font-bold text-slate-300"><input name="trusted" type="checkbox" defaultChecked={profile.trusted} /> Güvenilir</label>
                    <label className="text-xs font-bold text-slate-300"><input name="suspicious" type="checkbox" defaultChecked={profile.suspicious} /> Şüpheli</label>
                    <button className="rounded-xl bg-cyan px-3 py-2 text-sm font-black text-slate-950">Kaydet</button>
                  </form>
                  <form action={manualAffiliateRewardAction} className="grid gap-2">
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input name="amount" type="number" min="1" placeholder="Manuel kredi" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white" />
                    <input name="note" placeholder="Not" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white" />
                    <button className="rounded-xl border border-cyan/25 bg-cyan/10 px-3 py-2 text-sm font-black text-cyan">Manuel ödül</button>
                  </form>
                </div>
              </div>
            ))}
            {data.profiles.length === 0 ? <p className="text-sm font-bold text-slate-400">Henüz affiliate profili yok.</p> : null}
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}

function Field({ label, name, defaultValue, step = "1" }: { label: string; name: string; defaultValue: string | number; step?: string }) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
      {label}
      <input name={name} type="number" step={step} defaultValue={defaultValue} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold normal-case tracking-normal text-white" />
    </label>
  );
}
