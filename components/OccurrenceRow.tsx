"use client";

import { useTransition } from "react";
import { markAttendance, markPrepared, markReviewed, markListening } from "@/lib/academics/actions";
import type { AttendanceStatus, ClassOccurrence } from "@/lib/academics/types";

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present", label: "Present", color: "bg-emerald-600" },
  { value: "late", label: "Late", color: "bg-amber-500 text-black" },
  { value: "absent", label: "Absent", color: "bg-red-600" },
  { value: "excused", label: "Excused", color: "bg-neutral-700" },
];

export default function OccurrenceRow({
  occurrence,
  className,
}: {
  occurrence: ClassOccurrence;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function setAttendance(status: AttendanceStatus) {
    startTransition(() => markAttendance(occurrence.id, status));
  }

  function togglePrepared() {
    startTransition(() => markPrepared(occurrence.id, !occurrence.prepared));
  }

  function toggleReviewed() {
    startTransition(() => markReviewed(occurrence.id, !occurrence.reviewed));
  }

  function rate(n: number) {
    startTransition(() => markListening(occurrence.id, n));
  }

  return (
    <div className="rounded-xl bg-neutral-900 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="font-medium">{className ?? "Class"}</p>
          <p className="text-xs text-neutral-500">
            {occurrence.date}
            {occurrence.start_time ? ` · ${occurrence.start_time.slice(0, 5)}` : ""}
          </p>
        </div>
        {occurrence.attendance_status && (
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs capitalize text-neutral-300">
            {occurrence.attendance_status}
          </span>
        )}
      </div>

      <div className="mb-2.5 flex flex-wrap gap-2">
        {ATTENDANCE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={pending}
            onClick={() => setAttendance(o.value)}
            className={`min-h-[44px] flex-1 inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
              occurrence.attendance_status === o.value ? o.color : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800/60 pt-2">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={togglePrepared}
            className={`min-h-[44px] rounded-xl px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
              occurrence.prepared ? "bg-white text-neutral-950 font-semibold" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
            }`}
          >
            {occurrence.prepared ? "✓ Prepared" : "Prepared"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={toggleReviewed}
            className={`min-h-[44px] rounded-xl px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
              occurrence.reviewed ? "bg-white text-neutral-950 font-semibold" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
            }`}
          >
            {occurrence.reviewed ? "✓ Reviewed" : "Reviewed"}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-neutral-500 mr-0.5">Focus:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={pending}
              onClick={() => rate(n)}
              className={`h-9 w-9 rounded-xl text-xs font-medium flex items-center justify-center transition-colors disabled:opacity-50 ${
                (occurrence.listening_rating ?? 0) >= n
                  ? "bg-amber-500 text-black font-semibold"
                  : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700"
              }`}
              title={`Listening/engagement: ${n}/5`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
