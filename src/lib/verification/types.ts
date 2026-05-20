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

export type VerificationProvider = {
  key: string;
  verifyBatch(emails: string[]): Promise<VerificationProviderResult[]>;
};

export type VerificationExportType = "valid" | "invalid" | "risky" | "full";
