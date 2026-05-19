import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getMfaRedirectPath, getSafeNextPath } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Two-Factor Authentication",
  description: "Verify your Zeylora account with an authenticator app.",
  path: "/auth/mfa",
  noIndex: true
});

export default async function MfaPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params?.next);
  const supabase = await createClient();

  if (!supabase) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  const mfaRedirectPath = await getMfaRedirectPath(nextPath);

  if (!mfaRedirectPath) {
    redirect(nextPath);
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100vh-8rem)] bg-[#f7f8fb] px-3 py-8 sm:px-4 md:py-20">
        <MfaChallengeForm next={nextPath} />
      </main>
      <SiteFooter />
    </>
  );
}
