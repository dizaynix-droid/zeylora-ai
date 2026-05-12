import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { HeroUpload } from "@/components/home/hero-upload";
import { SiteFooter } from "@/components/layout/site-footer";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "AI Product Photo Editor",
  description: "Zeylora AI helps ecommerce teams turn raw product photos into premium previews and clean credit exports with private uploads, AI editing, and dashboard history.",
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
const EarlyAccess = dynamic(
  () => import("@/components/home/early-access").then((mod) => mod.EarlyAccess),
  { loading: () => <SectionSkeleton heightClass="min-h-[280px]" /> }
);
const PlatformSections = dynamic(
  () => import("@/components/home/platform-sections").then((mod) => mod.PlatformSections),
  { loading: () => <SectionSkeleton heightClass="min-h-[760px]" /> }
);

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroUpload />
        <ResultShowcase />
        <ToolGrid />
        <EarlyAccess />
        <PlatformSections />
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
