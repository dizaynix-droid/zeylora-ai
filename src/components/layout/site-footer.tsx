import Link from "next/link";
import Image from "next/image";
import { appConfig } from "@/config/app";
import { brandIdentity } from "@/config/brand";
import { marketingNav } from "@/config/navigation";

const footerLinks = [
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Contact", href: "/contact" },
  { label: "Support", href: "/dashboard/support" }
] as const;

export function SiteFooter() {
  return (
    <footer className="b2b-surface border-t border-slate-200 bg-white">
      <div className="section-shell py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <Link href="/" className="flex items-center gap-2 font-black text-slate-950">
              <Image
                src={brandIdentity.assets.mark}
                alt={`${appConfig.name} mark`}
                width={36}
                height={36}
                className="size-9 rounded-lg"
              />
              {appConfig.name}
            </Link>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-600">
              A fast email verification and list cleaning platform for reducing bounce rate, protecting sender reputation, and exporting clean segmented CSV reports.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-black text-slate-950">Product</h3>
              <div className="mt-3 grid gap-2">
                {marketingNav.map((item) => (
                  <Link key={item.href} href={item.href} className="text-sm text-slate-600 transition hover:text-slate-950">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-950">Trust</h3>
              <div className="mt-3 grid gap-2">
                {footerLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="text-sm text-slate-600 transition hover:text-slate-950">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-3 border-t border-slate-200 pt-5 text-xs font-semibold text-slate-500 sm:flex-row">
          <p>Copyright {new Date().getFullYear()} {appConfig.name}. All rights reserved.</p>
          <p>Verify emails before sending. Keep uploads private and downloads signed.</p>
        </div>
      </div>
    </footer>
  );
}
