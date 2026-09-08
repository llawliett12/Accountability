import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAssessments, fetchClasses } from "@/lib/academics/queries";
import { isAssessmentPast } from "@/lib/academics/engine";
import { todayISO } from "@/lib/date";
import AssessmentQuickAdd from "@/components/AssessmentQuickAdd";

export default async function AssessmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-sm text-neutral-500">Sign in to see your quizzes and exams.</p>;
  }

  const [assessments, classes] = await Promise.all([
    fetchAssessments(user.id),
    fetchClasses(user.id),
  ]);
  const today = todayISO();
  const upcoming = assessments.filter((a) => !isAssessmentPast(a.date, a.status, today));
  const past = assessments.filter((a) => isAssessmentPast(a.date, a.status, today) || a.status === "completed");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quizzes &amp; exams</h1>
        <Link href="/academics" className="text-xs text-neutral-500 underline">
          Back
        </Link>
      </header>

      <AssessmentQuickAdd classes={classes.map((c) => ({ id: c.id, name: c.name }))} />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-400">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-500">None upcoming.</p>
        ) : (
          upcoming.map((a) => (
            <Link
              key={a.id}
              href={`/academics/assessments/${a.id}`}
              className="block rounded-xl bg-neutral-900 p-3 text-sm"
            >
              <div className="flex justify-between">
                <span className="font-medium capitalize">
                  {a.type}: {a.title}
                </span>
                <span className="text-neutral-500">{a.date}</span>
              </div>
            </Link>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-400">Past</h2>
        {past.length === 0 ? (
          <p className="text-sm text-neutral-500">None yet.</p>
        ) : (
          past.map((a) => (
            <Link
              key={a.id}
              href={`/academics/assessments/${a.id}`}
              className="block rounded-xl bg-neutral-900 p-3 text-sm"
            >
              <div className="flex justify-between">
                <span className="capitalize">
                  {a.type}: {a.title}
                </span>
                <span className="text-neutral-500">
                  {a.score !== null && a.max_score ? `${a.score}/${a.max_score}` : "no score"}
                </span>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
