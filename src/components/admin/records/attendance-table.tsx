"use client";

import type { AttendanceRecord, AttendanceTotals } from "@/services/attendance-service";

export interface AttendanceTableProps {
  records: AttendanceRecord[];
  totals: AttendanceTotals;
  onRemove?: (id: string) => void;
  loading?: boolean;
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-14 rounded bg-zinc-200 dark:bg-zinc-700" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-10 rounded bg-zinc-200 dark:bg-zinc-700" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No records</p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        Try adjusting filters or create a duty record.
      </p>
    </div>
  );
}

export function AttendanceTable({ records, totals, onRemove, loading }: AttendanceTableProps) {
  const showRemoveColumn = typeof onRemove === "function";

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Slot</th>
                <th className="px-4 py-3">Amount</th>
                {showRemoveColumn && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Slot</th>
                <th className="px-4 py-3">Amount</th>
                {showRemoveColumn && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
          </table>
        </div>
        <EmptyState />
        {/* Totals row even when empty */}
        <div className="flex flex-wrap gap-4 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/50">
          <span className="text-zinc-600 dark:text-zinc-400">
            Full: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totals.fullCount}</span>
          </span>
          <span className="text-zinc-600 dark:text-zinc-400">
            Half: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totals.halfCount}</span>
          </span>
          <span className="text-zinc-600 dark:text-zinc-400">
            Total: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totals.totalCount}</span>
          </span>
          <span className="text-zinc-600 dark:text-zinc-400">
            Earnings: <span className="font-semibold text-zinc-900 dark:text-zinc-100">₹{totals.totalEarnings}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Worker</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Slot</th>
              <th className="px-4 py-3">Amount</th>
              {showRemoveColumn && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {records.map((r) => (
              <tr key={r.id} className="min-h-[44px] hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{r.date}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.worker_name}</span>
                    {r.worker_email && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{r.worker_email}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      r.duty_type === "FULL"
                        ? "inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        : "inline-flex rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                    }
                  >
                    {r.duty_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.slot_number}</td>
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">₹{r.rate_applied}</td>
                {showRemoveColumn && (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onRemove?.(r.id)}
                      className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-red-900 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals row at bottom */}
      <div className="flex flex-wrap gap-4 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/50">
        <span className="text-zinc-600 dark:text-zinc-400">
          Full: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totals.fullCount}</span>
        </span>
        <span className="text-zinc-600 dark:text-zinc-400">
          Half: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totals.halfCount}</span>
        </span>
        <span className="text-zinc-600 dark:text-zinc-400">
          Total: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totals.totalCount}</span>
        </span>
        <span className="text-zinc-600 dark:text-zinc-400">
          Earnings: <span className="font-semibold text-zinc-900 dark:text-zinc-100">₹{totals.totalEarnings}</span>
        </span>
      </div>
    </div>
  );
}
