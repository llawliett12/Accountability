import { createClient } from "@/lib/supabase/server";

export default async function DailyReportPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: plan } = await supabase
    .from("daily_plans")
    .select("id")
    .eq("user_id", user?.id ?? "")
    .eq("date", date)
    .maybeSingle();

  const { data: tasks } = plan
    ? await supabase.from("tasks").select("*").eq("daily_plan_id", plan.id)
    : { data: [] };

  const { data: sessions } = await supabase
    .from("focus_sessions")
    .select("id, focused_duration_sec")
    .eq("user_id", user?.id ?? "")
    .gte("started_at", `${date}T00:00:00`)
    .lte("started_at", `${date}T23:59:59`);

  const sessionIds = (sessions ?? []).map((s) => s.id).filter(Boolean);
  const { data: pauses } =
    sessionIds.length > 0
      ? await supabase
          .from("focus_pauses")
          .select("reason, started_at, ended_at, focus_session_id")
          .in("focus_session_id", sessionIds)
      : { data: [] };

  const totalFocusMin =
    (sessions ?? []).reduce((s, f) => s + (f.focused_duration_sec ?? 0), 0) / 60;

  const statusCounts = (tasks ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Daily report — {date}</h1>
      <p className="text-xs text-neutral-500">
        Factual only. For judgment, see the Discipline Log for this date.
      </p>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Tasks</h2>
        <ul className="text-sm">
          {Object.entries(statusCounts).map(([status, count]) => (
            <li key={status} className="flex justify-between">
              <span className="capitalize">{status.replace("_", " ")}</span>
              <span>{count}</span>
            </li>
          ))}
          {(tasks ?? []).length === 0 && (
            <li className="text-neutral-500">No tasks planned.</li>
          )}
        </ul>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Focus</h2>
        <p className="text-sm">Total focused time: {Math.round(totalFocusMin)} min</p>
        <p className="text-sm">Sessions: {(sessions ?? []).length}</p>
        <p className="text-sm">Pauses: {(pauses ?? []).length}</p>
      </section>
    </div>
  );
}
