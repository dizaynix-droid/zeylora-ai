import type { ParsedEmailList } from "@/lib/verification/types";

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const STRICT_EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const EMAIL_TOKEN_SPLIT_REGEX = /[\s,;"'<>()[\]{}]+/g;
const MAX_INVALID_SYNTAX_SAMPLES = 25;

export function parseEmailList(input: string): ParsedEmailList {
  const matches = input.match(EMAIL_REGEX) ?? [];
  const candidates = input.split(EMAIL_TOKEN_SPLIT_REGEX).filter((token) => token.includes("@"));
  const seen = new Set<string>();
  const uniqueEmails: string[] = [];
  const duplicateEmails: string[] = [];
  const invalidSyntaxSamples: string[] = [];
  let syntaxInvalidCount = 0;

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

  for (const candidate of candidates) {
    const normalized = normalizeEmail(candidate);
    if (!normalized || STRICT_EMAIL_REGEX.test(normalized)) continue;
    syntaxInvalidCount += 1;
    if (invalidSyntaxSamples.length < MAX_INVALID_SYNTAX_SAMPLES) {
      invalidSyntaxSamples.push(candidate.slice(0, 160));
    }
  }

  return {
    totalRows: matches.length + syntaxInvalidCount,
    syntaxInvalidCount,
    uniqueEmails,
    duplicateEmails,
    invalidSyntaxSamples
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
    file.type === "application/octet-stream" ||
    file.type === "";

  return allowedByName && allowedByType;
}
