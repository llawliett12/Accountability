"use client";

import { useState, useTransition, Fragment } from "react";
import {
  createAssessment,
  updateAssessment,
  deleteAssessment,
  createDeadline,
  updateDeadlineStatus,
  deleteDeadline,
  updateDeadline,
  createClass,
  deactivateClass,
  updateClass,
} from "@/lib/academics/actions";
import type { ClassWithAttendance } from "@/lib/academics/queries";
import type {
  Assessment,
  Deadline,
  ClassOccurrence,
  AssessmentType,
  DeadlineStatus,
} from "@/lib/academics/types";
import { todayISO } from "@/lib/date";

export type AcademicsTab = "assessments" | "timetable" | "deadlines" | "performance" | "classes";

const TABS: { id: AcademicsTab; label: string; icon: string }[] = [
  { id: "assessments", label: "Assessments", icon: "📊" },
  { id: "timetable", label: "Timetable", icon: "📅" },
  { id: "deadlines", label: "Deadlines", icon: "⏰" },
  { id: "performance", label: "Performance", icon: "📈" },
  { id: "classes", label: "Classes", icon: "📚" },
];

const DAYS = [
  { day: 1, name: "Mon" },
  { day: 2, name: "Tue" },
  { day: 3, name: "Wed" },
  { day: 4, name: "Thu" },
  { day: 5, name: "Fri" },
  { day: 6, name: "Sat" },
  { day: 0, name: "Sun" },
];

export default function AcademicsHub({
  initialClasses,
  initialAssessments,
  initialDeadlines,
  defaultTab = "assessments",
}: {
  initialClasses: ClassWithAttendance[];
  initialAssessments: Assessment[];
  initialDeadlines: Deadline[];
  initialOccurrences?: ClassOccurrence[];
  defaultTab?: AcademicsTab;
}) {
  const [activeTab, setActiveTab] = useState<AcademicsTab>(defaultTab);

  return (
    <div className="space-y-5">
      {/* SEGMENTED TAB SELECTOR (Google Sheets-inspired tabs) */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 rounded-2xl bg-neutral-900 border border-neutral-800/80 p-1.5">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] flex-1 min-w-[90px] flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-white text-neutral-950 shadow-sm"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENTS */}
      {activeTab === "assessments" && (
        <AssessmentsSection
          initialAssessments={initialAssessments}
          classes={initialClasses}
        />
      )}

      {activeTab === "timetable" && (
        <TimetableSection
          classes={initialClasses}
        />
      )}

      {activeTab === "deadlines" && (
        <DeadlinesSection
          initialDeadlines={initialDeadlines}
          classes={initialClasses}
        />
      )}

      {activeTab === "performance" && (
        <PerformanceSection
          assessments={initialAssessments}
          classes={initialClasses}
        />
      )}

      {activeTab === "classes" && (
        <ClassesSection
          initialClasses={initialClasses}
        />
      )}
    </div>
  );
}

