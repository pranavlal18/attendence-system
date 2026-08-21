"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  fetchWorkerMonthlyDetail,
  type WorkerMonthDetail,
} from "@/services/report-service";
import { WorkerNav } from "@/components/worker-nav";

export default function WorkerMonthlyReportPage() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [monthYear, setMonthYear] = useState<string>(thisMonth);
  const [detail, setDetail] = useState<WorkerMonthDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("userRole");
    window.location.href = "/login";
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Not authenticated. Please log in.");
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (profileError || !profile) {
          throw new Error("No worker profile linked. Contact admin.");
        }

        const { data: worker, error: workerError } = await supabase
          .from("workers")
          .select("id")
          .eq("profile_id", (profile as { id: string }).id)
          .eq("is_active", true)
          .maybeSingle();

        if (workerError) {
          throw new Error(workerError.message);
        }

        if (!worker) {
          throw new Error("No worker profile linked. Contact admin.");
        }

        const d = await fetchWorkerMonthlyDetail(
          (worker as { id: string }).id,
          monthYear
        );
        if (!cancelled) setDetail(d);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load monthly report"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [monthYear]);

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 p-4 sm:p-6">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
              My Monthly Work
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Shifts and earnings by day
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 min-h-[44px]"
          >
            Log out
          </button>
        </header>

        <WorkerNav />

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <label
            htmlFor="month"
            className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Select Month
          </label>
          <input
            id="month"
            type="month"
            value={monthYear}
            onChange={(e) => setMonthYear(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {loading ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
          </div>
        ) : error ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300"
            role="alert"
          >
            {error}
          </div>
        ) : detail ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Shifts</th>
                    <th className="py-2 text-right">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.days.map((d) => (
                    <tr
                      key={d.date}
                      className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                    >
                      <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">
                        {d.date}
                      </td>
                      <td
                        className={`py-2 pr-4 ${
                          d.present
                            ? "text-zinc-700 dark:text-zinc-300"
                            : "text-red-500 dark:text-red-400"
                        }`}
                      >
                        {d.label}
                      </td>
                      <td className="py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">
                        {d.present ? `₹${d.earning}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Total shifts: {detail.totalShifts}
              </span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Total earned: ₹{detail.totalEarnings}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
