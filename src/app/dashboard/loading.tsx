import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <AppShell
      area="dashboard"
      title="Product photo workspace"
      description="Loading your recent edits and secure previews."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="p-5">
            <div className="h-6 w-6 animate-pulse rounded-lg bg-white/10" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded-lg bg-white/10" />
            <div className="mt-3 h-4 w-28 animate-pulse rounded-lg bg-white/10" />
          </Card>
        ))}
      </div>

      <Card className="mt-5 p-6">
        <div className="h-16 animate-pulse rounded-2xl bg-white/10" />
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="h-6 w-40 animate-pulse rounded-lg bg-white/10" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded-lg bg-white/10" />
          </div>
          <div className="h-7 w-40 animate-pulse rounded-full bg-white/10" />
        </div>
        <div className="mt-5 flex gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-9 w-24 animate-pulse rounded-full bg-white/10" />
          ))}
        </div>
        <div className="mt-5 grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 lg:grid-cols-[260px_1fr_auto] lg:items-center">
              <div className="grid grid-cols-2 gap-2">
                <div className="aspect-[4/3] animate-pulse rounded-xl bg-white/10" />
                <div className="aspect-[4/3] animate-pulse rounded-xl bg-white/10" />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-28 animate-pulse rounded-lg bg-white/10" />
                <div className="h-6 w-44 animate-pulse rounded-lg bg-white/10" />
                <div className="h-4 w-64 max-w-full animate-pulse rounded-lg bg-white/10" />
              </div>
              <div className="h-10 w-32 animate-pulse rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="h-4 w-32 animate-pulse rounded-lg bg-cyan/20" />
            <div className="h-6 w-44 animate-pulse rounded-lg bg-white/10" />
            <div className="h-4 w-96 max-w-full animate-pulse rounded-lg bg-white/10" />
          </div>
          <div className="h-20 w-32 animate-pulse rounded-2xl bg-cyan/10" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/10" />
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
