import { AppShell } from "@/components/layout/app-shell";
import { AdminPaginationControls, AdminSection, AdminStatusPill, AdminTable, formatAdminDate } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminUsersData, normalizeAdminPage } from "@/lib/admin/data";
import { adjustUserCreditsAction } from "@/lib/admin/actions";
import { adminPerfNow, logAdminPerf } from "@/lib/admin/perf";
import { prisma } from "@/lib/db";
import { CreditAdjustSubmit } from "./credit-adjust-submit";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; filter?: string; page?: string; saved?: string; error?: string; amount?: string; balance?: string; email?: string; userId?: string }>;
}) {
  const pageStartedAt = adminPerfNow();
  const authStartedAt = adminPerfNow();
  await requireAdmin();
  const authMs = adminPerfNow() - authStartedAt;
  const params = await searchParams;
  const filter = params?.filter === "with-credits" || params?.filter === "with-jobs" || params?.filter === "recent"
    ? params.filter
    : "all";
  const query = params?.q || "";
  const page = normalizeAdminPage(params?.page);
  const returnTo = buildAdminUsersReturnPath({ q: query, filter, page });
  const savedAmount = Number(params?.amount || 0);
  const savedBalance = Number(params?.balance || 0);
  const savedEmail = params?.email || "";
  const highlightedUserId = params?.userId || "";
  const dataStartedAt = adminPerfNow();
  const { data, error: usersLoadError } = await getSafeAdminUsersData({ query, filter, page });
  const users = data.items;
  logAdminPerf("page./admin/users [admin-users-perf]", {
    authMs: `${authMs}ms`,
    dataMs: `${adminPerfNow() - dataStartedAt}ms`,
    totalMs: `${adminPerfNow() - pageStartedAt}ms`,
    page,
    filter,
    hasQuery: Boolean(query),
    resultCount: users.length
  });

  return (
    <AppShell
      area="admin"
      title="Kullanıcı yönetimi"
      description="Kullanıcıları, kredi bakiyelerini ve son işlem özetlerini güvenli şekilde takip et."
    >
      {params?.saved === "credits" ? (
        <div className="mb-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-[0_10px_30px_rgba(16,185,129,.10)]">
          <p className="text-base font-black">Kredi işlemi kaydedildi.</p>
          <p className="mt-1">
            {savedEmail ? `${savedEmail} için ` : ""}
            {Number.isFinite(savedAmount) && savedAmount !== 0 ? `${savedAmount > 0 ? "+" : ""}${savedAmount.toLocaleString("tr-TR")} kredi işlendi. ` : ""}
            {Number.isFinite(savedBalance) && savedBalance > 0 ? `Yeni bakiye: ${savedBalance.toLocaleString("tr-TR")}.` : "Kredi bakiyesi ve işlem geçmişi güncellendi."}
          </p>
        </div>
      ) : null}
      {params?.error ? (
        <div className="mb-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          Kredi işlemi kaydedilemedi. Tutarı ve kullanıcıyı kontrol edip tekrar dene.
        </div>
      ) : null}
      {usersLoadError ? (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Kullanıcı tablosu güvenli modda açıldı. Verification database migration eksik olabilir. System Health veya Logs ekranından detay kontrol edebilirsin.
        </div>
      ) : null}
      <AdminSection
        title="Kullanıcılar"
        description="Manuel kredi ekleme/çıkarma işlemleri audit log ve credit transaction olarak kaydedilir."
      >
        <form className="mb-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center">
          <input
            name="q"
            defaultValue={query}
            placeholder="Email veya isim ara"
            className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
          <select
            name="filter"
            defaultValue={filter}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">Tüm kullanıcılar</option>
            <option value="with-credits">Kredisi olanlar</option>
            <option value="with-jobs">İşlemi olanlar</option>
            <option value="recent">Yeni kayıtlar</option>
          </select>
          <button className="h-10 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700">
            Filtrele
          </button>
        </form>
        <div className="mb-3">
          <AdminPaginationControls
            basePath="/admin/users"
            params={{ q: query, filter }}
            pagination={data.pagination}
          />
        </div>
        <AdminTable>
          <table className="min-w-[1380px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Kayıt ülkesi</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Kredi</th>
                <th className="px-4 py-3">Son doğrulama</th>
                <th className="px-4 py-3">Son paid tutarı</th>
                <th className="px-4 py-3">Son ödeme durumu</th>
                <th className="px-4 py-3">Kayıt</th>
                <th className="px-4 py-3">Kredi düzenle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((user) => (
                <tr key={user.id} className={`align-top transition ${highlightedUserId === user.id ? "bg-emerald-50/80 ring-2 ring-inset ring-emerald-200" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-950">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.name || "İsim yok"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-950">{formatCountry(user.signupCountry)}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.signupCountry || "Veri yok"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusPill tone={user.role === "ADMIN" ? "good" : "neutral"}>{user.role}</AdminStatusPill>
                    <p className="mt-2 text-xs text-slate-500">{user.status}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-2xl font-semibold text-slate-950">{user.creditBalance}</p>
                    {highlightedUserId === user.id && params?.saved === "credits" ? (
                      <p className="mt-1 text-xs font-black text-emerald-700">Son kredi işlemi kaydedildi</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <p className="text-xs text-slate-500">
                      {user.lastVerificationJob
                        ? `${user.lastVerificationJob.status} · ${user.lastVerificationJob.uniqueEmails.toLocaleString()} email`
                        : "Henüz doğrulama yok"}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {user.lastPayment?.status === "PAID" ? `$${user.totalSpend.toFixed(2)}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {user.lastPayment ? (
                      <>
                        <p>{Number(user.lastPayment.amount).toFixed(2)} {user.lastPayment.currency.toUpperCase()}</p>
                        <p className="text-xs text-slate-500">{user.lastPayment.status} · {formatAdminDate(user.lastPayment.createdAt)}</p>
                      </>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatAdminDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <form action={adjustUserCreditsAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      {[10, 25, 50, -10].map((amount) => (
                        <button
                          key={amount}
                          name="amount"
                          value={amount}
                          className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {amount > 0 ? `+${amount}` : amount}
                        </button>
                      ))}
                      <input
                        name="amount"
                        type="number"
                        step="1"
                        placeholder="+10 / -5"
                        className="h-9 w-24 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                      <input
                        name="note"
                        placeholder="Not opsiyonel"
                        className="h-9 w-40 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                      <CreditAdjustSubmit />
                    </form>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Filtreye uygun kullanıcı yok.</td></tr>
              ) : null}
            </tbody>
          </table>
        </AdminTable>
        <div className="mt-3">
          <AdminPaginationControls
            basePath="/admin/users"
            params={{ q: query, filter }}
            pagination={data.pagination}
          />
        </div>
      </AdminSection>
    </AppShell>
  );
}

async function getSafeAdminUsersData(input: Parameters<typeof getAdminUsersData>[0]) {
  try {
    return { data: await getAdminUsersData(input), error: null };
  } catch (error) {
    console.error("[admin-page-failed]", {
      page: "/admin/users",
      widget: "users.table",
      error: error instanceof Error ? error.message : "Unknown admin users error"
    });
    const page = normalizeAdminPage(input?.page);
    const pageSize = 25;
    const query = input?.query?.trim();
    const where = {
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" as const } },
              { name: { contains: query, mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          creditBalance: true,
          createdAt: true
        }
      }),
      prisma.user.count({ where })
    ]).catch((fallbackError) => {
      console.error("[admin-page-failed]", {
        page: "/admin/users",
        widget: "users.minimal-table",
        error: fallbackError instanceof Error ? fallbackError.message : "Unknown minimal users error"
      });
      return [[], 0] as const;
    });
    return {
      data: {
        items: users.map((user) => ({
          ...user,
          signupCountry: null,
          _count: { verificationJobs: 0, creditTransactions: 0, payments: 0 },
          payments: [],
          verificationJobs: [],
          totalSpend: 0,
          lastPayment: null,
          lastVerificationJob: null
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          from: total === 0 ? 0 : (page - 1) * pageSize + 1,
          to: Math.min(total, page * pageSize),
          hasPrevious: page > 1,
          hasNext: page < Math.max(1, Math.ceil(total / pageSize))
        }
      },
      error
    };
  }
}

function buildAdminUsersReturnPath(input: { q: string; filter: string; page: number }) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.filter && input.filter !== "all") params.set("filter", input.filter);
  if (input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

function formatCountry(countryCode: string | null) {
  if (!countryCode) return "-";
  try {
    return new Intl.DisplayNames(["tr-TR"], { type: "region" }).of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
}
