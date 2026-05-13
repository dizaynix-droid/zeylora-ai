import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { createMetadata } from "@/lib/seo";

export const cmsPageDefinitions = [
  {
    slug: "privacy",
    label: "Privacy Policy",
    metaTitle: "Privacy Policy",
    metaDescription: "How Zeylora AI handles uploads, AI processing, private storage, providers, and account data.",
    status: "PUBLISHED"
  },
  {
    slug: "terms",
    label: "Terms of Service",
    metaTitle: "Terms of Service",
    metaDescription: "Terms for using Zeylora AI uploads, AI edits, free watermarked previews, paid credits, and clean exports.",
    status: "PUBLISHED"
  },
  {
    slug: "refund-policy",
    label: "Refund Policy",
    metaTitle: "Refund Policy",
    metaDescription: "Refund policy for Zeylora AI credit packs, paid clean exports, failed jobs, and support review.",
    status: "PUBLISHED"
  },
  {
    slug: "contact",
    label: "Contact Page",
    metaTitle: "Contact",
    metaDescription: "Contact Zeylora AI for support, privacy, refunds, provider issues, and launch questions.",
    status: "PUBLISHED"
  },
  {
    slug: "about",
    label: "About Page",
    metaTitle: "About Zeylora AI",
    metaDescription: "Learn about Zeylora AI, an ecommerce product photo editing studio for sellers and creators.",
    status: "DRAFT"
  },
  {
    slug: "faq",
    label: "FAQ Page",
    metaTitle: "Zeylora AI FAQ",
    metaDescription: "Frequently asked questions about Zeylora AI previews, credits, exports, and product photo workflows.",
    status: "DRAFT"
  }
] as const;

export type AdminCmsPageRecord = {
  id: string | null;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  bodyMarkdown: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: Date | null;
  exists: boolean;
};

export type PublishedCmsPage = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  bodyMarkdown: string;
  updatedAt: Date;
};

export async function getAdminCmsPages(): Promise<AdminCmsPageRecord[]> {
  noStore();
  const pages = await prisma.page.findMany({
    where: { deletedAt: null, language: "en" },
    orderBy: [{ slug: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      metaTitle: true,
      metaDescription: true,
      contentJson: true,
      status: true,
      updatedAt: true
    }
  });

  const bySlug = new Map(pages.map((page) => [page.slug, page]));

  return cmsPageDefinitions.map((definition) => {
    const page = bySlug.get(definition.slug);
    if (!page) {
      return {
        id: null,
        slug: definition.slug,
        title: definition.label,
        metaTitle: definition.metaTitle,
        metaDescription: definition.metaDescription,
        bodyMarkdown: getDefaultCmsBody(definition.slug),
        status: definition.status,
        updatedAt: null,
        exists: false
      };
    }

    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      bodyMarkdown: extractBodyMarkdown(page.contentJson),
      status: page.status,
      updatedAt: page.updatedAt,
      exists: true
    };
  });
}

export async function getPublishedCmsPage(slug: string): Promise<PublishedCmsPage | null> {
  noStore();
  const page = await prisma.page.findFirst({
    where: {
      slug,
      language: "en",
      status: "PUBLISHED",
      deletedAt: null
    },
    select: {
      slug: true,
      title: true,
      metaTitle: true,
      metaDescription: true,
      contentJson: true,
      updatedAt: true
    }
  });

  if (!page) return null;

  return {
    slug: page.slug,
    title: page.title,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    bodyMarkdown: extractBodyMarkdown(page.contentJson),
    updatedAt: page.updatedAt
  };
}

export async function createCmsPageMetadata({
  slug,
  fallbackTitle,
  fallbackDescription,
  path
}: {
  slug: string;
  fallbackTitle: string;
  fallbackDescription: string;
  path: string;
}): Promise<Metadata> {
  const page = await getPublishedCmsPage(slug);
  return createMetadata({
    title: page?.metaTitle || fallbackTitle,
    description: page?.metaDescription || fallbackDescription,
    path
  });
}

export function extractBodyMarkdown(contentJson: unknown) {
  if (!contentJson || typeof contentJson !== "object") return "";
  const value = (contentJson as { bodyMarkdown?: unknown }).bodyMarkdown;
  return typeof value === "string" ? value : "";
}

export function getDefaultCmsBody(slug: string) {
  const label = cmsPageDefinitions.find((page) => page.slug === slug)?.label ?? "Page";
  return `## ${label}\n\nAdd the production-ready ${label.toLowerCase()} content here.\n\n- Keep the copy clear and compliant.\n- Do not paste raw scripts into CMS page content.\n- Publish when ready.`;
}
