"use client";

import { useState, useTransition } from "react";
import { createCourse } from "@/lib/courses/actions";

import type { Course } from "@/lib/academics/types";

export default function AddCourseModal({
  isOpen,
  onClose,
  onCourseCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCourseCreated?: (course: Course) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [instructor, setInstructor] = useState("");
  const [location, setLocation] = useState("");
  const [attendanceTarget, setAttendanceTarget] = useState(75);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    if (!trimmedCode || !trimmedName) return;
    setError(null);

    startTransition(async () => {
      try {
        const newId = await createCourse({
          code: trimmedCode,
          name: trimmedName,
          instructor: instructor.trim() || undefined,
          location: location.trim() || undefined,
          attendance_target: attendanceTarget,
        });

        if (onCourseCreated) {
          onCourseCreated({
            id: newId,
            user_id: "",
            code: trimmedCode,
            name: trimmedName,
            description: null,
            instructor: instructor.trim() || null,
            location: location.trim() || null,
            attendance_target: attendanceTarget,
            syllabus_notes: null,
            next_assessment_notes: null,
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        setCode("");
        setName("");
        setInstructor("");
        setLocation("");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create course");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
          <h2 className="font-mono text-sm font-bold text-neutral-100 uppercase tracking-wider">
            Add New Course
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-950/60 border border-rose-800/60 p-2.5 text-xs text-rose-300 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 font-mono text-xs">
          <div>
            <label className="block text-[10px] text-neutral-400 uppercase mb-1">
              Course Code *
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
            />
          </div>

          <div>
            <label className="block text-[10px] text-neutral-400 uppercase mb-1">
              Course Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-neutral-400 uppercase mb-1">
                Instructor
              </label>
              <input
                type="text"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
              />
            </div>

            <div>
              <label className="block text-[10px] text-neutral-400 uppercase mb-1">
                Location / Room
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-neutral-400 uppercase mb-1">
              Attendance Target (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={attendanceTarget}
              onChange={(e) => setAttendanceTarget(parseInt(e.target.value, 10) || 75)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 focus:outline-none focus:border-neutral-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !code.trim() || !name.trim()}
              className="rounded-lg bg-neutral-100 px-4 py-1.5 font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors disabled:opacity-40"
            >
              {pending ? "Adding..." : "Add Course"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
