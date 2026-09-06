import { createClient } from "@/lib/supabase/server";

export interface ScreenTimeDay {
  date: string;
  totalMinutes: number;
  source: "gemini" | "manual";
  topApps: { app_name: string; duration_minutes: number }[];
}

export async function fetchScreenTimeHistory(
  userId: string,
  startDate: string,
  endDate: string
): Promise<ScreenTimeDay[]> {
  const supabase = await createClient();

  const { data: records } = await supabase
    .from("screen_time_records")
    .select("id, date, total_minutes, source")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  const recordIds = (records ?? []).map((r) => r.id);
  const { data: apps } = recordIds.length
    ? await supabase
        .from("screen_time_apps")
        .select("screen_time_record_id, app_name, duration_minutes")
        .in("screen_time_record_id", recordIds)
        .order("duration_minutes", { ascending: false })
    : { data: [] };

  const appsByRecord = new Map<string, { app_name: string; duration_minutes: number }[]>();
  for (const a of apps ?? []) {
    const list = appsByRecord.get(a.screen_time_record_id) ?? [];
    list.push({ app_name: a.app_name, duration_minutes: a.duration_minutes });
    appsByRecord.set(a.screen_time_record_id, list);
  }

  return (records ?? []).map((r) => ({
    date: r.date,
    totalMinutes: r.total_minutes,
    source: r.source,
    topApps: (appsByRecord.get(r.id) ?? []).slice(0, 5),
  }));
}

// A plain date -> total-minutes map, for the pattern-discovery layer to zip
// against other daily metrics without depending on the history page's shape.
export async function fetchScreenTimeMinutesByDate(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("screen_time_records")
    .select("date, total_minutes")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate);

  return new Map((data ?? []).map((r) => [r.date as string, r.total_minutes as number]));
}

// Aggregate app totals across a date range, for "which app ate the most
// time this month" — summed across days, not per-day.
export async function fetchAppTotals(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ app_name: string; total_minutes: number }[]> {
  const supabase = await createClient();
  const { data: records } = await supabase
    .from("screen_time_records")
    .select("id")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate);

  const recordIds = (records ?? []).map((r) => r.id);
  if (recordIds.length === 0) return [];

  const { data: apps } = await supabase
    .from("screen_time_apps")
    .select("app_name, duration_minutes")
    .in("screen_time_record_id", recordIds);

  const totals = new Map<string, number>();
  for (const a of apps ?? []) {
    totals.set(a.app_name, (totals.get(a.app_name) ?? 0) + a.duration_minutes);
  }

  return Array.from(totals.entries())
    .map(([app_name, total_minutes]) => ({ app_name, total_minutes }))
    .sort((a, b) => b.total_minutes - a.total_minutes);
}
