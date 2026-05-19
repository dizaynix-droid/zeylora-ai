import { redirect } from "next/navigation";
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

  return {
    title: tool ? `${tool.name} moved to verification workspace` : "Verification workspace",
    description: "Zeylora is now focused on email verification and list cleaning."
  };
}

export default async function LegacyToolPage({ params }: ToolPageProps) {
  await params;
  redirect("/dashboard#verify");
}
