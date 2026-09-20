import { createClient } from "@/lib/supabase/server";
import { todayISO, shiftDateISO } from "@/lib/date";
import HealthSectionManager, {
  type HealthSection,
  type HealthDayTrend,
} from "@/components/HealthSectionManager";
import { fetchScreenTimeHistory } from "@/lib/screen-time/queries";
import type { SleepLogRecord, MeditationLogRecord, FoodEntry } from "@/lib/health/types";

export default async function HealthPage(props: {
  searchParams?: Promise<{ section?: string }>;
}) {
  const searchParams = await props.searchParams;
  const section = searchParams?.section as HealthSection | undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = todayISO();
  const sevenDaysAgo = shiftDateISO(today, -6);
  const thirtyDaysAgo = shiftDateISO(today, -30);

  // 1. Fetch sleep logs (last 7 days)
  const { data: sleepRows } = await supabase
    .from("sleep_logs")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", sevenDaysAgo)
    .lte("date", today)
    .order("date", { ascending: false });
  const recentSleepLogs = (sleepRows ?? []) as SleepLogRecord[];

  const lastNightSleep = recentSleepLogs[0] ?? null;
  const totalSleepMinutes = recentSleepLogs.reduce((acc, s) => acc + (s.total_minutes || 0), 0);
  const weeklySleepAvgHours =
    recentSleepLogs.length > 0 ? totalSleepMinutes / recentSleepLogs.length / 60 : 0;

  // 2. Fetch food habits (last 7 days)
  const { data: foodRows } = await supabase
    .from("food_habits")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", sevenDaysAgo)
    .lte("date", today)
    .order("date", { ascending: false });

  const foodByDate = new Map<string, FoodEntry[]>();
  for (const row of foodRows ?? []) {
    foodByDate.set(row.date, ((row.entries as unknown[]) ?? []) as FoodEntry[]);
  }
  const todayFoodEntries = foodByDate.get(today) ?? [];

  // 3. Fetch meditation logs (last 30 days)
  const { data: medRows } = await supabase
    .from("meditation_logs")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", thirtyDaysAgo)
    .lte("date", today)
    .order("date", { ascending: false });

  const recentMeditationLogs = (medRows ?? []) as MeditationLogRecord[];
  const todayMeditation = recentMeditationLogs.find((m) => m.date === today) ?? null;

  // Calculate meditation streak
  let streak = 0;
  let checkDate = today;
  const medByDate = new Map<string, MeditationLogRecord>();
  for (const m of recentMeditationLogs) {
    medByDate.set(m.date, m);
  }

  if (!medByDate.get(checkDate)?.happened) {
    checkDate = shiftDateISO(today, -1);
  }
  while (streak < 30) {
    const log = medByDate.get(checkDate);
    if (log && log.happened) {
      streak++;
      checkDate = shiftDateISO(checkDate, -1);
    } else {
      break;
    }
  }

  // 4. Fetch screen time history (last 7 days)
  const recentScreenTime = await fetchScreenTimeHistory(user.id, sevenDaysAgo, today);
  const screenByDate = new Map(recentScreenTime.map((s) => [s.date, s]));
  const todayScreenTime = screenByDate.get(today) ?? null;

  // 5. Build 7-day trends
  const sleepByDate = new Map(recentSleepLogs.map((s) => [s.date, s]));
  const sevenDayTrends: HealthDayTrend[] = [];
  for (let i = 0; i < 7; i++) {
    const d = shiftDateISO(today, -i);
    const sLog = sleepByDate.get(d);
    const fEntries = foodByDate.get(d) ?? [];
    const mLog = medByDate.get(d);
    const stRecord = screenByDate.get(d);

    sevenDayTrends.push({
      date: d,
      sleepHours: sLog ? sLog.total_minutes / 60 : null,
      foodCount: fEntries.length,
      meditationMinutes: mLog?.happened ? mLog.duration_min ?? 15 : mLog ? 0 : null,
      screenTimeHours: stRecord ? stRecord.totalMinutes / 60 : null,
    });
  }

  return (
    <div className="space-y-6 pb-6">
      <header className="border-b border-neutral-800/80 pb-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Health</h1>
      </header>

      <HealthSectionManager
        initialSection={section}
        today={today}
        lastNightSleep={lastNightSleep}
        weeklySleepAvgHours={weeklySleepAvgHours}
        recentSleepLogs={recentSleepLogs}
        todayFoodEntries={todayFoodEntries}
        todayMeditation={todayMeditation}
        meditationStreak={streak}
        recentMeditationLogs={recentMeditationLogs.slice(0, 7)}
        todayScreenTime={todayScreenTime}
        recentScreenTime={recentScreenTime}
        sevenDayTrends={sevenDayTrends}
      />
    </div>
  );
}
