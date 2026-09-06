import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchClassById, fetchOccurrencesForClass } from "@/lib/academics/queries";
import OccurrenceRow from "@/components/OccurrenceRow";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-sm text-neutral-500">Sign in to see this class.</p>;
  }

  const cls = await fetchClassById(user.id, id);
  if (!cls) notFound();

  const occurrences = await fetchOccurrencesForClass(user.id, id);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{cls.name}</h1>
          {cls.subject && <p className="text-sm text-neutral-500">{cls.subject}</p>}
        </div>
        <Link href="/academics/classes" className="text-xs text-neutral-500 underline">
          Back
        </Link>
      </header>

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-400">Attendance</h2>
        <p className="text-2xl font-semibold">
          {cls.attendance.percentage !== null ? `${cls.attendance.percentage}%` : "No data yet"}
        </p>
        <p className="text-xs text-neutral-500">
          Target {cls.attendance.target}% · {cls.attendance.presentCount} attended /{" "}
          {cls.attendance.trackedCount} tracked
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-400">Occurrences</h2>
        {occurrences.length === 0 ? (
          <p className="text-sm text-neutral-500">No occurrences generated yet.</p>
        ) : (
          occurrences.map((o) => (
            <OccurrenceRow key={o.id} occurrence={o} className={cls.name} />
          ))
        )}
      </section>
    </div>
  );
}
