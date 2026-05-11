import type { Metadata } from "next";
import { AuthCallback } from "@/components/auth/auth-callback";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Auth Callback",
  description: "Secure Zeylora AI authentication callback.",
  path: "/auth/callback",
  noIndex: true
});

export default function AuthCallbackPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100vh-8rem)] bg-cinematic-depth px-4 py-12 md:py-20">
        <AuthCallback />
      </main>
      <SiteFooter />
    </>
  );
}
