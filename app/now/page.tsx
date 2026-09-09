import { createClient } from "@/lib/supabase/server";
import ActivityLedger, { type ActivityEntry } from "@/components/ActivityLedger";
import FocusTimer from "@/components/FocusTimer";
import MoodQuickLog from "@/components/MoodQuickLog";

export default async function NowPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: entries } = user
    ? await supabase.from("check_ins").select("id, actual_activity, timestamp").eq("user_id", user.id).order("timestamp", { ascending: false }).limit(20)
    : { data: [] };
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Right now</h1>
      <ActivityLedger initialEntries={(entries ?? []) as ActivityEntry[]} />
      <FocusTimer />
      <MoodQuickLog />
    </div>
  );
}
