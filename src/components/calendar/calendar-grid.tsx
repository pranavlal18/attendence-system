"use client";

import { useMemo } from "react";
import { buildCalendarGrid } from "@/services/calendar-service";
import type { CalendarDay } from "@/services/calendar-service";
import { DayCell } from "./day-cell";

export interface CalendarGridProps {
  year: number;
  month: number; // 1-12
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dutiesMap: Map<string, any>;
  onDateClick?: (date: string) => void;
  selectedDate?: string;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function CalendarGrid({
  year,
  month,
  dutiesMap,
  onDateClick,
  selectedDate,
}: CalendarGridProps) {
  const calendarMonth = useMemo(
    () => buildCalendarGrid(year, month, dutiesMap),
    [year, month, dutiesMap]
  );

  return (
    <div className="w-full">
      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400"
            aria-hidden="true"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex flex-col gap-1">
        {calendarMonth.weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((day) => (
              <DayCell
                key={day.date}
                day={day}
                selected={day.date === selectedDate}
                onClick={onDateClick}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CalendarGrid;
