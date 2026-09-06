"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  computeDisciplineScore,
  DayMetrics,
  explainScore,
  DEFAULT_WEIGHTS,
  DEFAULT_VERDICT_BANDS,
  ScoringWeights,
  nextStreakState,
} from "@/lib/scoring/engine";
import { recomputeAndStoreProgress } from "@/lib/goals/actions";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Ensures a daily_plans row exists for today (or a given date) and returns its id.
export async function getOrCreateDailyPlan(date: string = todayISO()) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("daily_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("daily_plans")
    .insert({ user_id: user.id, date })
    .select("id")
    .single();

  if (error) throw error;
  return created.id as string;
}

export async function createTask(input: {
  title: string;
  category?: string;
  priority?: number;
  planned_duration_min?: number;
  planned_start?: string;
  planned_end?: string;
  deadline?: string;
  notes?: string;
  is_top3?: boolean;
  goal_id?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const dailyPlanId = await getOrCreateDailyPlan();

  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    daily_plan_id: dailyPlanId,
    title: input.title,
    category: input.category ?? null,
    priority: input.priority ?? 3,
    planned_duration_min: input.planned_duration_min ?? null,
    planned_start: input.planned_start ?? null,
    planned_end: input.planned_end ?? null,
    deadline: input.deadline ?? null,
    notes: input.notes ?? null,
    is_top3: input.is_top3 ?? false,
    goal_id: input.goal_id ?? null,
  });

  if (error) throw error;
  await bumpStreak(supabase, user.id, "planning", todayISO());
  // A newly linked task changes its goal's task-derived progress (denominator
  // grows even before completion), so the goal tree needs a fresh number.
  if (input.goal_id) await recomputeAndStoreProgress(user.id);
  revalidatePath("/plan");
  revalidatePath("/");
}

export async function updateTaskStatus(taskId: string, status: string, clientId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: updated, error } = await supabase
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select("goal_id")
    .single();

  if (error) throw error;

  // clientId (set when this call is a replay from the offline queue) makes
  // a re-sent retry a no-op instead of a duplicate task_logs row — see
  // migration 0007's (user_id, client_id) unique index.
  await supabase.from("task_logs").upsert(
    {
      task_id: taskId,
      user_id: user.id,
      event_type: "status_change",
      value: status,
      client_id: clientId ?? null,
    },
    clientId ? { onConflict: "user_id,client_id", ignoreDuplicates: true } : undefined
  );

  // Real task completion is the whole point of task-linked goal progress —
  // recompute so a completed/skipped/etc. task is reflected immediately.
  if (updated?.goal_id) await recomputeAndStoreProgress(user.id);

  revalidatePath("/plan");
  revalidatePath("/");
}

