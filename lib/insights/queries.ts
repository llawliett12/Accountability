import { createClient } from "@/lib/supabase/server";
import { fetchDailyMetrics, type DailyMetricsRow } from "@/lib/analytics/queries";
import { fetchScreenTimeMinutesByDate } from "@/lib/screen-time/queries";
import { extractPairs, buildPattern, buildGroupComparison, type Pattern, type GroupComparison } from "./engine";

export interface InsightsData {
  patterns: Pattern[];
  morningEveningComparison: GroupComparison;
  daysAnalyzed: number;
  dailyRows: DailyMetricsRow[];
  screenTimeByDate: Map<string, number>;
}

export async function fetchInsights(
  userId: string,
  startDate: string,
  endDate: string
): Promise<InsightsData> {
  const supabase = await createClient();

  const [dailyRows, screenTimeByDate] = await Promise.all([
    fetchDailyMetrics(userId, startDate, endDate),
    fetchScreenTimeMinutesByDate(userId, startDate, endDate),
  ]);

  const rows = dailyRows.map((r) => ({
    ...r,
    screenTimeMinutes: screenTimeByDate.get(r.date) ?? null,
  }));

  const patterns: Pattern[] = [];

  // Screen time vs focus/study time
  {
    const { xs, ys } = extractPairs(
      rows,
      (r) => r.screenTimeMinutes,
      (r) => r.focusMinutes
    );
    patterns.push(buildPattern("screen time", "focus time", xs, ys));
  }

  // Sleep vs focus time
  {
    const { xs, ys } = extractPairs(
      rows,
      (r) => r.sleepMinutes,
      (r) => r.focusMinutes
    );
    patterns.push(buildPattern("sleep", "focus time", xs, ys));
  }

  // Sleep vs discipline score
  {
    const { xs, ys } = extractPairs(
      rows,
      (r) => r.sleepMinutes,
      (r) => r.disciplineScore
    );
    patterns.push(buildPattern("sleep", "discipline score", xs, ys));
  }

  // Planning (tasks planned) vs completion (tasks completed)
  {
    const { xs, ys } = extractPairs(
      rows,
      (r) => (r.tasksPlanned > 0 ? r.tasksPlanned : null),
      (r) => r.tasksCompleted
    );
    patterns.push(buildPattern("tasks planned", "tasks completed", xs, ys));
  }

  // Mood vs productivity (focus minutes)
  {
    const { xs, ys } = extractPairs(
      rows,
      (r) => r.moodAvg,
      (r) => r.focusMinutes
    );
    patterns.push(buildPattern("mood", "focus time", xs, ys));
  }

  // Energy vs focus
  {
    const { xs, ys } = extractPairs(
      rows,
      (r) => r.energyAvg,
      (r) => r.focusMinutes
    );
    patterns.push(buildPattern("energy", "focus time", xs, ys));
  }

  // Meditation (minutes, 0 when skipped) vs mood
  {
    const { xs, ys } = extractPairs(
      rows,
      (r) => r.meditationMinutes,
      (r) => r.moodAvg
    );
    patterns.push(buildPattern("meditation", "mood", xs, ys));
  }

  // Pause frequency vs focus session length (session-level, not daily)
  const { xs: pauseXs, ys: durationYs } = await fetchSessionPauseVsDuration(
    supabase,
    userId,
    startDate,
    endDate
  );
  patterns.push(buildPattern("pause count", "session length", pauseXs, durationYs));

  // Class preparation vs assessment performance, and listening vs performance
  const academic = await fetchAcademicPerformancePairs(supabase, userId, startDate, endDate);
  patterns.push(
    buildPattern("class preparation rate", "assessment score", academic.prepXs, academic.scoreYsForPrep)
  );
  patterns.push(
    buildPattern(
      "listening rating",
      "assessment score",
      academic.listeningXs,
      academic.scoreYsForListening
    )
  );

  // Morning vs evening focus time (group comparison, not correlation)
  const { morning, evening } = await fetchMorningEveningFocusMinutes(
    supabase,
    userId,
    startDate,
    endDate
  );
  const morningEveningComparison = buildGroupComparison("Morning", "Evening", morning, evening);

  return {
    patterns,
    morningEveningComparison,
    daysAnalyzed: rows.length,
    dailyRows,
    screenTimeByDate,
  };
}

