import Link from "next/link";
import type { ReactNode } from "react";
import { clsx } from "clsx";
import { Card } from "@/components/ui/card";

export function AdminMetricCard({
  label,
  value,
  note
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan">{label}</p>
      <p className="mt-2 text-2xl font-black text-white md:text-3xl">{value}</p>
      {note ? <p className="mt-1 text-xs leading-5 text-slate-400">{note}</p> : null}
    </Card>
  );
}

export function AdminSection({
  title,
  description,
  children,
  action
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-black text-white md:text-xl">{title}</h2>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function AdminStatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "good" | "bad" | "warn" | "neutral" }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em]",
        tone === "good" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
        tone === "bad" && "border-rose-400/30 bg-rose-400/10 text-rose-200",
        tone === "warn" && "border-amber-300/30 bg-amber-300/10 text-amber-100",
        tone === "neutral" && "border-white/10 bg-white/5 text-slate-300"
      )}
    >
      {children}
    </span>
  );
}

export function AdminTable({ children }: { children: ReactNode }) {
  return <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-[#080d1f]/55">{children}</div>;
}

export function AdminLinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center justify-center rounded-full border border-cyan/30 bg-cyan/10 px-4 text-sm font-black text-cyan transition hover:bg-cyan/15"
    >
      {children}
    </Link>
  );
}

export function formatAdminDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}
