"use client";

import type { CalendarDay } from "@/services/calendar-service";

export interface DayCellProps {
  day: CalendarDay;
  onClick?: (date: string) => void;
  selected?: boolean;
}

export function DayCell({ day, onClick, selected }: DayCellProps) {
  const { date, day: dayNum, isCurrentMonth, isToday, dutyType, count } = day;

  const handleClick = () => {
    onClick?.(date);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(date);
    }
  };

  // Base container styles
  const baseClasses =
    "relative flex h-16 w-full flex-col rounded-md border p-1.5 text-left transition-colors sm:h-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 dark:focus-visible:ring-zinc-500";

  // Background / border / tint per state
  let stateClasses = "";
  if (!isCurrentMonth) {
    stateClasses = "opacity-40 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700";
  } else if (dutyType === "FULL") {
    stateClasses = "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50";
  } else if (dutyType === "HALF") {
    stateClasses = "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-950/50";
  } else if (dutyType === "MIXED") {
    stateClasses = "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950/50";
  } else {
    // No duty
    stateClasses = "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800";
  }

  // Ring for today / selected — selected takes precedence visually but both can co-exist
  let ringClasses = "";
  if (selected) {
    ringClasses = "ring-2 ring-zinc-900 dark:ring-zinc-100 ring-offset-0";
    // if also today, add blue outer via ring color blending — prioritize selected with blue inner dot instead
    if (isToday) {
      ringClasses = "ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-0";
    }
  } else if (isToday) {
    ringClasses = "ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-0";
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${date}${count > 0 ? `, ${count} ${dutyType ?? ""} duty` : ", no duty"}${isToday ? ", today" : ""}${selected ? ", selected" : ""}`}
      aria-pressed={selected}
      className={`${baseClasses} ${stateClasses} ${ringClasses} min-h-[44px] min-w-[44px]`}
    >
      {/* Header: day number + today dot */}
      <div className="flex w-full items-start justify-between">
        <span
          className={`text-sm font-medium leading-none ${
            !isCurrentMonth
              ? "text-zinc-400 dark:text-zinc-500"
              : isToday
                ? "text-blue-600 dark:text-blue-400"
                : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {dayNum}
        </span>
        <span className="flex items-center gap-1">
          {isToday && (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400"
            />
          )}
          {count > 1 && (
            <span
              aria-hidden="true"
              className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ${
                dutyType === "FULL"
                  ? "bg-green-600 dark:bg-green-500"
                  : dutyType === "HALF"
                    ? "bg-yellow-600 dark:bg-yellow-500 text-white"
                    : dutyType === "MIXED"
                      ? "bg-orange-600 dark:bg-orange-500"
                      : "bg-zinc-600 dark:bg-zinc-500"
              }`}
            >
              ×{count}
            </span>
          )}
        </span>
      </div>

      {/* Body: visual indicator */}
      <div className="mt-1 flex flex-1 items-center justify-center">
        {count === 0 ? (
          <span className="text-xs text-zinc-300 dark:text-zinc-600" aria-hidden="true">
            —
          </span>
        ) : dutyType === "FULL" ? (
          <span className="inline-flex items-center gap-1" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-300">F</span>
          </span>
        ) : dutyType === "HALF" ? (
          <span className="inline-flex items-center gap-1" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-yellow-500 dark:bg-yellow-400" />
            <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">H</span>
          </span>
        ) : dutyType === "MIXED" ? (
          <span className="inline-flex items-center gap-1" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-orange-500 dark:bg-orange-400" />
            <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">M</span>
          </span>
        ) : null}
      </div>

      {/* Accessible hidden count for single duty duplicates: show badge inline when count >1 already in header, but also ensure single badge not duplicated */}
      {/* Background tint already handled via stateClasses */}
    </button>
  );
}

export default DayCell;
