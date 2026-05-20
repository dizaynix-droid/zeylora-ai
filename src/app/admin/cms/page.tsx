import { AppShell } from "@/components/layout/app-shell";
import { AdminMetricCard, AdminSection, AdminStatusPill, formatAdminDate } from "@/components/admin/admin-ui";
import { upsertCmsPageAction } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminCmsPages } from "@/lib/cms/pages";

export const dynamic = "force-dynamic";

export default async function AdminCmsPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const pages = await getAdminCmsPages();
  const publishedCount = pages.filter((page) => page.status === "PUBLISHED").length;
  const draftCount = pages.filter((page) => page.status === "DRAFT").length;

  return (
    <AppShell area="admin" title="CMS ve legal sayfalar" description="Legal, contact, about ve FAQ içeriklerini kod değiştirmeden yönet.">
      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="CMS sayfaları" value={pages.length} note="Legal + opsiyonel public sayfalar" />
        <AdminMetricCard label="Yayında" value={publishedCount} note="Public sayfada DB içeriği görünür" />
        <AdminMetricCard label="Taslak" value={draftCount} note="Taslak ise public fallback kullanılır" />
      </div>

      {params?.saved ? (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Sayfa kaydedildi: /{params.saved}. Durum Yayında ise public sayfa CMS içeriğini kullanır.
        </div>
      ) : null}

      {params?.error ? (
        <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          Sayfa kaydedilemedi. Zorunlu alanları kontrol edip tekrar deneyin.
        </div>
      ) : null}

      <div className="mt-5">
        <AdminSection
          title="Düzenlenebilir public sayfalar"
          description="Body alanı güvenli markdown textarea olarak saklanır. Raw script, iframe ve inline event handler içerikleri temizlenir."
        >
          <div className="grid gap-4">
            {pages.map((page) => (
              <form key={page.slug} action={upsertCmsPageAction} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <input type="hidden" name="pageId" value={page.id ?? ""} />
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">{page.title}</h2>
                      <PageStatus status={page.status} />
                      <AdminStatusPill tone={page.exists ? "good" : "warn"}>{page.exists ? "DB" : "fallback"}</AdminStatusPill>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      /{page.slug} • Son güncelleme {page.updatedAt ? formatAdminDate(page.updatedAt) : "henüz kaydedilmedi"}
                    </p>
                  </div>
                  <button className="h-10 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700">
                    Sayfayı kaydet
                  </button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <CmsInput label="Sayfa başlığı" name="title" defaultValue={page.title} />
                  <CmsInput label="Slug" name="slug" defaultValue={page.slug} />
                  <CmsInput label="Meta title" name="metaTitle" defaultValue={page.metaTitle} />
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Durum</span>
                    <select
                      name="status"
                      defaultValue={page.status}
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="PUBLISHED">Yayında</option>
                      <option value="DRAFT">Taslak</option>
                      <option value="ARCHIVED">Arşiv</option>
                    </select>
                  </label>
                </div>

                <label className="mt-3 grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Meta açıklama</span>
                  <textarea
                    name="metaDescription"
                    defaultValue={page.metaDescription}
                    rows={2}
                    className="rounded-md border border-slate-300 bg-white p-3 text-sm font-semibold leading-6 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3" open={!page.exists}>
                  <summary className="cursor-pointer text-sm font-semibold text-blue-700">Sayfa içeriğini düzenle</summary>
                  <textarea
                    name="bodyMarkdown"
                    id={`body-${page.slug}`}
                    defaultValue={page.bodyMarkdown}
                    rows={12}
                    className="mt-3 w-full rounded-md border border-slate-300 bg-white p-4 font-mono text-sm leading-6 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="## Bölüm başlığı&#10;&#10;Yasal metni buraya yaz. Gerekirse - liste satırları kullan."
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Desteklenen format: paragraflar, ## ile başlıklar ve - ile madde listeleri. HTML script içeriğine izin verilmez.
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
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function PageStatus({ status }: { status: string }) {
  if (status === "PUBLISHED") return <AdminStatusPill tone="good">Yayında</AdminStatusPill>;
  if (status === "ARCHIVED") return <AdminStatusPill tone="neutral">Arşiv</AdminStatusPill>;
  return <AdminStatusPill tone="warn">Taslak</AdminStatusPill>;
}
