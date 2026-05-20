import { redirect } from "next/navigation";

type ToolPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return [];
}

export function generateMetadata() {
  return {
    title: "Verification workspace",
    description: "Zeylora is now focused on email verification and list cleaning."
  };
}

export default async function LegacyToolPage({ params }: ToolPageProps) {
  await params;
  redirect("/dashboard#verify");
}
