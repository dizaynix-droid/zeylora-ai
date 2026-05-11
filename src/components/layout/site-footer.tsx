import Link from "next/link";
import Image from "next/image";
import { appConfig } from "@/config/app";
import { brandIdentity } from "@/config/brand";
import { marketingNav } from "@/config/navigation";

const footerLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Contact", href: "/contact" }
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#03050D]">
      <div className="section-shell py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <Link href="/" className="flex items-center gap-2 font-black text-white">
              <Image
                src={brandIdentity.assets.mark}
                alt={`${appConfig.name} mark`}
                width={36}
                height={36}
                className="size-9 rounded-xl shadow-glow"
              />
              {appConfig.name}
            </Link>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
              A cinematic AI photo studio built for premium product edits, private uploads, watermarked free exports, provider fallback, and global SEO growth.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-black text-white">Product</h3>
              <div className="mt-3 grid gap-2">
                {marketingNav.map((item) => (
                  <Link key={item.href} href={item.href} className="text-sm text-slate-400 transition hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Trust</h3>
              <div className="mt-3 grid gap-2">
                {footerLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="text-sm text-slate-400 transition hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-3 border-t border-white/10 pt-5 text-xs font-semibold text-slate-500 sm:flex-row">
          <p>Copyright {new Date().getFullYear()} {appConfig.name}. All rights reserved.</p>
          <p>AI-generated results may vary. Clear policies and support pages are ready for production approval.</p>
        </div>
      </div>
    </footer>
  );
}
