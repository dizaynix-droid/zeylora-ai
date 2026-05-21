"use client";

import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, MailCheck, UploadCloud, XCircle } from "lucide-react";
import { VerifyAction, VerifyBadge, VerifyPanel } from "@/components/verify-ui/core";
import { trackEvent } from "@/lib/analytics/events";
import { releaseMobileInputViewport } from "@/lib/dom/mobile-viewport";
import { parseEmailList } from "@/lib/verification/email-parser";

const DRAFT_STORAGE_KEY = "zeylora_verification_draft";
const MAX_DRAFT_CHARS = 650_000;
const MAX_HOMEPAGE_PRECHECK_BYTES = 1_000_000;

type ParseState = "idle" | "parsing" | "ready" | "error";

export function HomepageListChecker() {
  const router = useRouter();
  const [emails, setEmails] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [parseState, setParseState] = useState<ParseState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const parsed = useMemo(() => parseEmailList(emails), [emails]);
  const uniqueCount = parsed.uniqueEmails.length;
  const duplicateCount = parsed.duplicateEmails.length;
  const totalCount = parsed.totalRows;
  const quality = useMemo(() => estimateQuality(uniqueCount, duplicateCount), [duplicateCount, uniqueCount]);
  const recommendedPackage = useMemo(() => getRecommendedPackage(uniqueCount), [uniqueCount]);
  const ready = uniqueCount > 0;
  const score = ready ? Math.max(58, Math.min(98, quality.valid - Math.round(quality.risk / 4))) : 0;

  async function handleFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setFileSize(file.size);
    const name = file.name.toLowerCase();

    if (!name.endsWith(".csv") && !name.endsWith(".txt")) {
      setParseState("error");
      setMessage("Please upload a CSV or TXT file.");
      return;
    }

    if (file.size > MAX_HOMEPAGE_PRECHECK_BYTES) {
      setParseState("error");
      setMessage("This file is large. Sign in and upload it from the dashboard so it can be processed safely.");
      return;
    }

    setParseState("parsing");
    setMessage("Reading your list...");
    trackEvent({
      event: "homepage_list_upload",
      properties: { fileName: file.name, fileSize: file.size }
    });

    try {
      const text = await file.text();
      const nextParsed = parseEmailList(text);
      setEmails(text);
      setParseState("ready");
      setMessage(`${nextParsed.uniqueEmails.length.toLocaleString()} unique emails detected. Ready to verify.`);
      trackEvent({
        event: "homepage_list_parsed",
        properties: {
          source: "file",
          totalEmails: nextParsed.totalRows,
          uniqueEmails: nextParsed.uniqueEmails.length
        }
      });
    } catch {
      setParseState("error");
      setMessage("We could not read this file. Try a CSV or TXT export.");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFile(event.target.files?.[0] ?? null);
  }

  function onPasteChange(value: string) {
    setEmails(value);
    setFileName(null);
    setFileSize(null);
    setParseState(value.trim() ? "ready" : "idle");
    setMessage(value.trim() ? "List detected. Review the estimate, then start verification." : null);
    if (value.trim()) {
      trackEvent({
        event: "homepage_list_paste",
        properties: { characters: value.length }
      });
    }
  }

  function onDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function onDragLeave() {
    setDragActive(false);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    void handleFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function continueFlow() {
    if (!ready) {
      setParseState("error");
      setMessage("Add or upload emails first.");
      return;
    }

    saveDraft();
    releaseMobileInputViewport();
    setParseState("parsing");

    try {
      const authResponse = await fetch("/api/auth/me", { cache: "no-store" });
      const auth = (await authResponse.json().catch(() => null)) as { authenticated?: boolean } | null;

      if (!auth?.authenticated) {
        trackEvent({
          event: "homepage_auth_required",
          properties: { uniqueEmails: uniqueCount }
        });
        releaseMobileInputViewport();
        router.push(`/auth/sign-in?next=${encodeURIComponent("/dashboard?resumeVerification=1")}`);
        return;
      }

      const creditsResponse = await fetch("/api/v1/dashboard/credits", { cache: "no-store" });
      const credits = (await creditsResponse.json().catch(() => null)) as { ok?: boolean; creditBalance?: number } | null;
      const balance = Number(credits?.creditBalance ?? 0);

      if (!creditsResponse.ok || !credits?.ok || balance < uniqueCount) {
        trackEvent({
          event: "homepage_pricing_required",
          properties: { uniqueEmails: uniqueCount, creditBalance: balance }
        });
        setMessage(`You need ${uniqueCount.toLocaleString()} verification credits. ${recommendedPackage.name} is the best fit for this list.`);
        releaseMobileInputViewport();
        router.push(`/pricing?checkoutPackage=${recommendedPackage.key}&resumeVerification=1`);
        return;
      }

      trackEvent({
        event: "homepage_verification_resume",
        properties: { uniqueEmails: uniqueCount, creditBalance: balance }
      });
      setMessage("Starting verification...");
      const formData = new FormData();
      formData.set("emails", parsed.uniqueEmails.join("\n"));
      const jobResponse = await fetch("/api/v1/verification/jobs", {
        method: "POST",
        body: formData
      });
      const jobPayload = (await jobResponse.json().catch(() => null)) as { ok?: boolean; job?: { id?: string }; error?: string; code?: string; traceId?: string } | null;
      if (!jobResponse.ok || !jobPayload?.ok) {
        console.error("[homepage-verification-start-failed]", {
          httpStatus: jobResponse.status,
          code: jobPayload?.code ?? null,
          traceId: jobPayload?.traceId ?? null,
          error: jobPayload?.error ?? "No JSON error payload returned.",
          uniqueEmails: uniqueCount
        });
      }
      if (jobResponse.status === 402 || jobPayload?.code === "insufficient_credits") {
        setMessage(`You need ${uniqueCount.toLocaleString()} verification credits. ${recommendedPackage.name} is the best fit for this list.`);
        releaseMobileInputViewport();
        router.push(`/pricing?checkoutPackage=${recommendedPackage.key}&resumeVerification=1`);
        return;
      }
      if (!jobResponse.ok || !jobPayload?.ok) {
        throw new Error(formatStartError(jobPayload));
      }
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      releaseMobileInputViewport();
      router.push(jobPayload.job?.id ? `/dashboard/jobs/${jobPayload.job.id}` : "/dashboard#jobs");
    } catch (error) {
      setParseState("error");
      console.error("[homepage-verification-start-exception]", {
        message: error instanceof Error ? error.message : String(error || "Unknown error"),
        uniqueEmails: uniqueCount
      });
      setMessage(getFriendlyStartError(error));
    }
  }

  function saveDraft() {
    const draft = {
      sourceText: emails.slice(0, MAX_DRAFT_CHARS),
      originalLength: emails.length,
      truncated: emails.length > MAX_DRAFT_CHARS,
      fileName,
      uniqueEmails: uniqueCount,
      totalEmails: totalCount,
      createdAt: new Date().toISOString()
    };

    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ ...draft, sourceText: parsed.uniqueEmails.join("\n") }));
      } catch {
        // The dashboard can still open; user may need to paste the list again if browser storage is full.
      }
    }
  }

  return (
    <VerifyPanel className="overflow-hidden border-blue-200 bg-white shadow-[0_24px_80px_rgba(37,99,235,.14)]">
      <div className="relative overflow-hidden border-b border-blue-100 bg-[linear-gradient(135deg,#f8fbff_0%,#eef6ff_58%,#ffffff_100%)] px-5 py-5">
        <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-blue-200/45 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-blue-700 shadow-sm">
              <MailCheck size={14} />
              List quality check
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Upload, paste, verify.</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
              See unique emails, duplicates, required credits, and list risk before you spend anything.
            </p>
          </div>
          <VerifyBadge tone={ready ? "green" : "blue"}>
            {parseState === "parsing" ? <Loader2 className="mr-1 animate-spin" size={13} /> : null}
            {ready ? "Ready to start" : "Waiting for list"}
          </VerifyBadge>
        </div>
      </div>

      <div className="grid gap-4 p-5">
        <div className="grid gap-3 lg:grid-cols-[0.92fr_1.08fr]">
          <label
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`group relative grid min-h-40 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed p-5 text-center transition duration-300 ${
              dragActive
                ? "scale-[1.01] border-blue-500 bg-blue-50 shadow-[0_18px_55px_rgba(37,99,235,.18)] ring-4 ring-blue-100"
                : "border-blue-200 bg-[linear-gradient(135deg,#f8fbff_0%,#eef6ff_100%)] hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-[0_18px_45px_rgba(37,99,235,.12)]"
            }`}
          >
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />
            <div className={`mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm ring-1 ring-blue-100 ${dragActive || parseState === "parsing" ? "animate-pulse" : "transition group-hover:scale-105"}`}>
              <UploadCloud size={24} />
            </div>
            <p className="mt-3 text-base font-semibold text-slate-950">{fileName || "Drop CSV/TXT here"}</p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              {fileName ? `${formatBytes(fileSize)} selected` : "Or browse a list export."}
            </p>
            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition group-hover:bg-blue-700">
              Choose file
              <ArrowRight size={15} />
            </span>
            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFileChange} />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Paste emails</span>
            <textarea
              value={emails}
              onChange={(event) => onPasteChange(event.target.value)}
              rows={7}
              placeholder="test@gmail.com&#10;hello@example.com&#10;support@zeylora.ai"
              className="min-h-40 rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
          <Stat label="Uploaded" value={totalCount} />
          <Stat label="Unique" value={uniqueCount} tone="blue" />
          <Stat label="Duplicates" value={duplicateCount} tone="amber" />
          <Stat label="Credits" value={uniqueCount} tone="green" />
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-700">Ready workflow</p>
              <p className="mt-1 text-sm font-medium text-slate-700">
                {ready
                  ? `${uniqueCount.toLocaleString()} unique emails need ${uniqueCount.toLocaleString()} credits. Best fit: ${recommendedPackage.name}.`
                  : "Paste or upload emails to estimate list quality and credits."}
              </p>
            </div>
            <div className="min-w-[150px]">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>List score</span>
                <span>{ready ? score : "--"}/100</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-700 ${parseState === "parsing" ? "animate-pulse" : ""}`}
                  style={{ width: `${ready ? score : parseState === "parsing" ? 42 : 8}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <ResultPill label="Likely valid" value={`${quality.valid}%`} tone="green" />
          <ResultPill label="Risk estimate" value={`${quality.risk}%`} tone="amber" />
          <ResultPill label="Duplicate rate" value={`${quality.duplicates}%`} tone="red" />
        </div>

        <VerifyAction type="button" disabled={!ready || parseState === "parsing"} onClick={() => void continueFlow()} className="h-12 w-full text-base">
          {parseState === "parsing" ? <Loader2 className="animate-spin" size={18} /> : <MailCheck size={18} />}
          {ready ? "Start verification" : "Check list quality"}
          <ArrowRight size={18} />
        </VerifyAction>

        {message ? (
          <p className={`text-sm font-semibold ${parseState === "error" ? "text-rose-700" : "text-emerald-700"}`}>{message}</p>
        ) : null}
      </div>
    </VerifyPanel>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "blue" | "green" | "amber" }) {
  const color = tone === "blue" ? "text-blue-700" : tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-slate-950";
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-2xl font-semibold tracking-[-0.02em] ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function ResultPill({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "red" }) {
  const color =
    tone === "green"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-100 bg-amber-50 text-amber-700"
        : "border-rose-100 bg-rose-50 text-rose-700";
  const Icon = tone === "red" ? XCircle : CheckCircle2;
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <p className="text-xs font-semibold uppercase tracking-[0.08em]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{value}</p>
    </div>
  );
}

