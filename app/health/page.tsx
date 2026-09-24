import { createClient } from "@/lib/supabase/server";
import { todayISO, shiftDateISO } from "@/lib/date";
import HealthSectionManager, {
  type HealthSection,
  type HealthDayTrend,
} from "@/components/HealthSectionManager";
import { fetchScreenTimeHistory } from "@/lib/screen-time/queries";
import { fetchNotes } from "@/lib/notes/queries";
import type { SleepLogRecord, MeditationLogRecord } from "@/lib/health/types";

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

  // 1. Fetch sleep logs (last 30 days)
  const { data: sleepRows } = await supabase
    .from("sleep_logs")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", thirtyDaysAgo)
    .lte("date", today)
    .order("date", { ascending: false });
  const allSleepLogs = (sleepRows ?? []) as SleepLogRecord[];
  const recentSleepLogs = allSleepLogs.filter((s) => s.date >= sevenDaysAgo);

  const lastNightSleep = recentSleepLogs[0] ?? null;

  // Sleep 7d & 30d averages (hours)
  const sleep7dMinutes = recentSleepLogs.reduce((acc, s) => acc + (s.total_minutes || 0), 0);
  const sleepAvg7d = recentSleepLogs.length > 0 ? sleep7dMinutes / recentSleepLogs.length / 60 : null;

  const sleep30dMinutes = allSleepLogs.reduce((acc, s) => acc + (s.total_minutes || 0), 0);
  const sleepAvg30d = allSleepLogs.length > 0 ? sleep30dMinutes / allSleepLogs.length / 60 : null;

  // 2. Fetch food habits (last 7 days)
  const { data: foodRows } = await supabase
    .from("food_habits")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", sevenDaysAgo)
    .lte("date", today)
    .order("date", { ascending: false });

  const mealsByDate = new Map<string, { breakfast: boolean; lunch: boolean; dinner: boolean }>();
  let totalMealsMarked7d = 0;
  for (const row of foodRows ?? []) {
    const meals = {
      breakfast: Boolean(row.breakfast),
      lunch: Boolean(row.lunch),
      dinner: Boolean(row.dinner),
    };
    mealsByDate.set(row.date, meals);
    totalMealsMarked7d += [meals.breakfast, meals.lunch, meals.dinner].filter(Boolean).length;
  }
  const todayMeals = mealsByDate.get(today) ?? { breakfast: false, lunch: false, dinner: false };
  const foodAvg7d = totalMealsMarked7d / 7;

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

  // Meditation 7d & 30d averages (minutes per day)
  const med7dMinutes = recentMeditationLogs
    .filter((m) => m.date >= sevenDaysAgo && m.happened)
    .reduce((acc, m) => acc + (m.duration_min ?? 15), 0);
  const meditationAvg7d = Math.round(med7dMinutes / 7);

  const med30dMinutes = recentMeditationLogs
    .filter((m) => m.happened)
    .reduce((acc, m) => acc + (m.duration_min ?? 15), 0);
  const meditationAvg30d = Math.round(med30dMinutes / 30);

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

  const totalScreenMinutes7d = recentScreenTime.reduce((acc, s) => acc + s.totalMinutes, 0);
  const screenTimeAvg7d = recentScreenTime.length > 0 ? totalScreenMinutes7d / 7 / 60 : null;

  // 5. Build deterministic averages object
  const averages = {
    sleepAvg7d: sleepAvg7d ? Number(sleepAvg7d.toFixed(1)) : null,
    sleepAvg30d: sleepAvg30d ? Number(sleepAvg30d.toFixed(1)) : null,
    meditationAvg7d,
    meditationAvg30d,
    screenTimeAvg7d: screenTimeAvg7d ? Number(screenTimeAvg7d.toFixed(1)) : null,
    foodAvg7d: Number(foodAvg7d.toFixed(1)),
  };

  // 6. Build 7-day trends
  const sleepByDate = new Map(recentSleepLogs.map((s) => [s.date, s]));
  const sevenDayTrends: HealthDayTrend[] = [];
  for (let i = 0; i < 7; i++) {
    const d = shiftDateISO(today, -i);
    const sLog = sleepByDate.get(d);
    const dMeals = mealsByDate.get(d);
    const mLog = medByDate.get(d);
    const stRecord = screenByDate.get(d);

    sevenDayTrends.push({
      date: d,
      sleepHours: sLog ? sLog.total_minutes / 60 : null,
      foodCount: dMeals ? [dMeals.breakfast, dMeals.lunch, dMeals.dinner].filter(Boolean).length : 0,
      meditationMinutes: mLog?.happened ? mLog.duration_min ?? 15 : mLog ? 0 : null,
      screenTimeHours: stRecord ? stRecord.totalMinutes / 60 : null,
    });
  }

  // 7. Fetch health notes
  const healthNotes = await fetchNotes(user.id, { category: "health" });

  return (
    <div className="space-y-6 pb-6">
      <header className="border-b border-neutral-800/80 pb-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">Health</h1>
      </header>

      <HealthSectionManager
        initialSection={section}
        today={today}
        lastNightSleep={lastNightSleep}
        averages={averages}
        recentSleepLogs={recentSleepLogs}
        todayMeals={todayMeals}
        todayMeditation={todayMeditation}
        meditationStreak={streak}
        recentMeditationLogs={recentMeditationLogs.slice(0, 7)}
        todayScreenTime={todayScreenTime}
        recentScreenTime={recentScreenTime}
        sevenDayTrends={sevenDayTrends}
        healthNotes={healthNotes}
      />
    </div>
  );
}
