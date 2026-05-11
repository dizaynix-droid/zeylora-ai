import Link from "next/link";
import Image from "next/image";
import { UserCircle } from "lucide-react";
import { appConfig } from "@/config/app";
import { brandIdentity } from "@/config/brand";
import { marketingNav } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentSessionUser } from "@/lib/auth/current-user";

export async function SiteHeader() {
  const user = await getCurrentSessionUser();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-midnight/[0.72] shadow-[0_10px_50px_rgba(0,0,0,.22)] backdrop-blur-2xl">
      <div className="section-shell flex h-16 items-center justify-between gap-3">
        <Link href="/#top" className="flex items-center gap-2 font-black tracking-tight text-white">
          <Image
            src={brandIdentity.assets.mark}
            alt={`${appConfig.name} mark`}
            width={36}
            height={36}
            className="size-9 rounded-xl shadow-glow"
            priority
          />
          <span className="max-w-[150px] truncate sm:max-w-none">{appConfig.name}</span>
        </Link>

        <nav className="hidden items-center rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-sm font-semibold text-slate-300 md:flex">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Button href="/dashboard" variant="ghost" className="hidden sm:inline-flex">
              Dashboard
            </Button>
          ) : (
            <Button href="/auth/sign-in" variant="ghost" className="hidden sm:inline-flex">
              Sign in
            </Button>
          )}
          <Button href="/#upload" className="px-4">
            Upload
          </Button>
          <Link
            href={user ? "/dashboard" : "/auth/sign-in"}
            className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/15 md:hidden"
            aria-label={user ? "Open dashboard" : "Sign in"}
          >
            <UserCircle size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}
