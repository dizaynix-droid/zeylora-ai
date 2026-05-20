"use client";

import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ClipboardList, FileText, Loader2, MailCheck, ShieldCheck, TrendingDown, XCircle } from "lucide-react";
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
  const score = ready ? Math.max(54, Math.min(98, quality.valid - Math.round(quality.risk / 3))) : 0;
  const workflowSteps = getWorkflowSteps(parseState, ready);

  async function handleFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setFileSize(file.size);
    setMessage("File selected. Reading your email list now...");
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".txt")) {
      setParseState("error");
      setMessage("Please upload a CSV or TXT file.");
      return;
    }
    if (file.size > MAX_HOMEPAGE_PRECHECK_BYTES) {
      setParseState("error");
      setMessage("This file is large. Please sign in and upload it from the dashboard so it can be parsed safely on the server.");
      return;
    }

    setParseState("parsing");
    setMessage(null);
    trackEvent({
      event: "homepage_list_upload",
      properties: { fileName: file.name, fileSize: file.size }
    });

    try {
      const text = await file.text();
      setEmails(text);
      setParseState("ready");
      setMessage("List parsed. Review credits, then start verification.");
      trackEvent({
        event: "homepage_list_parsed",
        properties: {
          source: "file",
          totalEmails: parseEmailList(text).totalRows,
          uniqueEmails: parseEmailList(text).uniqueEmails.length
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
        setMessage(`You need ${uniqueCount.toLocaleString()} verification credits. ${recommendedPackage.name} is the best fit for this list; taking you to pricing.`);
        releaseMobileInputViewport();
        router.push(`/pricing?checkoutPackage=${recommendedPackage.key}&resumeVerification=1`);
        return;
      }

      trackEvent({
        event: "homepage_verification_resume",
        properties: { uniqueEmails: uniqueCount, creditBalance: balance }
      });
      setMessage("Credits are available. Starting verification now.");
      const formData = new FormData();
      formData.set("emails", parsed.uniqueEmails.join("\n"));
      const jobResponse = await fetch("/api/v1/verification/jobs", {
        method: "POST",
        body: formData
      });
      const jobPayload = await jobResponse.json().catch(() => null) as { ok?: boolean; job?: { id?: string }; error?: string; code?: string; traceId?: string } | null;
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
        setMessage(`You need ${uniqueCount.toLocaleString()} verification credits. ${recommendedPackage.name} is the best fit for this list; taking you to pricing.`);
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
    <VerifyPanel className="overflow-hidden border-slate-300 shadow-[0_18px_70px_rgba(15,23,42,.10)]">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">Free pre-check</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Upload CSV and estimate credits</h2>
          </div>
          <div className="text-right">
            <VerifyBadge tone={ready ? "green" : "blue"}>
              {parseState === "parsing" ? <Loader2 className="mr-1 animate-spin" size={13} /> : null}
              {ready ? "Ready to verify" : "Upload or paste"}
            </VerifyBadge>
            <p className="mt-2 text-xs font-semibold text-slate-500">{uniqueCount.toLocaleString()} unique emails</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5">
        <div className="grid gap-2 sm:grid-cols-5">
          {workflowSteps.map((step) => (
            <ProgressStep key={step.label} {...step} />
          ))}
        </div>

        <label
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`grid cursor-pointer place-items-center rounded-lg border border-dashed p-5 text-center transition duration-300 ${
            dragActive ? "scale-[1.01] border-blue-500 bg-blue-50 shadow-[0_16px_45px_rgba(37,99,235,.14)] ring-4 ring-blue-100" : "border-slate-300 bg-slate-50 hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50/70"
          }`}
        >
          <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-white text-blue-700 shadow-sm ${dragActive || parseState === "parsing" ? "animate-pulse" : ""}`}>
            <FileText size={22} />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-950">{fileName || "Drop your CSV or TXT file"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {fileName ? `${formatBytes(fileSize)} selected` : "or browse from your device"}
          </p>
          <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFileChange} />
        </label>

        <FileUploadStatus fileName={fileName} fileSize={fileSize} parseState={parseState} ready={ready} />

        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Paste emails</span>
          <textarea
            value={emails}
            onChange={(event) => onPasteChange(event.target.value)}
            rows={5}
            placeholder="founder@example.com&#10;ops@example.com&#10;sales@example.com"
            className="min-h-32 rounded-md border border-slate-300 bg-white p-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <DeliverabilityScore score={score} ready={ready} />
            <div className="grid flex-1 gap-3 sm:grid-cols-3">
              <Stat label="Uploaded emails" value={totalCount} />
              <Stat label="Unique emails" value={uniqueCount} tone="blue" />
              <Stat label="Credits needed" value={uniqueCount} tone="green" />
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            <QualityBar label="Valid estimate" value={quality.valid} tone="green" />
            <QualityBar label="Risk estimate" value={quality.risk} tone="amber" />
            <QualityBar label="Duplicates removed" value={quality.duplicates} tone="red" />
          </div>
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              <span>{parseState === "parsing" ? "Parsing list" : ready ? "Live estimate ready" : "Waiting for data"}</span>
              <span>{ready ? `${score}/100` : "0/100"}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-700 ${parseState === "parsing" ? "animate-pulse" : ""}`}
                style={{ width: `${ready ? score : parseState === "parsing" ? 42 : 8}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">What happens next</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />
              {ready ? "Scanning ready" : "Waiting for list"}
            </span>
          </div>
          <div className="grid gap-2">
            <ActivityItem active={parseState === "parsing" || ready} label="Scanning domains and syntax" />
            <ActivityItem active={ready && duplicateCount > 0} label={`${duplicateCount.toLocaleString()} duplicate${duplicateCount === 1 ? "" : "s"} removed`} />
            <ActivityItem active={ready} label={`${quality.risk}% catch-all / risky estimate detected`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ComparisonCard label="Before send" value={`${Math.max(12, quality.risk + quality.duplicates)}% risk`} tone="bad" />
            <ComparisonCard label="After clean" value={`${Math.max(2, quality.risk - 5)}% risk`} tone="good" />
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">Credit estimate</p>
              <p className="mt-1 text-sm text-slate-700">
                {ready
                  ? `${uniqueCount.toLocaleString()} unique emails will use ${uniqueCount.toLocaleString()} verification credits. Recommended package: ${recommendedPackage.name}.`
                  : "Upload or paste a list to estimate credits."}
              </p>
            </div>
            <ClipboardList className="text-blue-700" size={22} />
          </div>
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

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Estimated result split</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <MiniResult label="Likely valid" value={`${quality.valid}%`} tone="green" />
          <MiniResult label="Risky" value={`${quality.risk}%`} tone="amber" />
          <MiniResult label="Duplicate" value={`${quality.duplicates}%`} tone="red" />
        </div>
      </div>
    </VerifyPanel>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "blue" | "green" }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-[-0.02em] ${tone === "blue" ? "text-blue-700" : tone === "green" ? "text-emerald-700" : "text-slate-950"}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function DeliverabilityScore({ score, ready }: { score: number; ready: boolean }) {
  return (
    <div className="relative grid size-28 shrink-0 place-items-center rounded-full border border-blue-100 bg-blue-50">
      <div
        className="absolute inset-2 rounded-full"
        style={{
          background: `conic-gradient(#2563eb ${ready ? score * 3.6 : 0}deg, #dbeafe 0deg)`
        }}
      />
      <div className="relative grid size-20 place-items-center rounded-full bg-white text-center shadow-sm">
        <p className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{ready ? score : "--"}</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">score</p>
      </div>
    </div>
  );
}

