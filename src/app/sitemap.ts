import type { MetadataRoute } from "next";
import { appConfig } from "@/config/app";
import { initialTools } from "@/config/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/pricing", "/tools", "/about", "/faq", "/contact", "/privacy", "/terms", "/refund-policy"];
  const now = new Date();

  return [
    ...staticRoutes.map((route) => ({
      url: `${appConfig.url}${route}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.7
    })),
    ...initialTools.map((tool) => ({
      url: `${appConfig.url}/tools/${tool.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.85
    }))
  ];
}
