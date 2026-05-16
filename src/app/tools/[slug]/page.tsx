import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { HeroUpload, type HomeToolMode } from "@/components/home/hero-upload";
import { initialTools } from "@/config/tools";

type ToolPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return initialTools.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = initialTools.find((item) => item.slug === slug);

  if (!tool) return {};

  return {
    title: `${tool.name} - AI Photo Editing Tool`,
    description: tool.description
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = initialTools.find((item) => item.slug === slug);

  if (!tool) notFound();
  const initialTool = getHomeToolMode(slug);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-premium-radial">
        <section className="border-b border-white/10 bg-[#070b16]/80 py-4 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[1580px] flex-col gap-3 px-3 sm:px-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow">{tool.category}</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white md:text-4xl">{tool.name}</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">{tool.description}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button href="/tools" variant="secondary" className="h-10 px-4 text-xs md:h-11">
                All tools
              </Button>
              <Button href="/dashboard" variant="secondary" className="h-10 px-4 text-xs md:h-11">
                Dashboard
              </Button>
            </div>
          </div>
        </section>
        <HeroUpload initialTool={initialTool} workspaceMode />
      </main>
      <SiteFooter />
    </>
  );
}

function getHomeToolMode(slug: string): HomeToolMode {
  if (slug === "ai-photo-enhancer") return "photo-enhancer";
  if (slug === "background-remover") return "background-remover";
  if (slug === "marketplace-crop") return "marketplace-crop";
  if (slug === "product-shadow") return "product-shadow";
  if (slug === "ai-relight") return "ai-relight";
  if (slug === "object-remover") return "object-remover";
  return "hd-upscale";
}
