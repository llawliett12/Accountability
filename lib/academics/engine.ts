// Pure academics logic: no DB, no AI, no framework imports. Same shape as
// lib/goals/engine.ts and lib/scoring/engine.ts — testable in isolation.

import type { AttendanceStatus, DeadlineStatus, AssessmentStatus } from "./types";

// ---------- attendance ----------

export type AttendanceZone = "safe" | "warning" | "danger";

export interface AttendanceInput {
  attendance_status: AttendanceStatus | null;
}

export interface AttendanceStats {
  totalOccurrences: number;
  trackedCount: number; // occurrences with a non-null attendance_status
  presentCount: number; // present + late count toward "attended"
  absentCount: number;
  percentage: number | null; // null when nothing has been tracked yet — never fabricated as 0 or 100
  target: number;
  zone: AttendanceZone | null;
}

// "Present" and "late" both count as attended (you showed up); "absent" does
// not; "excused" is tracked but excluded from the denominator entirely — an
// excused absence should neither help nor hurt the percentage. Untracked
// (null attendance_status) occurrences are excluded too, per the
// "untracked is not a failure" rule that applies everywhere else in this app.
export function computeAttendanceStats(
  occurrences: AttendanceInput[],
  target: number
): AttendanceStats {
  const tracked = occurrences.filter((o) => o.attendance_status !== null);
  const countable = tracked.filter((o) => o.attendance_status !== "excused");
  const presentCount = countable.filter(
    (o) => o.attendance_status === "present" || o.attendance_status === "late"
  ).length;
  const absentCount = countable.filter((o) => o.attendance_status === "absent").length;

  const percentage = countable.length > 0 ? (presentCount / countable.length) * 100 : null;

  let zone: AttendanceZone | null = null;
  if (percentage !== null) {
    if (percentage >= target) zone = "safe";
    else if (percentage >= target - 10) zone = "warning";
    else zone = "danger";
  }

  return {
    totalOccurrences: occurrences.length,
    trackedCount: tracked.length,
    presentCount,
    absentCount,
    percentage: percentage === null ? null : Math.round(percentage * 10) / 10,
    target,
    zone,
  };
}

// ---------- overdue (deadlines + assessments) ----------

export function isDeadlineOverdue(dueDate: string, status: DeadlineStatus, today: string): boolean {
  if (status === "completed") return false;
  return dueDate < today;
}

export function isAssessmentPast(date: string, status: AssessmentStatus, today: string): boolean {
  if (status === "completed") return false;
  return date < today;
}

// ---------- occurrence-date generation ----------
// Deterministic: given a class's weekly day_of_week and a date range,
// returns every calendar date in range matching that weekday. Never invents
// a meeting date outside the recurring pattern.
export function occurrenceDatesInRange(
  dayOfWeek: number,
  startDateISO: string,
  endDateISO: string
): string[] {
  const dates: string[] = [];
  const start = new Date(startDateISO + "T00:00:00Z");
  const end = new Date(endDateISO + "T00:00:00Z");
  if (start > end) return dates;

  const cursor = new Date(start);
  // Advance to the first matching weekday.
  const diff = (dayOfWeek - cursor.getUTCDay() + 7) % 7;
  cursor.setUTCDate(cursor.getUTCDate() + diff);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return dates;
}

// ---------- calendar week bounds (for date/week navigation) ----------
// Week starts Monday. Returns [startISO, endISO] inclusive.
export function weekBounds(dateISO: string): [string, string] {
  const d = new Date(dateISO + "T00:00:00Z");
  const day = d.getUTCDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
}

export function shiftWeek(dateISO: string, weeks: number): string {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

// ---------- prep/review summary ----------

export interface PrepReviewInput {
  prepared: boolean;
  reviewed: boolean;
  status: string; // occurrence status; only "held" occurrences count
}

export interface PrepReviewSummary {
  heldCount: number;
  preparedCount: number;
  reviewedCount: number;
  preparedRate: number | null;
  reviewedRate: number | null;
}

export function summarizePrepReview(occurrences: PrepReviewInput[]): PrepReviewSummary {
  const held = occurrences.filter((o) => o.status === "held");
  const preparedCount = held.filter((o) => o.prepared).length;
  const reviewedCount = held.filter((o) => o.reviewed).length;
  return {
    heldCount: held.length,
    preparedCount,
    reviewedCount,
    preparedRate: held.length > 0 ? Math.round((preparedCount / held.length) * 100) : null,
    reviewedRate: held.length > 0 ? Math.round((reviewedCount / held.length) * 100) : null,
  };
}

// ---------- assessment performance ----------

export interface AssessmentScoreInput {
  score: number | null;
  max_score: number | null;
}

// Average percentage across scored assessments only — never fabricates a
// score for an ungraded/upcoming assessment.
export function averageAssessmentPercentage(assessments: AssessmentScoreInput[]): number | null {
  const scored = assessments.filter(
    (a) => a.score !== null && a.max_score !== null && a.max_score > 0
  );
  if (scored.length === 0) return null;
  const pct = scored.reduce((sum, a) => sum + (a.score! / a.max_score!) * 100, 0) / scored.length;
  return Math.round(pct * 10) / 10;
}

// ---------- target vs actual, practice scores ----------

export interface ScoreComparison {
  target: number;
  actual: number;
  delta: number; // actual - target
  met: boolean;
}

// Returns null when either value is missing — never invents a comparison
// from an incomplete pair (e.g. a target set before the assessment is taken).
export function compareToTarget(
  targetScore: number | null | undefined,
  actualScore: number | null | undefined
): ScoreComparison | null {
  if (targetScore == null || actualScore == null) return null;
  const delta = Math.round((actualScore - targetScore) * 100) / 100;
  return { target: targetScore, actual: actualScore, delta, met: actualScore >= targetScore };
}

// Plain average of practice scores; null on an empty list rather than NaN.
export function averagePracticeScore(practiceScores: number[]): number | null {
  if (practiceScores.length === 0) return null;
  const avg = practiceScores.reduce((a, b) => a + b, 0) / practiceScores.length;
  return Math.round(avg * 100) / 100;
}
