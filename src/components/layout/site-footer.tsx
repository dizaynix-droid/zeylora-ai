import Link from "next/link";
import Image from "next/image";
import { appConfig } from "@/config/app";
import { brandIdentity } from "@/config/brand";
import { marketingNav } from "@/config/navigation";
import { VerifyContainer, VerifyPanel } from "@/components/verify-ui/core";

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
    <footer className="border-t border-slate-200 bg-white">
      <VerifyContainer className="py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold text-slate-950">
              <Image
                src={brandIdentity.assets.mark}
                alt={`${appConfig.productName} mark`}
                width={36}
                height={36}
                className="size-9 rounded-lg"
              />
              {appConfig.productName}
            </Link>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-600">
              A fast email verification and list cleaning platform for reducing bounce rate, protecting sender reputation, and exporting clean segmented CSV reports.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <FooterStatus label="System status" value="Verification ready" />
              <FooterStatus label="Security" value="Private exports" />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Product</h3>
              <div className="mt-3 grid gap-2">
                {marketingNav.map((item) => (
                  <Link key={item.href} href={item.href} className="text-sm text-slate-600 transition hover:text-slate-950">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Trust</h3>
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

        <div className="mt-10 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-semibold text-slate-500">Copyright {new Date().getFullYear()} {appConfig.productName}. All rights reserved.</p>
            <p className="mt-1 text-xs text-slate-500">Verify emails before sending. Keep uploads private, downloads signed, and campaign lists under control.</p>
          </div>
          <Link href="/contact" className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
            Contact support
          </Link>
        </div>
      </VerifyContainer>
    </footer>
  );
}

function FooterStatus({ label, value }: { label: string; value: string }) {
  return (
    <VerifyPanel className="p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-950">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {value}
      </p>
    </VerifyPanel>
  );
}
