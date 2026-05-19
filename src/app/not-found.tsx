import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { VerifyAction, VerifyBadge, VerifyPageShell } from "@/components/verify-ui/core";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <VerifyPageShell className="grid min-h-[70vh] place-items-center px-4 text-center">
        <div>
          <VerifyBadge>404</VerifyBadge>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-slate-950">Page not found</h1>
          <p className="mt-3 max-w-md text-slate-600">
            The page you requested does not exist, may have moved, or is not available publicly.
          </p>
          <VerifyAction href="/" className="mt-6">
            Back home
          </VerifyAction>
        </div>
      </VerifyPageShell>
      <SiteFooter />
    </>
  );
}
