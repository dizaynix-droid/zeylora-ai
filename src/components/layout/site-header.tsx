import Link from "next/link";
import Image from "next/image";
import { appConfig } from "@/config/app";
import { brandIdentity } from "@/config/brand";
import { marketingNav } from "@/config/navigation";
import { SiteHeaderAuthActions } from "./site-header-auth-actions";

export function SiteHeader() {
  return (
    <header className="b2b-surface sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="section-shell flex h-16 items-center justify-between gap-3">
        <Link href="/#top" className="flex items-center gap-2 font-black tracking-tight text-slate-950">
          <Image
            src={brandIdentity.assets.mark}
            alt={`${appConfig.name} mark`}
            width={36}
            height={36}
            className="size-9 rounded-lg"
            priority
          />
          <span className="max-w-[150px] truncate sm:max-w-none">{appConfig.name}</span>
        </Link>

        <nav className="hidden items-center rounded-lg border border-slate-200 bg-slate-50 px-1 py-1 text-sm font-semibold text-slate-600 md:flex">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 transition hover:bg-white hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <SiteHeaderAuthActions />
      </div>
    </header>
  );
}
