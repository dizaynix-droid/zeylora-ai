"use client";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { VerifyAction, VerifyBadge, VerifyPageShell } from "@/components/verify-ui/core";

export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <SiteHeader />
      <VerifyPageShell className="grid min-h-[70vh] place-items-center px-4 text-center">
        <div>
          <VerifyBadge tone="red">Something went wrong</VerifyBadge>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-slate-950">We could not load this page.</h1>
          <p className="mt-3 max-w-md text-slate-600">
            Please try again. If the issue continues, contact support and include the page you were trying to open.
          </p>
          <VerifyAction className="mt-6" onClick={reset}>
            Try again
          </VerifyAction>
        </div>
      </VerifyPageShell>
      <SiteFooter />
    </>
  );
}
