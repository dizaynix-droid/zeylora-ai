import Link from "next/link";
import type { ReactNode } from "react";
import { clsx } from "clsx";
import { VerifyPanel, VerifyTable } from "@/components/verify-ui/core";

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
    <VerifyPanel className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-950 md:text-3xl">{value}</p>
      {note ? <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p> : null}
    </VerifyPanel>
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
    <VerifyPanel className="p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 md:text-xl">{title}</h2>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </VerifyPanel>
  );
}

export function AdminStatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "good" | "bad" | "warn" | "neutral" }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold",
        tone === "good" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "bad" && "border-rose-200 bg-rose-50 text-rose-700",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-700",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-600"
      )}
    >
      {children}
    </span>
  );
}

export function AdminTable({ children }: { children: ReactNode }) {
  return <VerifyTable>{children}</VerifyTable>;
}

export function AdminLinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
    >
      {children}
    </Link>
  );
}

export function AdminPaginationControls({
  pagination,
  basePath,
  params = {}
}: {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
  basePath: string;
  params?: Record<string, string | number | null | undefined>;
}) {
  const makeHref = (page: number) => {
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === null || value === undefined || String(value).trim() === "") continue;
      search.set(key, String(value));
    }

    if (page > 1) search.set("page", String(page));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const previousPage = Math.max(1, pagination.page - 1);
  const nextPage = Math.min(pagination.totalPages, pagination.page + 1);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
      <p className="font-bold">
        Gösteriliyor{" "}
        <span className="text-slate-950">
          {pagination.from}-{pagination.to}
        </span>{" "}
        / <span className="text-slate-950">{pagination.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={makeHref(previousPage)}
          aria-disabled={!pagination.hasPrevious}
          className={clsx(
            "inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50",
            !pagination.hasPrevious && "pointer-events-none opacity-40"
          )}
        >
          Önceki
        </Link>
        <span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
          Sayfa {pagination.page} / {pagination.totalPages}
        </span>
        <Link
          href={makeHref(nextPage)}
          aria-disabled={!pagination.hasNext}
          className={clsx(
            "inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50",
            !pagination.hasNext && "pointer-events-none opacity-40"
          )}
        >
          Sonraki
        </Link>
      </div>
    </div>
  );
}

export function formatAdminDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}
