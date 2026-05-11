import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { appConfig } from "@/config/app";
import { brandIdentity } from "@/config/brand";
import { adminNav, dashboardNav } from "@/config/navigation";
import { adminTr } from "@/i18n/admin/tr";

type AppShellProps = {
  title: string;
  description: string;
  area: "dashboard" | "admin";
  children: ReactNode;
};

export function AppShell({ title, description, area, children }: AppShellProps) {
  const nav = area === "admin" ? adminNav : dashboardNav;

  return (
    <main className="min-h-screen bg-cinematic-depth">
      <div className="section-shell grid gap-5 py-5 md:py-8 lg:grid-cols-[260px_1fr] lg:gap-6">
        <aside className="glass-panel h-fit rounded-2xl p-3 lg:sticky lg:top-6">
          <Link href="/" className="flex items-center gap-2 px-3 py-3 text-sm font-black text-white">
            <Image
              src={brandIdentity.assets.mark}
              alt={`${appConfig.name} mark`}
              width={30}
              height={30}
              className="size-8 rounded-lg shadow-glow"
            />
            {appConfig.name}
          </Link>
          <nav className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                scroll
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {area === "dashboard" ? (
            <form action="/auth/sign-out" method="post" className="mt-3 border-t border-white/10 pt-3">
              <button className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-400 transition hover:bg-white/10 hover:text-white">
                Sign out
              </button>
            </form>
          ) : null}
        </aside>

        <section>
          <div className="mb-6">
            <p className="eyebrow">{area === "admin" ? adminTr.shell.eyebrow : "Zeylora Workspace"}</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">{description}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
