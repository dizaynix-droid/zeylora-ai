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
  const rewardScopeLabel = data.settings.rewardScope === "FIRST_PAYMENT_ONLY" ? "Sadece ilk ödeme" : "Tüm başarılı ödemeler";

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

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,.86fr)_minmax(0,1.14fr)]">
        <AdminSection title="Komisyon kuralları" description="Ödüller v1 içinde yalnızca platform kredisi olarak verilir. Nakit ödeme yok.">
          <form action={updateAffiliateSettingsAction} className="grid gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <input name="enabled" type="checkbox" defaultChecked={data.settings.enabled} />
              Affiliate sistemi aktif
            </label>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-blue-700">Sistem nasıl çalışır?</p>
              <p className="mt-2">
                Ödül sadece referral ile gelen kullanıcı başarılı Stripe ödemesi yaptığında oluşur. Signup tek başına ödül vermez.
                Başarısız, iptal, refund, duplicate veya self-referral ödeme ödül üretmez.
              </p>
              <p className="mt-2 font-semibold text-slate-950">
                Formül: ödeme tutarı × komisyon yüzdesi ÷ 1 kredi USD değeri = verilecek kredi.
              </p>
              <p className="mt-1 text-blue-700">
                Örnek: ${samplePayment} ödeme × %{data.settings.defaultRewardPercent} ÷ ${data.settings.estimatedCreditUsdValue} = yaklaşık {sampleCredits} kredi.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Field label="Varsayılan %" hint="Tier/affiliate override yoksa kullanılan ana komisyon oranı." name="defaultRewardPercent" defaultValue={data.settings.defaultRewardPercent} />
              <Field label="Minimum ödeme ($)" hint="Bu tutarın altındaki ödemeler affiliate ödülü üretmez." name="minimumPaymentAmount" defaultValue={data.settings.minimumPaymentAmount} step="0.01" />
              <Field label="1 kredi USD değeri" hint="Dolar karşılığını krediye çevirmek için kullanılır. Örnek: 0.70 ise $7 ödül = 10 kredi." name="estimatedCreditUsdValue" defaultValue={data.settings.estimatedCreditUsdValue} step="0.01" />
              <Field label="Ödül gecikmesi gün" hint="0 ise başarılı ödeme sonrası hemen krediye döner. İleride fraud/refund bekleme süresi için." name="rewardDelayDays" defaultValue={data.settings.rewardDelayDays} />
              <Field label="Ödeme başı max kredi" hint="Tek bir ödemeden affiliate hesabına yazılabilecek maksimum kredi." name="maxRewardCreditsPerPayment" defaultValue={data.settings.maxRewardCreditsPerPayment} />
              <Field label="Aylık max kredi" hint="Bir affiliate hesabının ay içinde kazanabileceği maksimum ödül kredisi." name="maxMonthlyRewardCreditsPerAffiliate" defaultValue={data.settings.maxMonthlyRewardCreditsPerAffiliate} />
            </div>
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Ödül kapsamı
              <select name="rewardScope" defaultValue={data.settings.rewardScope} className="rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-semibold normal-case tracking-normal text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                <option value="ALL_PAYMENTS">Tüm başarılı ödemeler</option>
                <option value="FIRST_PAYMENT_ONLY">Sadece ilk ödeme</option>
              </select>
              <span className="text-[11px] font-semibold normal-case leading-5 tracking-normal text-slate-500">
                Şu an: {rewardScopeLabel}. İlk ödeme seçilirse aynı referred user sonraki ödemelerinde ödül üretmez.
              </span>
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-950">Snapshot mantığı</p>
              <p className="mt-1">
                Ödül oluştuğu anda yüzde, ödeme tutarı, kredi USD değeri, tier ve cap bilgisi kaydedilir. Sonradan oran değiştirmen eski ödülleri değiştirmez.
              </p>
            </div>
            <div className="grid gap-3 2xl:grid-cols-3">
              {data.settings.tiers.map((tier) => (
                <div key={tier.key} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <input name={`${tier.key}Active`} type="checkbox" defaultChecked={tier.active} />
                    {tier.name}
                  </label>
                  <input type="hidden" name={`${tier.key}Name`} defaultValue={tier.name} />
                  <div className="grid gap-2">
                    <Field compact label="%" hint="Bu tier için ödül oranı." name={`${tier.key}RewardPercent`} defaultValue={tier.rewardPercent} />
                    <Field compact label="Paid referral" hint="Bu tier'a geçmek için gereken başarılı ödeme sayısı." name={`${tier.key}RequiredPaidReferrals`} defaultValue={tier.requiredPaidReferrals} />
                    <Field compact label="Revenue şartı" hint="Bu tier'a geçmek için gereken referred revenue." name={`${tier.key}RequiredReferredRevenue`} defaultValue={tier.requiredReferredRevenue} />
                    <Field compact label="Aylık cap" hint="Bu tier için aylık maksimum kredi." name={`${tier.key}MonthlyCapCredits`} defaultValue={tier.monthlyCapCredits} />
                  </div>
                </div>
              ))}
            </div>
            <button className="h-11 rounded-md bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700">Kaydet</button>
          </form>
        </AdminSection>

        <AdminSection title="Son referral ödülleri" description="Başarılı ödeme sonrası oluşan kredi ödülleri. Tablo yatay kaydırmalı; veri geldikçe son ödüller burada görünür.">
          <AdminTable>
            <table className="min-w-[760px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr><th className="px-4 py-3">Affiliate</th><th className="px-4 py-3">Referred</th><th className="px-4 py-3">Kredi</th><th className="px-4 py-3">%</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3">Tarih</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.recentRewards.map((reward) => (
                  <tr key={reward.id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{reward.affiliateUser.email}</td>
                    <td className="px-4 py-3 text-slate-700">{reward.referredUser.email}</td>
                    <td className="px-4 py-3 font-semibold text-blue-700">+{reward.rewardCredits}</td>
                    <td className="px-4 py-3 text-slate-700">{Number(reward.rewardPercentSnapshot)}%</td>
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
        <AdminSection title="Affiliate hesapları" description="Affiliate durumunu, özel komisyonu, aylık cap limitini ve fraud notlarını yönet. Override boşsa tier/default ayarları kullanılır.">
          <div className="grid gap-4">
            {data.profiles.map((profile) => (
              <div key={profile.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr_.7fr]">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">{profile.user.email}</p>
                    <p className="mt-1 text-sm font-semibold text-blue-700">/{profile.referralCode}</p>
                    <p className="mt-2 text-xs font-bold text-slate-400">
                      {profile.totalClicks} click · {profile.totalSignups} signup · {profile.totalPaidReferrals} paid · {profile.totalRewardCredits} kredi
                    </p>
                  </div>
                  <form action={updateAffiliateProfileAction} className="grid min-w-0 gap-2 lg:grid-cols-2 2xl:grid-cols-4">
                    <input type="hidden" name="profileId" value={profile.id} />
                    <select name="status" defaultValue={profile.status} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                      <option value="ACTIVE">Aktif</option>
                      <option value="FROZEN">Dondur</option>
                      <option value="SUSPICIOUS">Şüpheli</option>
                      <option value="DISABLED">Devre dışı</option>
                    </select>
                    <input name="customRewardPercent" type="number" step="0.01" placeholder="Özel %" defaultValue={profile.customRewardPercent ? Number(profile.customRewardPercent) : ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                    <input name="customMonthlyCapCredits" type="number" placeholder="Özel aylık cap" defaultValue={profile.customMonthlyCapCredits || ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                    <input name="fraudNotes" placeholder="Fraud notu" defaultValue={profile.fraudNotes || ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                    <label className="text-xs font-semibold text-slate-600"><input name="freezeRewards" type="checkbox" defaultChecked={profile.freezeRewards} /> Ödülü dondur</label>
                    <label className="text-xs font-semibold text-slate-600"><input name="trusted" type="checkbox" defaultChecked={profile.trusted} /> Güvenilir</label>
                    <label className="text-xs font-semibold text-slate-600"><input name="suspicious" type="checkbox" defaultChecked={profile.suspicious} /> Şüpheli</label>
                    <button className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">Kaydet</button>
                  </form>
                  <form action={manualAffiliateRewardAction} className="grid min-w-0 gap-2">
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input name="amount" type="number" min="1" placeholder="Manuel kredi" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                    <input name="note" placeholder="Not" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                    <button className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">Manuel ödül</button>
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

function Field({
  label,
  name,
  defaultValue,
  step = "1",
  hint,
  compact = false
}: {
  label: string;
  name: string;
  defaultValue: string | number;
  step?: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
      {label}
      <input
        name={name}
        type="number"
        step={step}
        defaultValue={defaultValue}
        className={`w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${compact ? "py-2" : "py-3"}`}
      />
      {hint ? <span className="text-[11px] font-semibold normal-case leading-5 tracking-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}
