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
  sections
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: LegalSection[];
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

          <Card className="mt-8 p-5 md:p-8">
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
          </Card>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
