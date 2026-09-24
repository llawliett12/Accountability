// Pure, framework-free scoring engine. No Supabase/Gemini imports here on purpose —
// this must run and be unit-tested with zero AI and zero DB involvement.

export interface ScoringWeights {
  taskCompletionRate: number;
  onTimeStartRate: number;
  focusTimeRatio: number;
  trackingConsistency: number;
  driftPenalty: number;
  missedCommitmentPenalty: number;
  reschedulePenalty: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  taskCompletionRate: 30,
  onTimeStartRate: 15,
  focusTimeRatio: 20,
  trackingConsistency: 15,
  driftPenalty: 10,
  missedCommitmentPenalty: 5,
  reschedulePenalty: 5,
};

export const DEFAULT_VERDICT_BANDS: Record<string, number> = {
  EXCELLENT: 90,
  GOOD: 75,
  AVERAGE: 60,
  WEAK: 45,
  POOR: 25,
  LOSER: 0,
};

// Raw daily inputs — all pulled from Postgres by the caller. This function
// never queries anything; it just does the math on numbers it's given.
export interface DayMetrics {
  tasksPlanned: number;
  tasksCompleted: number;
  tasksPartial: number;
  tasksUnreconciled: number; // no tracking data — NOT the same as failed
  tasksOnTimeStart: number;
  plannedStudyMinutes: number;
  actualFocusMinutes: number;
  expectedCheckIns: number;
  actualCheckIns: number;
  driftMinutes: number;
  missedCommitments: number;
  reschedules: number;
}

export interface ScoreComponents {
  taskCompletionRate: number; // 0..1
  onTimeStartRate: number; // 0..1
  focusTimeRatio: number; // 0..1 (capped at 1)
  trackingConsistency: number; // 0..1
  driftMinutesNormalized: number; // 0..1
  missedCommitments: number; // raw count
  reschedules: number; // raw count
}

export interface ScoreResult {
  score: number; // 0..100
  negativeScore: number; // separate, accumulating signal — not "100 - score"
  components: ScoreComponents;
  verdictLabel: string;
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(1, Math.max(0, numerator / denominator));
}

export function computeScoreComponents(m: DayMetrics): ScoreComponents {
  // Unreconciled tasks are excluded from the completion denominator entirely —
  // they affect trackingConsistency instead, never counted as a failure.
  const reconciledPlanned = Math.max(0, m.tasksPlanned - m.tasksUnreconciled);

  return {
    taskCompletionRate: safeRatio(
      m.tasksCompleted + 0.5 * m.tasksPartial,
      reconciledPlanned
    ),
    onTimeStartRate: safeRatio(m.tasksOnTimeStart, reconciledPlanned),
    focusTimeRatio: safeRatio(m.actualFocusMinutes, m.plannedStudyMinutes),
    trackingConsistency: safeRatio(m.actualCheckIns, m.expectedCheckIns),
    driftMinutesNormalized: Math.min(1, m.driftMinutes / 120), // 120min drift = fully saturated penalty
    missedCommitments: m.missedCommitments,
    reschedules: m.reschedules,
  };
}

export function computeDisciplineScore(
  metrics: DayMetrics,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  verdictBands: Record<string, number> = DEFAULT_VERDICT_BANDS
): ScoreResult {
  const c = computeScoreComponents(metrics);

  const positive =
    weights.taskCompletionRate * c.taskCompletionRate +
    weights.onTimeStartRate * c.onTimeStartRate +
    weights.focusTimeRatio * c.focusTimeRatio +
    weights.trackingConsistency * c.trackingConsistency;

  const penalty =
    weights.driftPenalty * c.driftMinutesNormalized +
    weights.missedCommitmentPenalty * Math.min(1, c.missedCommitments / 3) +
    weights.reschedulePenalty * Math.min(1, c.reschedules / 3);

  const score = Math.min(100, Math.max(0, positive - penalty));

  // Negative score is its own accumulating signal, independent of the 0-100 score,
  // so a good day can still surface a specific bad pattern rather than being masked.
  const negativeScore =
    c.missedCommitments * 10 +
    c.reschedules * 5 +
    c.driftMinutesNormalized * 20 +
    (1 - c.trackingConsistency) * 10;

  const verdictLabel = labelForScore(score, verdictBands);

  return { score: Math.round(score * 10) / 10, negativeScore: Math.round(negativeScore * 10) / 10, components: c, verdictLabel };
}

// Pure streak-continuation logic: given the last recorded date and today's
// date, returns the new count (or null if today was already recorded, i.e.
// no change needed). No DB access — same testability philosophy as scoring.
export function nextStreakState(
  lastDate: string | null,
  currentCount: number,
  today: string
): { count: number; alreadyRecordedToday: boolean } {
  if (lastDate === today) {
    return { count: currentCount, alreadyRecordedToday: true };
  }
  if (!lastDate) {
    return { count: 1, alreadyRecordedToday: false };
  }
  const prevDay = new Date(today);
  prevDay.setDate(prevDay.getDate() - 1);
  const prevDayStr = prevDay.toISOString().slice(0, 10);
  const count = lastDate === prevDayStr ? currentCount + 1 : 1;
  return { count, alreadyRecordedToday: false };
}

function labelForScore(score: number, bands: Record<string, number>): string {
  const sorted = Object.entries(bands).sort((a, b) => b[1] - a[1]); // highest threshold first
  for (const [label, threshold] of sorted) {
    if (score >= threshold) return label;
  }
  return sorted[sorted.length - 1][0];
}

// Builds the templated (non-AI) explanation shown in the Discipline Log.
// Gemini may later rephrase this, but the facts always come from `components`.
export function explainScore(components: ScoreComponents, verdictLabel: string): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const parts = [
    `Task completion ${pct(components.taskCompletionRate)}`,
    `on-time starts ${pct(components.onTimeStartRate)}`,
    `focus time ${pct(components.focusTimeRatio)} of plan`,
    `tracking ${pct(components.trackingConsistency)}`,
  ];
  if (components.driftMinutesNormalized > 0) {
    parts.push(`drift ${Math.round(components.driftMinutesNormalized * 120)}min`);
  }
  if (components.missedCommitments > 0) {
    parts.push(`${components.missedCommitments} missed commitment(s)`);
  }
  if (components.reschedules > 0) {
    parts.push(`${components.reschedules} reschedule(s)`);
  }
  return `${verdictLabel}: ${parts.join(", ")}.`;
}