function ActivityItem({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <span className={`size-2 rounded-full ${active ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`} />
      <span className={active ? "text-sm font-semibold text-slate-900" : "text-sm font-medium text-slate-500"}>{label}</span>
    </div>
  );
}

function ComparisonCard({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={`mt-1 flex items-center gap-2 text-xl font-semibold ${tone === "good" ? "text-emerald-700" : "text-rose-700"}`}>
        {tone === "good" ? <TrendingDown size={18} /> : <XCircle size={18} />}
        {value}
      </p>
    </div>
  );
}

function ProgressStep({ label, state }: { label: string; state: "done" | "active" | "pending" }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        state === "done"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : state === "active"
            ? "border-blue-200 bg-blue-50 text-blue-800"
            : "border-slate-200 bg-white text-slate-500"
      }`}
    >
      <div className="flex items-center gap-2">
        {state === "active" ? <Loader2 className="animate-spin" size={14} /> : state === "done" ? <CheckCircle2 size={14} /> : <span className="size-3 rounded-full border border-current opacity-40" />}
        <span className="text-xs font-semibold">{label}</span>
      </div>
    </div>
  );
}

function QualityBar({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "red" }) {
  const color = tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-rose-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function MiniResult({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "red" }) {
  const Icon = tone === "green" ? CheckCircle2 : tone === "red" ? XCircle : ShieldCheck;
  const color = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-rose-700" : "text-amber-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <Icon className={color} size={18} />
      <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
    </div>
  );
}

function FileUploadStatus({
  fileName,
  fileSize,
  parseState,
  ready
}: {
  fileName: string | null;
  fileSize: number | null;
  parseState: ParseState;
  ready: boolean;
}) {
  if (!fileName) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <UploadStatusDot state="idle" />
          No file selected yet
        </div>
        <p className="mt-1 text-xs text-slate-500">Choose a CSV/TXT file or paste emails below.</p>
      </div>
    );
  }

  const error = parseState === "error";
  const parsing = parseState === "parsing";
  const progress = error ? 100 : parsing ? 48 : ready ? 100 : 20;
  const title = error ? "File needs attention" : parsing ? "Reading file..." : ready ? "File parsed and ready" : "File selected";
  const helper = error
    ? "Check the message below, then upload a CSV/TXT file again."
    : parsing
      ? "Zeylora is reading the file locally for the homepage estimate."
      : "The list estimate is ready. Click Continue to start or resume verification.";

  return (
    <div className={`rounded-lg border p-4 ${error ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className={`flex items-center gap-2 text-sm font-semibold ${error ? "text-rose-700" : "text-emerald-700"}`}>
            <UploadStatusDot state={error ? "error" : parsing ? "active" : "done"} />
            {title}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-slate-950">{fileName}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">{formatBytes(fileSize)} - CSV/TXT upload</p>
        </div>
        {ready ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={14} />
            Ready
          </span>
        ) : null}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full transition-all duration-700 ${error ? "bg-rose-500" : "bg-emerald-500"} ${parsing ? "animate-pulse" : ""}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className={`mt-2 text-xs font-semibold ${error ? "text-rose-700" : "text-emerald-700"}`}>{helper}</p>
    </div>
  );
}

function UploadStatusDot({ state }: { state: "idle" | "active" | "done" | "error" }) {
  const className =
    state === "done"
      ? "bg-emerald-500"
      : state === "active"
        ? "animate-pulse bg-blue-500"
        : state === "error"
          ? "bg-rose-500"
          : "bg-slate-300";
  return <span className={`inline-block size-2.5 rounded-full ${className}`} />;
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

function getWorkflowSteps(parseState: ParseState, ready: boolean) {
  const labels = ["Uploading file", "Parsing emails", "Removing duplicates", "Estimating credits", "Ready for verification"];
  if (parseState === "idle") return labels.map((label) => ({ label, state: "pending" as const }));
  if (parseState === "parsing") {
    return labels.map((label, index) => ({
      label,
      state: index <= 0 ? "done" as const : index === 1 ? "active" as const : "pending" as const
    }));
  }
  if (ready) return labels.map((label) => ({ label, state: "done" as const }));
  return labels.map((label) => ({ label, state: parseState === "error" && label === "Parsing emails" ? "active" as const : "pending" as const }));
}
