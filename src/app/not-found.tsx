import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="grid min-h-[70vh] place-items-center bg-premium-radial px-4 text-center">
        <div>
          <p className="eyebrow">404</p>
          <h1 className="mt-5 text-4xl font-black text-white">Page not found</h1>
          <p className="mt-3 max-w-md text-slate-300">
            The page you requested does not exist, may have moved, or is not available publicly.
          </p>
          <Button href="/" className="mt-6">
            Back home
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
