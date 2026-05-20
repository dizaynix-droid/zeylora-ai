import type { VerificationEmailStatus } from "@prisma/client";
import type {
  VerificationBulkInfoResult,
  VerificationBulkUploadResult,
  VerificationProvider,
  VerificationProviderResult
} from "@/lib/verification/types";

const DEFAULT_BASE_URL = "https://api.millionverifier.com/api/v3";
const DEFAULT_BULK_BASE_URL = "https://bulkapi.millionverifier.com/bulkapi/v2";

type MillionVerifierResponse = {
  email?: string;
  result?: string;
  status?: string;
  subresult?: string;
  reason?: string;
  disposable?: boolean;
  catch_all?: boolean;
  catchall?: boolean;
  free?: boolean;
  role?: boolean;
  mx?: boolean;
  [key: string]: unknown;
};

type MillionVerifierBulkResponse = {
  file_id?: string | number;
  file_name?: string;
  status?: string;
  unique_emails?: number | string;
  percent?: number | string;
  total_rows?: number | string;
  verified?: number | string;
  unverified?: number | string;
  ok?: number | string;
  catch_all?: number | string;
  disposable?: number | string;
  invalid?: number | string;
  unknown?: number | string;
  reverify?: number | string;
  credit?: number | string;
  estimated_time_sec?: number | string;
  error?: string;
  [key: string]: unknown;
};

export type MillionVerifierProviderOptions = {
  apiKey?: string | null;
  baseUrl?: string | null;
};