// Reconciliation: never silently assumes failure. Explicitly records the
// user's answer for a planned task with no tracking data.
export async function reconcileTask(
  taskId: string,
  answer: "did_but_forgot" | "didnt_do" | "rescheduled" | "did_something_else" | "unexpected_event"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const statusMap: Record<string, string> = {
    did_but_forgot: "completed",
    didnt_do: "skipped",
    rescheduled: "rescheduled",
    did_something_else: "skipped",
    unexpected_event: "skipped",
  };

  const { data: updated, error } = await supabase
    .from("tasks")
    .update({ status: statusMap[answer], updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select("goal_id")
    .single();
  if (error) throw error;

  await supabase.from("task_logs").insert({
    task_id: taskId,
    user_id: user.id,
    event_type: "reconciliation_answer",
    value: answer,
  });

  if (updated?.goal_id) await recomputeAndStoreProgress(user.id);

  revalidatePath("/plan");
  revalidatePath("/night");
}

export async function createCheckIn(input: {
  actual_activity: string;
  intended_task_id?: string;
  drift_state: "on_track" | "drifting" | "unknown";
  clientId?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("check_ins").upsert(
    {
      user_id: user.id,
      actual_activity: input.actual_activity,
      intended_task_id: input.intended_task_id ?? null,
      drift_state: input.drift_state,
      client_id: input.clientId ?? null,
    },
    input.clientId ? { onConflict: "user_id,client_id", ignoreDuplicates: true } : undefined
  );
  if (error) throw error;
  await bumpStreak(supabase, user.id, "tracking", todayISO());

  revalidatePath("/now");
  revalidatePath("/");
}

// --- Focus timer: timestamp-based so it survives Android tab backgrounding ---

// clientId lets the offline queue generate the session's id on-device (when
// starting a session while offline) so that a subsequent pause/stop event —
// which the user may also trigger before the session has ever synced — can
// reference the same id from the moment it's created. Passing it through as
// an explicit `id` and upserting with ignoreDuplicates makes a queued replay
// safe even if the row already made it to the server some other way.
export async function startFocusSession(
  taskId?: string,
  assessmentId?: string,
  clientId?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const id = clientId ?? crypto.randomUUID();

  const { error } = await supabase.from("focus_sessions").upsert(
    {
      id,
      user_id: user.id,
      task_id: taskId ?? null,
      assessment_id: assessmentId ?? null,
      started_at: new Date().toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (error) throw error;
  revalidatePath("/now");
  return id;
}

export async function startPause(sessionId: string, reason: string, clientId?: string) {
  const supabase = await createClient();
  const id = clientId ?? crypto.randomUUID();

  const { error } = await supabase.from("focus_pauses").upsert(
    {
      id,
      focus_session_id: sessionId,
      started_at: new Date().toISOString(),
      reason,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) throw error;
  revalidatePath("/now");
  return id;
}

export async function endPause(pauseId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("focus_pauses")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", pauseId);
  if (error) throw error;
  revalidatePath("/now");
}

// Stops the session and computes focused duration = total elapsed - paused time.
// All from timestamps stored in Postgres, never a client-side live counter.
export async function stopFocusSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: session, error: sessionErr } = await supabase
    .from("focus_sessions")
    .select("started_at")
    .eq("id", sessionId)
    .single();
  if (sessionErr) throw sessionErr;

  const { data: pauses, error: pausesErr } = await supabase
    .from("focus_pauses")
    .select("started_at, ended_at")
    .eq("focus_session_id", sessionId);
  if (pausesErr) throw pausesErr;

  const endedAt = new Date();
  const startedAt = new Date(session.started_at);
  const totalElapsedSec = (endedAt.getTime() - startedAt.getTime()) / 1000;

  const pausedSec = (pauses ?? []).reduce((sum, p) => {
    const pStart = new Date(p.started_at).getTime();
    const pEnd = p.ended_at ? new Date(p.ended_at).getTime() : endedAt.getTime();
    return sum + Math.max(0, (pEnd - pStart) / 1000);
  }, 0);

  const focusedDurationSec = Math.max(0, Math.round(totalElapsedSec - pausedSec));

  const { error } = await supabase
    .from("focus_sessions")
    .update({
      ended_at: endedAt.toISOString(),
      focused_duration_sec: focusedDurationSec,
    })
    .eq("id", sessionId);
  if (error) throw error;

  if (focusedDurationSec > 0) {
    await bumpStreak(supabase, user.id, "study", todayISO());
  }

  revalidatePath("/now");
  return focusedDurationSec;
}

// --- Discipline scoring: pulls the day's raw numbers, runs the pure engine ---

export async function computeAndStoreDailyScore(date: string = todayISO()) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: plan } = await supabase
    .from("daily_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, status, planned_start, planned_duration_min")
    .eq("daily_plan_id", plan?.id ?? "");

  const taskIds = (tasks ?? []).map((t) => t.id);

  // Real first-start timestamps, replacing the earlier "not not_started" proxy.
  const { data: startLogs } = taskIds.length
    ? await supabase
        .from("task_logs")
        .select("task_id, created_at")
        .in("task_id", taskIds)
        .eq("event_type", "status_change")
        .eq("value", "in_progress")
        .order("created_at", { ascending: true })
    : { data: [] };

  const firstStartByTask = new Map<string, string>();
  for (const log of startLogs ?? []) {
    if (!firstStartByTask.has(log.task_id)) firstStartByTask.set(log.task_id, log.created_at);
  }

  const { data: sessions } = await supabase
    .from("focus_sessions")
    .select("focused_duration_sec")
    .eq("user_id", user.id)
    .gte("started_at", `${date}T00:00:00`)
    .lte("started_at", `${date}T23:59:59`);

  const { data: checkIns } = await supabase
    .from("check_ins")
    .select("drift_state")
    .eq("user_id", user.id)
    .gte("timestamp", `${date}T00:00:00`)
    .lte("timestamp", `${date}T23:59:59`);

  const config = await getOrCreateScoringConfig(user.id);
  const taskList = tasks ?? [];

  const tasksOnTimeStart = taskList.filter((t) => {
    if (!t.planned_start) return false;
    const actualStart = firstStartByTask.get(t.id);
    if (!actualStart) return false;
    const diffMin =
      Math.abs(new Date(actualStart).getTime() - new Date(t.planned_start).getTime()) / 60000;
    return diffMin <= config.onTimeToleranceMin;
  }).length;

  const plannedStudyMinutes = taskList.reduce(
    (sum, t) => sum + (t.planned_duration_min ?? 0),
    0
  );

  const metrics: DayMetrics = {
    tasksPlanned: taskList.length,
    tasksCompleted: taskList.filter((t) => t.status === "completed").length,
    tasksPartial: taskList.filter((t) => t.status === "partial").length,
    tasksUnreconciled: taskList.filter((t) => t.status === "unreconciled").length,
    tasksOnTimeStart,
    plannedStudyMinutes,
    actualFocusMinutes:
      (sessions ?? []).reduce((s, f) => s + (f.focused_duration_sec ?? 0), 0) / 60,
    expectedCheckIns: config.expectedCheckIns,
    actualCheckIns: (checkIns ?? []).length,
    driftMinutes: (checkIns ?? []).filter((c) => c.drift_state === "drifting").length * 15,
    missedCommitments: taskList.filter((t) => t.status === "skipped").length,
    reschedules: taskList.filter((t) => t.status === "rescheduled").length,
  };

  const result = computeDisciplineScore(metrics, config.weights, config.verdictBands);
  const explanation = explainScore(result.components, result.verdictLabel);

  await supabase.from("discipline_scores").upsert(
    {
      user_id: user.id,
      date,
      score: result.score,
      negative_score: result.negativeScore,
      components: result.components,
    },
    { onConflict: "user_id,date" }
  );

  await supabase.from("discipline_verdicts").upsert(
    {
      user_id: user.id,
      date,
      label: result.verdictLabel,
      explanation,
    },
    { onConflict: "user_id,date" }
  );

  await bumpStreak(supabase, user.id, "daily_review", date);

  revalidatePath(`/discipline/${date}`);
  revalidatePath(`/report/${date}`);
  revalidatePath("/");

  return result;
}

// Reads the user's configurable scoring weights/verdict bands/constants,
// creating the row with engine defaults on first use. Editing this row
// (via /settings, or directly in Supabase) changes future scores with no
// redeploy — this is what makes the formula "transparent and configurable."
export async function getOrCreateScoringConfig(userId: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("scoring_config")
    .select("weights, verdict_bands, expected_check_ins, on_time_tolerance_min")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return {
      weights: existing.weights as ScoringWeights,
      verdictBands: existing.verdict_bands as Record<string, number>,
      expectedCheckIns: existing.expected_check_ins as number,
      onTimeToleranceMin: existing.on_time_tolerance_min as number,
    };
  }

  const { error } = await supabase.from("scoring_config").insert({
    user_id: userId,
    weights: DEFAULT_WEIGHTS,
    verdict_bands: DEFAULT_VERDICT_BANDS,
  });
  // A concurrent insert (e.g. a duplicate request) is fine to ignore here —
  // the defaults are the same either way.
  if (error && error.code !== "23505") throw error;

  return {
    weights: DEFAULT_WEIGHTS,
    verdictBands: DEFAULT_VERDICT_BANDS,
    expectedCheckIns: 4,
    onTimeToleranceMin: 15,
  };
}

export async function saveScoringConfig(input: {
  weights: ScoringWeights;
  verdictBands: Record<string, number>;
  expectedCheckIns: number;
  onTimeToleranceMin: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("scoring_config").upsert(
    {
      user_id: user.id,
      weights: input.weights,
      verdict_bands: input.verdictBands,
      expected_check_ins: input.expectedCheckIns,
      on_time_tolerance_min: input.onTimeToleranceMin,
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;

  revalidatePath("/settings");
}

// --- Streaks: consecutive-day counters, idempotent per day ---

type StreakType = "planning" | "study" | "daily_review" | "tracking";

async function bumpStreak(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  streakType: StreakType,
  date: string
) {
  const { data: existing } = await supabase
    .from("streaks")
    .select("current_count, last_date")
    .eq("user_id", userId)
    .eq("streak_type", streakType)
    .maybeSingle();

  const { count, alreadyRecordedToday } = nextStreakState(
    existing?.last_date ?? null,
    existing?.current_count ?? 0,
    date
  );

  if (alreadyRecordedToday) return;

  await supabase.from("streaks").upsert(
    { user_id: userId, streak_type: streakType, current_count: count, last_date: date },
    { onConflict: "user_id,streak_type" }
  );
}
