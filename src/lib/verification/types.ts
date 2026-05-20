import type { VerificationEmailStatus } from "@prisma/client";

export type ParsedEmailList = {
  totalRows: number;
  syntaxInvalidCount: number;
  uniqueEmails: string[];
  duplicateEmails: string[];
  invalidSyntaxSamples: string[];
};

export type VerificationProviderResult = {
  email: string;
  status: VerificationEmailStatus;
  reason?: string;
  raw?: Record<string, unknown>;
};

export type VerificationBulkUploadResult = {
  providerFileId: string;
  providerStatus: string;
  percent: number;
  totalRows: number;
  uniqueEmails: number;
  verified: number;
  estimatedTimeSec?: number | null;
  raw?: Record<string, unknown>;
};

export type VerificationBulkInfoResult = VerificationBulkUploadResult & {
  ok: number;
  catchAll: number;
  disposable: number;
  invalid: number;
  unknown: number;
  unverified: number;
};

export type VerificationProvider = {
  key: string;
  verifyBatch(emails: string[]): Promise<VerificationProviderResult[]>;
  uploadBulkFile?(input: { fileName: string; emails: string[] }): Promise<VerificationBulkUploadResult>;
  getBulkFileInfo?(providerFileId: string): Promise<VerificationBulkInfoResult>;
  downloadBulkReport?(providerFileId: string): Promise<VerificationProviderResult[]>;
  stopBulkFile?(providerFileId: string): Promise<{ ok: boolean; raw?: Record<string, unknown> }>;
};

export type VerificationExportType = "valid" | "invalid" | "risky" | "full";