export function createMillionVerifierProvider(options: MillionVerifierProviderOptions = {}): VerificationProvider {
  return {
    key: "millionverifier",
    async verifyBatch(emails: string[]) {
      const apiKey = process.env.MILLIONVERIFIER_API_KEY || options.apiKey;
      const baseUrl = (options.baseUrl || process.env.MILLIONVERIFIER_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
      if (!apiKey) {
        throw new Error("MillionVerifier API key is not configured.");
      }

      const results: VerificationProviderResult[] = [];

      for (const email of emails) {
        const url = new URL(baseUrl);
        url.searchParams.set("api", apiKey);
        url.searchParams.set("email", email);
        url.searchParams.set("timeout", "10");

        console.info("[verification-provider-request]", {
          provider: "millionverifier",
          domain: getEmailDomain(email),
          baseUrl: url.origin + url.pathname,
          timeoutSeconds: 10,
          apiKeyPresent: true
        });

        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(18_000)
        });

        const responseBody = await response.text().catch(() => "");
        const json = parseMillionVerifierResponse(responseBody);

        if (!response.ok) {
          console.error("[verification-provider-response-failed]", {
            provider: "millionverifier",
            domain: getEmailDomain(email),
            httpStatus: response.status,
            body: sanitizeProviderLogBody(responseBody)
          });
          throw new Error(`MillionVerifier failed with HTTP ${response.status}.`);
        }

        console.info("[verification-provider-response]", {
          provider: "millionverifier",
          domain: getEmailDomain(email),
          httpStatus: response.status,
          result: String(json.result || json.status || ""),
          subresult: String(json.subresult || json.reason || ""),
          body: sanitizeProviderLogBody(json)
        });
        results.push({
          email,
          status: mapMillionVerifierStatus(json),
          reason: String(json.subresult || json.reason || json.result || json.status || ""),
          raw: sanitizeProviderPayload(json)
        });
      }

      return results;
    },
    async uploadBulkFile(input: { fileName: string; emails: string[] }) {
      const apiKey = getMillionVerifierApiKey(options);
      const url = buildMillionVerifierBulkUrl("upload", apiKey);
      const csv = input.emails.map(escapeBulkCsvCell).join("\n");
      const formData = new FormData();
      formData.set(
        "file_contents",
        new Blob([csv], { type: "text/csv; charset=utf-8" }),
        sanitizeBulkFileName(input.fileName)
      );

      console.info("[verification-provider-bulk-upload-request]", {
        provider: "millionverifier",
        emailCount: input.emails.length,
        fileName: sanitizeBulkFileName(input.fileName)
      });

      const json = await fetchMillionVerifierBulkJson(url, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(Number(process.env.MILLIONVERIFIER_BULK_UPLOAD_TIMEOUT_MS || 60_000))
      });
      const result = toBulkUploadResult(json);

      console.info("[verification-provider-bulk-upload-response]", {
        provider: "millionverifier",
        fileId: result.providerFileId,
        status: result.providerStatus,
        percent: result.percent,
        uniqueEmails: result.uniqueEmails,
        estimatedTimeSec: result.estimatedTimeSec
      });

      return result;
    },
    async getBulkFileInfo(providerFileId: string) {
      const apiKey = getMillionVerifierApiKey(options);
      const url = buildMillionVerifierBulkUrl("fileinfo", apiKey);
      url.searchParams.set("file_id", providerFileId);

      const json = await fetchMillionVerifierBulkJson(url, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(Number(process.env.MILLIONVERIFIER_BULK_INFO_TIMEOUT_MS || 30_000))
      });
      const result = toBulkInfoResult(json);

      console.info("[verification-provider-bulk-info-response]", {
        provider: "millionverifier",
        fileId: providerFileId,
        status: result.providerStatus,
        percent: result.percent,
        verified: result.verified,
        unverified: result.unverified,
        ok: result.ok,
        invalid: result.invalid,
        catchAll: result.catchAll,
        disposable: result.disposable,
        unknown: result.unknown
      });

      return result;
    },
    async downloadBulkReport(providerFileId: string) {
      const apiKey = getMillionVerifierApiKey(options);
      const url = buildMillionVerifierBulkUrl("download", apiKey);
      url.searchParams.set("file_id", providerFileId);
      url.searchParams.set("filter", "all");

      console.info("[verification-provider-bulk-download-request]", {
        provider: "millionverifier",
        fileId: providerFileId
      });

      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(Number(process.env.MILLIONVERIFIER_BULK_DOWNLOAD_TIMEOUT_MS || 90_000))
      });
      const body = await response.text().catch(() => "");

      if (!response.ok) {
        console.error("[verification-provider-bulk-download-failed]", {
          provider: "millionverifier",
          fileId: providerFileId,
          httpStatus: response.status,
          body: sanitizeProviderLogBody(body)
        });
        throw new Error(`MillionVerifier bulk report download failed with HTTP ${response.status}.`);
      }

      const results = parseMillionVerifierBulkReport(body);
      console.info("[verification-provider-bulk-download-response]", {
        provider: "millionverifier",
        fileId: providerFileId,
        resultCount: results.length
      });
      return results;
    },
    async stopBulkFile(providerFileId: string) {
      const apiKey = getMillionVerifierApiKey(options);
      const url = buildMillionVerifierBulkStopUrl(apiKey);
      url.searchParams.set("file_id", providerFileId);

      console.info("[verification-provider-bulk-stop-request]", {
        provider: "millionverifier",
        fileId: providerFileId
      });

      const json = await fetchMillionVerifierBulkJson(url, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(Number(process.env.MILLIONVERIFIER_BULK_STOP_TIMEOUT_MS || 30_000))
      });
      const ok = String(json.result || "").toLowerCase() === "ok" || !json.error;

      console.info("[verification-provider-bulk-stop-response]", {
        provider: "millionverifier",
        fileId: providerFileId,
        ok,
        result: String(json.result || "")
      });

      return { ok, raw: sanitizeProviderPayload(json) };
    }
  };
}

function getMillionVerifierApiKey(options: MillionVerifierProviderOptions) {
  const apiKey = process.env.MILLIONVERIFIER_API_KEY || options.apiKey;
  if (!apiKey) {
    throw new Error("MillionVerifier API key is not configured.");
  }
  return apiKey;
}

