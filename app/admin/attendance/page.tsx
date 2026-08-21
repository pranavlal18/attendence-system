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

  return (
    <div className="min-h-screen bg-zinc-100 p-6 dark:bg-zinc-900">
      <div className="mx-auto max-w-6xl space-y-6">
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

        <AttendanceTable records={records} totals={totals} onRemove={handleRemove} loading={loading} />
      </div>
    </div>
  );
}