async function fetchSessionPauseVsDuration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ xs: number[]; ys: number[] }> {
  const { data: sessions } = await supabase
    .from("focus_sessions")
    .select("id, focused_duration_sec")
    .eq("user_id", userId)
    .gte("started_at", `${startDate}T00:00:00`)
    .lte("started_at", `${endDate}T23:59:59`)
    .not("focused_duration_sec", "is", null);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) return { xs: [], ys: [] };

  const { data: pauses } = await supabase
    .from("focus_pauses")
    .select("focus_session_id")
    .in("focus_session_id", sessionIds);

  const pauseCounts = new Map<string, number>();
  for (const p of pauses ?? []) {
    pauseCounts.set(p.focus_session_id, (pauseCounts.get(p.focus_session_id) ?? 0) + 1);
  }

  const xs = (sessions ?? []).map((s) => pauseCounts.get(s.id) ?? 0);
  const ys = (sessions ?? []).map((s) => (s.focused_duration_sec ?? 0) / 60);
  return { xs, ys };
}

async function fetchAcademicPerformancePairs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  startDate: string,
  endDate: string
) {
  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, class_id, date, score, max_score")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .not("class_id", "is", null)
    .not("score", "is", null)
    .not("max_score", "is", null);

  const scored = (assessments ?? []).filter((a) => (a.max_score ?? 0) > 0);
  if (scored.length === 0) {
    return { prepXs: [], scoreYsForPrep: [], listeningXs: [], scoreYsForListening: [] };
  }

  const classIds = Array.from(new Set(scored.map((a) => a.class_id as string)));
  const { data: occurrences } = await supabase
    .from("class_occurrences")
    .select("class_id, date, prepared, listening_rating, status")
    .in("class_id", classIds)
    .lte("date", endDate);

  const prepXs: number[] = [];
  const scoreYsForPrep: number[] = [];
  const listeningXs: number[] = [];
  const scoreYsForListening: number[] = [];

  for (const a of scored) {
    const relevant = (occurrences ?? []).filter(
      (o) => o.class_id === a.class_id && o.date <= a.date && o.status === "held"
    );
    if (relevant.length === 0) continue;

    const scorePct = (a.score! / a.max_score!) * 100;

    const preparedCount = relevant.filter((o) => o.prepared).length;
    prepXs.push((preparedCount / relevant.length) * 100);
    scoreYsForPrep.push(scorePct);

    const ratings = relevant
      .map((o) => o.listening_rating)
      .filter((r): r is number => r !== null);
    if (ratings.length > 0) {
      listeningXs.push(ratings.reduce((s, r) => s + r, 0) / ratings.length);
      scoreYsForListening.push(scorePct);
    }
  }

  return { prepXs, scoreYsForPrep, listeningXs, scoreYsForListening };
}

async function fetchMorningEveningFocusMinutes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ morning: number[]; evening: number[] }> {
  const { data: sessions } = await supabase
    .from("focus_sessions")
    .select("started_at, focused_duration_sec")
    .eq("user_id", userId)
    .gte("started_at", `${startDate}T00:00:00`)
    .lte("started_at", `${endDate}T23:59:59`)
    .not("focused_duration_sec", "is", null);

  const morning: number[] = [];
  const evening: number[] = [];

  for (const s of sessions ?? []) {
    const hour = new Date(s.started_at as string).getHours();
    const minutes = (s.focused_duration_sec ?? 0) / 60;
    if (hour < 12) morning.push(minutes);
    else if (hour >= 17) evening.push(minutes);
  }

  return { morning, evening };
}
