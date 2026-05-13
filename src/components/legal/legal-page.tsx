import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Card } from "@/components/ui/card";

type LegalSection = {
  title: string;
  body: string[];
};

export function LegalPage({
  eyebrow,
  title,
  description,
  sections,
  bodyMarkdown,
  lastUpdated
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections?: LegalSection[];
  bodyMarkdown?: string;
  lastUpdated?: Date | string | null;
}) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-premium-radial py-12 md:py-20">
        <section className="section-shell">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
            {description}
          </p>
          {lastUpdated ? (
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Last updated {new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(lastUpdated))}
            </p>
          ) : null}

          <Card className="mt-8 p-5 md:p-8">
            {bodyMarkdown ? <MarkdownLegalContent content={bodyMarkdown} /> : <StaticLegalSections sections={sections ?? []} />}
          </Card>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function StaticLegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="grid gap-8">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-xl font-black text-white">{section.title}</h2>
          <div className="mt-3 grid gap-3">
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-7 text-slate-300">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MarkdownLegalContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return (
    <div className="grid gap-6">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return <h2 key={`${index}-${block}`} className="text-xl font-black text-white">{block.replace(/^##\s+/, "")}</h2>;
        }

        if (block.startsWith("- ")) {
          return (
            <ul key={`${index}-${block}`} className="grid gap-2 pl-5 text-sm leading-7 text-slate-300">
              {block.split("\n").map((item) => (
                <li key={item} className="list-disc">{item.replace(/^-\s+/, "")}</li>
              ))}
            </ul>
          );
        }

        return <p key={`${index}-${block}`} className="text-sm leading-7 text-slate-300">{block}</p>;
      })}
    </div>
  );
}
