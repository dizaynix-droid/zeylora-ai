import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { appConfig } from "@/config/app";
import { brandIdentity } from "@/config/brand";
import { marketingNav } from "@/config/navigation";
import { VerifyContainer } from "@/components/verify-ui/core";
import { SiteHeaderAuthActions } from "./site-header-auth-actions";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,.04)] backdrop-blur">
      <VerifyContainer className="flex h-16 items-center justify-between gap-3">
        <Link href="/#top" className="flex items-center gap-2 font-semibold tracking-tight text-slate-950">
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

        <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 lg:flex">
          <ShieldCheck size={14} />
          Private list checks
        </div>

        <nav className="hidden items-center rounded-full border border-slate-200 bg-slate-50 p-1 text-sm font-medium text-slate-600 md:flex">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950 hover:shadow-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <SiteHeaderAuthActions />
      </VerifyContainer>
    </header>
  );
}
