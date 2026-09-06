import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchClassesWithAttendance } from "@/lib/academics/queries";
import ClassQuickAdd from "@/components/ClassQuickAdd";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ClassesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-sm text-neutral-500">Sign in to see your classes.</p>;
  }

  const classes = await fetchClassesWithAttendance(user.id);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Classes</h1>
        <Link href="/academics" className="text-xs text-neutral-500 underline">
          Back
        </Link>
      </header>

      <ClassQuickAdd />

      <div className="space-y-2">
        {classes.length === 0 ? (
          <p className="text-sm text-neutral-500">No classes yet — add your first one above.</p>
        ) : (
          classes
            .filter((c) => c.active)
            .map((c) => (
              <Link
                key={c.id}
                href={`/academics/classes/${c.id}`}
                className="block rounded-xl bg-neutral-900 p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{c.name}</p>
                  <span className="text-xs text-neutral-500">
                    {DAY_LABELS[c.day_of_week]} {c.start_time.slice(0, 5)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Attendance:{" "}
                  {c.attendance.percentage !== null ? `${c.attendance.percentage}%` : "no data yet"}
                  {" · target "}
                  {c.attendance_target}%
                </p>
              </Link>
            ))
        )}
      </div>
    </div>
  );
}
