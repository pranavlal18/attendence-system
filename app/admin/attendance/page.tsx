"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  fetchAttendance,
  fetchWorkersForFilter,
  type AttendanceFilters,
  type AttendanceRecord,
  type AttendanceTotals,
} from "@/services/attendance-service";
import { logAction } from "@/lib/audit-logger";
import {
  FULL_UNITS,
  HALF_UNITS,
  DAILY_TEAM_BUDGET,
  WORKER_MAX_FULL,
  WORKER_MAX_HALF,
} from "../../../constants/duty-types";
import { AdminNav } from "@/components/admin-nav";
import { AttendanceFilters as AttendanceFiltersUI } from "@/components/admin/filters/attendance-filters";
import { AttendanceTable } from "@/components/admin/records/attendance-table";

const EMPTY_TOTALS: AttendanceTotals = {
  fullCount: 0,
  halfCount: 0,
  totalCount: 0,
  totalEarnings: 0,
};

export default function AdminAttendancePage() {
  const [filters, setFilters] = useState<AttendanceFilters>({});
  const [workers, setWorkers] = useState<Array<{ id: string; name: string }>>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [totals, setTotals] = useState<AttendanceTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async (f: AttendanceFilters) => {
    setLoading(true);
    try {
      const result = await fetchAttendance(f);
      setRecords(result.records);
      setTotals(result.totals);
    } catch (err) {
      console.error("Failed to fetch attendance:", err);
      setRecords([]);
      setTotals(EMPTY_TOTALS);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch workers on mount
  useEffect(() => {
    let cancelled = false;
    async function loadWorkers() {
      try {
        const w = await fetchWorkersForFilter();
        if (!cancelled) setWorkers(w);
      } catch (err) {
        console.error("Failed to fetch workers for filter:", err);
      }
    }
    loadWorkers();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch attendance when filters change, with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void refetch(filters);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, refetch]);

  const handleClear = useCallback(() => {
    setFilters({});
  }, []);

  const handleRemove = useCallback(
    async (id: string) => {
      if (!confirm("Are you sure you want to remove this record?")) return;

      // Find record before deletion for audit log
      const target = records.find((r) => r.id === id);

      const { error } = await supabase.from("duty_records").delete().eq("id", id);

      if (error) {
        console.error("Failed to delete duty record:", error);
        alert(`Failed to remove record: ${error.message}`);
        return;
      }

      // Audit log - get current user id
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await logAction({
          actorUserId: user?.id ?? null,
          action: "DELETE",
          entityType: "duty_records",
          entityId: id,
          oldValue: target ? JSON.stringify(target) : null,
          newValue: null,
        });
      } catch (e) {
        console.warn("Audit log failed:", e);
      }

      await refetch(filters);
    },
    [records, filters, refetch]
  );

  // --- Admin add duty for worker (if employee missed, admin adds on their behalf) ---
  const [addWorkerId, setAddWorkerId] = useState("");
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addType, setAddType] = useState<"FULL" | "HALF">("FULL");
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // live preview for business logic (FULL=2 units, HALF=1 unit, team budget 4 units/day, worker caps 2 FULL + 1 HALF, mixing allowed)
  const [addExisting, setAddExisting] = useState<Array<{ duty_type: string; slot_number: number }>>([]);
  const [addPreviewLoading, setAddPreviewLoading] = useState(false);

  useEffect(() => {
    if (!addWorkerId || !addDate) {
      setAddExisting([]);
      return;
    }
    let cancelled = false;
    setAddPreviewLoading(true);
    supabase
      .from("duty_records")
      .select("duty_type, slot_number")
      .eq("worker_id", addWorkerId)
      .eq("date", addDate)
      .order("slot_number")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error) setAddExisting((data ?? []) as any);
        else setAddExisting([]);
        setAddPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addWorkerId, addDate]);

  const handleAdminAdd = async () => {
    setAddMsg(null);
    if (!addWorkerId) return setAddMsg({ type: "error", text: "Select a worker" });
    if (!addDate) return setAddMsg({ type: "error", text: "Select a date" });
    setAddSaving(true);
    try {
      const { data: worker, error: wErr } = await supabase
        .from("workers")
        .select("full_duty_rate, half_duty_rate")
        .eq("id", addWorkerId)
        .single();
      if (wErr || !worker) throw new Error(wErr?.message ?? "Worker not found");
      const rate_applied = addType === "FULL" ? (worker as any).full_duty_rate : (worker as any).half_duty_rate;

      const { data: existing, error: exErr } = await supabase
        .from("duty_records")
        .select("worker_id, duty_type, slot_number")
        .eq("date", addDate);
      if (exErr) throw new Error(exErr.message);
      const rows = (existing ?? []) as Array<{ worker_id: string; duty_type: string; slot_number: number }>;
      const workerRows = rows.filter((r) => r.worker_id === addWorkerId);
      const fullCount = workerRows.filter((r) => r.duty_type === "FULL").length;
      const halfCount = workerRows.filter((r) => r.duty_type === "HALF").length;
      if (addType === "FULL" && fullCount >= WORKER_MAX_FULL) {
        throw new Error(`Maximum ${WORKER_MAX_FULL} Full Duties per person`);
      }
      if (addType === "HALF" && halfCount >= WORKER_MAX_HALF) {
        throw new Error(`Maximum ${WORKER_MAX_HALF} Half Duty per person`);
      }
      const teamUsedUnits = rows.reduce(
        (acc, r) => acc + (r.duty_type === "FULL" ? FULL_UNITS : HALF_UNITS),
        0
      );
      const needed = addType === "FULL" ? FULL_UNITS : HALF_UNITS;
      if (teamUsedUnits + needed > DAILY_TEAM_BUDGET) {
        throw new Error(`Daily limit reached (${teamUsedUnits}/${DAILY_TEAM_BUDGET} units used)`);
      }
      // Global slot: max across ALL this worker's records for the date (mixing allowed)
      const nextSlot = workerRows.reduce((m, r) => Math.max(m, r.slot_number), 0) + 1;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: inserted, error: insErr } = await supabase
        .from("duty_records")
        .insert({
          worker_id: addWorkerId,
          date: addDate,
          duty_type: addType,
          slot_number: nextSlot,
          rate_applied,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (insErr) throw new Error(insErr.message);
      await logAction({
        actorUserId: user?.id ?? null,
        action: "CREATE_DUTY_ADMIN",
        entityType: "duty_record",
        entityId: (inserted as any).id,
        oldValue: null,
        newValue: JSON.stringify(inserted),
      });
      setAddMsg({ type: "success", text: `${addType} duty added for ${addDate} (slot ${nextSlot})` });
      await refetch(filters);
      // refresh preview list
      const { data: refreshed } = await supabase
        .from("duty_records")
        .select("duty_type, slot_number")
        .eq("worker_id", addWorkerId)
        .eq("date", addDate)
        .order("slot_number");
      setAddExisting((refreshed ?? []) as any);
    } catch (e) {
      setAddMsg({ type: "error", text: e instanceof Error ? e.message : "Failed to add duty" });
    } finally {
      setAddSaving(false);
    }
  };

  const handleAdminOverrideOrConvert = async (mode: "clear" | "convert") => {
    setAddMsg(null);
    if (!addWorkerId || !addDate) return;
    setAddSaving(true);
    try {
      // 1. Fetch worker rates
      const { data: worker, error: wErr } = await supabase
        .from("workers")
        .select("full_duty_rate, half_duty_rate")
        .eq("id", addWorkerId)
        .single();
      if (wErr || !worker) throw new Error(wErr?.message ?? "Worker not found");

      const fullRate = (worker as any).full_duty_rate;
      const halfRate = (worker as any).half_duty_rate;

      // 2. Fetch existing records for this worker/date (audit oldValue + validation input)
      const { data: existing, error: exErr } = await supabase
        .from("duty_records")
        .select("*")
        .eq("worker_id", addWorkerId)
        .eq("date", addDate);
      if (exErr) throw new Error(exErr.message);
      const existingRows = (existing ?? []) as Array<{ id: string; duty_type: string }>;

      // 3. Fetch ALL workers' rows for the date (team budget spans everyone)
      const { data: teamRowsData, error: teamErr } = await supabase
        .from("duty_records")
        .select("worker_id, duty_type")
        .eq("date", addDate);
      if (teamErr) throw new Error(teamErr.message);
      const teamRows = (teamRowsData ?? []) as Array<{ duty_type: string }>;

      const unitsOf = (t: string) => (t === "FULL" ? FULL_UNITS : HALF_UNITS);
      const deletedUnits = existingRows.reduce((acc, r) => acc + unitsOf(r.duty_type), 0);
      const teamUnitsAfterDelete =
        teamRows.reduce((acc, r) => acc + unitsOf(r.duty_type), 0) - deletedUnits;

      // 4. Compute the exact target rows BEFORE deleting anything
      let target: Array<{ duty_type: "FULL" | "HALF"; rate_applied: number }>;
      if (mode === "clear") {
        target = [{ duty_type: addType, rate_applied: addType === "FULL" ? fullRate : halfRate }];
      } else {
        // Convert preserves total units: FULL-containing days become all HALF,
        // HALF-only days pair up into FULL (2 HALF = 1 FULL).
        const hasFull = existingRows.some((r) => r.duty_type === "FULL");
        if (hasFull) {
          target = Array.from({ length: deletedUnits }, () => ({
            duty_type: "HALF" as const,
            rate_applied: halfRate,
          }));
        } else {
          if (deletedUnits < FULL_UNITS) {
            throw new Error(
              `Cannot convert: need at least ${FULL_UNITS} units (${FULL_UNITS / HALF_UNITS} HALF duties) to make one FULL`
            );
          }
          target = Array.from({ length: deletedUnits / FULL_UNITS }, () => ({
            duty_type: "FULL" as const,
            rate_applied: fullRate,
          }));
        }
      }

      // 5. Validate target rows against the POST-deletion state; abort before touching data
      const targetFulls = target.filter((t) => t.duty_type === "FULL").length;
      const targetHalves = target.filter((t) => t.duty_type === "HALF").length;
      if (targetFulls > WORKER_MAX_FULL) {
        throw new Error(
          `Conversion rejected: ${targetFulls} FULL exceeds max ${WORKER_MAX_FULL} per worker/day`
        );
      }
      if (targetHalves > WORKER_MAX_HALF) {
        throw new Error(
          `Conversion rejected: ${targetHalves} HALF exceeds max ${WORKER_MAX_HALF} per worker/day`
        );
      }
      const targetUnits = targetFulls * FULL_UNITS + targetHalves * HALF_UNITS;
      if (teamUnitsAfterDelete + targetUnits > DAILY_TEAM_BUDGET) {
        throw new Error(
          `Rejected: daily team limit would be exceeded (${teamUnitsAfterDelete + targetUnits}/${DAILY_TEAM_BUDGET} units)`
        );
      }

      // 6. Validation passed — safe to mutate
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Delete existing records for worker/date
      const { error: delErr } = await supabase
        .from("duty_records")
        .delete()
        .eq("worker_id", addWorkerId)
        .eq("date", addDate);

      if (delErr) throw new Error(delErr.message);

      // Audit delete
      for (const row of existingRows) {
        await logAction({
          actorUserId: user?.id ?? null,
          action: "DELETE_DUTY_OVERRIDE",
          entityType: "duty_record",
          entityId: row.id,
          oldValue: JSON.stringify(row),
          newValue: null,
        });
      }

      for (let i = 0; i < target.length; i++) {
        const t = target[i];
        const { data: inserted, error: insErr } = await supabase
          .from("duty_records")
          .insert({
            worker_id: addWorkerId,
            date: addDate,
            duty_type: t.duty_type,
            slot_number: i + 1,
            rate_applied: t.rate_applied,
            created_by: user?.id ?? null,
          })
          .select()
          .single();
        if (insErr) throw new Error(insErr.message);

        await logAction({
          actorUserId: user?.id ?? null,
          action: "CREATE_DUTY_ADMIN",
          entityType: "duty_record",
          entityId: (inserted as any).id,
          oldValue: null,
          newValue: JSON.stringify(inserted),
        });
      }

      if (mode === "clear") {
        setAddMsg({ type: "success", text: `Cleared & replaced with 1 ${addType} duty for ${addDate}` });
      } else {
        const existingFulls = existingRows.filter((r) => r.duty_type === "FULL").length;
        const existingHalves = existingRows.filter((r) => r.duty_type === "HALF").length;
        setAddMsg({
          type: "success",
          text: `Converted ${existingFulls} FULL / ${existingHalves} HALF into ${targetFulls} FULL / ${targetHalves} HALF for ${addDate}`,
        });
      }

      await refetch(filters);
      // refresh preview list
      const { data: refreshed } = await supabase
        .from("duty_records")
        .select("duty_type, slot_number")
        .eq("worker_id", addWorkerId)
        .eq("date", addDate)
        .order("slot_number");
      setAddExisting((refreshed ?? []) as any);
    } catch (e) {
      setAddMsg({ type: "error", text: e instanceof Error ? e.message : "Override failed" });
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 p-4 sm:p-6 dark:bg-zinc-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <AdminNav />
        <header>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Attendance</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Filter and review duty records by date, month, worker and duty type.
          </p>
        </header>

        <AttendanceFiltersUI
          filters={filters}
          onChange={setFilters}
          workers={workers}
          onClear={handleClear}
        />

        {/* Admin add duty on behalf of worker */}
        <div className="rounded-lg border bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Add Duty for Worker (admin)</h3>
          <p className="text-xs text-zinc-500 mb-2">If an employee missed marking that day and asks admin to add, admin can add FULL/HALF here.</p>
          <p className="text-[11px] text-zinc-400 mb-3 px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800 border dark:border-zinc-700">
            Business rule: <b>FULL = 2 units</b> • <b>HALF = 1 unit</b> • Team budget: <b>{DAILY_TEAM_BUDGET} units/day across ALL workers</b> • Per worker/day: max <b>{WORKER_MAX_FULL} FULL</b> + max <b>{WORKER_MAX_HALF} HALF</b> (mixing allowed).
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm">
              <span className="block text-xs text-zinc-500 mb-1">Worker</span>
              <select value={addWorkerId} onChange={(e) => setAddWorkerId(e.target.value)} className="w-full rounded border px-2 py-2 text-sm min-h-[44px] bg-white dark:bg-zinc-900">
                <option value="">Select worker</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-xs text-zinc-500 mb-1">Date</span>
              <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="w-full rounded border px-2 py-2 text-sm min-h-[44px]" />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-zinc-500 mb-1">Type</span>
              <select
                value={addType}
                onChange={(e) => setAddType(e.target.value as any)}
                className="w-full rounded border px-2 py-2 text-sm min-h-[44px] bg-white dark:bg-zinc-900"
              >
                <option value="FULL">FULL (max {WORKER_MAX_FULL}/day)</option>
                <option value="HALF">HALF (max {WORKER_MAX_HALF}/day)</option>
              </select>
            </label>
            <div className="flex items-end">
              <button onClick={handleAdminAdd} disabled={addSaving || !addWorkerId} className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 min-h-[44px]">
                {addSaving ? "Adding…" : "Add Duty"}
              </button>
            </div>
          </div>
          {/* live preview of existing duties for selected worker/date */}
          {addWorkerId && addDate && (
            <div className="mt-3 rounded-md border bg-zinc-50 dark:bg-zinc-900/50 dark:border-zinc-700 px-3 py-2">
              {addPreviewLoading ? (
                <p className="text-xs text-zinc-500">Loading existing duties…</p>
              ) : addExisting.length === 0 ? (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  No duties yet for this worker on <b>{addDate}</b> — can add <b>{addType}</b> (slot {addType === "FULL" ? `1/${WORKER_MAX_FULL}` : `1/${WORKER_MAX_HALF}`}). Units: <span className="text-zinc-500">FULL = {FULL_UNITS}, HALF = {HALF_UNITS}</span>
                </p>
              ) : (
                <>
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Existing on {addDate}:{" "}
                    {addExisting.map((r) => `${r.duty_type} #${r.slot_number}`).join(", ")}
                    <span className="font-normal text-zinc-500">
                      {" "}
                      • {addExisting.filter((r) => r.duty_type === "FULL").length} FULL,{" "}
                      {addExisting.filter((r) => r.duty_type === "HALF").length} HALF
                    </span>
                    <span className="font-normal text-zinc-500">
                      {" "}
                      • Units used: {addExisting.filter((r) => r.duty_type === "FULL").length * FULL_UNITS + addExisting.filter((r) => r.duty_type === "HALF").length * HALF_UNITS}/{DAILY_TEAM_BUDGET} (team budget)
                    </span>
                  </p>
                  {(() => {
                    const fullCount = addExisting.filter((r) => r.duty_type === "FULL").length;
                    const halfCount = addExisting.filter((r) => r.duty_type === "HALF").length;
                    const fullReached = fullCount >= WORKER_MAX_FULL;
                    const halfReached = halfCount >= WORKER_MAX_HALF;
                    const capReached = addType === "FULL" ? fullReached : halfReached;
                    if (capReached) {
                      const opposite = addType === "FULL" ? "HALF" : "FULL";
                      return (
                        <div className="space-y-2 mt-1">
                          <p className="text-xs text-red-600">
                            ⚠️ Maximum {addType === "FULL" ? WORKER_MAX_FULL : WORKER_MAX_HALF} {addType} already reached for this worker on {addDate}.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleAdminOverrideOrConvert("convert")}
                              disabled={addSaving}
                              className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              Convert existing duties to {opposite}(s)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdminOverrideOrConvert("clear")}
                              disabled={addSaving}
                              className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Clear & Replace with {addType}
                            </button>
                          </div>
                        </div>
                      );
                    }
                    const nextSlot = addExisting.reduce((m, r) => Math.max(m, r.slot_number), 0) + 1;
                    return <p className="text-xs text-green-700 dark:text-green-400">Will add {addType} slot {nextSlot}. {addType === "HALF" ? `Units: HALF = ${HALF_UNITS}, FULL = ${FULL_UNITS}.` : ""}</p>;
                  })()}
                </>
              )}
            </div>
          )}
          {addMsg && (
            <div className={`mt-3 rounded-md px-3 py-2 text-sm ${addMsg.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/20" : "bg-red-50 text-red-700 dark:bg-red-900/20"}`}>{addMsg.text}</div>
          )}
        </div>

        <AttendanceTable records={records} totals={totals} onRemove={handleRemove} loading={loading} />
      </div>
    </div>
  );
}
