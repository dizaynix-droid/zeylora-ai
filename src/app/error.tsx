"use client";

import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app";

export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <header className="border-b border-white/10 bg-midnight/[0.72] backdrop-blur-2xl">
        <div className="section-shell flex h-16 items-center justify-between">
          <Link href="/" className="font-black tracking-tight text-white">
            {appConfig.name}
          </Link>
        </div>
      </header>
      <main className="grid min-h-[70vh] place-items-center bg-premium-radial px-4 text-center">
        <div>
          <p className="eyebrow">Something went wrong</p>
          <h1 className="mt-5 text-4xl font-black text-white">We could not load this page.</h1>
          <p className="mt-3 max-w-md text-slate-300">
            Please try again. If the issue continues, contact support and include the page you were trying to open.
          </p>
          <Button className="mt-6" onClick={reset}>
            Try again
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
