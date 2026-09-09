"use client";

import { useState, useTransition } from "react";
import { markAttendance } from "@/lib/academics/actions";
import { createTask } from "@/lib/actions";
import type { AttendanceStatus } from "@/lib/academics/types";

export interface ScheduleItem {
  id: string;
  type: "class" | "block";
  title: string;
  subtitle?: string;
  start_time: string | null;
  end_time: string | null;
  attendance_status?: AttendanceStatus | null;
  badge?: string;
}

export interface ScheduleTableProps {
  items: ScheduleItem[];
  selectedDate?: string;
  isHomeView?: boolean;
}

export default function ScheduleTable({
  items: initialItems,
  selectedDate,
  isHomeView = false,
}: ScheduleTableProps) {
  const [items, setItems] = useState<ScheduleItem[]>(initialItems);
  const [, startTransition] = useTransition();

  // Inline Quick Add state for schedule blocks
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [blockTitle, setBlockTitle] = useState("");
  const [blockStart, setBlockStart] = useState("09:00");
  const [blockDuration, setBlockDuration] = useState("45");
  const [blockPending, setBlockPending] = useState(false);

  // Vibration helper
  const triggerHaptic = (ms = 12) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignore
      }
    }
  };

  // Attendance click handler
  const handleAttendance = (itemId: string, status: AttendanceStatus) => {
    triggerHaptic(12);

    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, attendance_status: status } : item
      )
    );

    startTransition(async () => {
      try {
        await markAttendance(itemId, status);
      } catch (err) {
        console.error("Failed to mark attendance", err);
      }
    });
  };

  // Quick Add Block handler
  const handleAddBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTitle.trim() || blockPending) return;

    triggerHaptic(10);
    setBlockPending(true);

    const dur = parseInt(blockDuration, 10);
    const [h, m] = blockStart.split(":").map(Number);
    const endMinTotal = h * 60 + m + dur;
    const endH = Math.floor(endMinTotal / 60) % 24;
    const endM = endMinTotal % 60;
    const endStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;

    const tempItem: ScheduleItem = {
      id: `temp-block-${Date.now()}`,
      type: "block",
      title: blockTitle.trim(),
      subtitle: `${dur} min block`,
      start_time: `${blockStart}:00`,
      end_time: endStr,
      badge: `${dur}m`,
    };

    setItems((prev) =>
      [...prev, tempItem].sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
    );
    setBlockTitle("");
    setShowAddBlock(false);

    try {
      await createTask({
        title: tempItem.title,
        planned_start: `${blockStart}:00`,
        planned_end: endStr,
        planned_duration_min: dur,
        date: selectedDate,
      });
    } catch {
      // Rollback
      setItems((prev) => prev.filter((i) => i.id !== tempItem.id));
    } finally {
      setBlockPending(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* SECTION HEADER */}
      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Timeline &amp; Schedule
          </span>
          <span className="font-mono text-[11px] text-neutral-500">
            [{items.length} {items.length === 1 ? "event" : "events"}]
          </span>
        </div>

        {!isHomeView && (
          <button
            type="button"
            onClick={() => setShowAddBlock(!showAddBlock)}
            className="text-xs font-mono text-amber-400 hover:text-amber-300 transition-colors"
          >
            {showAddBlock ? "✕ Close" : "+ Add Block"}
          </button>
        )}
      </div>

      {/* INLINE QUICK ADD BLOCK FORM */}
      {showAddBlock && (
        <form
          onSubmit={handleAddBlockSubmit}
          className="flex flex-wrap items-center gap-2 border border-neutral-800 bg-neutral-900/70 p-2.5 rounded-lg text-xs"
        >
          <input
            type="text"
            placeholder="Block title (e.g. Study, Workout)..."
            value={blockTitle}
            onChange={(e) => setBlockTitle(e.target.value)}
            className="flex-1 min-w-[150px] bg-neutral-800 px-2.5 py-1.5 rounded text-neutral-100 placeholder:text-neutral-500 outline-none"
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            <input
              type="time"
              value={blockStart}
              onChange={(e) => setBlockStart(e.target.value)}
              className="bg-neutral-800 px-2 py-1.5 rounded text-neutral-200 outline-none font-mono text-xs"
            />
            <select
              value={blockDuration}
              onChange={(e) => setBlockDuration(e.target.value)}
              className="bg-neutral-800 px-2 py-1.5 rounded text-neutral-200 outline-none font-mono text-xs"
            >
              <option value="15">15m</option>
              <option value="30">30m</option>
              <option value="45">45m</option>
              <option value="60">1h</option>
              <option value="90">1.5h</option>
              <option value="120">2h</option>
            </select>
            <button
              type="submit"
              disabled={blockPending || !blockTitle.trim()}
              className="rounded bg-white hover:bg-neutral-200 text-neutral-950 font-semibold px-3 py-1.5 transition-colors disabled:opacity-40"
            >
              {blockPending ? "..." : "Save"}
            </button>
          </div>
        </form>
      )}

      {/* SCHEDULE TABLE */}
      <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
        <table className="w-full text-left text-xs border-collapse min-w-[460px]">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              <th className="py-2 px-3 w-28 text-left">Time</th>
              <th className="py-2 px-3 text-left">Event</th>
              <th className="py-2 px-2 w-20 text-center">Type</th>
              <th className="py-2 px-3 w-40 text-right">Attendance / Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60">
            {items.map((item) => {
              const isClass = item.type === "class";
              const timeDisplay = item.start_time
                ? `${item.start_time.slice(0, 5)}${
                    item.end_time ? ` - ${item.end_time.slice(0, 5)}` : ""
                  }`
                : "--:--";

              return (
                <tr
                  key={item.id}
                  className="hover:bg-neutral-900/50 transition-colors"
                >
                  {/* Time */}
                  <td className="py-2.5 px-3 font-mono text-xs text-amber-400/90 whitespace-nowrap">
                    {timeDisplay}
                  </td>

                  {/* Title & Subtitle */}
                  <td className="py-2.5 px-3">
                    <div className="min-w-0">
                      <span className="font-medium text-neutral-200 block truncate">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="text-[11px] text-neutral-400 block truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Type Badge */}
                  <td className="py-2.5 px-2 text-center whitespace-nowrap">
                    {isClass ? (
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase bg-cyan-950/70 border border-cyan-800/60 text-cyan-300">
                        Class
                      </span>
                    ) : (
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase bg-purple-950/70 border border-purple-800/60 text-purple-300">
                        Block
                      </span>
                    )}
                  </td>

                  {/* Attendance or Status Actions */}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {isClass ? (
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => handleAttendance(item.id, "present")}
                          className={`min-h-[32px] px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                            item.attendance_status === "present"
                              ? "bg-emerald-500 text-neutral-950 font-bold shadow-sm"
                              : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAttendance(item.id, "absent")}
                          className={`min-h-[32px] px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                            item.attendance_status === "absent"
                              ? "bg-red-500 text-white font-bold shadow-sm"
                              : "bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
                          }`}
                        >
                          Absent
                        </button>
                      </div>
                    ) : (
                      <span className="font-mono text-[11px] text-neutral-400">
                        {item.badge ?? "Scheduled"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-6 text-center text-xs text-neutral-500 font-mono"
                >
                  No scheduled events or classes for this day.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
