"use client";

import { useState, useTransition } from "react";
import type { ClassWithAttendance } from "@/lib/academics/queries";
import type { Course, SlotType, ClassOccurrence } from "@/lib/academics/types";
import {
  addTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot,
  createExtraClass,
} from "@/lib/courses/actions";
import AddCourseModal from "@/components/AddCourseModal";
import TrashIcon from "@/components/icons/TrashIcon";

const WEEKDAYS = [
  { day: 1, name: "Monday", short: "Mon" },
  { day: 2, name: "Tuesday", short: "Tue" },
  { day: 3, name: "Wednesday", short: "Wed" },
  { day: 4, name: "Thursday", short: "Thu" },
  { day: 5, name: "Friday", short: "Fri" },
];

interface CanonicalTimetableProps {
  initialClasses: ClassWithAttendance[];
  courses: Course[];
  initialOccurrences?: ClassOccurrence[];
  screenshots?: { kind: string; url: string | null }[];
}

export default function CanonicalTimetable({
  initialClasses,
  courses,
  screenshots = [],
}: CanonicalTimetableProps) {
  const todayDay = new Date().getDay();
  const defaultDay = todayDay >= 1 && todayDay <= 5 ? todayDay : 1;

  const [selectedDay, setSelectedDay] = useState<number>(defaultDay);
  const [classes, setClasses] = useState<ClassWithAttendance[]>(initialClasses);

  // Sync state when props change
  const [prevInitialClasses, setPrevInitialClasses] = useState(initialClasses);
  if (prevInitialClasses !== initialClasses) {
    setPrevInitialClasses(initialClasses);
    setClasses(initialClasses);
  }

  // Reactive courses list
  const [coursesList, setCoursesList] = useState<Course[]>(courses);
  const [prevCourses, setPrevCourses] = useState(courses);
  if (prevCourses !== courses) {
    setPrevCourses(courses);
    setCoursesList(courses);
  }

  // Active courses map
  const activeCourses = coursesList.filter((c) => c.active);
  const courseMap = new Map<string, Course>();
  for (const c of coursesList) {
    courseMap.set(c.id, c);
  }

  // Modals state
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotCourseId, setSlotCourseId] = useState("");
  const [slotDay, setSlotDay] = useState(defaultDay);
  const [slotType, setSlotType] = useState<SlotType>("lecture");
  const [slotStart, setSlotStart] = useState("09:00");
  const [slotEnd, setSlotEnd] = useState("10:00");
  const [slotLocation, setSlotLocation] = useState("");
  const [slotError, setSlotError] = useState<string | null>(null);

  // Extra class modal state
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [extraCourseId, setExtraCourseId] = useState("");
  const [extraDate, setExtraDate] = useState("");
  const [extraStart, setExtraStart] = useState("14:00");
  const [extraEnd, setExtraEnd] = useState("15:00");
  const [extraNotes, setExtraNotes] = useState("");
  const [extraError, setExtraError] = useState<string | null>(null);

  // Screenshot modal state
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const timetableScreenshot = screenshots.find((s) => s.kind === "timetable" && s.url)?.url;

  // Add course modal trigger from within slot modal
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);

  const [pending, startTransition] = useTransition();

  // Filter slots for selected weekday (Monday to Friday only)
  const dayClasses = classes
    .filter((c) => c.day_of_week === selectedDay && c.active)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const openAddSlot = () => {
    setEditingSlotId(null);
    setSlotCourseId(activeCourses[0]?.id ?? "");
    setSlotDay(selectedDay);
    setSlotType("lecture");
    setSlotStart("09:00");
    setSlotEnd("10:00");
    setSlotLocation("");
    setSlotError(null);
    setShowSlotModal(true);
  };

  const openEditSlot = (slot: ClassWithAttendance) => {
    setEditingSlotId(slot.id);
    setSlotCourseId(slot.course_id ?? activeCourses[0]?.id ?? "");
    setSlotDay(slot.day_of_week);
    setSlotType(slot.slot_type ?? "lecture");
    setSlotStart(slot.start_time.slice(0, 5));
    setSlotEnd(slot.end_time.slice(0, 5));
    setSlotLocation(slot.location ?? "");
    setSlotError(null);
    setShowSlotModal(true);
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotCourseId) {
      setSlotError("Please select a canonical course.");
      return;
    }
    if (!slotStart || !slotEnd) {
      setSlotError("Start and end times are required.");
      return;
    }

    setSlotError(null);
    const course = courseMap.get(slotCourseId);
    const courseCode = course?.code ?? "Course";
    const courseName = course?.name ?? "Course";

    const prevSlots = classes;
    startTransition(async () => {
      try {
        if (editingSlotId) {
          // Optimistic local update
          setClasses((prev) =>
            prev.map((c) =>
              c.id === editingSlotId
                ? {
                    ...c,
                    course_id: slotCourseId,
                    name: courseCode,
                    subject: courseName,
                    day_of_week: slotDay,
                    start_time: slotStart.length === 5 ? `${slotStart}:00` : slotStart,
                    end_time: slotEnd.length === 5 ? `${slotEnd}:00` : slotEnd,
                    location: slotLocation.trim() || null,
                    slot_type: slotType,
                  }
                : c
            )
          );

          await updateTimetableSlot(editingSlotId, {
            course_id: slotCourseId,
            day_of_week: slotDay,
            start_time: slotStart,
            end_time: slotEnd,
            location: slotLocation.trim() || null,
            slot_type: slotType,
          });
        } else {
          const newId = await addTimetableSlot({
            course_id: slotCourseId,
            day_of_week: slotDay,
            start_time: slotStart,
            end_time: slotEnd,
            location: slotLocation.trim() || undefined,
            slot_type: slotType,
          });

          // Optimistic local add
          const newSlot: ClassWithAttendance = {
            id: newId,
            user_id: "",
            course_id: slotCourseId,
            created_at: new Date().toISOString(),
            name: courseCode,
            subject: courseName,
            day_of_week: slotDay,
            start_time: slotStart.length === 5 ? `${slotStart}:00` : slotStart,
            end_time: slotEnd.length === 5 ? `${slotEnd}:00` : slotEnd,
            location: slotLocation.trim() || null,
            instructor: course?.instructor ?? null,
            attendance_target: course?.attendance_target ?? 75,
            active: true,
            slot_type: slotType,
            attendance: {
              totalOccurrences: 0,
              trackedCount: 0,
              presentCount: 0,
              absentCount: 0,
              percentage: null,
              target: course?.attendance_target ?? 75,
              zone: "safe",
            },
          };
          setClasses((prev) => [...prev, newSlot]);
        }

        setShowSlotModal(false);
      } catch (err) {
        setClasses(prevSlots);
        setSlotError(err instanceof Error ? err.message : "Failed to save timetable slot");
      }
    });
  };

  const handleDeleteSlot = (slotId: string, slotName: string) => {
    if (!confirm(`Are you sure you want to remove this recurring slot for ${slotName}?`)) return;

    const prevSlots = classes;
    setClasses((prev) => prev.filter((c) => c.id !== slotId));

    startTransition(async () => {
      try {
        await deleteTimetableSlot(slotId);
      } catch (err) {
        console.error("Failed to delete timetable slot", err);
        setClasses(prevSlots);
        alert("Failed to delete timetable slot: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleSaveExtraClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraCourseId || !extraDate) {
      setExtraError("Course and Date are required.");
      return;
    }

    startTransition(async () => {
      try {
        await createExtraClass({
          course_id: extraCourseId,
          date: extraDate,
          start_time: extraStart,
          end_time: extraEnd,
          notes: extraNotes.trim() || undefined,
        });
        setShowExtraModal(false);
        setExtraDate("");
        setExtraNotes("");
      } catch (err) {
        setExtraError(err instanceof Error ? err.message : "Failed to schedule extra class");
      }
    });
  };

  return (
    <div className="space-y-4">
      <AddCourseModal
        isOpen={showAddCourseModal}
        onClose={() => setShowAddCourseModal(false)}
        onCourseCreated={(newCourse) => {
          setCoursesList((prev) => {
            if (prev.some((c) => c.id === newCourse.id)) return prev;
            return [...prev, newCourse];
          });
          setSlotCourseId(newCourse.id);
        }}
      />

      {/* HEADER & CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
        <div>
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-neutral-200">
            Academic Timetable
          </h2>
          <p className="font-mono text-[11px] text-neutral-400">
            Weekly schedule (Monday &ndash; Friday) · Canonical source
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {timetableScreenshot && (
            <button
              type="button"
              onClick={() => setShowScreenshotModal(true)}
              className="rounded-lg border border-neutral-700 bg-neutral-800/80 px-2.5 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
            >
              🖼 Reference
            </button>
          )}


          <button
            type="button"
            onClick={() => {
              setExtraCourseId(activeCourses[0]?.id ?? "");
              setExtraError(null);
              setShowExtraModal(true);
            }}
            className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-2.5 py-1.5 text-amber-300 hover:bg-amber-900/50 transition-colors"
          >
            + Extra Class
          </button>

          <button
            type="button"
            onClick={openAddSlot}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors"
          >
            + Add Slot
          </button>
        </div>
      </div>

      {/* WEEKDAY SEGMENTED TABS (MONDAY TO FRIDAY ONLY - NO SAT/SUN) */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 rounded-xl bg-neutral-900 border border-neutral-800/80 p-1 font-mono text-xs">
        {WEEKDAYS.map((d) => {
          const isSelected = selectedDay === d.day;
          const count = classes.filter((c) => c.day_of_week === d.day && c.active).length;
          return (
            <button
              key={d.day}
              type="button"
              onClick={() => setSelectedDay(d.day)}
              className={`min-h-[42px] flex-1 min-w-[70px] flex flex-col items-center justify-center rounded-lg px-2 py-1 transition-all ${
                isSelected
                  ? "bg-amber-400 text-neutral-950 font-bold shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
              }`}
            >
              <span className="text-xs">{d.short}</span>
              <span className={`text-[10px] ${isSelected ? "text-neutral-900/70" : "text-neutral-500"}`}>
                {count > 0 ? `${count} class${count > 1 ? "es" : ""}` : "No class"}
              </span>
            </button>
          );
        })}
      </div>

      {/* SLOTS LIST FOR SELECTED DAY */}
      <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/50 overflow-hidden">
        <div className="px-3.5 py-2.5 bg-neutral-900/80 border-b border-neutral-800/80 flex items-center justify-between font-mono text-xs">
          <span className="font-semibold text-neutral-300">
            {WEEKDAYS.find((d) => d.day === selectedDay)?.name} Schedule
          </span>
          <span className="text-neutral-500 text-[11px]">
            {dayClasses.length} recurring {dayClasses.length === 1 ? "slot" : "slots"}
          </span>
        </div>

        {dayClasses.length === 0 ? (
          <div className="p-8 text-center font-mono text-xs text-neutral-500 space-y-2">
            <p>No classes scheduled for {WEEKDAYS.find((d) => d.day === selectedDay)?.name}.</p>
            <button
              type="button"
              onClick={openAddSlot}
              className="text-amber-400 hover:text-amber-300 underline"
            >
              + Add a timetable slot
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/60 font-mono text-xs">
            {dayClasses.map((c) => {
              const course = c.course_id ? courseMap.get(c.course_id) : undefined;
              const courseCode = course?.code ?? c.name;
              const courseName = course?.name ?? c.subject ?? c.name;

              return (
                <div
                  key={c.id}
                  className="p-3 sm:px-4 flex flex-wrap items-center justify-between gap-3 hover:bg-neutral-900/40 transition-colors"
                >
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span className="font-bold text-amber-300 whitespace-nowrap text-xs">
                      {c.start_time.slice(0, 5)} &ndash; {c.end_time.slice(0, 5)}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-neutral-800 border border-neutral-700 px-1.5 py-0.2 text-[10px] font-bold text-neutral-200">
                          {courseCode}
                        </span>
                        <span className="font-medium text-neutral-100 truncate text-xs">
                          {courseName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400">
                        <span className="capitalize">{c.slot_type ?? "lecture"}</span>
                        {c.location && <span>· 📍 {c.location}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs ml-auto">
                    <button
                      type="button"
                      onClick={() => openEditSlot(c)}
                      className="px-2 py-1 rounded bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors text-[11px]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSlot(c.id, courseCode)}
                      className="p-1.5 rounded bg-neutral-900 text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                      title="Delete slot"
                      aria-label={`Delete slot for ${courseCode}`}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: ADD / EDIT TIMETABLE SLOT (STRICT COURSE SELECTOR) */}
      {showSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
              <h3 className="font-mono text-sm font-bold text-neutral-100 uppercase tracking-wider">
                {editingSlotId ? "Edit Timetable Slot" : "Add Timetable Slot"}
              </h3>
              <button
                type="button"
                onClick={() => setShowSlotModal(false)}
                className="text-neutral-500 hover:text-neutral-300 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {slotError && (
              <div className="rounded-lg bg-rose-950/60 border border-rose-800/60 p-2.5 text-xs text-rose-300 font-mono">
                {slotError}
              </div>
            )}

            <form onSubmit={handleSaveSlot} className="space-y-3.5 font-mono text-xs">
              {/* STRICT COURSE DROPDOWN */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-neutral-400 uppercase font-semibold block">
                    Course *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddCourseModal(true)}
                    className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                  >
                    + Add New Course
                  </button>
                </div>

                {activeCourses.length === 0 ? (
                  <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-300 text-[11px]">
                    No active courses found. Please tap &ldquo;+ Add New Course&rdquo; first.
                  </div>
                ) : (
                  <select
                    value={slotCourseId}
                    onChange={(e) => setSlotCourseId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  >
                    <option value="">-- Select from my courses --</option>
                    {activeCourses.map((crs) => (
                      <option key={crs.id} value={crs.id}>
                        {crs.code} &ndash; {crs.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* DAY OF WEEK (MON - FRI ONLY) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-400 uppercase font-semibold block mb-1">
                    Day (Mon &ndash; Fri) *
                  </label>
                  <select
                    value={slotDay}
                    onChange={(e) => setSlotDay(parseInt(e.target.value, 10))}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  >
                    {WEEKDAYS.map((d) => (
                      <option key={d.day} value={d.day}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-neutral-400 uppercase font-semibold block mb-1">
                    Slot Type *
                  </label>
                  <select
                    value={slotType}
                    onChange={(e) => setSlotType(e.target.value as SlotType)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="seminar">Seminar</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* TIME */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-400 uppercase font-semibold block mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={slotStart}
                    onChange={(e) => setSlotStart(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-neutral-400 uppercase font-semibold block mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={slotEnd}
                    onChange={(e) => setSlotEnd(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>
              </div>

              {/* LOCATION */}
              <div>
                <label className="text-[10px] text-neutral-400 uppercase font-semibold block mb-1">
                  Location / Room (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hall A, Lab 3, Online"
                  value={slotLocation}
                  onChange={(e) => setSlotLocation(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-400 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => setShowSlotModal(false)}
                  className="rounded-lg border border-neutral-800 px-3 py-2 text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || activeCourses.length === 0}
                  className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-neutral-950 hover:bg-amber-300 disabled:opacity-40 transition-colors"
                >
                  {pending ? "Saving..." : "Save Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SCHEDULE ONE-OFF EXTRA CLASS */}
      {showExtraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
              <h3 className="font-mono text-sm font-bold text-neutral-100 uppercase tracking-wider">
                Schedule Extra Class
              </h3>
              <button
                type="button"
                onClick={() => setShowExtraModal(false)}
                className="text-neutral-500 hover:text-neutral-300 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {extraError && (
              <div className="rounded-lg bg-rose-950/60 border border-rose-800/60 p-2.5 text-xs text-rose-300 font-mono">
                {extraError}
              </div>
            )}

            <form onSubmit={handleSaveExtraClass} className="space-y-3.5 font-mono text-xs">
              <div>
                <label className="text-[10px] text-neutral-400 uppercase font-semibold block mb-1">
                  Course *
                </label>
                <select
                  value={extraCourseId}
                  onChange={(e) => setExtraCourseId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                >
                  <option value="">-- Select Course --</option>
                  {activeCourses.map((crs) => (
                    <option key={crs.id} value={crs.id}>
                      {crs.code} &ndash; {crs.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 uppercase font-semibold block mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={extraDate}
                  onChange={(e) => setExtraDate(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-400 uppercase font-semibold block mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={extraStart}
                    onChange={(e) => setExtraStart(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-neutral-400 uppercase font-semibold block mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={extraEnd}
                    onChange={(e) => setExtraEnd(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 uppercase font-semibold block mb-1">
                  Notes / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Makeup lecture, doubt clearing"
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-400 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => setShowExtraModal(false)}
                  className="rounded-lg border border-neutral-800 px-3 py-2 text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-neutral-950 hover:bg-amber-300 disabled:opacity-40 transition-colors"
                >
                  {pending ? "Saving..." : "Save Extra Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REFERENCE TIMETABLE SCREENSHOT */}
      {showScreenshotModal && timetableScreenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
              <h3 className="font-mono text-xs font-bold text-neutral-200 uppercase tracking-wider">
                Timetable Reference Screenshot
              </h3>
              <button
                type="button"
                onClick={() => setShowScreenshotModal(false)}
                className="rounded px-2 py-1 bg-neutral-800 text-neutral-400 hover:text-white text-xs font-mono"
              >
                Close &times;
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto rounded-lg border border-neutral-800 bg-black flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={timetableScreenshot}
                alt="Timetable Reference Screenshot"
                className="max-w-full h-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
