import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { syncSupabaseUserProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
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
  searchParams?: Promise<{ authStatus?: string; authError?: string; next?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      await syncSupabaseUserProfile(user).catch(() => null);
      redirect(getSafeNextPath(params?.next));
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100vh-8rem)] bg-cinematic-depth px-3 py-8 sm:px-4 md:py-20">
        <AuthForm authStatus={params?.authStatus} authError={params?.authError} next={params?.next || "/dashboard"} />
      </main>
      <SiteFooter />
    </>
  );
}

function getSafeNextPath(next?: string) {
  if (!next?.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}
