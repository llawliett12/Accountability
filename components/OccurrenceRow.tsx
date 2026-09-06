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

      <div className="mb-2 flex flex-wrap gap-1.5">
        {ATTENDANCE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={pending}
            onClick={() => setAttendance(o.value)}
            className={`rounded-lg px-2.5 py-1 text-xs ${
              occurrence.attendance_status === o.value ? o.color : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={togglePrepared}
            className={`rounded-lg px-2 py-1 text-xs ${
              occurrence.prepared ? "bg-white text-neutral-950" : "bg-neutral-800 text-neutral-400"
            }`}
          >
            Prepared
          </button>
          <button
            type="button"
            onClick={toggleReviewed}
            className={`rounded-lg px-2 py-1 text-xs ${
              occurrence.reviewed ? "bg-white text-neutral-950" : "bg-neutral-800 text-neutral-400"
            }`}
          >
            Reviewed
          </button>
        </div>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => rate(n)}
              className={`h-6 w-6 rounded text-xs ${
                (occurrence.listening_rating ?? 0) >= n
                  ? "bg-amber-500 text-black"
                  : "bg-neutral-800 text-neutral-500"
              }`}
              title="Listening/engagement"
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
