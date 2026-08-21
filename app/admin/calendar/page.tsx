"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { fetchCalendarDuties, formatMonthLabel } from "@/services/calendar-service";
import type { CalendarDay } from "@/services/calendar-service";
import { fetchWorkersForFilter } from "@/services/attendance-service";

type Duties = CalendarDay["duties"];
type DutiesMap = Map<string, Duties>;

export default function AdminCalendarPage() {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-12

  const [year, setYear] = useState(todayYear);
  const [month, setMonth] = useState(todayMonth);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [workerId, setWorkerId] = useState<string>("");
  const [dutiesMap, setDutiesMap] = useState<DutiesMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Array<{ id: string; name: string }>>([]);

  // Fetch workers for dropdown on mount
  useEffect(() => {
    let cancelled = false;
    async function loadWorkers() {
      try {
        const w = await fetchWorkersForFilter();
        if (!cancelled) setWorkers(w);
      } catch (err) {
        console.error("Failed to fetch workers for calendar filter:", err);
      }
    }
    loadWorkers();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchDuties = useCallback(async (y: number, m: number, wid: string) => {
    setLoading(true);
    try {
      const map = await fetchCalendarDuties({
        year: y,
        month: m,
        workerId: wid || undefined,
      });
      setDutiesMap(map);
    } catch (err) {
      console.error("fetchCalendarDuties failed:", err);
      setDutiesMap(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when year/month/workerId change
  useEffect(() => {
    void fetchDuties(year, month, workerId);
  }, [year, month, workerId, fetchDuties]);

  const handlePrevClick = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextClick = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    setYear(todayYear);
    setMonth(todayMonth);
    // optionally select today? keep existing selectedDate or set to todayStr
  };

  const dutiesForSelected: Duties | undefined = selectedDate ? dutiesMap.get(selectedDate) : undefined;

  return (
    <div className="min-h-screen bg-zinc-100 p-4 sm:p-6 dark:bg-zinc-900">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
              Calendar
            </h1>
            <p className="text-sm text-zinc-500">View duties by month, filter by worker.</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex min-h-[44px] items-center rounded-md border bg-white px-3 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-800"
            >
              ← Dashboard
            </Link>
            <Link
              href="/admin/attendance"
              className="inline-flex min-h-[44px] items-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
            >
              Attendance
            </Link>
          </nav>
        </header>

        {/* Controls */}
        <div className="rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Month navigation */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevClick}
                aria-label="Previous month"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-700"
              >
                &lt;
              </button>
              <h2 className="min-w-[160px] text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {formatMonthLabel(year, month)}
              </h2>
              <button
                type="button"
                onClick={handleNextClick}
                aria-label="Next month"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-700"
              >
                &gt;
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="ml-1 inline-flex min-h-[44px] items-center rounded-md border bg-zinc-50 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600"
              >
                Today
              </button>
            </div>

            {/* Worker filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="worker-filter" className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Worker
              </label>
              <select
                id="worker-filter"
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                className="min-h-[44px] rounded-md border bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              >
                <option value="">All Workers</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Calendar Grid or Loading Skeleton */}
        <div className="rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          {loading ? (
            <div className="w-full" aria-busy="true" aria-label="Loading calendar">
              {/* Weekday header skeleton */}
              <div className="mb-1 grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" />
                ))}
              </div>
              <div className="flex flex-col gap-1">
                {Array.from({ length: 5 }).map((_, weekIdx) => (
                  <div key={weekIdx} className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 7 }).map((__, dayIdx) => (
                      <div
                        key={dayIdx}
                        className="h-16 animate-pulse rounded-md border bg-zinc-100 dark:bg-zinc-700 sm:h-20"
                      />
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-sm text-zinc-500">Loading duties…</p>
            </div>
          ) : (
            <CalendarGrid
              year={year}
              month={month}
              dutiesMap={dutiesMap}
              onDateClick={setSelectedDate}
              selectedDate={selectedDate}
            />
          )}
        </div>

        {/* Legend */}
        <div className="rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Legend</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-green-50 ring-1 ring-green-200 dark:bg-green-950/30 dark:ring-green-800">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="font-semibold text-green-700 dark:text-green-300">F</span>
              <span className="text-zinc-600 dark:text-zinc-400">Full</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-yellow-50 ring-1 ring-yellow-200 dark:bg-yellow-950/30 dark:ring-yellow-800">
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
              </span>
              <span className="font-semibold text-yellow-700 dark:text-yellow-300">H</span>
              <span className="text-zinc-600 dark:text-zinc-400">Half</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="text-zinc-400 dark:text-zinc-500">—</span>
              <span className="text-zinc-600 dark:text-zinc-400">No duty</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-700 px-1 text-[10px] font-bold text-white dark:bg-zinc-600">
                ×2
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">Multiple duties (badge count)</span>
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Green = <strong>F</strong> Full duty, Yellow = <strong>H</strong> Half duty, dash = no duty, number badge = multiple duties on that date.
          </p>
        </div>

        {/* Selected date detail */}
        {selectedDate && (
          <div className="rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Details for {selectedDate}
            </h3>
            {dutiesForSelected && dutiesForSelected.length > 0 ? (
              <ul className="space-y-2">
                {dutiesForSelected.map((d, idx) => (
                  <li
                    key={`${d.slot_number}-${idx}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm dark:border-zinc-700"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
                          d.duty_type === "FULL" ? "bg-green-600" : "bg-yellow-600"
                        }`}
                      >
                        {d.duty_type === "FULL" ? "F" : "H"}
                      </span>
                      <span className="font-medium">{d.duty_type}</span>
                      <span className="text-zinc-500">Slot {d.slot_number}</span>
                    </span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">₹{d.rate_applied}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">No duties on this date</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
