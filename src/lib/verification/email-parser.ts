import type { ParsedEmailList } from "@/lib/verification/types";

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function parseEmailList(input: string): ParsedEmailList {
  const matches = input.match(EMAIL_REGEX) ?? [];
  const seen = new Set<string>();
  const uniqueEmails: string[] = [];
  const duplicateEmails: string[] = [];

  for (const match of matches) {
    const normalized = normalizeEmail(match);
    if (!normalized) continue;

    if (seen.has(normalized)) {
      duplicateEmails.push(normalized);
      continue;
    }

    seen.add(normalized);
    uniqueEmails.push(normalized);
  }

  return {
    totalRows: matches.length,
    uniqueEmails,
    duplicateEmails
  };
}

export function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return "";
  return normalized;
}

export function looksLikeSupportedListFile(file: File) {
  const name = file.name.toLowerCase();
  const allowedByName = name.endsWith(".csv") || name.endsWith(".txt");
  const allowedByType =
    file.type === "text/csv" ||
    file.type === "text/plain" ||
    file.type === "application/vnd.ms-excel" ||
    file.type === "";

  return allowedByName && allowedByType;
}
