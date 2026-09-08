import { createClient } from "@/lib/supabase/server";
import { getOrCreateDailyPlan } from "@/lib/actions";
import ReconciliationList from "@/components/ReconciliationList";
import RunScoringButton from "@/components/RunScoringButton";
import SleepLogForm from "@/components/SleepLogForm";
import MeditationLogForm from "@/components/MeditationLogForm";
import { todayISO } from "@/lib/date";

export default async function NightReviewPage() {
  const date = todayISO();
  const planId = await getOrCreateDailyPlan(date);

  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("daily_plan_id", planId)
    .in("status", ["not_started", "in_progress"]); // needs reconciliation

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Night review</h1>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-400">
          Tasks needing reconciliation
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          These have no clear tracked outcome — this does NOT assume failure.
          Tell us what actually happened.
        </p>
        <ReconciliationList tasks={tasks ?? []} />
      </section>

      <SleepLogForm />
      <MeditationLogForm />

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">
          Compute today&apos;s discipline score
        </h2>
        <RunScoringButton date={date} />
      </section>
    </div>
  );
}