// ==========================================
// 1. ASSESSMENTS SPREADSHEET TABLE
// ==========================================
function AssessmentsSection({
  initialAssessments,
  classes,
}: {
  initialAssessments: Assessment[];
  classes: ClassWithAttendance[];
}) {
  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AssessmentType>("quiz");
  const [date, setDate] = useState(todayISO());
  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [scoreInput, setScoreInput] = useState("");
  const [maxScoreInput, setMaxScoreInput] = useState("20");
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  const classById = new Map(classes.map((c) => [c.id, c.name]));

  const handleScoreChange = (
    assessmentId: string,
    scoreVal: string,
    maxVal: string
  ) => {
    const s = scoreVal === "" ? null : Number(scoreVal);
    const m = maxVal === "" ? null : Number(maxVal);
    if (s !== null && Number.isNaN(s)) return;
    if (m !== null && Number.isNaN(m)) return;

    // Optimistically update local state
    setAssessments((prev) =>
      prev.map((a) => (a.id === assessmentId ? { ...a, score: s, max_score: m } : a))
    );

    setSavingId(assessmentId);
    startTransition(async () => {
      try {
        await updateAssessment(assessmentId, {
          score: s,
          max_score: m,
          status: s !== null && m !== null && m > 0 ? "completed" : "upcoming",
        });
      } finally {
        setSavingId(null);
      }
    });
  };

  const handleDelete = (assessmentId: string) => {
    setAssessments((prev) => prev.filter((a) => a.id !== assessmentId));
    startTransition(async () => {
      await deleteAssessment(assessmentId);
    });
  };

  const handleEditAssessment = (assessment: Assessment) => {
    const title = prompt("Assessment title", assessment.title);
    if (title === null || !title.trim()) return;
    const date = prompt("Date (YYYY-MM-DD)", assessment.date);
    if (!date) return;
    setAssessments((prev) => prev.map((item) => item.id === assessment.id ? { ...item, title: title.trim(), date } : item));
    startTransition(() => updateAssessment(assessment.id, { title: title.trim(), date }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    startTransition(async () => {
      const createdId = await createAssessment({
        title: title.trim(),
        type,
        date,
        class_id: classId || undefined,
        target_score: maxScoreInput ? Number(maxScoreInput) : undefined,
      });

      const s = scoreInput ? Number(scoreInput) : null;
      const m = maxScoreInput ? Number(maxScoreInput) : null;
      if (s !== null && m !== null) {
        await updateAssessment(createdId, { score: s, max_score: m });
      }

      setAssessments((prev) => [
        {
          id: createdId,
          user_id: "",
          class_id: classId || null,
          title: title.trim(),
          type,
          date,
          score: s,
          max_score: m,
          target_score: m,
          prep_hours: null,
          practice_scores: [],
          status: s !== null && m !== null ? "completed" : "upcoming",
          notes: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);

      setTitle("");
      setScoreInput("");
      setShowAdd(false);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">Assessments Sheet</h2>
          <p className="text-xs text-neutral-400">
            Inline editable scores with auto % calculation
            <span className="sm:hidden text-amber-400/80 font-mono text-[11px] ml-1.5">↔ Swipe table</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors"
        >
          {showAdd ? "✕ Close" : "+ Add Assessment"}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="border-y border-neutral-800 bg-neutral-950/30 py-3 space-y-3"
        >
          <div className="text-xs font-medium text-neutral-300">New Assessment Entry</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Test title (e.g. Midterm 1, Quiz 3)..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-xs text-neutral-100 outline-none"
              required
            />
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-xs text-neutral-200 outline-none"
            >
              <option value="">No specific subject</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AssessmentType)}
              className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 outline-none"
            >
              <option value="quiz">Quiz</option>
              <option value="exam">Exam</option>
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
              required
            />
            <input
              type="number"
              placeholder="Score (opt)"
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              className="rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
            />
            <input
              type="number"
              placeholder="Max Score"
              value={maxScoreInput}
              onChange={(e) => setMaxScoreInput(e.target.value)}
              className="rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={pending || !title.trim() || !date}
            className="w-full rounded-lg bg-white py-2 text-xs font-semibold text-neutral-950 disabled:opacity-50"
          >
            {pending ? "Adding..." : "Add to Sheet"}
          </button>
        </form>
      )}

      {/* SPREADSHEET TABLE CONTAINER */}
      <div className="border-y border-neutral-800 bg-neutral-950/50 overflow-x-auto">
        <table className="w-full text-left text-xs text-neutral-300 border-collapse min-w-[540px]">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-950/60 text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              <th className="py-2.5 px-3">Subject</th>
              <th className="py-2.5 px-3">Test</th>
              <th className="py-2.5 px-2">Date</th>
              <th className="py-2.5 px-2">Score / Max</th>
              <th className="py-2.5 px-2 text-right">%</th>
              <th className="py-2.5 px-2 text-center w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60">
            {assessments.map((a) => {
              const hasScore = a.score !== null && a.max_score !== null && a.max_score > 0;
              const pct = hasScore ? Math.round(((a.score as number) / (a.max_score as number)) * 100) : null;
              const isSaving = savingId === a.id;

              return (
                <tr key={a.id} className="hover:bg-neutral-800/40 transition-colors">
                  {/* Subject */}
                  <td className="py-2 px-3">
                    <span className="font-medium text-neutral-200 truncate max-w-[130px] block">
                      {a.class_id ? classById.get(a.class_id) ?? "Subject" : "General"}
                    </span>
                  </td>

                  {/* Test Title & Type */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase ${
                          a.type === "exam" ? "bg-purple-950/80 text-purple-300" : "bg-blue-950/80 text-blue-300"
                        }`}
                      >
                        {a.type}
                      </span>
                      <span className="font-medium text-neutral-100 truncate max-w-[160px]">{a.title}</span>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-2 px-2 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                    {a.date}
                  </td>

                  {/* Inline Editable Score & Max */}
                  <td className="py-2 px-2 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        defaultValue={a.score ?? ""}
                        placeholder="--"
                        onBlur={(e) =>
                          handleScoreChange(a.id, e.target.value, String(a.max_score ?? 100))
                        }
                        className="w-12 rounded bg-neutral-800/90 border border-neutral-700/60 px-1.5 py-1 font-mono text-center text-xs text-neutral-100 outline-none focus:border-amber-400"
                      />
                      <span className="text-neutral-500">/</span>
                      <input
                        type="number"
                        defaultValue={a.max_score ?? ""}
                        placeholder="100"
                        onBlur={(e) =>
                          handleScoreChange(a.id, String(a.score ?? ""), e.target.value)
                        }
                        className="w-12 rounded bg-neutral-800/90 border border-neutral-700/60 px-1.5 py-1 font-mono text-center text-xs text-neutral-100 outline-none focus:border-amber-400"
                      />
                    </div>
                  </td>

                  {/* Auto-Calculated Percentage */}
                  <td className="py-2 px-2 text-right font-mono font-semibold whitespace-nowrap">
                    {isSaving ? (
                      <span className="text-[10px] text-amber-400">...</span>
                    ) : pct !== null ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          pct >= 75
                            ? "bg-emerald-950/80 text-emerald-400"
                            : pct >= 50
                            ? "bg-amber-950/80 text-amber-400"
                            : "bg-red-950/80 text-red-400"
                        }`}
                      >
                        {pct}%
                      </span>
                    ) : (
                      <span className="text-neutral-600">--</span>
                    )}
                  </td>

                  {/* Delete row */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleEditAssessment(a)}
                      title="Edit assessment"
                      className="min-h-[44px] min-w-[32px] inline-flex items-center justify-center -m-2 text-neutral-600 hover:text-amber-400 transition-colors"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (confirm(`Delete ${a.title}?`)) handleDelete(a.id); }}
                      title="Delete assessment"
                      className="h-7 w-7 inline-flex items-center justify-center rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}

            {assessments.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-neutral-500">
                  No assessments added yet. Click &ldquo;+ Add Assessment&rdquo; to start tracking tests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 2. TIMETABLE VIEW (MON - SUN)
// ==========================================
function TimetableSection({
  classes,
}: {
  classes: ClassWithAttendance[];
}) {
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [showAddClass, setShowAddClass] = useState(false);
  const [className, setClassName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [targetAtt, setTargetAtt] = useState("75");
  const [pending, startTransition] = useTransition();

  const dayClasses = classes
    .filter((c) => c.day_of_week === selectedDay && c.active)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;

    startTransition(async () => {
      await createClass({
        name: className.trim(),
        day_of_week: selectedDay,
        start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
        end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
        location: location.trim() || undefined,
        attendance_target: parseInt(targetAtt, 10) || 75,
      });
      setClassName("");
      setLocation("");
      setShowAddClass(false);
    });
  };

  const editClass = (item: ClassWithAttendance) => {
    const name = prompt("Class name", item.name);
    if (name === null || !name.trim()) return;
    const start = prompt("Start time (HH:MM)", item.start_time.slice(0, 5));
    const end = start === null ? null : prompt("End time (HH:MM)", item.end_time.slice(0, 5));
    if (!start || !end) return;
    const location = prompt("Location (optional)", item.location ?? "");
    if (location === null) return;
    startTransition(() => updateClass(item.id, { name: name.trim(), start_time: start.length === 5 ? `${start}:00` : start, end_time: end.length === 5 ? `${end}:00` : end, location: location.trim() || null }));
  };

  return (
    <div className="space-y-4">
      {/* DAY SELECTOR */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 rounded-xl bg-neutral-900 border border-neutral-800/80 p-1">
        {DAYS.map((d) => {
          const isSelected = selectedDay === d.day;
          return (
            <button
              key={d.day}
              type="button"
              onClick={() => setSelectedDay(d.day)}
              className={`min-h-[44px] min-w-[44px] flex-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap px-2 ${
                isSelected
                  ? "bg-amber-400 text-neutral-950"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
          Classes for {DAYS.find((d) => d.day === selectedDay)?.name}
        </h2>
        <button
          type="button"
          onClick={() => setShowAddClass(!showAddClass)}
          className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-200"
        >
          {showAddClass ? "✕ Cancel" : "+ Add Class"}
        </button>
      </div>

      {showAddClass && (
        <form
          onSubmit={handleAddClass}
          className="border-y border-neutral-800 bg-neutral-950/30 py-3 space-y-3"
        >
          <div className="text-xs font-medium text-neutral-300">Add Class Schedule</div>
          <input
            type="text"
            placeholder="Class / Subject name..."
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-xs text-neutral-100 outline-none"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-neutral-400 block mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-400 block mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Location / Room (opt)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-xs text-neutral-100 outline-none"
            />
            <input
              type="number"
              placeholder="Attendance target %"
              value={targetAtt}
              onChange={(e) => setTargetAtt(e.target.value)}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-xs text-neutral-100 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={pending || !className.trim()}
            className="w-full rounded-lg bg-white py-2 text-xs font-semibold text-neutral-950 disabled:opacity-50"
          >
            {pending ? "Adding..." : "Save Class"}
          </button>
        </form>
      )}

      {/* TIMETABLE TABLE */}
      <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
        <table className="w-full text-left text-xs border-collapse min-w-[440px]">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              <th className="py-2 px-3 w-32">Time</th>
              <th className="py-2 px-3">Subject / Class</th>
              <th className="py-2 px-3">Location</th>
              <th className="py-2 px-3 text-right">Attendance / Target</th><th className="py-2 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">
            {dayClasses.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-900/50 transition-colors">
                <td className="py-2.5 px-3 text-amber-400 font-medium whitespace-nowrap">
                  {c.start_time.slice(0, 5)} - {c.end_time.slice(0, 5)}
                </td>
                <td className="py-2.5 px-3 font-sans">
                  <span className="font-semibold text-neutral-100">{c.name}</span>
                </td>
                <td className="py-2.5 px-3 text-neutral-400 text-[11px] font-sans">
                  {c.location ? `📍 ${c.location}` : "--"}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      c.attendance.zone === "danger"
                        ? "bg-red-950/80 text-red-400 border border-red-800/50"
                        : c.attendance.zone === "warning"
                        ? "bg-amber-950/80 text-amber-400 border border-amber-800/50"
                        : "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                    }`}
                  >
                    {c.attendance.percentage !== null ? `${c.attendance.percentage}%` : "--"}
                  </span>
                  <span className="text-[10px] text-neutral-500 ml-1.5">
                    ({c.attendance_target}%)
                  </span>
                </td>
                <td className="py-1 px-2 text-right"><button type="button" onClick={() => editClass(c)} className="min-h-9 px-1 text-[10px] text-amber-400">Edit</button></td>
              </tr>
            ))}
            {dayClasses.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-neutral-500 font-mono">
                  No classes scheduled for {DAYS.find((d) => d.day === selectedDay)?.name}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 3. DEADLINES SPREADSHEET TABLE
// ==========================================
function DeadlinesSection({
  initialDeadlines,
  classes,
}: {
  initialDeadlines: Deadline[];
  classes: ClassWithAttendance[];
}) {
  const [deadlines, setDeadlines] = useState<Deadline[]>(initialDeadlines);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [classId, setClassId] = useState("");
  const [pending, startTransition] = useTransition();

  const classById = new Map(classes.map((c) => [c.id, c.name]));
  const today = todayISO();

  const handleToggleStatus = (deadlineId: string, currentStatus: DeadlineStatus) => {
    const newStatus: DeadlineStatus = currentStatus === "completed" ? "pending" : "completed";
    setDeadlines((prev) =>
      prev.map((d) => (d.id === deadlineId ? { ...d, status: newStatus } : d))
    );
    startTransition(async () => {
      await updateDeadlineStatus(deadlineId, newStatus);
    });
  };

  const handleDelete = (deadlineId: string) => {
    setDeadlines((prev) => prev.filter((d) => d.id !== deadlineId));
    startTransition(async () => {
      await deleteDeadline(deadlineId);
    });
  };

  const handleEditDeadline = (deadline: Deadline) => {
    const title = prompt("Deadline title", deadline.title);
    if (title === null || !title.trim()) return;
    const due_date = prompt("Due date (YYYY-MM-DD)", deadline.due_date);
    if (!due_date) return;
    setDeadlines((prev) => prev.map((item) => item.id === deadline.id ? { ...item, title: title.trim(), due_date } : item));
    startTransition(() => updateDeadline(deadline.id, { title: title.trim(), due_date }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    startTransition(async () => {
      const createdId = await createDeadline({
        title: title.trim(),
        due_date: dueDate,
        class_id: classId || undefined,
      });
      setDeadlines((prev) => [
        {
          id: createdId,
          user_id: "",
          class_id: classId || null,
          title: title.trim(),
          due_date: dueDate,
          category: null,
          status: "pending",
          notes: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setTitle("");
      setShowAdd(false);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">Deadlines</h2>
          <p className="text-xs text-neutral-400">Assignments, projects, and submission tracker</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-200"
        >
          {showAdd ? "✕ Cancel" : "+ Add Deadline"}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="border-y border-neutral-800 bg-neutral-950/30 py-3 space-y-3"
        >
          <div className="text-xs font-medium text-neutral-300">New Deadline</div>
          <input
            type="text"
            placeholder="Assignment or submission title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-xs text-neutral-100 outline-none"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
              required
            />
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200 outline-none"
            >
              <option value="">No subject</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={pending || !title.trim()}
            className="w-full rounded-lg bg-white py-2 text-xs font-semibold text-neutral-950 disabled:opacity-50"
          >
            {pending ? "Adding..." : "Save Deadline"}
          </button>
        </form>
      )}

      {/* DEADLINES TABLE */}
      <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
        <table className="w-full text-left text-xs border-collapse min-w-[460px]">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              <th className="py-2 px-2 w-10 text-center">✓</th>
              <th className="py-2 px-3">Deadline</th>
              <th className="py-2 px-3 w-32">Subject</th>
              <th className="py-2 px-3 w-28 text-center">Due Date</th>
              <th className="py-2 px-2 w-20 text-center">Status</th>
              <th className="py-2 px-2 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">
            {deadlines.map((d) => {
              const isDone = d.status === "completed";
              const isOverdue = !isDone && d.due_date < today;

              return (
                <tr
                  key={d.id}
                  className={`hover:bg-neutral-900/50 transition-colors ${
                    isDone ? "opacity-60 bg-neutral-950/40" : isOverdue ? "bg-red-950/15" : ""
                  }`}
                >
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(d.id, d.status)}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center -m-2"
                      aria-label={isDone ? "Mark deadline pending" : "Mark deadline completed"}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          isDone
                            ? "bg-emerald-500 border-emerald-500 text-black"
                            : "border-neutral-600 bg-neutral-900"
                        }`}
                      >
                        {isDone && "✓"}
                      </span>
                    </button>
                  </td>

                  <td className="py-2.5 px-3 font-sans">
                    <span
                      className={`font-medium ${
                        isDone ? "line-through text-neutral-500" : "text-neutral-100"
                      }`}
                    >
                      {d.title}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-neutral-400 font-sans">
                    {d.class_id ? classById.get(d.class_id) ?? "--" : "--"}
                  </td>

                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span className={isOverdue ? "text-red-400 font-bold" : "text-neutral-300"}>
                      {d.due_date}
                    </span>
                  </td>

                  <td className="py-2.5 px-2 text-center whitespace-nowrap">
                    {isDone ? (
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-emerald-950/70 border border-emerald-800/60 text-emerald-300">
                        Completed
                      </span>
                    ) : isOverdue ? (
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-red-950/70 border border-red-800/60 text-red-300">
                        Overdue
                      </span>
                    ) : (
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-neutral-900 border border-neutral-800 text-neutral-400">
                        Incomplete
                      </span>
                    )}
                  </td>

                  <td className="py-2 px-2 text-center">
                    <button type="button" onClick={() => handleEditDeadline(d)} title="Edit deadline" className="min-h-[44px] min-w-[28px] inline-flex items-center justify-center -m-2 text-neutral-600 hover:text-amber-400 transition-colors">✎</button>
                    <button
                      type="button"
                      onClick={() => { if (confirm(`Delete ${d.title}?`)) handleDelete(d.id); }}
                      title="Delete deadline"
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center -m-2 text-neutral-600 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}

            {deadlines.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-xs text-neutral-500 font-mono">
                  No deadlines recorded. Click &ldquo;+ Add Deadline&rdquo; to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 4. PERFORMANCE & TRENDS VIEW
// ==========================================
function PerformanceSection({
  assessments,
  classes,
}: {
  assessments: Assessment[];
  classes: ClassWithAttendance[];
}) {
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const scoredAssessments = assessments.filter(
    (a) => a.score !== null && a.max_score !== null && a.max_score > 0
  );

  const overallAvg =
    scoredAssessments.length > 0
      ? Math.round(
          (scoredAssessments.reduce(
            (acc, a) => acc + ((a.score as number) / (a.max_score as number)) * 100,
            0
          ) /
            scoredAssessments.length)
        )
      : null;

  // Group scored assessments by class
  const classById = new Map(classes.map((c) => [c.id, c.name]));
  const testsByClass = new Map<string, Assessment[]>();

  for (const a of scoredAssessments) {
    const key = a.class_id || "general";
    const list = testsByClass.get(key) ?? [];
    list.push(a);
    testsByClass.set(key, list);
  }

  return (
    <div className="space-y-3">
      {/* PERFORMANCE KPI SUMMARY */}
      <div className="border border-neutral-800/80 rounded-xl bg-neutral-950/60 p-3 flex items-center justify-between font-mono text-xs">
        <div>
          <span className="text-[10px] uppercase text-neutral-500 block">Overall Average</span>
          <span className="text-xl font-bold text-neutral-100">
            {overallAvg !== null ? `${overallAvg}%` : "--"}
          </span>
        </div>
        <span className="text-neutral-400">
          {scoredAssessments.length} scored tests
        </span>
      </div>

      {/* SUBJECT PERFORMANCE TABLE */}
      <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
        <table className="w-full text-left text-xs border-collapse min-w-[420px]">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              <th className="py-2 px-3">Subject</th>
              <th className="py-2 px-3 text-center w-24">Tests</th>
              <th className="py-2 px-3 text-center w-28">Average %</th>
              <th className="py-2 px-3 text-right w-24">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">
            {Array.from(testsByClass.entries()).map(([classKey, tests]) => {
              const className = classKey === "general" ? "General / Other" : classById.get(classKey) ?? "Subject";
              const avg = Math.round(
                tests.reduce(
                  (acc, a) => acc + ((a.score as number) / (a.max_score as number)) * 100,
                  0
                ) / tests.length
              );
              const isExpanded = expandedSubject === classKey;

              return (
                <Fragment key={classKey}>
                  <tr
                    onClick={() => setExpandedSubject(isExpanded ? null : classKey)}
                    className="hover:bg-neutral-900/50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-sans font-semibold text-neutral-200">
                      {className}
                    </td>
                    <td className="py-2.5 px-3 text-center text-neutral-400">
                      {tests.length} tests
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          avg >= 75
                            ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                            : avg >= 50
                            ? "bg-amber-950/80 text-amber-400 border border-amber-800/50"
                            : "bg-red-950/80 text-red-400 border border-red-800/50"
                        }`}
                      >
                        {avg}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-400 hover:text-amber-300 text-[11px]">
                      {isExpanded ? "▲ Hide" : "▼ Details"}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-neutral-950/70 border-b border-neutral-800/60">
                      <td colSpan={4} className="p-3">
                        <div className="space-y-1 pl-2 border-l-2 border-amber-500/40">
                          {tests.map((t) => {
                            const testPct = Math.round(((t.score as number) / (t.max_score as number)) * 100);
                            return (
                              <div
                                key={t.id}
                                className="flex items-center justify-between text-xs py-1 text-neutral-300"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="capitalize text-neutral-500 text-[10px]">
                                    {t.type}
                                  </span>
                                  <span className="font-sans text-neutral-200">{t.title}</span>
                                  <span className="text-neutral-500 text-[10px]">({t.date})</span>
                                </div>
                                <span className="font-mono font-medium text-neutral-300">
                                  {t.score}/{t.max_score} ({testPct}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {scoredAssessments.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-xs text-neutral-500 font-mono">
                  No scored assessments recorded yet. Score your tests in the Assessments tab to view performance trends.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 5. CLASSES & ATTENDANCE VIEW
// ==========================================
function ClassesSection({
  initialClasses,
}: {
  initialClasses: ClassWithAttendance[];
}) {
  const [classes, setClasses] = useState<ClassWithAttendance[]>(initialClasses);
  const [, startTransition] = useTransition();

  const handleDeactivate = (classId: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== classId));
    startTransition(async () => {
      await deactivateClass(classId);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">Subjects & Attendance</h2>
          <p className="text-xs text-neutral-400">Attendance records and targets</p>
        </div>
      </div>

      {/* SUBJECTS TABLE */}
      <div className="overflow-x-auto border-y sm:border border-neutral-800/80 sm:rounded-xl bg-neutral-950/50">
        <table className="w-full text-left text-xs border-collapse min-w-[480px]">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              <th className="py-2 px-3">Subject</th>
              <th className="py-2 px-3">Location</th>
              <th className="py-2 px-3 text-center">Attended / Tracked</th>
              <th className="py-2 px-3 text-center">Target %</th>
              <th className="py-2 px-3 text-right">Attendance %</th>
              <th className="py-2 px-2 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 font-mono text-xs">
            {classes
              .filter((c) => c.active)
              .map((c) => (
                <tr key={c.id} className="hover:bg-neutral-900/50 transition-colors">
                  <td className="py-2.5 px-3 font-sans font-semibold text-neutral-200">
                    {c.name}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-400 text-[11px] font-sans">
                    {c.location ? `📍 ${c.location}` : "--"}
                  </td>
                  <td className="py-2.5 px-3 text-center text-neutral-300">
                    {c.attendance.presentCount} / {c.attendance.trackedCount}
                  </td>
                  <td className="py-2.5 px-3 text-center text-neutral-400">
                    {c.attendance_target}%
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        c.attendance.zone === "danger"
                          ? "bg-red-950/80 text-red-400 border border-red-800/50"
                          : c.attendance.zone === "warning"
                          ? "bg-amber-950/80 text-amber-400 border border-amber-800/50"
                          : "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                      }`}
                    >
                      {c.attendance.percentage !== null ? `${c.attendance.percentage}%` : "--"}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeactivate(c.id)}
                      title="Deactivate class"
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center -m-2 text-neutral-600 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            {classes.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-xs text-neutral-500 font-mono">
                  No subjects added yet. Add classes under the Timetable tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
