export type OccurrenceStatus = "scheduled" | "held" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type AssessmentType = "quiz" | "exam";
export type AssessmentStatus = "upcoming" | "completed";
export type DeadlineStatus = "pending" | "completed";
export type SlotType = "lecture" | "lab" | "tutorial" | "seminar" | "other";

export interface Course {
  id: string;
  user_id: string;
  code: string;
  name: string;
  description: string | null;
  instructor: string | null;
  location: string | null;
  attendance_target: number;
  syllabus_notes: string | null;
  next_assessment_notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassDef {
  id: string;
  user_id: string;
  course_id?: string | null;
  name: string;
  subject: string | null;
  day_of_week: number; // 0 = Sunday .. 6 = Saturday
  start_time: string; // "HH:MM:SS"
  end_time: string;
  location: string | null;
  instructor: string | null;
  attendance_target: number;
  slot_type?: SlotType;
  active: boolean;
  created_at: string;
}

export interface ClassOccurrence {
  id: string;
  user_id: string;
  class_id: string | null;
  course_id?: string | null;
  date: string; // ISO date
  start_time: string | null;
  end_time: string | null;
  status: OccurrenceStatus;
  attendance_status: AttendanceStatus | null;
  listening_rating: number | null;
  prepared: boolean;
  reviewed: boolean;
  notes: string | null;
  is_extra?: boolean;
  created_at: string;
}

export interface Assessment {
  id: string;
  user_id: string;
  class_id: string | null;
  course_id?: string | null;
  title: string;
  type: AssessmentType;
  date: string;
  score: number | null;
  max_score: number | null;
  target_score: number | null;
  prep_hours: number | null;
  practice_scores: number[];
  status: AssessmentStatus;
  notes: string | null;
  created_at: string;
}

export interface Deadline {
  id: string;
  user_id: string;
  class_id: string | null;
  course_id?: string | null;
  title: string;
  due_date: string;
  category: string | null;
  status: DeadlineStatus;
  notes: string | null;
  created_at: string;
}
