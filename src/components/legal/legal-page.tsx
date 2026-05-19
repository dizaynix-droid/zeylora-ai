import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { VerifyBadge, VerifyContainer, VerifyPageShell, VerifyPanel } from "@/components/verify-ui/core";
import type { ReactNode } from "react";

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
      <VerifyPageShell className="py-12 md:py-20">
        <VerifyContainer>
          <VerifyBadge tone="blue">{eyebrow}</VerifyBadge>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
            {description}
          </p>
          {lastUpdated ? (
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Last updated {new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(lastUpdated))}
            </p>
          ) : null}

          <VerifyPanel className="mt-8 p-5 md:p-8">
            <MarkdownLegalContent content={bodyMarkdown || sectionsToMarkdown(sections ?? [])} />
          </VerifyPanel>
        </VerifyContainer>
      </VerifyPageShell>
      <SiteFooter />
    </>
  );
}

function MarkdownLegalContent({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = `h${block.level}` as "h1" | "h2" | "h3";
          return (
            <HeadingTag
              key={`${index}-${block.text}`}
              className={
                block.level === 1
                  ? "pt-1 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl"
                  : block.level === 2
                    ? "pt-2 text-xl font-semibold text-slate-950 md:text-2xl"
                    : "pt-1 text-lg font-semibold text-slate-950"
              }
            >
              {renderInlineMarkdown(block.text)}
            </HeadingTag>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={`${index}-${block.items.join("-")}`} className="grid gap-2 pl-5 text-sm leading-7 text-slate-600 md:text-base">
              {block.items.map((item) => (
                <li key={item} className="list-disc marker:text-blue-600">
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`${index}-${block.text}`} className="text-sm leading-7 text-slate-600 md:text-base md:leading-8">
            {renderInlineMarkdown(block.text)}
          </p>
        );
      })}
    </div>
  );
}

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const normalized = normalizeMarkdown(content);
  const lines = normalized.split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ type: "paragraph", text });
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length) blocks.push({ type: "list", items: listItems });
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: Math.min(heading[1].length, 3) as 1 | 2 | 3,
        text: heading[2].trim()
      });
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      flushParagraph();
      listItems.push(bullet[1].trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${match.index}-${token}`} className="font-semibold text-slate-950">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        const href = sanitizeMarkdownHref(link[2]);
        nodes.push(
          href ? (
            <a
              key={`${match.index}-${token}`}
              href={href}
              className="font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-800"
              rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              target={href.startsWith("http") ? "_blank" : undefined}
            >
              {link[1]}
            </a>
          ) : (
            link[1]
          )
        );
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function sanitizeMarkdownHref(rawHref: string) {
  const href = rawHref.trim();
  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("mailto:")) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return "";
}

function normalizeMarkdown(content: string) {
  const hasEscapedNewlines = content.includes("\\n") && !content.includes("\n");
  return (hasEscapedNewlines ? content.replace(/\\n/g, "\n") : content)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function sectionsToMarkdown(sections: LegalSection[]) {
  return sections
    .map((section) => [`## ${section.title}`, ...section.body].join("\n\n"))
    .join("\n\n");
}
