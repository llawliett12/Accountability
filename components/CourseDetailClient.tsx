"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { CourseDetailData } from "@/lib/courses/queries";
import {
  updateCourse,
  deactivateCourse,
  activateCourse,
  addTimetableSlot,
  deleteTimetableSlot,
  createExtraClass,
} from "@/lib/courses/actions";
import { createGoal, updateGoal, deleteGoal } from "@/lib/goals/actions";
import { createTask, updateTaskStatus, deleteTask } from "@/lib/actions";
import {
  createAssessment,
  deleteAssessment,
  createDeadline,
  deleteDeadline,
  updateDeadlineStatus,
} from "@/lib/academics/actions";
import type {
  SlotType,
  AssessmentType,
  Assessment,
  Deadline,
  ClassDef,
} from "@/lib/academics/types";
import type { Goal, GoalStatus } from "@/lib/goals/types";
import type { Task, TaskStatus } from "@/lib/types";
import TrashIcon from "@/components/icons/TrashIcon";
import NotesSection from "@/components/NotesSection";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ASSESSMENT_TYPES: { value: AssessmentType; label: string }[] = [
  { value: "quiz", label: "Quiz" },
  { value: "exam", label: "Exam" },
];

const PRIORITY_BADGES: Record<number, { label: string; class: string }> = {
  1: { label: "P1", class: "bg-rose-950/70 text-rose-300 border-rose-800/60" },
  2: { label: "P2", class: "bg-amber-950/70 text-amber-300 border-amber-800/60" },
  3: { label: "P3", class: "bg-blue-950/70 text-blue-300 border-blue-800/60" },
  4: { label: "P4", class: "bg-neutral-800 text-neutral-400 border-neutral-700" },
  5: { label: "P5", class: "bg-neutral-800 text-neutral-500 border-neutral-700" },
};

