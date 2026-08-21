"use client";

import * as React from "react";

export interface MonthSelectorProps {
  value: string; // YYYY-MM
  onChange: (v: string) => void;
}

function getPrevMonth(monthYear: string): string {
  const [yStr, mStr] = monthYear.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  // m is 1-based, create date for previous month
  const d = new Date(y, m - 2, 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}`;
}

function getNextMonth(monthYear: string): string {
  const [yStr, mStr] = monthYear.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = new Date(y, m, 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}`;
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  const handlePrev = React.useCallback(() => {
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    onChange(getPrevMonth(value));
  }, [value, onChange]);

  const handleNext = React.useCallback(() => {
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    onChange(getNextMonth(value));
  }, [value, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handlePrev}
        aria-label="Previous month"
        className="inline-flex min-h-[44px] items-center justify-center rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      >
        Prev
      </button>
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border px-2 py-2 min-h-[44px] bg-white text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />
      <button
        type="button"
        onClick={handleNext}
        aria-label="Next month"
        className="inline-flex min-h-[44px] items-center justify-center rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      >
        Next
      </button>
    </div>
  );
}

export default MonthSelector;
