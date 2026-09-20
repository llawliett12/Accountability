import Link from "next/link";

export interface AcademicScheduleItem {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  slotType: string; // 'lecture' | 'lab' | 'tutorial' | 'extra'
  startTime: string; // "08:00"
  endTime: string; // "09:00"
  location: string | null;
  status: "scheduled" | "held" | "cancelled";
  isExtra: boolean;
}

export default function TodayAcademicSchedule({
  items,
}: {
  items: AcademicScheduleItem[];
}) {
  return (
    <section aria-label="Today's Academic Schedule" className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
          Today&apos;s Academic Schedule
        </h2>
        <Link
          href="/academics?section=schedule"
          className="font-mono text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Timetable &rarr;
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="font-mono text-xs text-neutral-500 py-1">No classes scheduled today.</p>
      ) : (
        <div className="divide-y divide-neutral-800/60 font-mono text-xs">
          {items.map((item) => {
            const isCancelled = item.status === "cancelled";
            return (
              <div
                key={item.id}
                className={`py-2 flex items-center justify-between gap-2 ${
                  isCancelled ? "opacity-50 line-through" : ""
                }`}
              >
                <div className="flex items-baseline gap-2.5 min-w-0">
                  <span className="text-neutral-400 font-medium whitespace-nowrap text-[11px]">
                    {item.startTime.slice(0, 5)}
                  </span>
                  <Link
                    href={`/academics/courses/${item.courseId}`}
                    className="font-semibold text-neutral-200 hover:text-white transition-colors truncate"
                  >
                    {item.courseCode}
                  </Link>
                  <span className="text-[10px] text-neutral-500 capitalize truncate">
                    {item.isExtra ? "Extra Class" : item.slotType}
                  </span>
                  {item.location && (
                    <span className="text-[10px] text-neutral-600 hidden sm:inline truncate">
                      ({item.location})
                    </span>
                  )}
                </div>

                <div className="text-right whitespace-nowrap">
                  {isCancelled ? (
                    <span className="rounded bg-rose-950/80 px-1.5 py-0.5 text-[10px] font-medium text-rose-300 border border-rose-800/50">
                      Cancelled
                    </span>
                  ) : item.status === "held" ? (
                    <span className="text-[10px] text-emerald-400">Held</span>
                  ) : (
                    <span className="text-[10px] text-neutral-400">{item.endTime.slice(0, 5)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
