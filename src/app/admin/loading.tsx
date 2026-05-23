import { AppShell } from "@/components/layout/app-shell";

export default function AdminLoading() {
  return (
    <AppShell
      area="admin"
      title="Yönetim paneli yükleniyor"
      description="Sayfa verileri hazırlanıyor; menü ve ana iskelet beklemeden açılır."
    >
      <div className="grid gap-3 md:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="min-h-32 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-5 h-8 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-3 w-36 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
