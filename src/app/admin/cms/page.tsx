import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminSection, AdminStatusPill, formatAdminDate } from "@/components/admin/admin-ui";
import { upsertCmsPageAction } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminCmsPages } from "@/lib/cms/pages";

export const dynamic = "force-dynamic";

export default async function AdminCmsPage() {
  await requireAdmin();
  const pages = await getAdminCmsPages();
  const publishedCount = pages.filter((page) => page.status === "PUBLISHED").length;
  const draftCount = pages.filter((page) => page.status === "DRAFT").length;

  return (
    <AppShell area="admin" title="CMS ve legal sayfalar" description="Legal, contact, about ve FAQ içeriklerini kod değiştirmeden yönet.">
      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="CMS pages" value={pages.length} note="Legal + optional public pages" />
        <AdminMetricCard label="Published" value={publishedCount} note="Public sayfada DB içeriği görünür" />
        <AdminMetricCard label="Draft" value={draftCount} note="Draft ise public fallback kullanılır" />
      </div>

      <div className="mt-5">
        <AdminSection
          title="Editable public pages"
          description="Body alanı güvenli markdown textarea olarak saklanır. Raw script, iframe ve inline event handler içerikleri temizlenir."
        >
          <div className="grid gap-4">
            {pages.map((page) => (
              <form key={page.slug} action={upsertCmsPageAction} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <input type="hidden" name="pageId" value={page.id ?? ""} />
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-white">{page.title}</h2>
                      <PageStatus status={page.status} />
                      <AdminStatusPill tone={page.exists ? "good" : "warn"}>{page.exists ? "DB" : "fallback"}</AdminStatusPill>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      /{page.slug} • Last updated {page.updatedAt ? formatAdminDate(page.updatedAt) : "not saved yet"}
                    </p>
                  </div>
                  <button className="h-10 rounded-full bg-zeylora-brand px-5 text-sm font-black text-white shadow-glow transition hover:brightness-110">
                    Save page
                  </button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <CmsInput label="Page title" name="title" defaultValue={page.title} />
                  <CmsInput label="Slug" name="slug" defaultValue={page.slug} />
                  <CmsInput label="Meta title" name="metaTitle" defaultValue={page.metaTitle} />
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Status</span>
                    <select
                      name="status"
                      defaultValue={page.status}
                      className="h-10 rounded-xl border border-white/10 bg-[#101525] px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                    >
                      <option value="PUBLISHED">PUBLISHED</option>
                      <option value="DRAFT">DRAFT</option>
                      <option value="ARCHIVED">ARCHIVED</option>
                    </select>
                  </label>
                </div>

                <label className="mt-3 grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Meta description</span>
                  <textarea
                    name="metaDescription"
                    defaultValue={page.metaDescription}
                    rows={2}
                    className="rounded-xl border border-white/10 bg-[#080d1f] p-3 text-sm font-semibold leading-6 text-white outline-none focus:border-cyan"
                  />
                </label>

                <details className="mt-3 rounded-2xl border border-white/10 bg-black/15 p-3" open={!page.exists}>
                  <summary className="cursor-pointer text-sm font-black text-cyan">Edit page body</summary>
                  <textarea
                    name="bodyMarkdown"
                    defaultValue={page.bodyMarkdown}
                    rows={12}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-[#080d1f] p-4 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-cyan"
                    placeholder="## Section title&#10;&#10;Write clear legal copy here. Use - list items when useful."
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Supported: paragraphs, headings using ##, and bullet lists using -. HTML scripts are not allowed.
                  </p>
                </details>
              </form>
            ))}
          </div>
        </AdminSection>
      </div>
    </AppShell>
  );
}

function CmsInput({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        className="h-10 rounded-xl border border-white/10 bg-[#080d1f] px-3 text-sm font-bold text-white outline-none focus:border-cyan"
      />
    </label>
  );
}

function PageStatus({ status }: { status: string }) {
  if (status === "PUBLISHED") return <AdminStatusPill tone="good">PUBLISHED</AdminStatusPill>;
  if (status === "ARCHIVED") return <AdminStatusPill tone="neutral">ARCHIVED</AdminStatusPill>;
  return <AdminStatusPill tone="warn">DRAFT</AdminStatusPill>;
}
