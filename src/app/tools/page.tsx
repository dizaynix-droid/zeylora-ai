import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card } from "@/components/ui/card";
import { initialTools } from "@/config/tools";

export default function ToolsPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-premium-radial py-14">
        <section className="section-shell">
          <p className="eyebrow">AI tools</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-6xl">
            Modular photo editing tools.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Each tool is built around credit cost, provider config, fallback rules, SEO content, input rules, and versioning.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {initialTools.map((tool) => (
              <Link key={tool.slug} href={`/tools/${tool.slug}`}>
                <Card className="h-full p-5 transition hover:-translate-y-1 hover:border-cyan/40">
                  <p className="text-xs font-black uppercase text-cyan">{tool.category}</p>
                  <h2 className="mt-3 text-xl font-black text-white">{tool.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{tool.description}</p>
                  <p className="mt-5 text-sm font-black text-white">Requires {tool.creditCost} credits</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
