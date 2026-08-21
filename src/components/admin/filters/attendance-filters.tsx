"use client";

import type { AttendanceFilters } from "@/services/attendance-service";

export interface AttendanceFiltersProps {
  filters: AttendanceFilters;
  onChange: (f: AttendanceFilters) => void;
  workers: Array<{ id: string; name: string }>;
  onClear: () => void;
}

export function AttendanceFilters({
  filters,
  onChange,
  workers,
  onClear,
}: AttendanceFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Date picker */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="attendance-filter-date"
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Date
        </label>
        <input
          id="attendance-filter-date"
          type="date"
          value={filters.date || ""}
          onChange={(e) =>
            onChange({
              ...filters,
              date: e.target.value || undefined,
              month: undefined,
            })
          }
          className="min-h-[36px] rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Month picker */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="attendance-filter-month"
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Month
        </label>
        <input
          id="attendance-filter-month"
          type="month"
          value={filters.month || ""}
          onChange={(e) =>
            onChange({
              ...filters,
              month: e.target.value || undefined,
              date: undefined,
            })
          }
          className="min-h-[36px] rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Worker dropdown */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="attendance-filter-worker"
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Worker
        </label>
        <select
          id="attendance-filter-worker"
          value={filters.workerId || ""}
          onChange={(e) =>
            onChange({
              ...filters,
              workerId: e.target.value || undefined,
            })
          }
          className="min-h-[36px] rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">All Workers</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {/* Duty type toggle */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="attendance-filter-duty"
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Duty Type
        </label>
        <select
          id="attendance-filter-duty"
          value={filters.dutyType || "ALL"}
          onChange={(e) =>
            onChange({
              ...filters,
              dutyType: e.target.value as AttendanceFilters["dutyType"],
            })
          }
          className="min-h-[36px] rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="ALL">ALL</option>
          <option value="FULL">FULL</option>
          <option value="HALF">HALF</option>
        </select>
      </div>

      {/* Clear button */}
      <button
        type="button"
        onClick={onClear}
        className="min-h-[36px] rounded-md border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        Clear
      </button>
    </div>
  );
}
