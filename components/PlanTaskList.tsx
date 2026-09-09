"use client";

import TaskSpreadsheet, { LinkableGoal } from "./TaskSpreadsheet";
import ScheduleTable, { ScheduleItem } from "./ScheduleTable";
import RolloverBanner from "./RolloverBanner";
import type { Task } from "@/lib/types";

export interface PlanTaskListProps {
  initialTasks: Task[];
  goals: LinkableGoal[];
  scheduleItems: ScheduleItem[];
  selectedDate?: string;
  yesterdayUnfinishedCount?: number;
  yesterdayDate?: string;
}

export default function PlanTaskList({
  initialTasks,
  goals = [],
  scheduleItems = [],
  selectedDate,
  yesterdayUnfinishedCount = 0,
  yesterdayDate,
}: PlanTaskListProps) {
  return (
    <div className="space-y-5">
      {/* YESTERDAY'S UNFINISHED TASKS ROLLOVER BANNER */}
      {yesterdayDate && yesterdayUnfinishedCount > 0 && (
        <RolloverBanner
          yesterdayDate={yesterdayDate}
          todayDate={selectedDate ?? ""}
          unfinishedCount={yesterdayUnfinishedCount}
        />
      )}

      {/* SPREADSHEET TABLE OF TASKS */}
      <section>
        <TaskSpreadsheet
          initialTasks={initialTasks}
          goals={goals}
          selectedDate={selectedDate}
        />
      </section>

      {/* SCHEDULE & TIMELINE TABLE */}
      <section className="pt-2">
        <ScheduleTable
          items={scheduleItems}
          selectedDate={selectedDate}
        />
      </section>
    </div>
  );
}
export type { ScheduleItem, LinkableGoal };
