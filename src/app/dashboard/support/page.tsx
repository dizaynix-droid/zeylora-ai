import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { createSupportTicketAction, replyToTicketAction } from "@/lib/support/actions";
import { getCurrentUserFromSession } from "@/lib/auth/current-user";
import { listUserTickets, ticketCategories } from "@/lib/support/tickets";

export const dynamic = "force-dynamic";

export default async function DashboardSupportPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; error?: string; jobId?: string }>;
}) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return (
      <AppShell area="dashboard" title="Support" description="Sign in to create and view support tickets.">
        <Card className="p-6">
          <Link href="/auth/sign-in?next=/dashboard/support" className="text-cyan">Sign in to continue</Link>
        </Card>
      </AppShell>
    );
  }

  const [params, tickets] = await Promise.all([searchParams, listUserTickets(user.id)]);

  return (
    <AppShell area="dashboard" title="Support tickets" description="Create a ticket, track replies, and keep support history tied to your Zeylora account.">
      {params?.saved ? <Notice tone="good">Ticket saved. We will reply here in your dashboard.</Notice> : null}
      {params?.error ? <Notice tone="bad">Ticket could not be saved. Please check the fields and try again.</Notice> : null}

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="text-xl font-black text-white">Create ticket</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">For billing, credits, clean exports, failed jobs, account access, or result quality questions.</p>
          <form action={createSupportTicketAction} className="mt-5 grid gap-3">
            <select name="category" className="h-11 rounded-xl border border-white/10 bg-[#101525] px-3 text-sm font-bold text-white outline-none focus:border-cyan">
              {ticketCategories.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
            <input name="subject" required minLength={3} maxLength={160} placeholder="Subject" className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan" />
            <input name="aiJobId" defaultValue={params?.jobId || ""} placeholder="Related job ID (optional)" className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan" />
            <textarea name="message" required minLength={5} rows={7} placeholder="Tell us what happened." className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-white outline-none focus:border-cyan" />
            <button className="h-11 rounded-full bg-zeylora-brand text-sm font-black text-white shadow-glow transition hover:brightness-110">Create ticket</button>
          </form>
        </Card>

        <div className="grid gap-4">
          {tickets.length ? tickets.map((ticket) => (
            <Card key={ticket.id} className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-white">{ticket.subject}</h3>
                    <TicketPill>{ticket.status}</TicketPill>
                    <TicketPill>{ticket.category.replaceAll("_", " ")}</TicketPill>
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-500">Last reply {formatDate(ticket.lastMessageAt)} {ticket.aiJobId ? `• Job ${ticket.aiJobId}` : ""}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {ticket.messages.map((message) => (
                  <div key={message.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan">{message.actorType}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{message.body}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDate(message.createdAt)}</p>
                  </div>
                ))}
              </div>
              {ticket.status !== "CLOSED" ? (
                <form action={replyToTicketAction} className="mt-4 grid gap-2">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <textarea name="message" rows={3} required placeholder="Reply to this ticket" className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-white outline-none focus:border-cyan" />
                  <button className="h-10 w-fit rounded-full border border-cyan/30 bg-cyan/10 px-4 text-sm font-black text-cyan transition hover:bg-cyan/15">Send reply</button>
                </form>
              ) : null}
            </Card>
          )) : (
            <Card className="p-8 text-center">
              <h2 className="text-xl font-black text-white">No tickets yet</h2>
              <p className="mt-2 text-sm text-slate-400">Create a ticket when you need help with credits, exports, jobs, or account access.</p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Notice({ children, tone }: { children: string; tone: "good" | "bad" }) {
  return <div className={`mb-5 rounded-2xl border p-4 text-sm font-bold ${tone === "good" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-rose-400/20 bg-rose-400/10 text-rose-100"}`}>{children}</div>;
}

function TicketPill({ children }: { children: string }) {
  return <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-black uppercase text-slate-200">{children}</span>;
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}
