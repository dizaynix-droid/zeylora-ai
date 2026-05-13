import { AppShell } from "@/components/layout/app-shell";
import { AdminSection } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requireAdmin();

  return (
    <AppShell area="admin" title="Ödeme hazırlığı" description="Stripe checkout, webhook ve kredi teslimatı için operasyon temeli.">
      <AdminSection title="Payment foundation" description="Checkout endpoint ve webhook skeleton hazır; production activation öncesi bu ekran payment review tablosuna dönüşecek.">
        <div className="grid gap-3 md:grid-cols-3">
          <Info title="Checkout" text="Credit pack checkout Stripe ile bağlanacak." />
          <Info title="Webhook" text="Ödeme başarılı olduğunda kredi teslimatı bu katmana bağlanacak." />
          <Info title="Refund" text="İade takibi ödeme ve kredi transaction kayıtlarıyla eşleşecek." />
        </div>
      </AdminSection>
    </AppShell>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}
