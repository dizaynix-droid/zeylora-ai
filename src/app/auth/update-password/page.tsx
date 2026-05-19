import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Update Password",
  description: "Update your Zeylora account password.",
  path: "/auth/update-password",
  noIndex: true
});

export default async function UpdatePasswordPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100vh-8rem)] bg-[#f7f8fb] px-3 py-8 sm:px-4 md:py-20">
        <UpdatePasswordForm next={getSafeNextPath(params?.next)} />
      </main>
      <SiteFooter />
    </>
  );
}

function getSafeNextPath(next?: string) {
  if (!next?.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}
