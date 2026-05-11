import type { Metadata } from "next";
import { appConfig } from "@/config/app";

type SeoInput = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
};

export function createMetadata(input: SeoInput = {}): Metadata {
  const title = input.title ? `${input.title} | ${appConfig.name}` : appConfig.name;
  const description = input.description || appConfig.description;
  const url = new URL(input.path || "/", appConfig.url).toString();

  return {
    title,
    description,
    alternates: {
      canonical: url
    },
    robots: input.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      url,
      siteName: appConfig.name,
      type: "website",
      images: input.image ? [{ url: input.image }] : undefined
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: input.image ? [input.image] : undefined
    },
    icons: {
      icon: "/brand/zeylora-favicon.svg",
      shortcut: "/brand/zeylora-favicon.svg",
      apple: "/brand/zeylora-mark.svg"
    }
  };
}
