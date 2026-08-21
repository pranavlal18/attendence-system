"use client";

import type { MonthlySummary } from "@/services/report-service";

export interface WorkerSummaryTableProps {
  summaries: MonthlySummary[];
  totals: {
    fullCount: number;
    halfCount: number;
    totalCount: number;
    totalEarnings: number;
  };
  getStatus?: (workerId: string, earnings: number) => string;
  onPayout?: (workerId: string, workerName: string, earnings: number) => void;
}

function StatusBadge({ status }: { status: string }) {
  const base = "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium";
  let cls = "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  if (status === "PAID") cls = "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  else if (status === "PARTIALLY_PAID") cls = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
  else if (status === "UNPAID") cls = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  return <span className={`${base} ${cls}`}>{status}</span>;
}

export function WorkerSummaryTable({ summaries, totals, getStatus, onPayout }: WorkerSummaryTableProps) {
  if (summaries.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3 text-center">Full</th>
                <th className="px-4 py-3 text-center">Half</th>
                <th className="px-4 py-3 text-center">Total</th>
                <th className="px-4 py-3 text-right">Earnings (₹)</th>
                {getStatus && <th className="px-4 py-3 text-center">Status</th>}
                {onPayout && <th className="px-4 py-3 text-center">Action</th>}
              </tr>
            </thead>
          </table>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No duties for this month.</p>
        </div>
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
            Earnings: <span className="font-semibold text-zinc-900 dark:text-zinc-100">₹{totals.totalEarnings.toLocaleString()}</span>
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
              <th className="px-4 py-3">Worker</th>
              <th className="px-4 py-3 text-center">Full</th>
              <th className="px-4 py-3 text-center">Half</th>
              <th className="px-4 py-3 text-center">Total</th>
              <th className="px-4 py-3 text-right">Earnings (₹)</th>
              {getStatus && <th className="px-4 py-3 text-center">Status</th>}
              {onPayout && <th className="px-4 py-3 text-center">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {summaries.map((s) => {
              const status = getStatus ? getStatus(s.workerId, s.earnings) : undefined;
              return (
                <tr key={s.workerId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{s.workerName}</span>
                      {s.workerEmail && <span className="text-xs text-zinc-500 dark:text-zinc-400">{s.workerEmail}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-900 dark:text-zinc-100">{s.fullCount}</td>
                  <td className="px-4 py-3 text-center text-zinc-900 dark:text-zinc-100">{s.halfCount}</td>
                  <td className="px-4 py-3 text-center font-medium text-zinc-900 dark:text-zinc-100">{s.totalCount}</td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
                    ₹{s.earnings.toLocaleString()}
                  </td>
                  {getStatus && (
                    <td className="px-4 py-3 text-center">
                      {status ? <StatusBadge status={status} /> : <span className="text-xs text-zinc-400">-</span>}
                    </td>
                  )}
                  {onPayout && (
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => onPayout(s.workerId, s.workerName, s.earnings)}
                        disabled={s.earnings <= 0}
                        title={s.earnings <= 0 ? "No earnings to pay" : `Record payout for ${s.workerName}`}
                        className="inline-flex min-h-[32px] items-center justify-center rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                      >
                        Pay
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-50 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
              <td className="px-4 py-3">Totals</td>
              <td className="px-4 py-3 text-center">{totals.fullCount}</td>
              <td className="px-4 py-3 text-center">{totals.halfCount}</td>
              <td className="px-4 py-3 text-center">{totals.totalCount}</td>
              <td className="px-4 py-3 text-right">₹{totals.totalEarnings.toLocaleString()}</td>
              {getStatus && <td className="px-4 py-3" />}
              {onPayout && <td className="px-4 py-3" />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default WorkerSummaryTable;
