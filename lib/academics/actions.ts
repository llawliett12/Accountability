"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { occurrenceDatesInRange } from "./engine";
import { todayISO } from "@/lib/date";
import type { AttendanceStatus, AssessmentType, AssessmentStatus, DeadlineStatus } from "./types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------- classes ----------

export async function createClass(input: {
  name: string;
  subject?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location?: string;
  instructor?: string;
  attendance_target?: number;
}) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("classes")
    .insert({
      user_id: user.id,
      name: input.name,
      subject: input.subject ?? null,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      location: input.location ?? null,
      instructor: input.instructor ?? null,
      attendance_target: input.attendance_target ?? 75,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Generate the next 8 weeks of occurrences immediately so the class shows
  // up on the calendar without a separate manual step.
  await generateOccurrences(data.id, todayISO(), addDays(todayISO(), 56));

  revalidatePath("/academics");
  revalidatePath("/");
  return data.id as string;
}

export async function deactivateClass(classId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("classes")
    .update({ active: false })
    .eq("id", classId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/");
}

// ---------- occurrences ----------

// Idempotent: relies on the (class_id, date) unique constraint, so calling
// this repeatedly for overlapping ranges never creates duplicate meetings.
export async function generateOccurrences(classId: string, startISO: string, endISO: string) {
  const { supabase, user } = await requireUser();

  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("id, course_id, day_of_week, start_time, end_time")
    .eq("id", classId)
    .eq("user_id", user.id)
    .single();
  if (clsErr) throw clsErr;

  const dates = occurrenceDatesInRange(cls.day_of_week, startISO, endISO);
  if (dates.length === 0) return;

  const rows = dates.map((date) => ({
    user_id: user.id,
    class_id: classId,
    course_id: cls.course_id ?? null,
    date,
    start_time: cls.start_time,
    end_time: cls.end_time,
    is_extra: false,
  }));

  const { error } = await supabase
    .from("class_occurrences")
    .upsert(rows, { onConflict: "class_id,date", ignoreDuplicates: true });
  if (error) throw error;

  revalidatePath("/academics");
  revalidatePath("/academics/calendar");
  if (cls.course_id) {
    revalidatePath(`/academics/courses/${cls.course_id}`);
  }
  revalidatePath("/");
}

export async function markAttendance(occurrenceId: string, status: AttendanceStatus) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("class_occurrences")
    .update({ attendance_status: status, status: "held" })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .select("class_id")
    .single();
  if (error) throw error;

  revalidatePath("/academics");
  revalidatePath("/academics/calendar");
  revalidatePath(`/academics/classes/${data.class_id}`);
  revalidatePath("/");
}

export async function markListening(occurrenceId: string, rating: number) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("class_occurrences")
    .update({ listening_rating: rating })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .select("class_id")
    .single();
  if (error) throw error;
  revalidatePath(`/academics/classes/${data.class_id}`);
}

export async function markPrepared(occurrenceId: string, prepared: boolean) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("class_occurrences")
    .update({ prepared })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .select("class_id")
    .single();
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath(`/academics/classes/${data.class_id}`);
}

export async function markReviewed(occurrenceId: string, reviewed: boolean) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("class_occurrences")
    .update({ reviewed })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .select("class_id")
    .single();
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath(`/academics/classes/${data.class_id}`);
}