function estimateQuality(uniqueCount: number, duplicateCount: number) {
  if (uniqueCount === 0) return { valid: 0, risk: 0, duplicates: 0 };
  const duplicateRate = Math.min(35, Math.round((duplicateCount / Math.max(1, uniqueCount + duplicateCount)) * 100));
  const risk = Math.min(28, Math.max(6, Math.round(8 + duplicateRate * 0.45)));
  const valid = Math.max(55, Math.min(92, 100 - risk - Math.round(duplicateRate / 2)));
  return {
    valid,
    risk,
    duplicates: duplicateRate
  };
}

function formatBytes(value: number | null | undefined) {
  if (!value) return "0 KB";
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024)).toLocaleString()} KB`;
}

function getRecommendedPackage(uniqueCount: number) {
  if (uniqueCount <= 1000) return { key: "starter", name: "Starter" };
  if (uniqueCount <= 5000) return { key: "growth", name: "Growth" };
  if (uniqueCount <= 20000) return { key: "scale", name: "Scale" };
  if (uniqueCount <= 50000) return { key: "business", name: "Business" };
  if (uniqueCount <= 100000) return { key: "agency", name: "Agency" };
  if (uniqueCount <= 250000) return { key: "pro", name: "Pro" };
  if (uniqueCount <= 500000) return { key: "enterprise", name: "Enterprise" };
  return { key: "enterprise-plus", name: "Enterprise Plus" };
}

function getFriendlyStartError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();

  if (lower.includes("provider") || lower.includes("millionverifier")) {
    return "Verification is temporarily unavailable. Your list is saved in this browser; please try again shortly or contact support.";
  }

  if (lower.includes("storage") || lower.includes("upload") || lower.includes("r2")) {
    return "We could not store this list for processing. Your pasted list is still saved in this browser; please try again with a smaller list or contact support.";
  }

  if (message && message.length < 240 && !lower.includes("prisma")) {
    return message;
  }

  return "Verification could not be started. Your list is saved in this browser; please try again in a moment.";
}

function formatStartError(payload: { error?: string; code?: string; traceId?: string } | null) {
  const base = payload?.error || "Verification could not be started.";
  return payload?.traceId ? `${base} Reference: ${payload.traceId}` : base;
}
