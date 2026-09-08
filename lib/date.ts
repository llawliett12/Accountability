/**
 * Local calendar date utility.
 *
 * In personal tracking and accountability, a day begins at 00:00 local time
 * and ends at 23:59 local time. Naive UTC ISO slicing (`new Date().toISOString().slice(0, 10)`)
 * causes date shifting in non-UTC timezones (e.g. IST UTC+5:30), creating records under yesterday
 * or tomorrow.
 *
 * Default timezone: "Asia/Kolkata" (IST) as required by project context.
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Returns YYYY-MM-DD for a given date in the specified timezone (defaulting to IST).
 */
export function getLocalDateISO(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fallback to local device components if timezone is unavailable
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Convenience helper returning today's date in YYYY-MM-DD format for the active timezone.
 */
export function todayISO(timeZone?: string): string {
  return getLocalDateISO(new Date(), timeZone);
}
