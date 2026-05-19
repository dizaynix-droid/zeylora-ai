import { Prisma, VerificationEmailStatus } from "@prisma/client";
import { AppShell } from "@/components/layout/app-shell";
import { AdminPaginationControls, AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminEmailResultsPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = normalizePage(params?.page);
  const status = sanitizeStatus(params?.status);
  const query = params?.q?.trim() || "";
  const where: Prisma.VerificationEmailResultWhereInput = {
    ...(status ? { status } : {}),
    ...(query ? { normalizedEmail: { contains: query.toLowerCase(), mode: "insensitive" as const } } : {})
  };

  let data: {
    items: EmailResultRow[];
    total: number;
  };
  let failed = false;

  try {
    const [items, total] = await Promise.all([
      prisma.verificationEmailResult.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          email: true,
          status: true,
          reason: true,
          domain: true,
          disposable: true,
          roleBased: true,
          createdAt: true,
          verificationJob: {
            select: {
              id: true,
              originalFilename: true,
              user: { select: { email: true } }
            }
          }
        }
      }),
      prisma.verificationEmailResult.count({ where })
    ]);
    data = { items, total };
  } catch (error) {
    failed = true;
    console.error("[admin-page-failed]", {
      page: "/admin/email-results",
      widget: "email-results.table",
      error: error instanceof Error ? error.message : "Unknown email results error"
    });
    data = { items: [], total: 0 };
  }

  const pagination = {
    page,
    pageSize: PAGE_SIZE,
    total: data.total,
    totalPages: Math.max(1, Math.ceil(data.total / PAGE_SIZE)),
    from: data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
    to: Math.min(data.total, page * PAGE_SIZE),
    hasPrevious: page > 1,
    hasNext: page < Math.max(1, Math.ceil(data.total / PAGE_SIZE))
  };

  return (
    <AppShell
      area="admin"
      title="Email Results"
      description="Verification result satırlarını job detayına gitmeden hızlıca incele."
    >
      {failed ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Verification database migration may be missing. Email results tablosu güvenli modda boş gösteriliyor.
        </div>
      ) : null}

      <AdminSection title="Email result listesi" description="Varsayılan olarak son 25 email sonucu gösterilir. Tam sonuç setleri job detayında sayfalı yüklenmelidir.">
        <form className="mb-4 grid gap-2 md:grid-cols-[1fr_220px_120px]">
          <input name="q" defaultValue={query} placeholder="Email ara" className={inputClass} />
          <select name="status" defaultValue={status || ""} className={inputClass}>
            <option value="">Tüm statüler</option>
            <option value="VALID">Valid</option>
            <option value="INVALID">Invalid</option>
            <option value="RISKY">Risky</option>
            <option value="CATCH_ALL">Catch-all</option>
            <option value="DISPOSABLE">Disposable</option>
            <option value="UNKNOWN">Unknown</option>
            <option value="DUPLICATE">Duplicate</option>
          </select>
          <button className="h-10 rounded-md bg-blue-600 text-sm font-semibold text-white">Filtrele</button>
        </form>
        <div className="mb-3">
          <AdminPaginationControls basePath="/admin/email-results" params={{ q: query, status }} pagination={pagination} />
        </div>
        <AdminTable>
          <table className="min-w-[1100px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Signals</th>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.items.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-semibold text-slate-950">{row.email}</td>
                  <td className="px-4 py-3"><ResultStatus status={row.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{row.domain || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.disposable ? "Disposable " : ""}
                    {row.roleBased ? "Role-based " : ""}
                    {row.reason || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{row.verificationJob.originalFilename || row.verificationJob.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-400">{row.verificationJob.user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatAdminDate(row.createdAt)}</td>
                </tr>
              ))}
              {data.items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Henüz email result kaydı yok.</td></tr>
              ) : null}
            </tbody>
          </table>
        </AdminTable>
      </AdminSection>
    </AppShell>
  );
}

function normalizePage(value: unknown) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function sanitizeStatus(value: string | undefined) {
  const allowed = new Set(Object.values(VerificationEmailStatus));
  return value && allowed.has(value as VerificationEmailStatus) ? (value as VerificationEmailStatus) : undefined;
}

function ResultStatus({ status }: { status: string }) {
  if (status === "VALID") return <AdminStatusPill tone="good">Valid</AdminStatusPill>;
  if (status === "INVALID" || status === "DISPOSABLE") return <AdminStatusPill tone="bad">{status}</AdminStatusPill>;
  if (status === "RISKY" || status === "CATCH_ALL" || status === "UNKNOWN") return <AdminStatusPill tone="warn">{status}</AdminStatusPill>;
  return <AdminStatusPill>{status}</AdminStatusPill>;
}

const inputClass = "h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500";

type EmailResultRow = Prisma.VerificationEmailResultGetPayload<{
  select: {
    id: true;
    email: true;
    status: true;
    reason: true;
    domain: true;
    disposable: true;
    roleBased: true;
    createdAt: true;
    verificationJob: {
      select: {
        id: true;
        originalFilename: true;
        user: { select: { email: true } };
      };
    };
  };
}>;
