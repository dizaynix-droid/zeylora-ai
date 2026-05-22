export const ADMIN_DATE_LOCALE = "tr-TR";
export const ADMIN_TIME_ZONE = "Europe/Istanbul";
const ADMIN_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

export function formatAdminDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";

  return new Intl.DateTimeFormat(ADMIN_DATE_LOCALE, {
    timeZone: ADMIN_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(parsed);
}

export function formatAdminDateInputValue(date: Date | string | null | undefined) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ADMIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(parsed);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function formatAdminDateKey(date: Date | string | null | undefined) {
  return formatAdminDateInputValue(date);
}

export function getAdminDayStartUtc(date = new Date()) {
  const parts = getAdminDateParts(date);
  if (!parts) return startOfUtcDay(date);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0) - ADMIN_UTC_OFFSET_MS);
}

export function getAdminDayEndUtc(date = new Date()) {
  return new Date(getAdminDayStartUtc(date).getTime() + DAY_MS - 1);
}

export function addAdminDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function getAdminMonthStartUtc(date = new Date()) {
  const parts = getAdminDateParts(date);
  if (!parts) return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  return new Date(Date.UTC(parts.year, parts.month - 1, 1, 0, 0, 0, 0) - ADMIN_UTC_OFFSET_MS);
}

export function getAdminMonthEndUtc(date = new Date()) {
  const parts = getAdminDateParts(date);
  if (!parts) return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0) - 1);
  return new Date(Date.UTC(parts.year, parts.month, 1, 0, 0, 0, 0) - ADMIN_UTC_OFFSET_MS - 1);
}

export function parseAdminDateInputStartUtc(value: string | null | undefined) {
  const parts = parseDateInput(value);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0) - ADMIN_UTC_OFFSET_MS);
}

export function parseAdminDateInputEndUtc(value: string | null | undefined) {
  const start = parseAdminDateInputStartUtc(value);
  return start ? new Date(start.getTime() + DAY_MS - 1) : null;
}

function getAdminDateParts(date: Date | string | null | undefined) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ADMIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(parsed);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? { year, month, day } : null;
}

function parseDateInput(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? { year, month, day } : null;
}

function startOfUtcDay(date: Date) {
  const parsed = new Date(date);
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
}
