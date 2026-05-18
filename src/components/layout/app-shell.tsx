import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Upload } from "lucide-react";
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
    <main className={`b2b-surface min-h-screen overflow-x-hidden bg-cinematic-depth ${area === "dashboard" ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0" : ""}`}>
      <div
        className={
          isAdmin
            ? "mx-auto grid w-[calc(100%-24px)] max-w-[1760px] min-w-0 gap-5 py-4 md:w-[calc(100%-32px)] md:py-6 xl:grid-cols-[250px_minmax(0,1fr)] xl:gap-6"
            : "section-shell grid gap-4 py-4 md:py-8 lg:grid-cols-[260px_1fr] lg:gap-6"
        }
      >
        <aside className={area === "dashboard"
            ? "glass-panel fixed inset-x-3 bottom-3 z-40 h-fit rounded-xl p-2 shadow-[0_16px_40px_rgba(15,23,42,.12)] lg:sticky lg:inset-auto lg:top-6 lg:p-3"
          : "glass-panel sticky top-2 z-40 h-fit w-full max-w-full min-w-0 overflow-hidden rounded-xl p-2 lg:top-6 lg:p-3"}
        >
          <Link href="/" className="hidden items-center gap-2 px-3 py-3 text-sm font-black text-slate-950 lg:flex">
            <Image
              src={brandIdentity.assets.mark}
              alt={`${appConfig.name} mark`}
              width={30}
              height={30}
              className="size-8 rounded-lg"
            />
            {appConfig.name}
          </Link>
          <nav className={area === "dashboard"
            ? "grid grid-cols-5 gap-1 overflow-x-auto lg:mt-2 lg:grid-cols-1 lg:overflow-visible"
            : "flex w-full min-w-0 max-w-full gap-1 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] lg:mt-2 lg:grid lg:grid-cols-1 lg:overflow-visible lg:pb-0"}
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isAdmin
                  ? "shrink-0 rounded-lg px-3 py-2 text-[12px] font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 lg:text-[13px] lg:font-semibold"
                  : "rounded-lg px-2 py-2 text-center text-[11px] font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 lg:px-3 lg:text-left lg:text-sm lg:font-semibold"}
                scroll
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {area === "dashboard" ? (
            <div className="mt-2 hidden rounded-xl border border-slate-200 bg-slate-50 p-3 lg:block">
              <Link
                href="/dashboard#verify"
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
              >
                <Upload className="mr-2" size={17} />
                Verify list
              </Link>
              <p className="mt-2 text-center text-xs font-semibold leading-5 text-slate-500">
                Upload CSV/TXT or paste emails
              </p>
            </div>
          ) : null}
          {area === "dashboard" ? (
            <form action="/auth/sign-out" method="post" className="mt-3 hidden border-t border-slate-200 pt-3 lg:block">
              <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-950">
                Sign out
              </button>
            </form>
          ) : null}
        </aside>

        <section className="min-w-0 overflow-hidden">
          <div className={isAdmin ? "mb-5 flex flex-col gap-3 2xl:flex-row 2xl:items-end 2xl:justify-between" : "mb-6"}>
            <div>
            <p className="eyebrow">{area === "admin" ? adminTr.shell.eyebrow : "Zeylora Workspace"}</p>
            <h1 className={isAdmin ? "mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl" : "mt-3 text-2xl font-black tracking-tight text-slate-950 md:mt-4 md:text-5xl"}>{title}</h1>
            <p className={isAdmin ? "mt-2 max-w-4xl break-words text-sm leading-6 text-slate-600 md:text-base" : "mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:mt-3 md:text-base md:leading-7"}>{description}</p>
            </div>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
