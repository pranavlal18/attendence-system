"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchAttendance, type AttendanceRecord } from "@/services/attendance-service";
import { AdminNav } from "@/components/admin-nav";
import Link from "next/link";

type DashboardFilters = { date?: string; month?: string };

export default function AdminDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const [filters, setFilters] = useState<DashboardFilters>({ month: thisMonth });
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [totals, setTotals] = useState({ fullCount: 0, halfCount: 0, totalCount: 0, totalEarnings: 0 });
  const [activeWorkers, setActiveWorkers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workerBreakdown, setWorkerBreakdown] = useState<
    Array<{ worker_id: string; name: string; email: string; full: number; half: number; total: number; earnings: number }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [att, workersRes] = await Promise.all([
        fetchAttendance({ date: filters.date, month: filters.month, dutyType: "ALL" }),
        supabase.from("workers").select("id").eq("is_active", true),
      ]);
      if (cancelled) return;
      setRecords(att.records);
      setTotals(att.totals);
      setActiveWorkers((workersRes.data?.length ?? 0) as number);

      // worker-wise grouping
      const map = new Map<string, { name: string; email: string; full: number; half: number; earnings: number }>();
      for (const r of att.records) {
        const cur = map.get(r.worker_id) ?? { name: r.worker_name, email: r.worker_email, full: 0, half: 0, earnings: 0 };
        if (r.duty_type === "FULL") cur.full += 1;
        else cur.half += 1;
        cur.earnings += r.rate_applied;
        map.set(r.worker_id, cur);
      }
      setWorkerBreakdown(
        [...map.entries()].map(([worker_id, v]) => ({
          worker_id,
          name: v.name,
          email: v.email,
          full: v.full,
          half: v.half,
          total: v.full + v.half,
          earnings: v.earnings,
        }))
      );
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filters.date, filters.month]);

  const periodLabel = filters.date ? filters.date : filters.month ? `${filters.month}` : "All time";

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <AdminNav />

        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">Admin Dashboard</h1>
            <p className="text-sm text-zinc-500">{periodLabel} • overview</p>
          </div>
        </header>

        <div className="rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800 flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            <span className="block text-xs text-zinc-500 mb-1">Date</span>
            <input
              type="date"
              value={filters.date ?? ""}
              onChange={(e) => setFilters({ date: e.target.value || undefined, month: undefined })}
              className="rounded border px-2 py-2 text-sm min-h-[44px]"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-zinc-500 mb-1">Month</span>
            <input
              type="month"
              value={filters.month ?? ""}
              onChange={(e) => setFilters({ month: e.target.value || undefined, date: undefined })}
              className="rounded border px-2 py-2 text-sm min-h-[44px]"
            />
          </label>
          <button
            onClick={() => setFilters({ month: thisMonth })}
            className="rounded-md border px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-700 min-h-[44px]"
          >
            Reset to this month
          </button>
        </div>

        {loading ? (
          <div className="rounded-lg border bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">Loading…</div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Active Workers" value={String(activeWorkers)} />
              <Stat label="Full Duties" value={String(totals.fullCount)} />
              <Stat label="Half Duties" value={String(totals.halfCount)} />
              <Stat label="Total Records" value={String(totals.totalCount)} />
              <Stat label="Total Earnings" value={`₹${totals.totalEarnings.toLocaleString()}`} highlight />
            </div>

            <div className="rounded-lg border bg-white dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
              <div className="p-4 border-b dark:border-zinc-700 flex justify-between">
                <h2 className="font-medium">Worker-wise totals • {periodLabel}</h2>
                <span className="text-xs text-zinc-500">{workerBreakdown.length} workers</span>
              </div>
              {workerBreakdown.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">No duties for this period.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-700/50 text-left">
                      <tr>
                        <th className="px-4 py-2">Worker</th>
                        <th className="px-4 py-2">Full</th>
                        <th className="px-4 py-2">Half</th>
                        <th className="px-4 py-2">Total</th>
                        <th className="px-4 py-2">Earnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workerBreakdown.map((w) => (
                        <tr key={w.worker_id} className="border-t dark:border-zinc-700">
                          <td className="px-4 py-2">
                            <div className="font-medium">{w.name}</div>
                            <div className="text-xs text-zinc-500">{w.email}</div>
                          </td>
                          <td className="px-4 py-2">{w.full}</td>
                          <td className="px-4 py-2">{w.half}</td>
                          <td className="px-4 py-2">{w.total}</td>
                          <td className="px-4 py-2 font-medium">₹{w.earnings.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="text-xs text-zinc-500">
              Tip: Go to <Link href="/admin/attendance" className="underline">Attendance</Link> for date/worker/type filters and corrections (Remove/Correct with audit log).
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-white dark:bg-zinc-800 dark:border-zinc-700"}`}>
      <div className={`text-xs ${highlight ? "opacity-80" : "text-zinc-500"}`}>{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
