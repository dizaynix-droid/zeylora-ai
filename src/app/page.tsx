import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { HeroUpload } from "@/components/home/hero-upload";
import { SiteFooter } from "@/components/layout/site-footer";
import { getCreditPackagesForDisplay } from "@/lib/pricing/packages";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "AI Product Photo Editor for Ecommerce Sellers",
  description: "Zeylora AI is an ecommerce product studio for HD upscaling, AI relighting, photo enhancement, marketplace crops, cutouts, and seller-ready product visuals.",
  path: "/"
});

const ResultShowcase = dynamic(
  () => import("@/components/showcase/result-showcase").then((mod) => mod.ResultShowcase),
  { loading: () => <SectionSkeleton heightClass="min-h-[520px]" /> }
);
const ToolGrid = dynamic(
  () => import("@/components/home/tool-grid").then((mod) => mod.ToolGrid),
  { loading: () => <SectionSkeleton heightClass="min-h-[420px]" /> }
);
const PlatformSections = dynamic(
  () => import("@/components/home/platform-sections").then((mod) => mod.PlatformSections),
  { loading: () => <SectionSkeleton heightClass="min-h-[760px]" /> }
);

export default async function HomePage() {
  const creditPackages = await getCreditPackagesForDisplay();
  const trialPack = creditPackages.find((pack) => pack.key === "starter-trial") ?? creditPackages[0];

  return (
    <>
      <SiteHeader />
      <main>
        <HeroUpload
          trialCredits={trialPack?.totalCredits ?? 15}
          trialPrice={trialPack?.price ?? 7.99}
        />
        <ResultShowcase />
        <PlatformSections />
        <ToolGrid />
      </main>
      <SiteFooter />
    </>
  );
}

function SectionSkeleton({ heightClass }: { heightClass: string }) {
  return (
    <section className="section-shell py-10 md:py-14">
      <div className={`${heightClass} animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.035]`} />
    </section>
  );
}
