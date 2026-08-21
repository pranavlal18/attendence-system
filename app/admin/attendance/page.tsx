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
  // live preview for business logic (2 HALF = 1 FULL, max 4 HALF / 2 FULL / no mix)
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
        .select("duty_type, slot_number")
        .eq("worker_id", addWorkerId)
        .eq("date", addDate);
      if (exErr) throw new Error(exErr.message);
      const rows = (existing ?? []) as Array<{ duty_type: string; slot_number: number }>;
      const existingType = rows[0]?.duty_type as "FULL" | "HALF" | undefined;
      if (existingType && existingType !== addType) {
        throw new Error(`Cannot mix FULL and HALF on same date (already has ${existingType})`);
      }
      const count = rows.filter((r) => r.duty_type === addType).length;
      const max = addType === "FULL" ? 2 : 4;
      if (count >= max) throw new Error(`Maximum ${max} ${addType} duties already reached for ${addDate}`);
      const nextSlot = count + 1;
      if (addType === "FULL" && nextSlot > 2) throw new Error("FULL slot must be 1-2");
      if (addType === "HALF" && nextSlot > 4) throw new Error("HALF slot must be 1-4");

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

      // 2. Fetch existing records for audit oldValue
      const { data: existing } = await supabase
        .from("duty_records")
        .select("*")
        .eq("worker_id", addWorkerId)
        .eq("date", addDate);

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
      if (existing && existing.length > 0) {
        for (const row of existing) {
          await logAction({
            actorUserId: user?.id ?? null,
            action: "DELETE_DUTY_OVERRIDE",
            entityType: "duty_record",
            entityId: row.id,
            oldValue: JSON.stringify(row),
            newValue: null,
          });
        }
      }

      if (mode === "clear") {
        // Clear & insert 1 new addType duty at slot 1
        const rate_applied = addType === "FULL" ? fullRate : halfRate;
        const { data: inserted, error: insErr } = await supabase
          .from("duty_records")
          .insert({
            worker_id: addWorkerId,
            date: addDate,
            duty_type: addType,
            slot_number: 1,
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

        setAddMsg({ type: "success", text: `Cleared & replaced with 1 ${addType} duty for ${addDate}` });
      } else if (mode === "convert") {
        // Convert: e.g. if existing was FULL (1 or 2), convert to 2 HALF per FULL (max 4 HALF)
        // Or if existing was HALF, convert 2 HALF into 1 FULL
        const existingType = (existing?.[0] as any)?.duty_type;
        const existingCount = existing?.length ?? 0;

        if (existingType === "FULL") {
          // 1 FULL = 2 HALF. If 1 FULL existed, create 2 HALF. If 2 FULL existed, create 4 HALF.
          const targetHalfCount = Math.min(existingCount * 2, 4);
          for (let i = 1; i <= targetHalfCount; i++) {
            const { data: inserted, error: insErr } = await supabase
              .from("duty_records")
              .insert({
                worker_id: addWorkerId,
                date: addDate,
                duty_type: "HALF",
                slot_number: i,
                rate_applied: halfRate,
                created_by: user?.id ?? null,
              })
              .select()
              .single();
            if (!insErr && inserted) {
              await logAction({
                actorUserId: user?.id ?? null,
                action: "CREATE_DUTY_ADMIN",
                entityType: "duty_record",
                entityId: (inserted as any).id,
                oldValue: null,
                newValue: JSON.stringify(inserted),
              });
            }
          }
          setAddMsg({ type: "success", text: `Converted ${existingCount} FULL duty(ies) into ${targetHalfCount} HALF duties for ${addDate}` });
        } else if (existingType === "HALF") {
          // 2 HALF = 1 FULL. e.g. 4 HALF -> 2 FULL, or 2 HALF -> 1 FULL
          const targetFullCount = Math.min(Math.floor(existingCount / 2), 2) || 1;
          for (let i = 1; i <= targetFullCount; i++) {
            const { data: inserted, error: insErr } = await supabase
              .from("duty_records")
              .insert({
                worker_id: addWorkerId,
                date: addDate,
                duty_type: "FULL",
                slot_number: i,
                rate_applied: fullRate,
                created_by: user?.id ?? null,
              })
              .select()
              .single();
            if (!insErr && inserted) {
              await logAction({
                actorUserId: user?.id ?? null,
                action: "CREATE_DUTY_ADMIN",
                entityType: "duty_record",
                entityId: (inserted as any).id,
                oldValue: null,
                newValue: JSON.stringify(inserted),
              });
            }
          }
          setAddMsg({ type: "success", text: `Converted ${existingCount} HALF duties into ${targetFullCount} FULL duty(ies) for ${addDate}` });
        } else {
          // fallback
          const rate_applied = addType === "FULL" ? fullRate : halfRate;
          await supabase.from("duty_records").insert({
            worker_id: addWorkerId,
            date: addDate,
            duty_type: addType,
            slot_number: 1,
            rate_applied,
            created_by: user?.id ?? null,
          });
          setAddMsg({ type: "success", text: `Reset & added ${addType} for ${addDate}` });
        }
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
            Business rule: <b>2 HALF = 1 FULL</b> equivalent • Capacity per worker/day: <b>2 FULL</b> (slots 1-2) <b>or 4 HALF</b> (slots 1-4) • <b>No mixing</b> FULL + HALF same date. If worker already has FULL, HALF becomes unavailable and vice-versa.
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
                <option value="FULL">FULL (max 2/day)</option>
                <option value="HALF">HALF (max 4/day)</option>
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
                  No duties yet for this worker on <b>{addDate}</b> — can add <b>{addType}</b> (slot {addType === "FULL" ? "1/2" : "1/4"}). Equivalent: <span className="text-zinc-500">2 HALF = 1 FULL</span>
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
                      • Equivalent: {addExisting.filter((r) => r.duty_type === "FULL").length * 2 + addExisting.filter((r) => r.duty_type === "HALF").length} half-slots used /4
                    </span>
                  </p>
                  {(() => {
                    const existingType = addExisting[0]?.duty_type as "FULL" | "HALF" | undefined;
                    const isMix = existingType && existingType !== addType;
                    const fullCount = addExisting.filter((r) => r.duty_type === "FULL").length;
                    const halfCount = addExisting.filter((r) => r.duty_type === "HALF").length;
                    const fullReached = fullCount >= 2;
                    const halfReached = halfCount >= 4;
                    if (isMix) {
                      const opposite = existingType === "FULL" ? "HALF" : "FULL";
                      return (
                        <div className="space-y-2 mt-1">
                          <p className="text-xs text-red-600">
                            ⚠️ Already has {existingType} — cannot mix {existingType} and {addType} on the same date.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleAdminOverrideOrConvert("convert")}
                              disabled={addSaving}
                              className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              Convert existing {existingType}(s) to {opposite}(s)
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
                    if (addType === "FULL" && fullReached) return <p className="text-xs text-red-600">⚠️ 2 FULL already reached — capacity = 2 FULL or 4 HALF. Need to remove one first.</p>;
                    if (addType === "HALF" && halfReached) return <p className="text-xs text-red-600">⚠️ 4 HALF already reached — capacity full (2 HALF = 1 FULL).</p>;
                    const nextSlot = addType === "FULL" ? fullCount + 1 : halfCount + 1;
                    return <p className="text-xs text-green-700 dark:text-green-400">Will add {addType} slot {nextSlot}. {addType === "HALF" ? "Remember: 2 HALF = 1 FULL equivalent." : ""}</p>;
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
