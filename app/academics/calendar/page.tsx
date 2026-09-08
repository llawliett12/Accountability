import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchOccurrencesInRange, fetchAssessments, fetchDeadlines, fetchClasses } from "@/lib/academics/queries";
import { weekBounds, shiftWeek } from "@/lib/academics/engine";
import { todayISO } from "@/lib/date";

export default async function AcademicCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const anchor = dateParam ?? todayISO();
  const [weekStart, weekEnd] = weekBounds(anchor);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-sm text-neutral-500">Sign in to see your calendar.</p>;
  }

  const [occurrences, classes, assessments, deadlines] = await Promise.all([
    fetchOccurrencesInRange(user.id, weekStart, weekEnd),
    fetchClasses(user.id),
    fetchAssessments(user.id),
    fetchDeadlines(user.id),
  ]);

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  const weekAssessments = assessments.filter((a) => a.date >= weekStart && a.date <= weekEnd);
  const weekDeadlines = deadlines.filter((d) => d.due_date >= weekStart && d.due_date <= weekEnd);

  // Build a day-by-day view of the week.
  const days: string[] = [];
  const cursor = new Date(weekStart + "T00:00:00Z");
  for (let i = 0; i < 7; i++) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <Link href="/academics" className="text-xs text-neutral-500 underline">
          Back
        </Link>
      </header>

      <div className="flex items-center justify-between rounded-2xl bg-neutral-900 p-3 text-sm">
        <Link href={`/academics/calendar?date=${shiftWeek(anchor, -1)}`} className="underline">
          ← Prev
        </Link>
        <span className="text-neutral-400">
          {weekStart} – {weekEnd}
        </span>
        <Link href={`/academics/calendar?date=${shiftWeek(anchor, 1)}`} className="underline">
          Next →
        </Link>
      </div>

      <div className="space-y-3">
        {days.map((day) => {
          const dayOccurrences = occurrences.filter((o) => o.date === day && o.status !== "cancelled");
          const dayAssessments = weekAssessments.filter((a) => a.date === day);
          const dayDeadlines = weekDeadlines.filter((d) => d.due_date === day);
          const hasAnything =
            dayOccurrences.length > 0 || dayAssessments.length > 0 || dayDeadlines.length > 0;
          if (!hasAnything) return null;

          return (
            <section key={day} className="rounded-2xl bg-neutral-900 p-3">
              <h2 className="mb-2 text-xs font-medium text-neutral-500">
                {new Date(day + "T00:00:00Z").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </h2>
              <ul className="space-y-1 text-sm">
                {dayOccurrences.map((o) => (
                  <li key={o.id} className="flex justify-between">
                    <Link href={`/academics/classes/${o.class_id}`} className="underline">
                      {classNameById.get(o.class_id) ?? "Class"}
                    </Link>
                    <span className="text-neutral-500">{o.start_time?.slice(0, 5)}</span>
                  </li>
                ))}
                {dayAssessments.map((a) => (
                  <li key={a.id} className="flex justify-between">
                    <Link href={`/academics/assessments/${a.id}`} className="underline capitalize">
                      {a.type}: {a.title}
                    </Link>
                    <span className="text-amber-400">{a.type}</span>
                  </li>
                ))}
                {dayDeadlines.map((d) => (
                  <li key={d.id} className="flex justify-between">
                    <span>{d.title}</span>
                    <span className="text-red-400">deadline</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {occurrences.length === 0 && weekAssessments.length === 0 && weekDeadlines.length === 0 && (
          <p className="text-sm text-neutral-500">Nothing scheduled this week.</p>
        )}
      </div>
    </div>
  );
}
