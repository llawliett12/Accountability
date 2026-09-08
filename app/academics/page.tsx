import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAcademicDashboard } from "@/lib/academics/queries";

export default async function AcademicsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-sm text-neutral-500">Sign in to see your academics.</p>;
  }

  const data = await fetchAcademicDashboard(user.id);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Academics</h1>
        <div className="flex gap-3 text-xs text-neutral-500">
          <Link href="/academics/calendar" className="underline">
            Calendar
          </Link>
          <Link href="/academics/classes" className="underline">
            Classes
          </Link>
        </div>
      </header>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Next class</h2>
        {data.nextOccurrence ? (
          <Link
            href={`/academics/classes/${data.nextOccurrence.class_id}`}
            className="block"
          >
            <p className="text-lg font-semibold">{data.nextOccurrence.className}</p>
            <p className="text-sm text-neutral-400">
              {data.nextOccurrence.date} · {data.nextOccurrence.start_time?.slice(0, 5)}
            </p>
          </Link>
        ) : (
          <div>
            <p className="text-sm text-neutral-400">No upcoming classes scheduled.</p>
            <Link
              href="/academics/classes"
              className="mt-2 inline-flex items-center text-xs font-medium text-white underline underline-offset-4"
            >
              + Add a class to schedule →
            </Link>
          </div>
        )}
      </section>

      {data.todayOccurrences.length > 0 && (
        <section className="rounded-2xl bg-neutral-900 p-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-400">Today</h2>
          <ul className="space-y-1 text-sm">
            {data.todayOccurrences.map((o) => (
              <li key={o.id} className="flex items-center justify-between">
                <Link href={`/academics/classes/${o.class_id}`} className="underline">
                  {o.className}
                </Link>
                <span className="text-neutral-500">{o.start_time?.slice(0, 5)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Preparation &amp; review</h2>
        {data.prepReview.heldCount === 0 ? (
          <p className="text-sm text-neutral-500">No held classes tracked yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-neutral-500">Prepared</p>
              <p className="text-lg font-semibold">{data.prepReview.preparedRate}%</p>
            </div>
            <div>
              <p className="text-neutral-500">Reviewed</p>
              <p className="text-lg font-semibold">{data.prepReview.reviewedRate}%</p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Attendance</h2>
        {data.attendanceZones.length === 0 ? (
          <div>
            <p className="text-sm text-neutral-400">No classes tracked yet.</p>
            <Link
              href="/academics/classes"
              className="mt-2 inline-flex items-center text-xs font-medium text-white underline underline-offset-4"
            >
              + Add your first class →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.attendanceZones.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <Link href={`/academics/classes/${c.id}`} className="underline truncate min-w-0 mr-2">
                  {c.name}
                </Link>
                <span
                  className={`shrink-0 ${
                    c.attendance.zone === "danger"
                      ? "text-red-400"
                      : c.attendance.zone === "warning"
                      ? "text-amber-400"
                      : c.attendance.zone === "safe"
                      ? "text-emerald-400"
                      : "text-neutral-500"
                  }`}
                >
                  {c.attendance.percentage !== null ? `${c.attendance.percentage}%` : "no data"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-400">Recent performance</h2>
          <Link href="/academics/assessments" className="text-xs text-neutral-500 underline">
            View all
          </Link>
        </div>
        {data.recentScoredAssessments && data.recentScoredAssessments.length > 0 ? (
          <div className="space-y-3">
            {data.averageScorePct !== null && (
              <p className="text-xs text-neutral-400">
                Average score: <span className="font-semibold text-white">{data.averageScorePct}%</span>
              </p>
            )}
            <ul className="space-y-2">
              {data.recentScoredAssessments.map((a) => {
                const pct =
                  a.score !== null && a.max_score && a.max_score > 0
                    ? Math.round((a.score / a.max_score) * 100)
                    : null;
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-neutral-800/60 p-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/academics/assessments/${a.id}`}
                        className="font-medium hover:underline truncate block"
                      >
                        <span className="capitalize text-neutral-400 font-normal mr-1.5">{a.type}:</span>
                        {a.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400">
                        {a.className && <span className="truncate">{a.className}</span>}
                        {a.className && <span>·</span>}
                        <span>{a.date}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block rounded-lg bg-neutral-700/80 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-100">
                        {a.score}/{a.max_score}
                        {pct !== null && ` (${pct}%)`}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="space-y-1 text-sm text-neutral-400">
            <p>No scored quizzes or exams yet — log scores in Assessments to see your recent performance.</p>
            <Link
              href="/academics/assessments"
              className="inline-block text-xs text-amber-400 underline hover:text-amber-300 mt-1"
            >
              Go to Assessments →
            </Link>
          </div>
        )}
      </section>

      {data.overdueDeadlines.length > 0 && (
        <section className="rounded-2xl bg-neutral-900 p-4">
          <h2 className="mb-2 text-sm font-medium text-red-400">Overdue deadlines</h2>
          <ul className="space-y-1 text-sm">
            {data.overdueDeadlines.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span className="truncate min-w-0 mr-2">{d.title}</span>
                <span className="shrink-0 text-neutral-500">{d.due_date}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-neutral-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-400">Upcoming deadlines</h2>
          <Link href="/academics/deadlines" className="text-xs text-neutral-500 underline">
            View all
          </Link>
        </div>
        {data.upcomingDeadlines.length === 0 ? (
          <div>
            <p className="text-sm text-neutral-400">Nothing upcoming.</p>
            <Link
              href="/academics/deadlines"
              className="mt-2 inline-flex items-center text-xs font-medium text-white underline underline-offset-4"
            >
              + Add a deadline →
            </Link>
          </div>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.upcomingDeadlines.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span className="truncate min-w-0 mr-2">{d.title}</span>
                <span className="shrink-0 text-neutral-500">{d.due_date}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
