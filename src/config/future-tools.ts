import type { ToolCategory } from "@/config/tools";

export type FutureToolConfig = {
  slug: string;
  name: string;
  category: ToolCategory;
  status: "active-mvp" | "planned" | "research" | "provider-selection";
  description: string;
  reuses: string[];
};

export const futureTools: FutureToolConfig[] = [
  {
    slug: "portrait-cutout",
    name: "Portrait Cutout",
    category: "Portrait",
    status: "research",
    description: "A dedicated people cutout pipeline for hair, hands, shoes, and full-body poses.",
    reuses: ["protected uploads", "AI jobs", "provider abstraction", "R2 result storage", "dashboard history"]
  }
];
