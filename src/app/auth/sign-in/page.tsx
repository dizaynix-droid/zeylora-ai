import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Sign In",
  description: "Sign in to your private Zeylora AI workspace.",
  path: "/auth/sign-in",
  noIndex: true
});

export default async function SignInPage({
  searchParams
}: {
  searchParams?: Promise<{ authStatus?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100vh-8rem)] bg-cinematic-depth px-3 py-8 sm:px-4 md:py-20">
        <AuthForm authStatus={params?.authStatus} next={params?.next || "/dashboard"} />
      </main>
      <SiteFooter />
    </>
  );
}
