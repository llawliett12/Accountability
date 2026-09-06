"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferencesRow,
  preferencesToRow,
  rowToPreferences,
} from "./types";
import type { NotificationPreferences } from "./engine";

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Server-side sanity clamp before this ever reaches Postgres. RLS already
 * confines a malicious value to the user's own row, so this isn't an
 * isolation boundary — it's just refusing to persist a value (a negative
 * interval, an interval of zero, a malformed time string) that could make
 * the scheduling engine or the settings UI behave strangely.
 */
function sanitize(prefs: NotificationPreferences): NotificationPreferences {
  const time = (t: string, fallback: string) => (HHMM_RE.test(t) ? t : fallback);
  return {
    ...prefs,
    timezone: typeof prefs.timezone === "string" && prefs.timezone.length <= 64 ? prefs.timezone : "UTC",
    classReminderLeadMin: clamp(prefs.classReminderLeadMin, 0, 180),
    deadlineReminderLeadHours: clamp(prefs.deadlineReminderLeadHours, 0, 168),
    examReminderLeadHours: clamp(prefs.examReminderLeadHours, 0, 168),
    hydrationIntervalMin: clamp(prefs.hydrationIntervalMin, 15, 480),
    hydrationStartTime: time(prefs.hydrationStartTime, "09:00"),
    hydrationEndTime: time(prefs.hydrationEndTime, "21:00"),
    dailyReviewTime: time(prefs.dailyReviewTime, "21:30"),
    accountabilityIntervalMin: clamp(prefs.accountabilityIntervalMin, 30, 1440),
    sleepReminderTime: time(prefs.sleepReminderTime, "22:30"),
  };
}

export async function getOrCreateNotificationPreferences(): Promise<NotificationPreferences> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return rowToPreferences(existing as unknown as NotificationPreferencesRow);

  const { error } = await supabase.from("notification_preferences").insert({
    user_id: user.id,
  });
  // A concurrent first-write race is harmless — the defaults are the same either way.
  if (error && error.code !== "23505") throw error;

  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export async function saveNotificationPreferences(prefs: NotificationPreferences) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const row = preferencesToRow(user.id, sanitize(prefs));
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;

  revalidatePath("/settings");
}

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  authKey: string;
  userAgent?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // endpoint is globally unique per browser install; re-subscribing (e.g.
  // after clearing site data) just refreshes the keys on the same row.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth_key: input.authKey,
      user_agent: input.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

export async function deletePushSubscription(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Scoped by user_id as well as endpoint so a user can only ever delete
  // their own subscription row, even though endpoint alone is unique.
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  if (error) throw error;
}
