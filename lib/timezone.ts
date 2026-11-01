export const DEFAULT_TIMEZONE = "UTC";

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 64) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value: unknown): string {
  return isValidTimeZone(value) ? value : DEFAULT_TIMEZONE;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function getZonedParts(date: Date, timezone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimeZone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  };
}

export function getLocalDate(date: Date, timezone: string): string {
  const { year, month, day } = getZonedParts(date, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function timezoneOffsetMs(date: Date, timezone: string): number {
  const parts = getZonedParts(date, timezone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  // The scheduler only needs minute precision; dropping seconds avoids floating errors.
  return representedAsUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

/** Convert a local calendar date/time to UTC, including a second DST-offset check. */
export function zonedDateTimeToUtc(
  localDate: string,
  timezone: string,
  hour = 0,
  minute = 0,
): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error("Invalid local date");
  const [year, month, day] = localDate.split("-").map(Number);
  const desiredUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  const guess = new Date(desiredUtcMs);
  let result = new Date(desiredUtcMs - timezoneOffsetMs(guess, timezone));
  const correctedOffset = timezoneOffsetMs(result, timezone);
  result = new Date(desiredUtcMs - correctedOffset);
  return result;
}

export function getLocalDateRange(localDate: string, timezone: string) {
  const start = zonedDateTimeToUtc(localDate, timezone);
  const nextLocalDate = new Date(`${localDate}T00:00:00.000Z`);
  nextLocalDate.setUTCDate(nextLocalDate.getUTCDate() + 1);
  const nextDate = nextLocalDate.toISOString().slice(0, 10);
  const end = zonedDateTimeToUtc(nextDate, timezone);
  return { start, end };
}

export function isLocalNightlyWindow(date: Date, timezone: string): boolean {
  const { hour } = getZonedParts(date, timezone);
  return hour >= 22;
}
