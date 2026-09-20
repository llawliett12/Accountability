"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { CourseDetailData } from "@/lib/courses/queries";
import {
  updateCourse,
  deactivateCourse,
  activateCourse,
  addTimetableSlot,
  createExtraClass,
  cancelClassOccurrence,
} from "@/lib/courses/actions";
import type { SlotType } from "@/lib/academics/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CourseDetailClient({ details }: { details: CourseDetailData }) {
  const { course, slots, occurrences, attendance, assessments, deadlines, linkedGoals, linkedTasks, pastScores } =
    details;

  const [pending, startTransition] = useTransition();

  // Notes editing state
  const [syllabusNotes, setSyllabusNotes] = useState(course.syllabus_notes ?? "");
  const [nextExamNotes, setNextExamNotes] = useState(course.next_assessment_notes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);

  // Add slot modal/state
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [slotDay, setSlotDay] = useState(1);
  const [slotStart, setSlotStart] = useState("09:00");
  const [slotEnd, setSlotEnd] = useState("10:00");
  const [slotType, setSlotType] = useState<SlotType>("lecture");
  const [slotLocation, setSlotLocation] = useState(course.location ?? "");

  // Add extra class state
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [extraDate, setExtraDate] = useState("");
  const [extraStart, setExtraStart] = useState("14:00");
  const [extraEnd, setExtraEnd] = useState("15:00");
  const [extraNotes, setExtraNotes] = useState("");

  const handleSaveNotes = () => {
    startTransition(async () => {
      try {
        await updateCourse(course.id, {
          syllabus_notes: syllabusNotes,
          next_assessment_notes: nextExamNotes,
        });
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2500);
      } catch (e) {
        console.error("Failed to save notes", e);
      }
    });
  };

  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await addTimetableSlot({
          course_id: course.id,
          day_of_week: slotDay,
          start_time: slotStart,
          end_time: slotEnd,
          slot_type: slotType,
          location: slotLocation.trim() || undefined,
        });
        setShowAddSlot(false);
      } catch (err) {
        console.error("Failed to add slot", err);
      }
    });
  };

  const handleAddExtraClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraDate) return;
    startTransition(async () => {
      try {
        await createExtraClass({
          course_id: course.id,
          date: extraDate,
          start_time: extraStart,
          end_time: extraEnd,
          notes: extraNotes.trim() || undefined,
        });
        setShowAddExtra(false);
        setExtraDate("");
        setExtraNotes("");
      } catch (err) {
        console.error("Failed to add extra class", err);
      }
    });
  };


  const handleToggleActive = () => {
    startTransition(async () => {
      try {
        if (course.active) {
          await deactivateCourse(course.id);
        } else {
          await activateCourse(course.id);
        }
      } catch (e) {
        console.error("Failed to toggle course active status", e);
      }
    });
  };

  const handleCancelOccurrence = (occId: string) => {
    if (!confirm("Are you sure you want to cancel this class occurrence?")) return;
    startTransition(async () => {
      try {
        await cancelClassOccurrence(occId);
      } catch (e) {
        console.error("Failed to cancel occurrence", e);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. ATTENDANCE & STATUS SUMMARY */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div>
            <span className="text-[10px] uppercase text-neutral-500 block">Attendance Rate</span>
            <span
              className={`text-xl font-bold ${
                attendance.zone === "safe"
                  ? "text-emerald-400"
                  : attendance.zone === "warning"
                  ? "text-amber-400"
                  : attendance.zone === "danger"
                  ? "text-rose-400"
                  : "text-neutral-200"
              }`}
            >
              {attendance.percentage !== null ? `${attendance.percentage}%` : "--"}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-neutral-500 block">Target Cutoff</span>
            <span className="text-xl font-bold text-neutral-200">{course.attendance_target}%</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-neutral-500 block">Attended / Tracked</span>
            <span className="text-sm font-semibold text-neutral-200 pt-1 block">
              {attendance.presentCount} / {attendance.trackedCount}
            </span>
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={handleToggleActive}
              className={`rounded-lg px-2.5 py-1 text-xs font-mono border transition-colors ${
                course.active
                  ? "border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  : "border-emerald-800 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900"
              }`}
            >
              {course.active ? "Deactivate (Archive)" : "Re-activate Course"}
            </button>
          </div>
        </div>
      </section>

      {/* 2. RECENT / CURRENT SYLLABUS & NEXT ASSESSMENT NOTES */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Course Notes &amp; Exam Insights
          </h2>
          <div className="flex items-center gap-2">
            {notesSaved && <span className="font-mono text-[10px] text-emerald-400">✓ Saved</span>}
            <button
              type="button"
              disabled={pending}
              onClick={handleSaveNotes}
              className="rounded-lg bg-neutral-100 px-3 py-1 font-mono text-xs font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors"
            >
              {pending ? "Saving..." : "Save Notes"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider block">
              What is happening in class? (Syllabus &amp; Progress)
            </label>
            <textarea
              value={syllabusNotes}
              onChange={(e) => setSyllabusNotes(e.target.value)}
              placeholder="e.g. Chapter 4 Virtual Memory; Lecture 12 covered Paging algorithms..."
              rows={3}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-neutral-100 placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] text-amber-400/90 uppercase tracking-wider block">
              What is likely to be asked in the next assessment?
            </label>
            <textarea
              value={nextExamNotes}
              onChange={(e) => setNextExamNotes(e.target.value)}
              placeholder="e.g. Prof emphasized page replacement proofs and numerical problems from HW 3..."
              rows={3}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-neutral-100 placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* 3. RECURRING TIMETABLE & EXTRA CLASSES */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Recurring Timetable Slots ({slots.length})
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddSlot(!showAddSlot)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-mono text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              + Add Slot
            </button>
            <button
              type="button"
              onClick={() => setShowAddExtra(!showAddExtra)}
              className="rounded-lg border border-amber-800/80 bg-amber-950/40 px-2.5 py-1 text-xs font-mono text-amber-300 hover:bg-amber-900/60 transition-colors"
            >
              + Extra Class
            </button>
          </div>
        </div>

        {/* Add Slot Form */}
        {showAddSlot && (
          <form onSubmit={handleAddSlot} className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 space-y-3 text-xs">
            <div className="font-mono font-medium text-neutral-300">Add Recurring Slot (Lectures / Labs)</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">Day</label>
                <select
                  value={slotDay}
                  onChange={(e) => setSlotDay(parseInt(e.target.value, 10))}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-100"
                >
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                  <option value={0}>Sunday</option>
                </select>
              </div>

              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">Type</label>
                <select
                  value={slotType}
                  onChange={(e) => setSlotType(e.target.value as SlotType)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-100"
                >
                  <option value="lecture">Lecture</option>
                  <option value="lab">Lab</option>
                  <option value="tutorial">Tutorial</option>
                  <option value="seminar">Seminar</option>
                </select>
              </div>

              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">Start Time</label>
                <input
                  type="time"
                  value={slotStart}
                  onChange={(e) => setSlotStart(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>

              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">End Time</label>
                <input
                  type="time"
                  value={slotEnd}
                  onChange={(e) => setSlotEnd(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>

              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">Room / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Hall A"
                  value={slotLocation}
                  onChange={(e) => setSlotLocation(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddSlot(false)}
                className="px-2.5 py-1 font-mono text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-neutral-100 px-3 py-1 font-mono font-semibold text-neutral-950 hover:bg-neutral-200"
              >
                Save Slot
              </button>
            </div>
          </form>
        )}

        {/* Add Extra Class Form */}
        {showAddExtra && (
          <form onSubmit={handleAddExtraClass} className="rounded-lg border border-amber-800/80 bg-neutral-950 p-3 space-y-3 text-xs">
            <div className="font-mono font-medium text-amber-300">Schedule One-Off Extra Class</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={extraDate}
                  onChange={(e) => setExtraDate(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">Start Time</label>
                <input
                  type="time"
                  value={extraStart}
                  onChange={(e) => setExtraStart(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">End Time</label>
                <input
                  type="time"
                  value={extraEnd}
                  onChange={(e) => setExtraEnd(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Makeup lecture"
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
            </div>


            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddExtra(false)}
                className="px-2.5 py-1 font-mono text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !extraDate}
                className="rounded bg-amber-400 px-3 py-1 font-mono font-semibold text-neutral-950 hover:bg-amber-300"
              >
                Save Extra Class
              </button>
            </div>
          </form>
        )}

        {/* Timetable slots list */}
        {slots.length === 0 ? (
          <p className="font-mono text-xs text-neutral-500">No recurring timetable slots configured for this course.</p>
        ) : (
          <div className="divide-y divide-neutral-800/60 font-mono text-xs">
            {slots.map((s) => (
              <div key={s.id} className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-neutral-300 w-10">{DAY_NAMES[s.day_of_week]}</span>
                  <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400 capitalize">
                    {s.slot_type ?? "lecture"}
                  </span>
                  <span className="text-neutral-400">
                    {s.start_time.slice(0, 5)} &ndash; {s.end_time.slice(0, 5)}
                  </span>
                </div>
                {s.location && <span className="text-neutral-500 text-[11px]">{s.location}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. UPCOMING ASSESSMENTS & DEADLINES */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-3">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
          Upcoming Academic Events &amp; Deadlines
        </h2>

        {assessments.length === 0 && deadlines.length === 0 ? (
          <p className="font-mono text-xs text-neutral-500">No upcoming tests, quizzes, or assignments.</p>
        ) : (
          <div className="divide-y divide-neutral-800/60 font-mono text-xs">
            {assessments.map((a) => (
              <Link
                key={a.id}
                href={`/academics/assessments/${a.id}`}
                className="py-2.5 flex items-center justify-between group hover:bg-neutral-800/20 px-1 rounded transition-colors"
              >
                <div>
                  <span className="text-neutral-200 group-hover:text-white transition-colors">{a.title}</span>
                  <span className="text-[10px] text-neutral-500 capitalize ml-2">({a.type})</span>
                </div>
                <div className="text-neutral-400 text-right">
                  <span>{a.date}</span>
                  {a.target_score && <span className="text-[10px] text-neutral-500 block">Target: {a.target_score}</span>}
                </div>
              </Link>
            ))}

            {deadlines.map((d) => (
              <div key={d.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-neutral-200">{d.title}</span>
                  <span className="text-[10px] text-neutral-500 ml-2">({d.category ?? "Deadline"})</span>
                </div>
                <span className="text-neutral-400">Due {d.due_date}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. PAST SCORES & HISTORY */}
      {pastScores.length > 0 && (
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-3">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Historical Scores &amp; Results
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-500 text-[10px] uppercase">
                  <th className="py-1.5">Assessment</th>
                  <th className="py-1.5">Date</th>
                  <th className="py-1.5 text-right">Score</th>
                  <th className="py-1.5 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {pastScores.map((ps) => {
                  const pct = Math.round((ps.score / ps.maxScore) * 100);
                  return (
                    <tr key={ps.id}>
                      <td className="py-2 text-neutral-200">{ps.title}</td>
                      <td className="py-2 text-neutral-400">{ps.date}</td>
                      <td className="py-2 text-right text-neutral-200">
                        {ps.score} / {ps.maxScore}
                      </td>
                      <td className="py-2 text-right font-bold text-neutral-100">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 6. COURSE-LINKED GOALS & TASKS */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Linked Goals */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-3">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Course Goals ({linkedGoals.length})
          </h2>
          {linkedGoals.length === 0 ? (
            <p className="font-mono text-xs text-neutral-500">No goals linked to this course.</p>
          ) : (
            <div className="divide-y divide-neutral-800/60 font-mono text-xs">
              {linkedGoals.map((g) => (
                <Link
                  key={g.id}
                  href={`/goals/${g.id}`}
                  className="py-2 flex items-center justify-between group hover:bg-neutral-800/20 px-1 rounded transition-colors"
                >
                  <span className="text-neutral-200 group-hover:text-white truncate">{g.title}</span>
                  <span className="text-neutral-400 text-[10px] ml-2">{g.progress}%</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Linked Tasks */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-3">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Recent Course Tasks ({linkedTasks.length})
          </h2>
          {linkedTasks.length === 0 ? (
            <p className="font-mono text-xs text-neutral-500">No tasks linked to this course.</p>
          ) : (
            <div className="divide-y divide-neutral-800/60 font-mono text-xs">
              {linkedTasks.map((t) => (
                <div key={t.id} className="py-2 flex items-center justify-between">
                  <span className={`text-neutral-200 truncate ${t.status === "completed" ? "line-through text-neutral-500" : ""}`}>
                    {t.title}
                  </span>
                  <span className="text-[10px] text-neutral-500 uppercase">{t.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 7. CLASS OCCURRENCES & CANCELLATIONS */}
      {occurrences.length > 0 && (
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-3">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Recent Class Meetings &amp; Cancellations
          </h2>
          <div className="divide-y divide-neutral-800/60 font-mono text-xs max-h-60 overflow-y-auto">
            {occurrences.slice(0, 15).map((occ) => {
              const isCancelled = occ.status === "cancelled";
              return (
                <div key={occ.id} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-300">{occ.date}</span>
                    {occ.start_time && <span className="text-neutral-500 text-[11px]">{occ.start_time.slice(0, 5)}</span>}
                    {occ.is_extra && (
                      <span className="rounded bg-amber-950 px-1 py-0.2 text-[9px] text-amber-400 border border-amber-800/60">
                        Extra
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isCancelled ? (
                      <span className="text-rose-400 text-[11px]">Cancelled</span>
                    ) : occ.attendance_status ? (
                      <span className="text-emerald-400 text-[11px] capitalize">{occ.attendance_status}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCancelOccurrence(occ.id)}
                        className="text-[10px] text-neutral-500 hover:text-rose-400 underline"
                      >
                        Cancel occurrence
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
