// Pure screen-time validation logic. No DB, no Gemini/network imports —
// this validates whatever untrusted JSON came back from Gemini (or was
// typed by hand) into safe, bounded data. Same "no DB/AI in the pure
// engine" convention as lib/scoring/engine.ts and lib/academics/engine.ts.

import type { AppUsage, RawGeminiExtraction } from "./types";

// A single app's screen time in one day can't sensibly exceed 24h. Anything
// above this is almost certainly a misread (e.g. "4h 30m" parsed as 430).
export const MAX_MINUTES_PER_APP = 24 * 60;
export const MAX_TOTAL_MINUTES = 24 * 60;
export const MAX_APP_NAME_LENGTH = 100;

export interface ValidationResult {
  apps: AppUsage[];
  warnings: string[];
}

// Cleans one raw "app usage" entry. Returns null (and a warning) for
// anything that can't be salvaged into a safe value, rather than throwing —
// one bad entry in a list of twelve shouldn't discard the other eleven.
function sanitizeAppEntry(raw: unknown, warnings: string[]): AppUsage | null {
  if (typeof raw !== "object" || raw === null) {
    warnings.push("Skipped an app entry that wasn't a valid object.");
    return null;
  }
  const entry = raw as Record<string, unknown>;

  const nameRaw = entry.app_name ?? entry.name;
  if (typeof nameRaw !== "string" || nameRaw.trim().length === 0) {
    warnings.push("Skipped an app entry with no readable name.");
    return null;
  }
  const app_name = nameRaw.trim().slice(0, MAX_APP_NAME_LENGTH);

  const durationRaw = entry.duration_minutes ?? entry.minutes ?? entry.duration;
  const duration = typeof durationRaw === "number" ? durationRaw : Number(durationRaw);
  if (!Number.isFinite(duration) || duration < 0) {
    warnings.push(`Skipped "${app_name}" — no valid duration.`);
    return null;
  }
  if (duration > MAX_MINUTES_PER_APP) {
    warnings.push(
      `"${app_name}" reported ${Math.round(duration)}min, above the 24h cap — clamped to 24h. Please check it.`
    );
  }
  const duration_minutes = Math.round(Math.min(duration, MAX_MINUTES_PER_APP));

  const categoryRaw = entry.category;
  const category = typeof categoryRaw === "string" && categoryRaw.trim() ? categoryRaw.trim() : null;

  return { app_name, duration_minutes, category };
}

// Same-named apps (case-insensitive, trimmed) are summed rather than kept
// as separate rows — a screenshot can list an app twice across categories.
export function mergeDuplicateApps(apps: AppUsage[]): AppUsage[] {
  const byName = new Map<string, AppUsage>();
  for (const app of apps) {
    const key = app.app_name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      existing.duration_minutes += app.duration_minutes;
      if (!existing.category && app.category) existing.category = app.category;
    } else {
      byName.set(key, { ...app });
    }
  }
  return Array.from(byName.values());
}

// If Gemini's reported total disagrees with the sum of individual apps,
// prefer the app sum (it's auditable) unless no apps were extracted at all,
// in which case fall back to the reported total.
export function computeTotalMinutes(apps: AppUsage[], reportedTotal?: number | null): number {
  const appSum = apps.reduce((s, a) => s + a.duration_minutes, 0);
  if (apps.length > 0) return Math.min(appSum, MAX_TOTAL_MINUTES);
  if (typeof reportedTotal === "number" && Number.isFinite(reportedTotal) && reportedTotal >= 0) {
    return Math.round(Math.min(reportedTotal, MAX_TOTAL_MINUTES));
  }
  return 0;
}

export interface ParsedExtraction {
  date: string | null; // null when not reliably identifiable — caller should ask the user
  totalMinutes: number;
  apps: AppUsage[];
  warnings: string[];
}

// Validates a raw (already-JSON-parsed) Gemini response. Never trusts it
// blindly: unknown shapes, missing fields, and out-of-range values are all
// handled without throwing, so a partially-malformed response still yields
// whatever could be salvaged plus a warning list the UI can show.
export function validateGeminiExtraction(raw: RawGeminiExtraction): ParsedExtraction {
  const warnings: string[] = [];

  let date: string | null = null;
  if (typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    date = raw.date;
  } else if (raw.date !== undefined) {
    warnings.push("Couldn't reliably read a date from the screenshot — please set it.");
  }

  const rawApps = Array.isArray(raw.apps) ? raw.apps : [];
  if (!Array.isArray(raw.apps)) {
    warnings.push("No per-app breakdown was found — you can add apps manually.");
  }

  const sanitized = rawApps
    .map((a) => sanitizeAppEntry(a, warnings))
    .filter((a): a is AppUsage => a !== null);
  const apps = mergeDuplicateApps(sanitized);

  const reportedTotal =
    typeof raw.total_minutes === "number"
      ? raw.total_minutes
      : Number(raw.total_minutes);
  const totalMinutes = computeTotalMinutes(
    apps,
    Number.isFinite(reportedTotal) ? reportedTotal : null
  );

  return { date, totalMinutes, apps, warnings };
}

// Same validation path for manual entry — a human can also mistype a
// duration, so the same bounds apply regardless of source.
export function validateManualEntry(apps: AppUsage[], reportedTotal?: number | null) {
  const warnings: string[] = [];
  const sanitized = apps
    .map((a) => sanitizeAppEntry(a, warnings))
    .filter((a): a is AppUsage => a !== null);
  const merged = mergeDuplicateApps(sanitized);
  const totalMinutes = computeTotalMinutes(merged, reportedTotal);
  return { apps: merged, totalMinutes, warnings };
}
