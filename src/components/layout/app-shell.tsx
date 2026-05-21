import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Menu, Upload } from "lucide-react";
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
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#f7f8fb] text-slate-950">
      <div className="w-full max-w-full overflow-x-hidden border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-[1760px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-950">
            <Image
              src={brandIdentity.assets.mark}
              alt={`${appConfig.productName} mark`}
              width={28}
              height={28}
              className="size-7 rounded-md"
            />
            <span className="truncate">{appConfig.productName}</span>
          </Link>
          <div className="flex items-center gap-2">
            {area === "dashboard" ? (
              <Link href="/dashboard#verify" className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
                <Upload size={16} />
                Verify list
              </Link>
            ) : null}
            <Link href="/" className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Site
            </Link>
          </div>
        </div>
      </div>

      <div
        className={
          isAdmin
            ? "mx-auto grid w-full max-w-[1760px] overflow-x-hidden gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[248px_minmax(0,1fr)]"
            : "mx-auto grid w-full max-w-[1760px] overflow-x-hidden gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[248px_minmax(0,1fr)] xl:py-8"
        }
      >
        <aside className="hidden min-w-0 xl:block">
          <div className="sticky top-5 rounded-lg border border-slate-200 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              {area === "admin" ? "Yönetim" : "Workspace"}
            </p>
            <nav className="grid gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                  scroll
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {area === "dashboard" ? (
              <>
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <Link
                    href="/dashboard#verify"
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Upload size={17} />
                    Verify list
                  </Link>
                  <p className="mt-2 text-center text-xs leading-5 text-slate-500">Upload CSV/TXT or paste emails.</p>
                </div>
                <form action="/auth/sign-out" method="post" className="mt-3 border-t border-slate-200 pt-3">
                  <button className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-950">
                    Sign out
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </aside>

        <section className="verify-workspace min-w-0 max-w-full overflow-x-hidden">
          <details className="mb-4 rounded-lg border border-slate-200 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,.04)] xl:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-950">
              <span className="inline-flex items-center gap-2">
                <Menu size={17} />
                {area === "admin" ? "Yönetim menüsü" : "Workspace menu"}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">
                {area === "admin" ? "Aç / kapa" : "Open / close"}
              </span>
            </summary>
            <nav className="mt-2 grid gap-1 border-t border-slate-200 pt-2 sm:grid-cols-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                  scroll
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {area === "dashboard" ? (
              <form action="/auth/sign-out" method="post" className="mt-2 border-t border-slate-200 pt-2">
                <button className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-950">
                  Sign out
                </button>
              </form>
            ) : null}
          </details>
          <div className="mb-5">
            <p className="text-sm font-semibold text-blue-700">{area === "admin" ? adminTr.shell.eyebrow : "Zeylora Workspace"}</p>
            <h1 className={isAdmin ? "mt-2 break-words text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-4xl" : "mt-2 break-words text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-5xl"}>
              {title}
            </h1>
            <p className="mt-2 max-w-4xl break-words text-sm leading-6 text-slate-600 md:text-base">{description}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
