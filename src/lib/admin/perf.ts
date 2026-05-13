type AdminPerfValue = string | number | boolean | null | undefined;

export function isAdminPerfEnabled() {
  return process.env.ADMIN_PERF_LOGS === "true";
}

export function adminPerfNow() {
  return Date.now();
}

export function logAdminPerf(label: string, details: Record<string, AdminPerfValue> = {}) {
  if (!isAdminPerfEnabled()) return;

  const detailText = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${formatAdminPerfValue(value)}`)
    .join(" ");

  console.info(`[admin-perf] ${label}${detailText ? ` ${detailText}` : ""}`);
}

export async function measureAdminQuery<T>(
  label: string,
  promise: Promise<T>,
  details: Record<string, AdminPerfValue> = {}
) {
  const startedAt = adminPerfNow();

  try {
    const result = await promise;
    logAdminPerf(label, {
      duration: `${adminPerfNow() - startedAt}ms`,
      ...details
    });
    return result;
  } catch (error) {
    logAdminPerf(label, {
      duration: `${adminPerfNow() - startedAt}ms`,
      status: "error",
      error: error instanceof Error ? error.name : "UnknownError",
      ...details
    });
    throw error;
  }
}

function formatAdminPerfValue(value: AdminPerfValue) {
  if (typeof value === "string") {
    const safe = value.replace(/\s+/g, "_").slice(0, 80);
    return safe || "-";
  }

  return String(value);
}
