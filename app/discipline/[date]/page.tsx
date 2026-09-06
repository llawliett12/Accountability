import { createClient } from "@/lib/supabase/server";

export default async function DisciplineLogPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: verdict } = await supabase
    .from("discipline_verdicts")
    .select("label, explanation")
    .eq("user_id", user?.id ?? "")
    .eq("date", date)
    .maybeSingle();

  const { data: score } = await supabase
    .from("discipline_scores")
    .select("score, negative_score, components")
    .eq("user_id", user?.id ?? "")
    .eq("date", date)
    .maybeSingle();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Discipline log — {date}</h1>

      {verdict ? (
        <section className="rounded-2xl bg-neutral-900 p-4">
          <p className="text-3xl font-bold">{verdict.label}</p>
          <p className="mt-1 text-sm text-neutral-400">{verdict.explanation}</p>
        </section>
      ) : (
        <p className="text-sm text-neutral-500">
          No verdict computed yet for this date. Run Night Review to generate one.
        </p>
      )}

      {score && (
        <section className="rounded-2xl bg-neutral-900 p-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-400">
            Score breakdown ({score.score}/100, negative {score.negative_score})
          </h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(score.components as Record<string, number>).map(
              ([key, value]) => (
                <li key={key} className="flex justify-between">
                  <span className="capitalize">
                    {key.replace(/([A-Z])/g, " $1")}
                  </span>
                  <span>{typeof value === "number" ? value.toFixed(2) : value}</span>
                </li>
              )
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
