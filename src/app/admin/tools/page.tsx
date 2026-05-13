import { AppShell } from "@/components/layout/app-shell";
import { AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminToolsData, LAUNCH_TOOL_SLUGS } from "@/lib/admin/data";
import { updateToolEconomicsAction } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminToolsPage() {
  await requireAdmin();
  const tools = await getAdminToolsData();
  const launchSlugSet = new Set<string>(LAUNCH_TOOL_SLUGS);
  const launchTools = tools.filter((tool) => launchSlugSet.has(tool.slug));
  const futureTools = tools.filter((tool) => !launchSlugSet.has(tool.slug));

  return (
    <AppShell
      area="admin"
      title="AI araç ekonomisi"
      description="Araç kredi maliyetleri, aktif/pasif durum ve provider ilişkisini buradan yönet."
    >
      <AdminSection
        title="Tool configuration"
        description="Kredi maliyeti ve durum değişiklikleri yeni job’lara etki eder. Eski job kayıtları versiyon/maliyet bilgisini korur."
      >
        <AdminTable>
          <table className="min-w-[1180px] w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Araç</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Son güncelleme</th>
                <th className="px-4 py-3">Kontrol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {launchTools.map((tool) => (
                <tr key={tool.id} className="align-middle">
                  <td className="px-4 py-3">
                    <p className="font-black text-white">{tool.name}</p>
                    <p className="text-xs text-slate-500">{tool.slug} v{tool.version}</p>
                    <div className="mt-2 flex gap-2"><AdminStatusPill tone="good">Launch tool</AdminStatusPill><ToolStatus status={tool.status} /></div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{tool.category}</td>
                  <td className="px-4 py-3 text-slate-300">{tool.providerKey}</td>
                  <td className="px-4 py-3 text-slate-300">{"_count" in tool ? tool._count.jobs : 0}</td>
                  <td className="px-4 py-3 text-slate-400">{formatAdminDate("updatedAt" in tool ? tool.updatedAt : new Date())}</td>
                  <td className="px-4 py-3">
                    <form action={updateToolEconomicsAction} className="flex items-center gap-2">
                      <input type="hidden" name="toolId" value={tool.id} />
                      <input
                        name="creditCost"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={tool.creditCost}
                        className="h-9 w-20 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                      />
                      <select
                        name="status"
                        defaultValue={tool.status}
                        className="h-9 rounded-xl border border-white/10 bg-[#101525] px-3 text-sm font-bold text-white outline-none focus:border-cyan"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="PAUSED">PAUSED</option>
                        <option value="INACTIVE">INACTIVE</option>
                        <option value="DRAFT">DRAFT</option>
                      </select>
                      <button className="h-9 rounded-full bg-zeylora-brand px-4 text-xs font-black text-white shadow-glow transition hover:brightness-110">
                        Kaydet
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>
      {futureTools.length ? (
        <div className="mt-4">
          <AdminSection title="Future tools" description="Launch dışı araçlar gizli/alt bölümde tutulur; public positioning’i karıştırmaz.">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {futureTools.map((tool) => (
                <div key={tool.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-white">{tool.name}</p>
                      <p className="text-xs text-slate-500">{tool.slug}</p>
                    </div>
                    <ToolStatus status={tool.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{tool.creditCost} credits • {tool.providerKey}</p>
                </div>
              ))}
            </div>
          </AdminSection>
        </div>
      ) : null}
    </AppShell>
  );
}

function ToolStatus({ status }: { status: string }) {
  if (status === "ACTIVE") return <AdminStatusPill tone="good">ACTIVE</AdminStatusPill>;
  if (status === "PAUSED") return <AdminStatusPill tone="warn">PAUSED</AdminStatusPill>;
  if (status === "INACTIVE") return <AdminStatusPill tone="bad">INACTIVE</AdminStatusPill>;
  return <AdminStatusPill>{status}</AdminStatusPill>;
}
