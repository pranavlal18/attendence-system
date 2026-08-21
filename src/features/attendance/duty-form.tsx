"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { FULL_MAX, HALF_MAX } from "../../constants/duty-types";
import { format } from "date-fns";
import { logAction } from "@/lib/audit-logger";

interface DutyRecord {
  id: string;
  worker_id: string;
  date: string;
  duty_type: string;
  slot_number: number;
  rate_applied: number;
}

interface DutyFormProps {
  workerId: string;
  selectedDate: string; // YYYY-MM-DD
  onSuccess?: () => void;
}

export function DutyForm({ workerId, selectedDate, onSuccess }: DutyFormProps) {
  const [duties, setDuties] = useState<DutyRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<"FULL" | "HALF" | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDuties = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase
        .from("duty_records")
        .select("*")
        .eq("worker_id", workerId)
        .eq("date", selectedDate)
        .order("slot_number", { ascending: true });

      if (error) {
        setMessage({ type: "error", text: error.message });
        setDuties([]);
      } else {
        setDuties((data ?? []) as DutyRecord[]);
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load duties",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!workerId || !selectedDate) return;
    fetchDuties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId, selectedDate]);

  const existingType = duties[0]?.duty_type as "FULL" | "HALF" | undefined;
  const fullCount = duties.filter((d) => d.duty_type === "FULL").length;
  const halfCount = duties.filter((d) => d.duty_type === "HALF").length;
  const isFullDisabled = existingType === "HALF" || fullCount >= FULL_MAX;
  const isHalfDisabled = existingType === "FULL" || halfCount >= HALF_MAX;

  const handleAddDuty = async (dutyType: "FULL" | "HALF") => {
    setMessage(null);

    // inline canRecord logic before insert
    if (dutyType === "FULL" && isFullDisabled) {
      if (existingType === "HALF") {
        setMessage({ type: "error", text: "Cannot mix FULL and HALF on same date" });
      } else if (fullCount >= FULL_MAX) {
        setMessage({ type: "error", text: "Maximum 2 Full Duties reached" });
      }
      return;
    }
    if (dutyType === "HALF" && isHalfDisabled) {
      if (existingType === "FULL") {
        setMessage({ type: "error", text: "Cannot mix FULL and HALF on same date" });
      } else if (halfCount >= HALF_MAX) {
        setMessage({ type: "error", text: "Maximum 4 Half Duties reached" });
      }
      return;
    }

    setActionLoading(dutyType);
    try {
      const { data: worker, error: workerError } = await supabase
        .from("workers")
        .select("full_duty_rate, half_duty_rate")
        .eq("id", workerId)
        .single();

      if (workerError || !worker) {
        setMessage({
          type: "error",
          text: workerError?.message ?? "Worker not found",
        });
        return;
      }

      const rate_applied =
        dutyType === "FULL"
          ? (worker as { full_duty_rate: number }).full_duty_rate
          : (worker as { half_duty_rate: number }).half_duty_rate;

      const nextSlot = dutyType === "FULL" ? fullCount + 1 : halfCount + 1;

      // extra guard: ensure nextSlot within max
      if (dutyType === "FULL" && nextSlot > FULL_MAX) {
        setMessage({ type: "error", text: "Maximum 2 Full Duties reached" });
        return;
      }
      if (dutyType === "HALF" && nextSlot > HALF_MAX) {
        setMessage({ type: "error", text: "Maximum 4 Half Duties reached" });
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: inserted, error: insertError } = await supabase
        .from("duty_records")
        .insert({
          worker_id: workerId,
          date: selectedDate,
          duty_type: dutyType,
          slot_number: nextSlot,
          rate_applied,
          created_by: user?.id ?? null,
        })
        .select()
        .single();

      if (insertError) {
        if (
          insertError.message.includes("duplicate") ||
          insertError.message.includes("idx_duty_slots") ||
          insertError.code === "23505"
        ) {
          setMessage({ type: "error", text: "Slot already taken for this worker/date" });
        } else {
          setMessage({ type: "error", text: insertError.message });
        }
        return;
      }

      // Audit worker record
      try {
        await logAction({
          actorUserId: user?.id ?? null,
          action: "RECORD_DUTY",
          entityType: "duty_record",
          entityId: (inserted as any)?.id ?? `${workerId}-${selectedDate}-${nextSlot}`,
          oldValue: null,
          newValue: JSON.stringify(inserted ?? { worker_id: workerId, date: selectedDate, duty_type: dutyType, slot_number: nextSlot, rate_applied }),
        });
      } catch (_) {}

      setMessage({ type: "success", text: `${dutyType} duty added (slot ${nextSlot})` });
      await fetchDuties();
      onSuccess?.();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (dutyId: string, dutyLabel: string) => {
    if (!confirm(`Remove ${dutyLabel}? This will undo the duty for ${selectedDate}.`)) return;
    setRemovingId(dutyId);
    setMessage(null);
    try {
      const target = duties.find((d) => d.id === dutyId);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("duty_records").delete().eq("id", dutyId).eq("worker_id", workerId);
      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }
      try {
        await logAction({
          actorUserId: user?.id ?? null,
          action: "DELETE_DUTY",
          entityType: "duty_record",
          entityId: dutyId,
          oldValue: target ? JSON.stringify(target) : null,
          newValue: null,
        });
      } catch (_) {}
      setMessage({ type: "success", text: `${dutyLabel} removed` });
      await fetchDuties();
      onSuccess?.();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to remove" });
    } finally {
      setRemovingId(null);
    }
  };

  let formattedDate = selectedDate;
  try {
    formattedDate = format(new Date(selectedDate + "T00:00:00"), "PPP");
  } catch {
    formattedDate = selectedDate;
  }

  const fullProgress = (fullCount / FULL_MAX) * 100;
  const halfProgress = (halfCount / HALF_MAX) * 100;

  return (
    <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Selected Date</h3>
        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{formattedDate}</p>
        <p className="text-xs text-zinc-500">{selectedDate}</p>
      </div>

      {/* Progress Bars */}
      <div className="mb-4 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">Full Duty</span>
            <span className="text-zinc-500">
              {fullCount}/{FULL_MAX} • {FULL_MAX - fullCount} remaining
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${fullProgress}%` }}
              role="progressbar"
              aria-valuenow={fullCount}
              aria-valuemin={0}
              aria-valuemax={FULL_MAX}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">Half Duty</span>
            <span className="text-zinc-500">
              {halfCount}/{HALF_MAX} • {HALF_MAX - halfCount} remaining
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
            <div
              className="h-full bg-yellow-500 transition-all"
              style={{ width: `${halfProgress}%` }}
              role="progressbar"
              aria-valuenow={halfCount}
              aria-valuemin={0}
              aria-valuemax={HALF_MAX}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-zinc-500">Loading duties...</div>
      ) : (
        <>
          {/* Full Duty Section */}
          <div className="mb-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-medium text-zinc-900 dark:text-zinc-100">Full Duty</h4>
              <span className="text-xs text-zinc-500">{FULL_MAX - fullCount} remaining</span>
            </div>

            {fullCount > 0 ? (
              <ul className="mb-3 space-y-1">
                {duties
                  .filter((d) => d.duty_type === "FULL")
                  .map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between rounded bg-green-50 px-2 py-1 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    >
                      <span className="flex items-center gap-2"><span aria-hidden>✓</span> Slot {d.slot_number}</span>
                      <button
                        type="button"
                        onClick={() => handleRemove(d.id, `Full Duty Slot ${d.slot_number}`)}
                        disabled={removingId === d.id}
                        className="ml-2 rounded bg-white px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:bg-zinc-800 dark:text-red-400"
                      >
                        {removingId === d.id ? "Removing…" : "Undo"}
                      </button>
                    </li>
                  ))}
                {/* placeholder slots not yet filled */}
                {Array.from({ length: FULL_MAX - fullCount }).map((_, i) => (
                  <li
                    key={`full-empty-${i}`}
                    className="rounded border border-dashed px-2 py-1 text-sm text-zinc-400"
                  >
                    Empty slot {fullCount + i + 1}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm text-zinc-500">No full duties recorded yet.</p>
            )}

            <button
              type="button"
              onClick={() => handleAddDuty("FULL")}
              disabled={isFullDisabled || actionLoading !== null}
              className="min-h-[44px] w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === "FULL" ? "Adding..." : "Add Full Duty"}
            </button>
            {isFullDisabled && (
              <p className="mt-2 text-xs text-zinc-500">
                {existingType === "HALF"
                  ? "Disabled: HALF duties already recorded"
                  : "Maximum 2 Full Duties reached"}
              </p>
            )}
          </div>

          {/* Half Duty Section */}
          <div className="mb-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-medium text-zinc-900 dark:text-zinc-100">Half Duty</h4>
              <span className="text-xs text-zinc-500">{HALF_MAX - halfCount} remaining</span>
            </div>

            {halfCount > 0 ? (
              <ul className="mb-3 space-y-1">
                {duties
                  .filter((d) => d.duty_type === "HALF")
                  .map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between rounded bg-yellow-50 px-2 py-1 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                    >
                      <span className="flex items-center gap-2"><span aria-hidden>✓</span> Slot {d.slot_number}</span>
                      <button
                        type="button"
                        onClick={() => handleRemove(d.id, `Half Duty Slot ${d.slot_number}`)}
                        disabled={removingId === d.id}
                        className="ml-2 rounded bg-white px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:bg-zinc-800 dark:text-red-400"
                      >
                        {removingId === d.id ? "Removing…" : "Undo"}
                      </button>
                    </li>
                  ))}
                {Array.from({ length: HALF_MAX - halfCount }).map((_, i) => (
                  <li
                    key={`half-empty-${i}`}
                    className="rounded border border-dashed px-2 py-1 text-sm text-zinc-400"
                  >
                    Empty slot {halfCount + i + 1}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm text-zinc-500">No half duties recorded yet.</p>
            )}

            <button
              type="button"
              onClick={() => handleAddDuty("HALF")}
              disabled={isHalfDisabled || actionLoading !== null}
              className="min-h-[44px] w-full rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === "HALF" ? "Adding..." : "Add Half Duty"}
            </button>
            {isHalfDisabled && (
              <p className="mt-2 text-xs text-zinc-500">
                {existingType === "FULL"
                  ? "Disabled: FULL duties already recorded"
                  : "Maximum 4 Half Duties reached"}
              </p>
            )}
          </div>
        </>
      )}

      {message && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
          }`}
          role="alert"
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

export default DutyForm;
