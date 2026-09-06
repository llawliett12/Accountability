import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ScreenTimeCapture from "@/components/screen-time/ScreenTimeCapture";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ScreenTimePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: today } = await supabase
    .from("screen_time_records")
    .select("total_minutes, source")
    .eq("user_id", user?.id ?? "")
    .eq("date", todayISO())
    .maybeSingle();

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
          <span className="text-neutral-400">Today logged: </span>
          <span className="font-medium">{today.total_minutes} min</span>
          <span className="text-neutral-500"> ({today.source})</span>
        </div>
      )}

      <ScreenTimeCapture />
    </div>
  );
}