function buildMillionVerifierBulkUrl(endpoint: "upload" | "fileinfo" | "download", apiKey: string) {
  const baseUrl = (process.env.MILLIONVERIFIER_BULK_API_BASE_URL || DEFAULT_BULK_BASE_URL).replace(/\/$/, "");
  const url = new URL(`${baseUrl}/${endpoint}`);
  url.searchParams.set("key", apiKey);
  return url;
}

function buildMillionVerifierBulkStopUrl(apiKey: string) {
  const baseUrl = (process.env.MILLIONVERIFIER_BULK_API_BASE_URL || DEFAULT_BULK_BASE_URL)
    .replace(/\/$/, "")
    .replace(/\/v2$/, "");
  const url = new URL(`${baseUrl}/stop`);
  url.searchParams.set("key", apiKey);
  return url;
}

async function fetchMillionVerifierBulkJson(url: URL, init: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.text().catch(() => "");
  const json = parseMillionVerifierBulkResponse(body);

  if (!response.ok || json.error) {
    console.error("[verification-provider-bulk-response-failed]", {
      provider: "millionverifier",
      endpoint: url.pathname,
      httpStatus: response.status,
      body: sanitizeProviderLogBody(json.error ? json : body)
    });
    throw new Error(json.error || `MillionVerifier bulk request failed with HTTP ${response.status}.`);
  }

  return json;
}

function toBulkUploadResult(payload: MillionVerifierBulkResponse): VerificationBulkUploadResult {
  const providerFileId = String(payload.file_id || "").trim();
  if (!providerFileId) {
    throw new Error("MillionVerifier bulk upload did not return a file id.");
  }

  return {
    providerFileId,
    providerStatus: String(payload.status || "unknown"),
    percent: clampPercent(readNumber(payload.percent)),
    totalRows: readNumber(payload.total_rows),
    uniqueEmails: readNumber(payload.unique_emails),
    verified: readNumber(payload.verified),
    estimatedTimeSec: payload.estimated_time_sec == null ? null : readNumber(payload.estimated_time_sec),
    raw: sanitizeProviderPayload(payload)
  };
}

function toBulkInfoResult(payload: MillionVerifierBulkResponse): VerificationBulkInfoResult {
  return {
    ...toBulkUploadResult(payload),
    ok: readNumber(payload.ok),
    catchAll: readNumber(payload.catch_all),
    disposable: readNumber(payload.disposable),
    invalid: readNumber(payload.invalid),
    unknown: readNumber(payload.unknown),
    unverified: readNumber(payload.unverified)
  };
}

function parseMillionVerifierBulkResponse(body: string): MillionVerifierBulkResponse {
  if (!body) return {};
  try {
    return JSON.parse(body) as MillionVerifierBulkResponse;
  } catch {
    return { error: "MillionVerifier bulk response was not JSON.", rawText: sanitizeProviderLogBody(body) };
  }
}

function parseMillionVerifierBulkReport(body: string): VerificationProviderResult[] {
  const trimmed = body.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("{")) {
    const json = parseMillionVerifierBulkResponse(trimmed);
    if (json.error) {
      throw new Error(json.error);
    }
  }

  const rows = parseCsvRows(trimmed);
  if (rows.length === 0) return [];

  const header = rows[0].map(normalizeHeader);
  const hasHeader = header.includes("email") || header.includes("result") || header.includes("status");
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const fallbackHeader = ["email", "result", "quality", "resultcode", "subresult", "free", "role", "didyoumean", "credits", "executiontime", "error"];
  const activeHeader = hasHeader ? header : fallbackHeader;

  return dataRows
    .map((row) => rowToMillionVerifierResult(activeHeader, row))
    .filter((result): result is VerificationProviderResult => Boolean(result));
}

function rowToMillionVerifierResult(header: string[], row: string[]): VerificationProviderResult | null {
  const payload: MillionVerifierResponse = {};
  for (let index = 0; index < row.length; index += 1) {
    const key = header[index] || `column_${index}`;
    payload[key] = coerceCsvValue(row[index]);
  }

  const email = String(payload.email || payload.address || payload.mail || "").trim();
  if (!email || !email.includes("@")) return null;

  const normalizedPayload = normalizeBulkResultPayload(payload);
  return {
    email,
    status: mapMillionVerifierStatus(normalizedPayload),
    reason: String(normalizedPayload.subresult || normalizedPayload.reason || normalizedPayload.result || normalizedPayload.status || ""),
    raw: sanitizeProviderPayload(normalizedPayload)
  };
}