export async function cancelOccurrence(occurrenceId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("class_occurrences")
    .update({ status: "cancelled" })
    .eq("id", occurrenceId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/academics/calendar");
}

// ---------- assessments (quizzes/exams) ----------

export async function createAssessment(input: {
  title: string;
  type: AssessmentType;
  date: string;
  class_id?: string;
  course_id?: string | null;
  notes?: string;
  target_score?: number;
  prep_hours?: number;
}) {
  const { supabase, user } = await requireUser();

  let resolvedClassId = input.class_id ?? null;
  let resolvedCourseId = input.course_id ?? null;

  // Auto-resolve bidirectional relationship between course_id and class_id.
  //
  // `class_id` identifies one specific weekly `classes` row (schema: "one
  // row per weekly recurrence... a class that meets multiple days gets
  // multiple `classes` rows"), while `course_id` is the higher-level
  // grouping. A course legitimately has multiple `classes` rows (different
  // weekdays, and sometimes different session types — lecture vs lab vs
  // tutorial). There is no canonical/primary class per course anywhere in
  // this schema, and `class_id` drives user-visible per-class data
  // downstream (the "Subject"/class-name column in AcademicsHub, and the
  // class-attendance↔score correlation in lib/insights/queries.ts, which
  // deliberately filters out null `class_id` rather than requiring one).
  // So resolving to an arbitrary class when a course has several would
  // silently mislabel the assessment/deadline and could feed its score
  // into the wrong slot's attendance correlation.
  //
  // The only correct resolution is: if this course maps to EXACTLY ONE
  // class, use it (unambiguous); otherwise leave class_id null, exactly
  // like every other entry point in this app (AssessmentQuickAdd,
  // DeadlineQuickAdd, AcademicsHub) always requires the user to pick a
  // specific class explicitly rather than guessing one. `.limit(2)` (fetch
  // up to 2 rows, then check the count) makes that "exactly one" check
  // explicit and deterministic, rather than relying on `.maybeSingle()`'s
  // error being silently discarded for a multi-row result.
  if (resolvedCourseId && !resolvedClassId) {
    const { data: candidates } = await supabase
      .from("classes")
      .select("id")
      .eq("course_id", resolvedCourseId)
      .eq("user_id", user.id)
      .limit(2);
    if (candidates?.length === 1) {
      resolvedClassId = candidates[0].id;
    }
  } else if (resolvedClassId && !resolvedCourseId) {
    const { data: cls } = await supabase
      .from("classes")
      .select("course_id")
      .eq("id", resolvedClassId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (cls?.course_id) {
      resolvedCourseId = cls.course_id;
    }
  }

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      user_id: user.id,
      title: input.title,
      type: input.type,
      date: input.date,
      class_id: resolvedClassId,
      course_id: resolvedCourseId,
      notes: input.notes ?? null,
      target_score: input.target_score ?? null,
      prep_hours: input.prep_hours ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/academics");
  revalidatePath("/academics/assessments");
  revalidatePath("/academics/calendar");
  if (resolvedCourseId) {
    revalidatePath(`/academics/courses/${resolvedCourseId}`);
  }
  revalidatePath("/");
  return data.id as string;
}

export async function addPracticeScore(assessmentId: string, score: number) {
  const { supabase, user } = await requireUser();
  const { data: existing, error: fetchError } = await supabase
    .from("assessments")
    .select("practice_scores")
    .eq("id", assessmentId)
    .eq("user_id", user.id)
    .single();
  if (fetchError) throw fetchError;
  const scores = [...((existing?.practice_scores as number[]) ?? []), score];
  const { error } = await supabase
    .from("assessments")
    .update({ practice_scores: scores })
    .eq("id", assessmentId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath(`/academics/assessments/${assessmentId}`);
}

export async function recordAssessmentScore(
  assessmentId: string,
  score: number,
  maxScore: number
) {
  const { supabase, user } = await requireUser();
  const status: AssessmentStatus = "completed";

  const { data: existing } = await supabase
    .from("assessments")
    .select("course_id")
    .eq("id", assessmentId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("assessments")
    .update({ score, max_score: maxScore, status })
    .eq("id", assessmentId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/academics/assessments");
  revalidatePath(`/academics/assessments/${assessmentId}`);
  if (existing?.course_id) {
    revalidatePath(`/academics/courses/${existing.course_id}`);
  }
  revalidatePath("/");
}

// ---------- deadlines ----------

export async function createDeadline(input: {
  title: string;
  due_date: string;
  class_id?: string;
  course_id?: string | null;
  category?: string;
  notes?: string;
}) {
  const { supabase, user } = await requireUser();

  let resolvedClassId = input.class_id ?? null;
  let resolvedCourseId = input.course_id ?? null;

  // Same bidirectional resolution as createAssessment above: only resolve
  // class_id from course_id when the course maps to exactly one class row
  // (see the detailed comment there for why an arbitrary pick is wrong).
  if (resolvedCourseId && !resolvedClassId) {
    const { data: candidates } = await supabase
      .from("classes")
      .select("id")
      .eq("course_id", resolvedCourseId)
      .eq("user_id", user.id)
      .limit(2);
    if (candidates?.length === 1) {
      resolvedClassId = candidates[0].id;
    }
  } else if (resolvedClassId && !resolvedCourseId) {
    const { data: cls } = await supabase
      .from("classes")
      .select("course_id")
      .eq("id", resolvedClassId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (cls?.course_id) {
      resolvedCourseId = cls.course_id;
    }
  }

  const { data, error } = await supabase
    .from("deadlines")
    .insert({
      user_id: user.id,
      title: input.title,
      due_date: input.due_date,
      class_id: resolvedClassId,
      course_id: resolvedCourseId,
      category: input.category ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/academics");
  revalidatePath("/academics/deadlines");
  revalidatePath("/academics/calendar");
  if (resolvedCourseId) {
    revalidatePath(`/academics/courses/${resolvedCourseId}`);
  }
  revalidatePath("/");
  return data.id as string;
}

export async function updateDeadlineStatus(deadlineId: string, status: DeadlineStatus) {
  const { supabase, user } = await requireUser();
  const { data: existing, error } = await supabase
    .from("deadlines")
    .update({ status })
    .eq("id", deadlineId)
    .eq("user_id", user.id)
    .select("course_id")
    .maybeSingle();
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/academics/deadlines");
  revalidatePath("/academics/calendar");
  if (existing?.course_id) {
    revalidatePath(`/academics/courses/${existing.course_id}`);
  }
  revalidatePath("/");
}

export async function updateAssessment(
  assessmentId: string,
  patch: {
    title?: string;
    date?: string;
    score?: number | null;
    max_score?: number | null;
    class_id?: string | null;
    course_id?: string | null;
    status?: AssessmentStatus;
    type?: AssessmentType;
    notes?: string | null;
    target_score?: number | null;
  }
) {
  const { supabase, user } = await requireUser();
  const updatePayload: Record<string, unknown> = { ...patch };
  if (patch.score !== undefined && patch.max_score !== undefined) {
    if (patch.score !== null && patch.max_score !== null && patch.max_score > 0) {
      updatePayload.status = "completed";
    }
  }
  const { error } = await supabase
    .from("assessments")
    .update(updatePayload)
    .eq("id", assessmentId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/academics/assessments");
  revalidatePath(`/academics/assessments/${assessmentId}`);
  if (patch.course_id) {
    revalidatePath(`/academics/courses/${patch.course_id}`);
  }
  revalidatePath("/");
}

export async function deleteAssessment(assessmentId: string) {
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase
    .from("assessments")
    .select("course_id")
    .eq("id", assessmentId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("assessments")
    .delete()
    .eq("id", assessmentId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/academics/assessments");
  revalidatePath("/academics/calendar");
  if (existing?.course_id) {
    revalidatePath(`/academics/courses/${existing.course_id}`);
  }
  revalidatePath("/");
}

export async function updateDeadline(
  deadlineId: string,
  patch: {
    title?: string;
    due_date?: string;
    class_id?: string | null;
    course_id?: string | null;
    category?: string | null;
    notes?: string | null;
    status?: DeadlineStatus;
  }
) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("deadlines")
    .update(patch)
    .eq("id", deadlineId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/academics/deadlines");
  revalidatePath("/academics/calendar");
  if (patch.course_id) {
    revalidatePath(`/academics/courses/${patch.course_id}`);
  }
  revalidatePath("/");
}

export async function deleteDeadline(deadlineId: string) {
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase
    .from("deadlines")
    .select("course_id")
    .eq("id", deadlineId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("deadlines")
    .delete()
    .eq("id", deadlineId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/academics/deadlines");
  revalidatePath("/academics/calendar");
  if (existing?.course_id) {
    revalidatePath(`/academics/courses/${existing.course_id}`);
  }
  revalidatePath("/");
}

export async function updateClass(
  classId: string,
  patch: {
    name?: string;
    subject?: string | null;
    start_time?: string;
    end_time?: string;
    location?: string | null;
    attendance_target?: number;
    day_of_week?: number;
  }
) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("classes")
    .update(patch)
    .eq("id", classId)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/academics");
  revalidatePath("/");
}

