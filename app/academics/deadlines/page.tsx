import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchDeadlines, fetchClasses } from "@/lib/academics/queries";
import { isDeadlineOverdue } from "@/lib/academics/engine";
import { todayISO } from "@/lib/date";
import DeadlineQuickAdd from "@/components/DeadlineQuickAdd";
import DeadlineRow from "@/components/DeadlineRow";

export default async function DeadlinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-sm text-neutral-500">Sign in to see your deadlines.</p>;
  }

  const [deadlines, classes] = await Promise.all([
    fetchDeadlines(user.id),
    fetchClasses(user.id),
  ]);
  const today = todayISO();
  const overdue = deadlines.filter((d) => isDeadlineOverdue(d.due_date, d.status, today));
  const pending = deadlines.filter(
    (d) => d.status === "pending" && !isDeadlineOverdue(d.due_date, d.status, today)
  );
  const completed = deadlines.filter((d) => d.status === "completed");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Deadlines</h1>
        <Link href="/academics" className="text-xs text-neutral-500 underline">
          Back
        </Link>
      </header>

      <DeadlineQuickAdd classes={classes.map((c) => ({ id: c.id, name: c.name }))} />

      {overdue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-red-400">Overdue</h2>
          {overdue.map((d) => (
            <DeadlineRow key={d.id} deadline={d} />
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-400">Upcoming</h2>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center">
            <p className="text-sm text-neutral-400">No upcoming deadlines.</p>
            <p className="mt-1 text-xs text-neutral-500">
              Use the form above to add an assignment, project, or exam deadline.
            </p>
          </div>
        ) : (
          pending.map((d) => <DeadlineRow key={d.id} deadline={d} />)
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-400">Completed</h2>
        {completed.length === 0 ? (
          <p className="text-sm text-neutral-500">None yet.</p>
        ) : (
          completed.map((d) => <DeadlineRow key={d.id} deadline={d} />)
        )}
      </section>
    </div>
  );
}
