// The ONE place weekly / monthly / review rollup numbers are calculated.
// Pure: hand it the per-day rows and it returns the period summary, so the
// /weekly, /monthly and /review pages can never disagree about the same days.

import type { DailyMetricsRow } from "@/lib/analytics/queries";
import {
  sum,
  average,
  strongestDay,
  weakestDay,
  consistencyScore,
  type DayValue,
} from "@/lib/analytics/engine";

export interface PeriodSummary {
  days: number;
  tasksPlanned: number;
  tasksCompleted: number;
  /** 0–100, rounded; 0 when nothing was planned. */
  completionRate: number;
  focusMinutes: number;
  pauseCount: number;
  pauseReasonTotals: Record<string, number>;
  topPauseReason: string | null;
  driftCount: number;
  /** Days that have a stored discipline score. */
  scoredDays: number;
  /** null when no day in the period has been scored. */
  avgDisciplineScore: number | null;
  avgNegativeScore: number | null;
  /** Average over nights that have a sleep log (> 0 min); null if none. */
  avgSleepMinutes: number | null;
  meditationDays: number;
  avgMood: number | null;
  avgEnergy: number | null;
  strongestDay: DayValue | null;
  weakestDay: DayValue | null;
  /** 0–100, how tightly the daily scores cluster. */
  consistency: number;
}

function avgOrNull(values: number[]): number | null {
  return values.length > 0 ? average(values) : null;
}

/** Average of the positive values only (0 / missing = "not logged"). */
export function averagePositive(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => typeof v === "number" && v > 0);
  return valid.length > 0 ? Math.round(average(valid)) : null;
}

export function summarizePeriod(rows: DailyMetricsRow[]): PeriodSummary {
  const scoreDays: DayValue[] = rows
    .filter((r) => r.disciplineScore !== null)
    .map((r) => ({ date: r.date, value: r.disciplineScore as number }));
  const scores = scoreDays.map((d) => d.value);

  const pauseReasonTotals: Record<string, number> = {};
  for (const r of rows) {
    for (const [reason, count] of Object.entries(r.pauseReasons)) {
      pauseReasonTotals[reason] = (pauseReasonTotals[reason] ?? 0) + count;
    }
  }
  const topPauseReason =
    Object.entries(pauseReasonTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const tasksPlanned = sum(rows.map((r) => r.tasksPlanned));
  const tasksCompleted = sum(rows.map((r) => r.tasksCompleted));

  return {
    days: rows.length,
    tasksPlanned,
    tasksCompleted,
    completionRate: tasksPlanned > 0 ? Math.round((tasksCompleted / tasksPlanned) * 100) : 0,
    focusMinutes: sum(rows.map((r) => r.focusMinutes)),
    pauseCount: sum(rows.map((r) => r.pauseCount)),
    pauseReasonTotals,
    topPauseReason,
    driftCount: sum(rows.map((r) => r.driftCount)),
    scoredDays: scores.length,
    avgDisciplineScore: avgOrNull(scores),
    avgNegativeScore: avgOrNull(
      rows.map((r) => r.negativeScore).filter((s): s is number => s !== null)
    ),
    avgSleepMinutes: averagePositive(rows.map((r) => r.sleepMinutes)),
    meditationDays: rows.filter((r) => r.meditationMinutes > 0).length,
    avgMood: avgOrNull(rows.map((r) => r.moodAvg).filter((s): s is number => s !== null)),
    avgEnergy: avgOrNull(rows.map((r) => r.energyAvg).filter((s): s is number => s !== null)),
    strongestDay: strongestDay(scoreDays),
    weakestDay: weakestDay(scoreDays),
    consistency: consistencyScore(scores),
  };
}
