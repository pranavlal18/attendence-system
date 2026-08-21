"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { DatePicker } from "@/components/calendar/date-picker";
import { DutyForm } from "@/features/attendance/duty-form";

export default function WorkerDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("userRole");
    window.location.href = "/login";
  };

  useEffect(() => {
    const resolveWorker = async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          setError("Not authenticated. Please log in.");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (profileError || !profile) {
          setError("No worker profile linked. Contact admin.");
          return;
        }

        const { data: worker, error: workerError } = await supabase
          .from("workers")
          .select("id")
          .eq("profile_id", (profile as { id: string }).id)
          .eq("is_active", true)
          .maybeSingle();

        if (workerError) {
          setError(workerError.message);
          return;
        }

        if (!worker) {
          setError("No worker profile linked. Contact admin.");
          return;
        }

        setWorkerId((worker as { id: string }).id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load worker profile");
      } finally {
        setLoading(false);
      }
    };

    resolveWorker();
  }, []);

  let formattedDate = selectedDate;
  try {
    formattedDate = format(new Date(selectedDate + "T00:00:00"), "PPP");
  } catch {
    formattedDate = selectedDate;
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 p-4 sm:p-6">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
              My Dashboard
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Select Date → Record Duty</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">{formattedDate}</p>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 min-h-[44px]"
          >
            Log out
          </button>
        </header>

        {loading ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading worker profile...</p>
          </div>
        ) : error ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300"
            role="alert"
          >
            {error}
          </div>
        ) : workerId ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Select Date
              </label>
              <DatePicker value={selectedDate} onChange={setSelectedDate} />
            </div>

            <DutyForm workerId={workerId} selectedDate={selectedDate} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
