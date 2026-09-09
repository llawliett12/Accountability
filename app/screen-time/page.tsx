import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ScreenTimeCapture from "@/components/screen-time/ScreenTimeCapture";
import { todayISO } from "@/lib/date";

export default async function ScreenTimePage(props: { searchParams?: Promise<{ date?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const selectedDate = searchParams?.date ?? todayISO();
  const { data: today } = await supabase
    .from("screen_time_records")
    .select("id, date, total_minutes, source")
    .eq("user_id", user?.id ?? "")
    .eq("date", selectedDate)
    .maybeSingle();
  const { data: apps } = today ? await supabase.from("screen_time_apps").select("app_name, duration_minutes, category").eq("screen_time_record_id", today.id) : { data: [] };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Screen time</h1>
        <Link href="/screen-time/history" className="text-xs text-neutral-500 underline">
          History
        </Link>
      </div>

      {today && (
        <div className="rounded-2xl bg-neutral-900 p-3 text-sm">
          <span className="text-neutral-400">{selectedDate === todayISO() ? "Today" : selectedDate} logged: </span>
          <span className="font-medium">{today.total_minutes} min</span>
          <span className="text-neutral-500"> ({today.source})</span>
        </div>
      )}

      <ScreenTimeCapture initialRecord={today ? { date: today.date, totalMinutes: today.total_minutes, source: today.source as "gemini" | "manual", apps: apps ?? [] } : null} />
    </div>
  );
}
