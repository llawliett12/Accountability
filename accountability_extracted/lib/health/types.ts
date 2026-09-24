export interface FoodEntry {
  id: string;
  time: string; // "HH:MM"
  food: string; // "What I ate"
  notes?: string;
}

export interface FoodHabitsRecord {
  user_id: string;
  date: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  entries: FoodEntry[];
  updated_at: string;
}

export interface SleepLogRecord {
  id: string;
  user_id: string;
  date: string;
  bedtime: string;
  wake_time: string;
  total_minutes: number;
  quality: number | null;
  poor_sleep_reason: string | null;
  note: string | null;
  period_type: "night" | "daytime";
  created_at: string;
}

export interface MeditationLogRecord {
  id: string;
  user_id: string;
  date: string;
  happened: boolean;
  duration_min: number | null;
  type: string | null;
  mood_before: number | null;
  mood_after: number | null;
  created_at: string;
}
