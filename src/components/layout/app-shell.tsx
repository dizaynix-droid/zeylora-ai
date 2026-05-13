import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { ImagePlus } from "lucide-react";
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
  const isAdmin = area === "admin";

  return (
    <main className="min-h-screen bg-cinematic-depth">
      <div
        className={
          isAdmin
            ? "mx-auto grid w-[min(100%-24px,1760px)] gap-5 py-4 md:w-[min(100%-32px,1760px)] md:py-6 xl:grid-cols-[250px_minmax(0,1fr)] xl:gap-6"
            : "section-shell grid gap-5 py-5 md:py-8 lg:grid-cols-[260px_1fr] lg:gap-6"
        }
      >
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
                className={isAdmin
                  ? "rounded-xl px-3 py-2 text-[13px] font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                  : "rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"}
                scroll
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {area === "dashboard" ? (
            <div className="mt-3 rounded-2xl border border-cyan/25 bg-[linear-gradient(135deg,rgba(32,211,255,.18),rgba(139,92,246,.14),rgba(255,255,255,.05))] p-3 shadow-glow">
              <Link
                href="/#upload"
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow transition hover:brightness-110"
              >
                <ImagePlus className="mr-2" size={17} />
                New Edit
              </Link>
              <p className="mt-2 text-center text-xs font-semibold leading-5 text-slate-300">
                Upload another product photo
              </p>
            </div>
          ) : null}
          {area === "dashboard" ? (
            <form action="/auth/sign-out" method="post" className="mt-3 border-t border-white/10 pt-3">
              <button className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-400 transition hover:bg-white/10 hover:text-white">
                Sign out
              </button>
            </form>
          ) : null}
        </aside>

        <section className="min-w-0">
          <div className={isAdmin ? "mb-5 flex flex-col gap-3 2xl:flex-row 2xl:items-end 2xl:justify-between" : "mb-6"}>
            <div>
            <p className="eyebrow">{area === "admin" ? adminTr.shell.eyebrow : "Zeylora Workspace"}</p>
            <h1 className={isAdmin ? "mt-3 text-3xl font-black tracking-tight text-white md:text-4xl" : "mt-4 text-3xl font-black tracking-tight text-white md:text-5xl"}>{title}</h1>
            <p className={isAdmin ? "mt-2 max-w-4xl text-sm leading-6 text-slate-300 md:text-base" : "mt-3 max-w-2xl text-base leading-7 text-slate-300"}>{description}</p>
            </div>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
