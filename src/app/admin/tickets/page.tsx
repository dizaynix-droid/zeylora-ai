import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill } from "@/components/admin/admin-ui";
import { adminReplyToTicketAction, adminUpdateTicketStatusAction } from "@/lib/support/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminTickets, ticketCategories, ticketStatuses } from "@/lib/support/tickets";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage({
  searchParams
}: {
  searchParams?: Promise<{ status?: string; category?: string; user?: string; saved?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const tickets = await listAdminTickets({
    status: params?.status,
    category: params?.category,
    user: params?.user
  });

  return (
    <AppShell area="admin" title="Destek talepleri" description="Kullanıcı ticketları, job/export context ve hızlı admin yanıtları.">
      {params?.saved ? <Notice tone="good">Ticket güncellendi.</Notice> : null}
      {params?.error ? <Notice tone="bad">Ticket işlemi başarısız oldu.</Notice> : null}

      <AdminSection title="Filtreler" description="Son 50 ticket gösterilir. Durum, kategori veya kullanıcı email ile filtrele.">
        <form className="grid gap-3 md:grid-cols-4">
          <select name="status" defaultValue={params?.status || ""} className="h-10 rounded-xl border border-white/10 bg-[#101525] px-3 text-sm font-bold text-white">
            <option value="">Tüm durumlar</option>
            {ticketStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <select name="category" defaultValue={params?.category || ""} className="h-10 rounded-xl border border-white/10 bg-[#101525] px-3 text-sm font-bold text-white">
            <option value="">Tüm kategoriler</option>
            {ticketCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
          <input name="user" defaultValue={params?.user || ""} placeholder="Kullanıcı email" className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white" />
          <button className="h-10 rounded-full bg-zeylora-brand text-sm font-black text-white shadow-glow">Filtrele</button>
        </form>
      </AdminSection>

      <div className="mt-5 grid gap-4">
        {tickets.length ? tickets.map((ticket) => (
          <AdminSection
            key={ticket.id}
            title={ticket.subject}
            description={`${ticket.user.email} • ${ticket.category.replaceAll("_", " ")} • Son yanıt ${formatDate(ticket.lastMessageAt)}`}
            action={<AdminStatusPill tone={ticket.status === "CLOSED" ? "neutral" : ticket.status === "ANSWERED" ? "good" : "warn"}>{ticketStatusLabel(ticket.status)}</AdminStatusPill>}
          >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-3">
                {ticket.messages.map((message) => (
                  <div key={message.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan">{message.actorType} {message.user?.email ? `• ${message.user.email}` : ""}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{message.body}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDate(message.createdAt)}</p>
                  </div>
                ))}
                <form action={adminReplyToTicketAction} className="grid gap-2">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <textarea name="message" rows={3} required placeholder="Admin yanıtı" className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-white outline-none focus:border-cyan" />
                  <button className="h-10 w-fit rounded-full border border-cyan/30 bg-cyan/10 px-4 text-sm font-black text-cyan">Admin yanıtını gönder</button>
                </form>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Bağlam</p>
                <div className="mt-3 grid gap-2 text-sm text-slate-300">
                  <p>Kullanıcı bakiyesi: <span className="font-black text-white">{ticket.user.creditBalance}</span></p>
                  {ticket.aiJob ? (
                    <>
                      <p>Job: <span className="font-mono text-xs text-white">{ticket.aiJob.id}</span></p>
                      <p>Araç: <span className="font-black text-white">{ticket.aiJob.tool.name}</span></p>
                      <p>Durum: <span className="font-black text-white">{ticket.aiJob.status}</span></p>
                      {ticket.aiJob.errorMessage ? <p className="line-clamp-3">Hata: {ticket.aiJob.errorMessage}</p> : null}
                      <Link href={`/admin/jobs?user=${encodeURIComponent(ticket.user.email)}`} className="text-cyan">İlgili işleri aç</Link>
                    </>
                  ) : <p>Bağlı job yok.</p>}
                </div>
                <form action={adminUpdateTicketStatusAction} className="mt-4 grid gap-2">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <select name="status" defaultValue={ticket.status} className="h-10 rounded-xl border border-white/10 bg-[#101525] px-3 text-sm font-bold text-white">
                    {ticketStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                  <button className="h-10 rounded-full bg-white/10 text-sm font-black text-white">Durumu güncelle</button>
                </form>
              </div>
            </div>
          </AdminSection>
        )) : (
          <AdminSection title="Ticket yok" description="Bu filtrelere uygun destek ticketı yok.">
            <p className="text-sm text-slate-400">Yeni kullanıcı ticketları burada görünecek.</p>
          </AdminSection>
        )}
      </div>
    </AppShell>
  );
}

function Notice({ children, tone }: { children: string; tone: "good" | "bad" }) {
  return <div className={`mb-5 rounded-2xl border p-4 text-sm font-bold ${tone === "good" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-rose-400/20 bg-rose-400/10 text-rose-100"}`}>{children}</div>;
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("tr-TR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function ticketStatusLabel(status: string) {
  if (status === "OPEN") return "Açık";
  if (status === "ANSWERED") return "Yanıtlandı";
  if (status === "CLOSED") return "Kapalı";
  return status;
}
