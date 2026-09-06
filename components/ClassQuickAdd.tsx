"use client";

import { useState, useTransition } from "react";
import { createClass } from "@/lib/academics/actions";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export default function ClassQuickAdd() {
  const [name, setName] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [attendanceTarget, setAttendanceTarget] = useState(75);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createClass({
          name: name.trim(),
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          attendance_target: attendanceTarget,
        });
        setName("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create class");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-2xl bg-neutral-900 p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Class name (e.g. Linear Algebra)"
        className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none"
      />

      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDayOfWeek(d.value)}
            className={`rounded-lg px-2.5 py-1 text-xs ${
              dayOfWeek === d.value ? "bg-white text-neutral-950" : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="flex-1 rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="flex-1 rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={attendanceTarget}
          onChange={(e) => setAttendanceTarget(Number(e.target.value))}
          title="Attendance target %"
          className="w-16 rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !name.trim()}
        className="w-full rounded-lg bg-white py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
      >
        Add class
      </button>
    </div>
  );
}
