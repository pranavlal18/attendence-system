"use client";

import { useState } from "react";
import {
  fetchAttendanceMatrix,
  type AttendanceMatrix,
} from "@/services/report-service";

interface Props {
  monthYear: string;
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export function PrintAttendanceSheet({ monthYear }: Props) {
  const today = localToday();
  const defaultEnd = today.startsWith(monthYear) ? today : `${monthYear}-01`;
  const [overrideEnd, setOverrideEnd] = useState<string | null>(null);
  const [lastMonth, setLastMonth] = useState(monthYear);
  const [matrix, setMatrix] = useState<AttendanceMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adjust state during render when monthYear changes (React docs pattern):
  // reset any explicit override and drop the stale matrix.
  if (lastMonth !== monthYear) {
    setLastMonth(monthYear);
    setOverrideEnd(null);
    setMatrix(null);
    setError(null);
  }
  const endDate = overrideEnd ?? defaultEnd;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setMatrix(await fetchAttendanceMatrix(monthYear, endDate));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const [pdfGenerating, setPdfGenerating] = useState(false);

  const downloadPdf = async () => {
    if (!matrix) return;
    setPdfGenerating(true);
    setError(null);
    try {
      // Dynamic import keeps the ~350KB jsPDF bundle out of initial page load
      const { generateAttendancePdf } = await import("@/lib/pdf/attendance-pdf");
      generateAttendancePdf(matrix);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <label htmlFor="print-end-date" className="block text-xs font-medium text-zinc-500">Until date</label>
          <input id="print-end-date" type="date" value={endDate} min={`${monthYear}-01`}
            onChange={(e) => setOverrideEnd(e.target.value)}
            className="mt-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800" />
        </div>
        <button type="button" onClick={load} disabled={loading}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-700">
          {loading ? "Loading…" : "Load Sheet"}
        </button>
        <button type="button" onClick={downloadPdf} disabled={!matrix || pdfGenerating}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {pdfGenerating ? "Generating…" : "Download PDF"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {matrix && matrix.workers.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <h3 className="mb-2 text-sm font-semibold">
            Attendance {matrix.monthYear} (until {matrix.endDate})
          </h3>
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-zinc-300 px-1 py-0.5 text-left dark:border-zinc-600">Worker</th>
                {matrix.days.map((d) => (
                  <th key={d} className="border border-zinc-300 px-1 py-0.5 dark:border-zinc-600">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.workers.map((w) => (
                <tr key={w.workerId}>
                  <td className="border border-zinc-300 px-1 py-0.5 whitespace-nowrap dark:border-zinc-600">{w.workerName}</td>
                  {matrix.days.map((d) => (
                    <td key={d}
                      className={`border border-zinc-300 px-1 py-0.5 text-center ${w.cells[d] === "A" ? "text-red-500" : ""}`}>
                      {w.cells[d]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-zinc-500 print:text-black">F = 1 Full · 2F = 2 Fulls · H = Half · FH = 1 Full + 1 Half · A = Absent</p>
        </div>
      )}
    </section>
  );
}
