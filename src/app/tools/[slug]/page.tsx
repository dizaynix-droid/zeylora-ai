import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-premium-radial py-14">
        <section className="section-shell grid gap-8 lg:grid-cols-[1fr_420px]">
          <div>
            <p className="eyebrow">{tool.category}</p>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">{tool.name}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{tool.description}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button href="/#upload">Upload photo</Button>
              <Button href="/dashboard" variant="secondary">
                View dashboard
              </Button>
            </div>
          </div>

          <Card className="p-6">
            <h2 className="text-xl font-black text-white">Tool configuration</h2>
            <dl className="mt-5 grid gap-4 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <dt className="text-slate-400">Version</dt>
                <dd className="font-bold text-white">v{tool.version}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <dt className="text-slate-400">Credit cost</dt>
                <dd className="font-bold text-white">{tool.creditCost}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <dt className="text-slate-400">Primary provider</dt>
                <dd className="font-bold text-white">{tool.providerKey}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Fallback</dt>
                <dd className="font-bold text-white">{tool.fallbackProviderKeys.join(", ")}</dd>
              </div>
            </dl>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
