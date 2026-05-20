import type { VerificationEmailStatus } from "@prisma/client";
import type { VerificationProvider, VerificationProviderResult } from "@/lib/verification/types";

const DEFAULT_BASE_URL = "https://api.millionverifier.com/api/v3";

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
      const debugProvider = process.env.NODE_ENV === "development" || process.env.VERIFICATION_PROVIDER_DEBUG === "true";

      if (!apiKey) {
        throw new Error("MillionVerifier API key is not configured.");
      }

      const results: VerificationProviderResult[] = [];

      for (const email of emails) {
        const url = new URL(baseUrl);
        url.searchParams.set("api", apiKey);
        url.searchParams.set("email", email);
        url.searchParams.set("timeout", "10");

        if (debugProvider) {
          console.info("[verification-provider-request]", {
            provider: "millionverifier",
            domain: getEmailDomain(email),
            baseUrl: url.origin + url.pathname
          });
        }

        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(18_000)
        });

        if (!response.ok) {
          console.error("[verification-provider-response-failed]", {
            provider: "millionverifier",
            domain: getEmailDomain(email),
            httpStatus: response.status
          });
          throw new Error(`MillionVerifier failed with HTTP ${response.status}.`);
        }

        const json = (await response.json().catch(() => ({}))) as MillionVerifierResponse;
        if (debugProvider) {
          console.info("[verification-provider-response]", {
            provider: "millionverifier",
            domain: getEmailDomain(email),
            httpStatus: response.status,
            result: String(json.result || json.status || ""),
            subresult: String(json.subresult || json.reason || "")
          });
        }
        results.push({
          email,
          status: mapMillionVerifierStatus(json),
          reason: String(json.subresult || json.reason || json.result || json.status || ""),
          raw: sanitizeProviderPayload(json)
        });
      }

      return results;
    }
  };
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

function sanitizeProviderPayload(payload: MillionVerifierResponse) {
  const clone = { ...payload };
  delete clone.api;
  delete clone.apiKey;
  delete clone.key;
  return clone;
}
