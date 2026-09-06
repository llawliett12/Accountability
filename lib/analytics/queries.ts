import { createClient } from "@/lib/supabase/server";
import { average } from "@/lib/analytics/engine";

export interface DailyMetricsRow {
  date: string;
  tasksPlanned: number;
  tasksCompleted: number;
  focusMinutes: number;
  pauseCount: number;
  pauseReasons: Record<string, number>;
  driftCount: number;
  disciplineScore: number | null;
  negativeScore: number | null;
  sleepMinutes: number | null;
  meditationMinutes: number;
  moodAvg: number | null;
  energyAvg: number | null;
}

interface Acc {
  date: string;
  tasksPlanned: number;
  tasksCompleted: number;
  focusMinutes: number;
  pauseCount: number;
  pauseReasons: Record<string, number>;
  driftCount: number;
  disciplineScore: number | null;
  negativeScore: number | null;
  sleepMinutes: number | null;
  meditationMinutes: number;
  moodValues: number[];
  energyValues: number[];
}

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function fetchDailyMetrics(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailyMetricsRow[]> {
  const supabase = await createClient();

  const [{ data: plans }, { data: scores }, { data: sleep }, { data: meditation }, { data: mood }, { data: checkIns }] =
    await Promise.all([
      supabase
        .from("daily_plans")
        .select("id, date")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("discipline_scores")
        .select("date, score, negative_score")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("sleep_logs")
        .select("date, total_minutes")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("meditation_logs")
        .select("date, happened, duration_min")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("mood_logs")
        .select("date, mood, energy")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("check_ins")
        .select("timestamp, drift_state")
        .eq("user_id", userId)
        .gte("timestamp", `${startDate}T00:00:00`)
        .lte("timestamp", `${endDate}T23:59:59`),
    ]);

  const planIds = (plans ?? []).map((p) => p.id);
  const planIdToDate = new Map((plans ?? []).map((p) => [p.id, p.date as string]));

  const { data: tasks } = planIds.length
    ? await supabase.from("tasks").select("daily_plan_id, status").in("daily_plan_id", planIds)
    : { data: [] };

  const { data: sessions } = await supabase
    .from("focus_sessions")
    .select("id, started_at, focused_duration_sec")
    .eq("user_id", userId)
    .gte("started_at", `${startDate}T00:00:00`)
    .lte("started_at", `${endDate}T23:59:59`);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: pauses } = sessionIds.length
    ? await supabase.from("focus_pauses").select("focus_session_id, reason").in("focus_session_id", sessionIds)
    : { data: [] };

  const sessionIdToDate = new Map(
    (sessions ?? []).map((s) => [s.id, (s.started_at as string).slice(0, 10)])
  );

  const dates = dateRange(startDate, endDate);
  const acc = new Map<string, Acc>();
  for (const date of dates) {
    acc.set(date, {
      date,
      tasksPlanned: 0,
      tasksCompleted: 0,
      focusMinutes: 0,
      pauseCount: 0,
      pauseReasons: {},
      driftCount: 0,
      disciplineScore: null,
      negativeScore: null,
      sleepMinutes: null,
      meditationMinutes: 0,
      moodValues: [],
      energyValues: [],
    });
  }

  for (const t of tasks ?? []) {
    const date = planIdToDate.get(t.daily_plan_id);
    const a = date ? acc.get(date) : undefined;
    if (!a) continue;
    a.tasksPlanned++;
    if (t.status === "completed") a.tasksCompleted++;
  }

  for (const s of sessions ?? []) {
    const date = (s.started_at as string).slice(0, 10);
    const a = acc.get(date);
    if (!a) continue;
    a.focusMinutes += (s.focused_duration_sec ?? 0) / 60;
  }

  for (const p of pauses ?? []) {
    const date = sessionIdToDate.get(p.focus_session_id);
    const a = date ? acc.get(date) : undefined;
    if (!a) continue;
    a.pauseCount++;
    if (p.reason) a.pauseReasons[p.reason] = (a.pauseReasons[p.reason] ?? 0) + 1;
  }

  for (const c of checkIns ?? []) {
    const date = (c.timestamp as string).slice(0, 10);
    const a = acc.get(date);
    if (!a) continue;
    if (c.drift_state === "drifting") a.driftCount++;
  }

  for (const s of scores ?? []) {
    const a = acc.get(s.date as string);
    if (!a) continue;
    a.disciplineScore = s.score;
    a.negativeScore = s.negative_score;
  }

  for (const s of sleep ?? []) {
    const a = acc.get(s.date as string);
    if (!a) continue;
    a.sleepMinutes = s.total_minutes;
  }

  for (const m of meditation ?? []) {
    const a = acc.get(m.date as string);
    if (!a) continue;
    if (m.happened) a.meditationMinutes += m.duration_min ?? 0;
  }

  for (const m of mood ?? []) {
    const a = acc.get(m.date as string);
    if (!a) continue;
    a.moodValues.push(m.mood);
    a.energyValues.push(m.energy);
  }

  return dates.map((date) => {
    const a = acc.get(date)!;
    return {
      date: a.date,
      tasksPlanned: a.tasksPlanned,
      tasksCompleted: a.tasksCompleted,
      focusMinutes: Math.round(a.focusMinutes),
      pauseCount: a.pauseCount,
      pauseReasons: a.pauseReasons,
      driftCount: a.driftCount,
      disciplineScore: a.disciplineScore,
      negativeScore: a.negativeScore,
      sleepMinutes: a.sleepMinutes,
      meditationMinutes: a.meditationMinutes,
      moodAvg: a.moodValues.length ? average(a.moodValues) : null,
      energyAvg: a.energyValues.length ? average(a.energyValues) : null,
    };
  });
}

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