export default function CourseDetailClient({ details }: { details: CourseDetailData }) {
  const { course, attendance, pastScores } = details;

  const [pending, startTransition] = useTransition();

  // Reactive data lists
  const [slots, setSlots] = useState<ClassDef[]>(details.slots);
  const [assessments, setAssessments] = useState<Assessment[]>(details.assessments);
  const [deadlines, setDeadlines] = useState<Deadline[]>(details.deadlines);
  const [goals, setGoals] = useState<Goal[]>(details.linkedGoals);
  const [tasks, setTasks] = useState<Task[]>(details.linkedTasks);

  // Notes editing state
  const [syllabusNotes, setSyllabusNotes] = useState(course.syllabus_notes ?? "");
  const [nextExamNotes, setNextExamNotes] = useState(course.next_assessment_notes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);

  // Modal 1: Add slot state
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [slotDay, setSlotDay] = useState(1);
  const [slotStart, setSlotStart] = useState("09:00");
  const [slotEnd, setSlotEnd] = useState("10:00");
  const [slotType, setSlotType] = useState<SlotType>("lecture");
  const [slotLocation, setSlotLocation] = useState(course.location ?? "");

  // Modal 2: Add extra class state
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [extraDate, setExtraDate] = useState("");
  const [extraStart, setExtraStart] = useState("14:00");
  const [extraEnd, setExtraEnd] = useState("15:00");
  const [extraNotes, setExtraNotes] = useState("");

  // Modal 3: Add Assessment state
  const [showAddAssessment, setShowAddAssessment] = useState(false);
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentType, setAssessmentType] = useState<AssessmentType>("quiz");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [assessmentTargetScore, setAssessmentTargetScore] = useState("");
  const [assessmentNotes, setAssessmentNotes] = useState("");

  // Modal 4: Add Deadline state
  const [showAddDeadline, setShowAddDeadline] = useState(false);
  const [deadlineTitle, setDeadlineTitle] = useState("");
  const [deadlineDueDate, setDeadlineDueDate] = useState("");
  const [deadlineCategory, setDeadlineCategory] = useState("Assignment");
  const [deadlineNotes, setDeadlineNotes] = useState("");

  // Modal 5: Add Goal state
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalPriority, setGoalPriority] = useState(3);
  const [goalDueDate, setGoalDueDate] = useState("");
  const [goalDescription, setGoalDescription] = useState("");

  // Modal 6: Add Task state (with explicit Add as Goal option)
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState(3);
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskDuration, setTaskDuration] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskAddAsGoal, setTaskAddAsGoal] = useState(false);

  // 1. NOTES
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

  // 2. COURSE STATUS
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

  // 3. RECURRING SLOTS & EXTRA CLASSES
  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const slotId = await addTimetableSlot({
          course_id: course.id,
          day_of_week: slotDay,
          start_time: slotStart,
          end_time: slotEnd,
          slot_type: slotType,
          location: slotLocation.trim() || undefined,
        });
        setSlots((prev) => [
          ...prev,
          {
            id: slotId,
            user_id: course.user_id,
            course_id: course.id,
            day_of_week: slotDay,
            start_time: slotStart.length === 5 ? `${slotStart}:00` : slotStart,
            end_time: slotEnd.length === 5 ? `${slotEnd}:00` : slotEnd,
            slot_type: slotType,
            location: slotLocation.trim() || null,
            name: course.code,
            subject: course.name,
            instructor: course.instructor ?? null,
            attendance_target: course.attendance_target ?? 75,
            active: true,
            created_at: new Date().toISOString(),
          } as ClassDef,
        ]);
        setShowAddSlot(false);
      } catch (err) {
        console.error("Failed to add slot", err);
      }
    });
  };

  const handleDeleteSlot = (slotId: string) => {
    if (!confirm("Are you sure you want to remove this recurring timetable slot?")) return;
    const prevSlots = slots;
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
    startTransition(async () => {
      try {
        await deleteTimetableSlot(slotId);
      } catch (e) {
        console.error("Failed to delete slot", e);
        setSlots(prevSlots);
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

  // 4. ASSESSMENTS
  const handleAddAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentTitle.trim() || !assessmentDate) return;
    startTransition(async () => {
      try {
        const id = await createAssessment({
          course_id: course.id,
          title: assessmentTitle.trim(),
          type: assessmentType,
          date: assessmentDate,
          target_score: assessmentTargetScore ? parseFloat(assessmentTargetScore) : undefined,
          notes: assessmentNotes.trim() || undefined,
        });

        const newAssessment: Assessment = {
          id,
          user_id: course.user_id,
          course_id: course.id,
          class_id: null,
          title: assessmentTitle.trim(),
          type: assessmentType,
          date: assessmentDate,
          target_score: assessmentTargetScore ? parseFloat(assessmentTargetScore) : null,
          notes: assessmentNotes.trim() || null,
          prep_hours: null,
          score: null,
          max_score: null,
          status: "upcoming",
          practice_scores: [],
          created_at: new Date().toISOString(),
        };

        setAssessments((prev) =>
          [...prev, newAssessment].sort((a, b) => a.date.localeCompare(b.date))
        );
        setShowAddAssessment(false);
        setAssessmentTitle("");
        setAssessmentDate("");
        setAssessmentTargetScore("");
        setAssessmentNotes("");
      } catch (err) {
        console.error("Failed to add assessment", err);
      }
    });
  };

  const handleDeleteAssessment = (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete event "${title}"?`)) return;
    const prevList = assessments;
    setAssessments((prev) => prev.filter((a) => a.id !== id));
    startTransition(async () => {
      try {
        await deleteAssessment(id);
      } catch (err) {
        console.error("Failed to delete assessment", err);
        setAssessments(prevList);
      }
    });
  };

  // 5. DEADLINES
  const handleAddDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deadlineTitle.trim() || !deadlineDueDate) return;
    startTransition(async () => {
      try {
        const id = await createDeadline({
          course_id: course.id,
          title: deadlineTitle.trim(),
          due_date: deadlineDueDate,
          category: deadlineCategory.trim() || undefined,
          notes: deadlineNotes.trim() || undefined,
        });

        const newDeadline: Deadline = {
          id,
          user_id: course.user_id,
          course_id: course.id,
          class_id: null,
          title: deadlineTitle.trim(),
          due_date: deadlineDueDate,
          category: deadlineCategory.trim() || null,
          notes: deadlineNotes.trim() || null,
          status: "pending",
          created_at: new Date().toISOString(),
        };

        setDeadlines((prev) =>
          [...prev, newDeadline].sort((a, b) => a.due_date.localeCompare(b.due_date))
        );
        setShowAddDeadline(false);
        setDeadlineTitle("");
        setDeadlineDueDate("");
        setDeadlineNotes("");
      } catch (err) {
        console.error("Failed to add deadline", err);
      }
    });
  };

  const handleToggleDeadlineStatus = (id: string, current: string) => {
    const nextStatus = current === "completed" ? "pending" : "completed";
    setDeadlines((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: nextStatus } : d))
    );
    startTransition(async () => {
      try {
        await updateDeadlineStatus(id, nextStatus);
      } catch (err) {
        console.error("Failed to toggle deadline status", err);
      }
    });
  };

  const handleDeleteDeadline = (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete deadline "${title}"?`)) return;
    const prevList = deadlines;
    setDeadlines((prev) => prev.filter((d) => d.id !== id));
    startTransition(async () => {
      try {
        await deleteDeadline(id);
      } catch (err) {
        console.error("Failed to delete deadline", err);
        setDeadlines(prevList);
      }
    });
  };

  // 6. COURSE GOALS
  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    startTransition(async () => {
      try {
        const id = await createGoal({
          course_id: course.id,
          title: goalTitle.trim(),
          priority: goalPriority,
          due_date: goalDueDate || undefined,
          description: goalDescription.trim() || undefined,
          level: "week",
        });

        const newGoal: Goal = {
          id,
          user_id: course.user_id,
          parent_id: null,
          course_id: course.id,
          level: "week",
          title: goalTitle.trim(),
          description: goalDescription.trim() || null,
          start_date: null,
          due_date: goalDueDate || null,
          priority: goalPriority,
          is_top3: false,
          status: "not_started",
          progress: 0,
          target_value: null,
          current_value: null,
          manual_progress: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setGoals((prev) => [newGoal, ...prev]);
        setShowAddGoal(false);
        setGoalTitle("");
        setGoalDueDate("");
        setGoalDescription("");
        setGoalPriority(3);
      } catch (err) {
        console.error("Failed to add goal", err);
      }
    });
  };

  const handleUpdateGoalStatus = (goalId: string, nextStatus: GoalStatus) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, status: nextStatus } : g))
    );
    startTransition(async () => {
      try {
        await updateGoal(goalId, { status: nextStatus });
      } catch (err) {
        console.error("Failed to update goal status", err);
      }
    });
  };

  const handleUpdateGoalProgress = (goalId: string, progressValue: number | null) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? {
              ...g,
              manual_progress: progressValue,
              progress: progressValue ?? g.progress,
              status: progressValue === 100 ? "completed" : g.status,
            }
          : g
      )
    );
    startTransition(async () => {
      try {
        await updateGoal(goalId, {
          manual_progress: progressValue,
          status: progressValue === 100 ? "completed" : undefined,
        });
      } catch (err) {
        console.error("Failed to update goal progress", err);
      }
    });
  };

  const handleDeleteGoal = (goalId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete course goal "${title}"?`)) return;
    const prevList = goals;
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    startTransition(async () => {
      try {
        await deleteGoal(goalId);
      } catch (err) {
        console.error("Failed to delete goal", err);
        setGoals(prevList);
      }
    });
  };

  // 7. COURSE TASKS (WITH EXPLICIT TASK -> GOAL OPTION)
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    startTransition(async () => {
      try {
        let createdGoalId: string | undefined = undefined;

        // If user checked "Add this as a Goal", create corresponding goal record first
        if (taskAddAsGoal) {
          createdGoalId = await createGoal({
            course_id: course.id,
            title: taskTitle.trim(),
            priority: taskPriority,
            due_date: taskDeadline || undefined,
            level: "week",
          });

          const newGoal: Goal = {
            id: createdGoalId,
            user_id: course.user_id,
            parent_id: null,
            course_id: course.id,
            level: "week",
            title: taskTitle.trim(),
            description: null,
            start_date: null,
            due_date: taskDeadline || null,
            priority: taskPriority,
            is_top3: false,
            status: "not_started",
            progress: 0,
            target_value: null,
            current_value: null,
            manual_progress: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          setGoals((prev) => [newGoal, ...prev]);
        }

        const createdTask = await createTask({
          course_id: course.id,
          title: taskTitle.trim(),
          priority: taskPriority,
          deadline: taskDeadline || undefined,
          planned_duration_min: taskDuration ? parseInt(taskDuration, 10) : undefined,
          notes: taskNotes.trim() || undefined,
          goal_id: createdGoalId,
        });

        setTasks((prev) => [createdTask as unknown as Task, ...prev]);
        setShowAddTask(false);
        setTaskTitle("");
        setTaskDeadline("");
        setTaskDuration("");
        setTaskNotes("");
        setTaskAddAsGoal(false);
        setTaskPriority(3);
      } catch (err) {
        console.error("Failed to add task", err);
      }
    });
  };

  const handleToggleTask = (taskId: string, currentStatus: string) => {
    const nextStatus: TaskStatus = currentStatus === "completed" ? "not_started" : "completed";
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
    );
    startTransition(async () => {
      try {
        await updateTaskStatus(taskId, nextStatus);
      } catch (err) {
        console.error("Failed to toggle task", err);
      }
    });
  };

  const handleDeleteTask = (taskId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete task "${title}"?`)) return;
    const prevList = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    startTransition(async () => {
      try {
        await deleteTask(taskId);
      } catch (err) {
        console.error("Failed to delete task", err);
        setTasks(prevList);
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

        {/* Add Slot Form Modal */}
        {showAddSlot && (
          <form onSubmit={handleAddSlot} className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-neutral-200">Add Recurring Slot</span>
              <button
                type="button"
                onClick={() => setShowAddSlot(false)}
                className="text-neutral-500 hover:text-white"
              >
                &times;
              </button>
            </div>
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
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={slotStart}
                  onChange={(e) => setSlotStart(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>

              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">End Time</label>
                <input
                  type="time"
                  required
                  value={slotEnd}
                  onChange={(e) => setSlotEnd(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>

              <div className="col-span-2 sm:col-span-4">
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">Room / Location</label>
                <input
                  type="text"
                  value={slotLocation}
                  onChange={(e) => setSlotLocation(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-neutral-800/80">
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

        {/* Add Extra Class Form Modal */}
        {showAddExtra && (
          <form onSubmit={handleAddExtraClass} className="rounded-lg border border-amber-800/80 bg-neutral-950 p-3 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono font-medium text-amber-300">Schedule One-Off Extra Class</span>
              <button
                type="button"
                onClick={() => setShowAddExtra(false)}
                className="text-neutral-500 hover:text-white"
              >
                &times;
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={extraDate}
                  onChange={(e) => setExtraDate(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">Start Time *</label>
                <input
                  type="time"
                  required
                  value={extraStart}
                  onChange={(e) => setExtraStart(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">End Time *</label>
                <input
                  type="time"
                  required
                  value={extraEnd}
                  onChange={(e) => setExtraEnd(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] text-neutral-400 block mb-1">Notes</label>
                <input
                  type="text"
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-neutral-800/80">
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
                <div className="flex items-center gap-3">
                  {s.location && <span className="text-neutral-500 text-[11px]">📍 {s.location}</span>}
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(s.id)}
                    className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                    title="Delete slot"
                    aria-label="Delete slot"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. UPCOMING ASSESSMENTS & DEADLINES (READ/WRITE) */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Upcoming Academic Events &amp; Deadlines
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddAssessment(!showAddAssessment)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-mono text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              + Add Event
            </button>
            <button
              type="button"
              onClick={() => setShowAddDeadline(!showAddDeadline)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-mono text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              + Add Deadline
            </button>
          </div>
        </div>

        {/* Add Assessment Form Modal */}
        {showAddAssessment && (
          <form onSubmit={handleAddAssessment} className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-200">Add Academic Event / Assessment</span>
              <button
                type="button"
                onClick={() => setShowAddAssessment(false)}
                className="text-neutral-500 hover:text-white"
              >
                &times;
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-neutral-400 block mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={assessmentTitle}
                  onChange={(e) => setAssessmentTitle(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Type *</label>
                <select
                  value={assessmentType}
                  onChange={(e) => setAssessmentType(e.target.value as AssessmentType)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-100"
                >
                  {ASSESSMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Target Score (Optional)</label>
                <input
                  type="number"
                  value={assessmentTargetScore}
                  onChange={(e) => setAssessmentTargetScore(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Notes</label>
                <input
                  type="text"
                  value={assessmentNotes}
                  onChange={(e) => setAssessmentNotes(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-neutral-800/80">
              <button
                type="button"
                onClick={() => setShowAddAssessment(false)}
                className="px-2.5 py-1 text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !assessmentTitle.trim() || !assessmentDate}
                className="rounded bg-neutral-100 px-3 py-1 font-semibold text-neutral-950 hover:bg-neutral-200"
              >
                Save Event
              </button>
            </div>
          </form>
        )}

        {/* Add Deadline Form Modal */}
        {showAddDeadline && (
          <form onSubmit={handleAddDeadline} className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-200">Add Academic Deadline</span>
              <button
                type="button"
                onClick={() => setShowAddDeadline(false)}
                className="text-neutral-500 hover:text-white"
              >
                &times;
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-neutral-400 block mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={deadlineTitle}
                  onChange={(e) => setDeadlineTitle(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Due Date *</label>
                <input
                  type="date"
                  required
                  value={deadlineDueDate}
                  onChange={(e) => setDeadlineDueDate(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Category</label>
                <input
                  type="text"
                  value={deadlineCategory}
                  onChange={(e) => setDeadlineCategory(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] text-neutral-400 block mb-1">Notes</label>
                <input
                  type="text"
                  value={deadlineNotes}
                  onChange={(e) => setDeadlineNotes(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-neutral-800/80">
              <button
                type="button"
                onClick={() => setShowAddDeadline(false)}
                className="px-2.5 py-1 text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !deadlineTitle.trim() || !deadlineDueDate}
                className="rounded bg-neutral-100 px-3 py-1 font-semibold text-neutral-950 hover:bg-neutral-200"
              >
                Save Deadline
              </button>
            </div>
          </form>
        )}

        {assessments.length === 0 && deadlines.length === 0 ? (
          <p className="font-mono text-xs text-neutral-500">No upcoming tests, quizzes, or assignments.</p>
        ) : (
          <div className="divide-y divide-neutral-800/60 font-mono text-xs">
            {assessments.map((a) => (
              <div
                key={a.id}
                className="py-2.5 flex items-center justify-between group hover:bg-neutral-800/20 px-1 rounded transition-colors"
              >
                <Link href={`/academics/assessments/${a.id}`} className="flex-1 min-w-0">
                  <span className="text-neutral-200 group-hover:text-white transition-colors font-medium">
                    {a.title}
                  </span>
                  <span className="text-[10px] text-neutral-500 capitalize ml-2">({a.type})</span>
                </Link>
                <div className="flex items-center gap-3 text-right">
                  <div className="text-neutral-400">
                    <span>{a.date}</span>
                    {a.target_score && (
                      <span className="text-[10px] text-neutral-500 block">Target: {a.target_score}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAssessment(a.id, a.title)}
                    className="p-1 rounded text-neutral-600 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                    title="Delete assessment"
                    aria-label={`Delete ${a.title}`}
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {deadlines.map((d) => (
              <div key={d.id} className="py-2.5 flex items-center justify-between px-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={d.status === "completed"}
                    onChange={() => handleToggleDeadlineStatus(d.id, d.status)}
                    className="h-3.5 w-3.5 rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className={`truncate font-medium ${d.status === "completed" ? "line-through text-neutral-500" : "text-neutral-200"}`}>
                    {d.title}
                  </span>
                  <span className="text-[10px] text-neutral-500">({d.category ?? "Deadline"})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-400">Due {d.due_date}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteDeadline(d.id, d.title)}
                    className="p-1 rounded text-neutral-600 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                    title="Delete deadline"
                    aria-label={`Delete ${d.title}`}
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
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

      {/* 6. COURSE-LINKED GOALS & TASKS (READ/WRITE WITH SYNC) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Linked Goals (Writes to canonical global goals table with course_id) */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Course Goals ({goals.length})
            </h2>
            <button
              type="button"
              onClick={() => setShowAddGoal(!showAddGoal)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-mono text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              + Add Goal
            </button>
          </div>

          {/* Add Goal Modal */}
          {showAddGoal && (
            <form onSubmit={handleAddGoal} className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-200">Add Course Goal</span>
                <button
                  type="button"
                  onClick={() => setShowAddGoal(false)}
                  className="text-neutral-500 hover:text-white"
                >
                  &times;
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Goal Title *</label>
                  <input
                    type="text"
                    required
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Priority</label>
                    <select
                      value={goalPriority}
                      onChange={(e) => setGoalPriority(parseInt(e.target.value, 10))}
                      className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-100"
                    >
                      <option value={1}>P1 · High</option>
                      <option value={2}>P2 · Med</option>
                      <option value={3}>P3 · Normal</option>
                      <option value={4}>P4 · Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Target Due Date</label>
                    <input
                      type="date"
                      value={goalDueDate}
                      onChange={(e) => setGoalDueDate(e.target.value)}
                      className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Description / Notes</label>
                  <input
                    type="text"
                    value={goalDescription}
                    onChange={(e) => setGoalDescription(e.target.value)}
                    className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => setShowAddGoal(false)}
                  className="px-2.5 py-1 text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !goalTitle.trim()}
                  className="rounded bg-neutral-100 px-3 py-1 font-semibold text-neutral-950 hover:bg-neutral-200"
                >
                  Save Goal
                </button>
              </div>
            </form>
          )}

          {goals.length === 0 ? (
            <p className="font-mono text-xs text-neutral-500">No goals linked to this course.</p>
          ) : (
            <div className="divide-y divide-neutral-800/60 font-mono text-xs">
              {goals.map((g) => {
                const badge = PRIORITY_BADGES[g.priority] ?? PRIORITY_BADGES[3];
                return (
                  <div
                    key={g.id}
                    className="py-2 flex items-center justify-between group hover:bg-neutral-800/20 px-1 rounded transition-colors gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${badge.class}`}>
                        {badge.label}
                      </span>
                      <Link
                        href={`/goals/${g.id}`}
                        className="text-neutral-200 group-hover:text-amber-300 truncate font-medium"
                      >
                        {g.title}
                      </Link>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={g.manual_progress ?? g.progress ?? 0}
                          onChange={(e) => {
                            const val =
                              e.target.value === ""
                                ? null
                                : Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                            handleUpdateGoalProgress(g.id, val);
                          }}
                          className="w-11 rounded bg-neutral-900 border border-neutral-700 px-1 py-0.5 text-center text-neutral-100 text-[10px] font-mono focus:border-amber-500 focus:outline-none"
                          title="Goal progress %"
                          aria-label={`Progress percentage for ${g.title}`}
                        />
                        <span className="text-[10px] text-neutral-500 font-mono">%</span>
                      </div>

                      <select
                        value={g.status}
                        onChange={(e) => handleUpdateGoalStatus(g.id, e.target.value as GoalStatus)}
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold outline-none ${
                          g.status === "completed"
                            ? "bg-emerald-950/70 border-emerald-800 text-emerald-400"
                            : g.status === "in_progress"
                            ? "bg-blue-950/70 border-blue-800 text-blue-300"
                            : "bg-neutral-900 border-neutral-700 text-neutral-400"
                        }`}
                      >
                        <option value="not_started">Pending</option>
                        <option value="in_progress">Active</option>
                        <option value="completed">Done</option>
                        <option value="abandoned">Dropped</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleDeleteGoal(g.id, g.title)}
                        className="p-1 rounded text-neutral-600 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                        title="Delete goal"
                        aria-label={`Delete ${g.title}`}
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

        {/* Linked Tasks (With Explicit [ ] Add as Goal option) */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Recent Course Tasks ({tasks.length})
            </h2>
            <button
              type="button"
              onClick={() => setShowAddTask(!showAddTask)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-mono text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              + Add Task
            </button>
          </div>

          {/* Add Task Modal */}
          {showAddTask && (
            <form onSubmit={handleAddTask} className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-200">Add Course Task</span>
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="text-neutral-500 hover:text-white"
                >
                  &times;
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Task Title *</label>
                  <input
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(parseInt(e.target.value, 10))}
                      className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1.5 text-neutral-100"
                    >
                      <option value={1}>P1 · High</option>
                      <option value={2}>P2 · Med</option>
                      <option value={3}>P3 · Normal</option>
                      <option value={4}>P4 · Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Duration (min)</label>
                    <input
                      type="number"
                      value={taskDuration}
                      onChange={(e) => setTaskDuration(e.target.value)}
                      className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Deadline Date</label>
                    <input
                      type="date"
                      value={taskDeadline}
                      onChange={(e) => setTaskDeadline(e.target.value)}
                      className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Notes</label>
                  <input
                    type="text"
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    className="w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-100"
                  />
                </div>

                {/* CRUCIAL: EXPLICIT TASK -> GOAL TOGGLE */}
                <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5 flex items-start gap-2.5 mt-2">
                  <input
                    type="checkbox"
                    id="addAsGoalCheckbox"
                    checked={taskAddAsGoal}
                    onChange={(e) => setTaskAddAsGoal(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-neutral-700 bg-neutral-950 text-amber-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <label htmlFor="addAsGoalCheckbox" className="text-[11px] text-neutral-300 leading-tight cursor-pointer">
                    <span className="font-semibold text-neutral-100 block">Add this as a Goal</span>
                    <span className="text-[10px] text-neutral-400 block">
                      Also creates a canonical goal in the global goals system and links this task to it.
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="px-2.5 py-1 text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !taskTitle.trim()}
                  className="rounded bg-neutral-100 px-3 py-1 font-semibold text-neutral-950 hover:bg-neutral-200"
                >
                  Save Task
                </button>
              </div>
            </form>
          )}

          {tasks.length === 0 ? (
            <p className="font-mono text-xs text-neutral-500">No tasks linked to this course.</p>
          ) : (
            <div className="divide-y divide-neutral-800/60 font-mono text-xs">
              {tasks.map((t) => (
                <div key={t.id} className="py-2 flex items-center justify-between px-1 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={t.status === "completed"}
                      onChange={() => handleToggleTask(t.id, t.status)}
                      className="h-3.5 w-3.5 rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span
                      className={`truncate font-medium ${
                        t.status === "completed" ? "line-through text-neutral-500" : "text-neutral-200"
                      }`}
                    >
                      {t.title}
                    </span>
                    {t.goal_id && (
                      <span className="text-[9px] rounded bg-neutral-800 border border-neutral-700 px-1 py-0.2 text-amber-400 font-bold">
                        Goal
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500 uppercase">{t.status}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(t.id, t.title)}
                      className="p-1 rounded text-neutral-600 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                      title="Delete task"
                      aria-label={`Delete ${t.title}`}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 7. COURSE NOTES (CANONICAL PERSISTENT NOTES TIED TO COURSE_ID) */}
      <NotesSection
        title="Course Notes"
        notes={details.courseNotes ?? []}
        courseId={course.id}
        category="course"
      />
    </div>
  );
}
