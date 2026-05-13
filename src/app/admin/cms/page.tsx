import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminMetricCard } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminCmsPage() {
  await requireAdmin();
  const [posts, pages] = await Promise.all([
    prisma.blogPost.count({ where: { deletedAt: null } }),
    prisma.page.count({ where: { deletedAt: null } })
  ]);

  return (
    <AppShell area="admin" title="İçerik ve SEO" description="Blog, statik sayfalar ve SEO yönetimi için temel modül.">
      <div className="grid gap-4 md:grid-cols-2">
        <AdminMetricCard label="Blog posts" value={posts} note="Draft/published içerikler" />
        <AdminMetricCard label="Pages" value={pages} note="Legal ve statik sayfalar" />
      </div>
      <div className="mt-5">
        <AdminSection title="CMS foundation" description="Editör UI sonraki fazda eklenecek. Şema çok dilli yapı için hazır." >
          <p className="text-sm leading-6 text-slate-400">
            BlogPost ve Page modelleri slug, meta title, meta description, dil, yayın durumu ve soft-delete alanlarıyla hazır.
          </p>
        </AdminSection>
      </div>
    </AppShell>
  );
}