function normalizeBulkResultPayload(payload: MillionVerifierResponse): MillionVerifierResponse {
  const result = payload.result ?? payload.status ?? payload.verdict ?? payload.quality;
  const subresult = payload.subresult ?? payload.reason ?? payload.error;
  return {
    ...payload,
    result: result == null ? undefined : String(result),
    status: payload.status == null ? undefined : String(payload.status),
    subresult: subresult == null ? undefined : String(subresult),
    disposable: readBooleanLike(payload.disposable),
    catch_all: readBooleanLike(payload.catch_all ?? payload.catchall),
    free: readBooleanLike(payload.free),
    role: readBooleanLike(payload.role),
    mx: readBooleanLike(payload.mx)
  };
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((candidate) => candidate.some((value) => value.trim()));
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function coerceCsvValue(value: string) {
  const trimmed = value.trim();
  if (/^(true|yes|1)$/i.test(trimmed)) return true;
  if (/^(false|no|0)$/i.test(trimmed)) return false;
  return trimmed;
}

function readNumber(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? Math.max(0, Math.floor(numberValue)) : 0;
}

function readBooleanLike(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return undefined;
  if (/^(true|yes|1)$/i.test(value.trim())) return true;
  if (/^(false|no|0)$/i.test(value.trim())) return false;
  return undefined;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function escapeBulkCsvCell(value: string) {
  const clean = value.trim();
  if (!/[",\n\r]/.test(clean)) return clean;
  return `"${clean.replace(/"/g, '""')}"`;
}

function sanitizeBulkFileName(value: string) {
  const clean = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || "zeylora-verification-list.csv";
}

function getEmailDomain(email: string) {
  return email.includes("@") ? email.split("@").pop()?.toLowerCase() || "unknown" : "unknown";
}

function mapMillionVerifierStatus(payload: MillionVerifierResponse): VerificationEmailStatus {
  const result = String(payload.result || payload.status || "").toLowerCase();
  const subresult = String(payload.subresult || payload.reason || "").toLowerCase();

  if (payload.disposable || result.includes("disposable") || subresult.includes("disposable")) return "DISPOSABLE";
  if (payload.catch_all || payload.catchall || result.includes("catch") || subresult.includes("catch")) return "CATCH_ALL";
  if (result === "ok" || result === "valid" || result === "deliverable") return "VALID";
  if (result === "invalid" || result === "bad" || result === "undeliverable") return "INVALID";
  if (result === "risk" || result === "risky" || subresult.includes("role") || subresult.includes("mailbox_full")) return "RISKY";
  return "UNKNOWN";
}

function sanitizeProviderPayload(payload: Record<string, unknown>) {
  const clone = { ...payload };
  delete clone.api;
  delete clone.apiKey;
  delete clone.key;
  return clone;
}

function parseMillionVerifierResponse(body: string): MillionVerifierResponse {
  if (!body) return {};
  try {
    return JSON.parse(body) as MillionVerifierResponse;
  } catch {
    return { result: "unknown", reason: "Provider response was not JSON.", rawText: sanitizeProviderLogBody(body) };
  }
}

function sanitizeProviderLogBody(payload: unknown) {
  if (typeof payload === "string") {
    return payload.replace(/api=([^&\s]+)/gi, "api=***").slice(0, 700);
  }
  if (!payload || typeof payload !== "object") return payload;
  const clone = { ...(payload as Record<string, unknown>) };
  delete clone.api;
  delete clone.apiKey;
  delete clone.key;
  delete clone.token;
  if (typeof clone.email === "string") {
    clone.emailDomain = getEmailDomain(clone.email);
    delete clone.email;
  }
  return clone;
}
