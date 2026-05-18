import type { VerificationEmailResult, VerificationEmailStatus } from "@prisma/client";

type ExportableResult = Pick<VerificationEmailResult, "email" | "normalizedEmail" | "status" | "reason" | "domain" | "mxFound" | "disposable" | "roleBased" | "freeProvider">;

export function buildVerificationCsv(results: ExportableResult[]) {
  const header = [
    "email",
    "normalized_email",
    "status",
    "reason",
    "domain",
    "mx_found",
    "disposable",
    "role_based",
    "free_provider"
  ];

  const rows = results.map((result) => [
    result.email,
    result.normalizedEmail,
    result.status,
    result.reason ?? "",
    result.domain ?? "",
    boolToCsv(result.mxFound),
    boolToCsv(result.disposable),
    boolToCsv(result.roleBased),
    boolToCsv(result.freeProvider)
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function filterResultsForExport<T extends { status: VerificationEmailStatus }>(results: T[], type: string) {
  if (type === "valid") return results.filter((result) => result.status === "VALID");
  if (type === "invalid") return results.filter((result) => result.status === "INVALID");
  if (type === "risky") {
    return results.filter((result) => result.status === "RISKY" || result.status === "CATCH_ALL" || result.status === "DISPOSABLE" || result.status === "UNKNOWN");
  }
  return results;
}

function boolToCsv(value: boolean | null) {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
}

function escapeCsvCell(value: string) {
  const needsQuotes = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}
