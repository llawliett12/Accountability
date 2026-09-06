import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToPreferences, NotificationPreferencesRow } from "./types";
import type {
  NotificationPreferences,
  UpcomingClassOccurrence,
  UpcomingDeadline,
  UpcomingAssessment,
  UpcomingPlannedTask,
} from "./engine";

export interface DispatchUser {
  userId: string;
  prefs: NotificationPreferences;
  subscriptions: { endpoint: string; p256dh: string; auth_key: string }[];
}

// Deadlines/assessments only store a due *date*, not a due time (see
// lib/academics — Phase 3 schema). We treat the deadline as due at the very
// end of that local day; a lead-time reminder is computed back from there.
// This is an approximation, documented in PROGRESS.md: it will always fire
// on the correct date, but "24h before" really means "24h before end of day".
const END_OF_DAY_MINUTE = 23 * 60 + 59;

export async function fetchUsersWithNotificationsEnabled(): Promise<DispatchUser[]> {
  const supabase = createAdminClient();

  const { data: prefRows, error: prefErr } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("enabled", true);
  if (prefErr) throw prefErr;
  if (!prefRows || prefRows.length === 0) return [];

  const userIds = prefRows.map((r) => r.user_id as string);

  const { data: subs, error: subErr } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth_key")
    .in("user_id", userIds);
  if (subErr) throw subErr;

  const subsByUser = new Map<string, { endpoint: string; p256dh: string; auth_key: string }[]>();
  for (const s of subs ?? []) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth_key: s.auth_key });
    subsByUser.set(s.user_id, list);
  }

  return prefRows.map((row) => ({
    userId: row.user_id as string,
    prefs: rowToPreferences(row as NotificationPreferencesRow),
    subscriptions: subsByUser.get(row.user_id as string) ?? [],
  }));
}

function timeToMinutes(t: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export async function fetchTodaysClasses(
  userId: string,
  localDate: string
): Promise<UpcomingClassOccurrence[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("class_occurrences")
    .select("id, start_time, status, classes(name)")
    .eq("user_id", userId)
    .eq("date", localDate)
    .eq("status", "scheduled");
  if (error) throw error;

  return (data ?? []).map((row) => {
    const className =
      (row as unknown as { classes: { name: string } | { name: string }[] | null }).classes;
    const name = Array.isArray(className) ? className[0]?.name : className?.name;
    return {
      occurrenceId: row.id as string,
      className: name ?? "Class",
      startMinuteOfDay: timeToMinutes(row.start_time as string | null),
    };
  });
}

export async function fetchUpcomingDeadlines(
  userId: string,
  localDate: string
): Promise<UpcomingDeadline[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("deadlines")
    .select("id, title, due_date")
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("due_date", localDate);
  if (error) throw error;

  return (data ?? []).map((d) => ({
    id: d.id as string,
    title: d.title as string,
    dueLocalDate: d.due_date as string,
    dueMinuteOfDay: END_OF_DAY_MINUTE,
  }));
}

export async function fetchUpcomingAssessments(
  userId: string,
  localDate: string
): Promise<UpcomingAssessment[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("id, title, type, date")
    .eq("user_id", userId)
    .eq("status", "upcoming")
    .eq("date", localDate);
  if (error) throw error;

  return (data ?? []).map((a) => ({
    id: a.id as string,
    title: a.title as string,
    type: a.type as "quiz" | "exam",
    dueLocalDate: a.date as string,
    dueMinuteOfDay: END_OF_DAY_MINUTE,
  }));
}

export async function fetchPlannedTasksForDate(
  userId: string,
  localDate: string,
  timezone: string
): Promise<UpcomingPlannedTask[]> {
  const supabase = createAdminClient();
  const { data: plan } = await supabase
    .from("daily_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("date", localDate)
    .maybeSingle();
  if (!plan) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, planned_start")
    .eq("daily_plan_id", plan.id)
    .eq("status", "not_started")
    .not("planned_start", "is", null);
  if (error) throw error;

  // planned_start is a timestamptz (an absolute instant). Its local
  // wall-clock minute depends on the user's timezone, never the server's —
  // reuse the same Intl-based conversion the scheduling engine uses so a
  // "9am" task reminder actually fires at 9am for that user, not 9am UTC.
  const { localDateAndMinutes } = await import("./engine");

  return (data ?? [])
    .map((t) => {
      const instant = new Date(t.planned_start as string);
      const { localDate: taskLocalDate, minuteOfDay } = localDateAndMinutes(instant, timezone);
      return {
        id: t.id as string,
        title: t.title as string,
        startLocalDate: taskLocalDate,
        startMinuteOfDay: minuteOfDay,
      };
    })
    .filter((t) => t.startLocalDate === localDate);
}

export async function hasAlreadySent(
  userId: string,
  category: string,
  localDate: string,
  slot: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notification_log")
    .select("id")
    .eq("user_id", userId)
    .eq("category", category)
    .eq("local_date", localDate)
    .eq("slot", slot)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function markSent(
  userId: string,
  category: string,
  localDate: string,
  slot: string
): Promise<void> {
  const supabase = createAdminClient();
  // Upsert-style insert: a duplicate (user_id, category, local_date, slot) is
  // exactly the idempotency guarantee this table exists for — ignore it.
  const { error } = await supabase
    .from("notification_log")
    .upsert(
      { user_id: userId, category, local_date: localDate, slot },
      { onConflict: "user_id,category,local_date,slot", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function deleteExpiredSubscription(endpoint: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
