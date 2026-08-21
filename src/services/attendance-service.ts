import { supabase } from "@/lib/supabase/client";
import { logAction } from "@/lib/audit-logger";

export interface AttendanceFilters {
  date?: string; // YYYY-MM-DD
  month?: string; // YYYY-MM e.g., 2026-08 (filter via gte/lte on date)
  workerId?: string;
  dutyType?: "FULL" | "HALF" | "ALL";
}

export interface AttendanceRecord {
  id: string;
  date: string;
  duty_type: "FULL" | "HALF";
  slot_number: number;
  rate_applied: number;
  created_at: string;
  worker_id: string;
  worker_name: string;
  worker_email: string;
}

export interface AttendanceTotals {
  fullCount: number;
  halfCount: number;
  totalCount: number;
  totalEarnings: number;
}

function getNextMonth(month: string): string {
  // month: YYYY-MM
  const [yStr, mStr] = month.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  // JS Date months are 0-indexed; creating date for next month 01
  const next = new Date(y, m, 1); // m is already next month index (since m is 1-based, passing m gives next month)
  const ny = next.getFullYear();
  const nm = String(next.getMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}-01`;
}

export async function fetchAttendance(
  filters: AttendanceFilters
): Promise<{ records: AttendanceRecord[]; totals: AttendanceTotals }> {
  const emptyTotals: AttendanceTotals = {
    fullCount: 0,
    halfCount: 0,
    totalCount: 0,
    totalEarnings: 0,
  };

  try {
    let query = supabase
      .from("duty_records")
      .select("*")
      .order("date", { ascending: false })
      .order("slot_number", { ascending: true });

    if (filters.date) {
      query = query.eq("date", filters.date);
    }

    if (filters.month) {
      const start = `${filters.month}-01`;
      const end = getNextMonth(filters.month);
      query = query.gte("date", start).lt("date", end);
    }

    if (filters.workerId) {
      query = query.eq("worker_id", filters.workerId);
    }

    if (filters.dutyType && filters.dutyType !== "ALL") {
      query = query.eq("duty_type", filters.dutyType);
    }

    const { data, error } = await query;

    if (error) {
      console.error("fetchAttendance query error:", error);
      return { records: [], totals: emptyTotals };
    }

    const rows = (data ?? []) as Array<{
      id: string;
      date: string;
      duty_type: "FULL" | "HALF";
      slot_number: number;
      rate_applied: number;
      created_at: string;
      worker_id: string;
    }>;

    if (rows.length === 0) {
      return { records: [], totals: emptyTotals };
    }

    // Batch fetch worker -> profile mapping
    const uniqueWorkerIds = [...new Set(rows.map((r) => r.worker_id))];

    const { data: workerRows, error: workerError } = await supabase
      .from("workers")
      .select("id, profiles(name,email)")
      .in("id", uniqueWorkerIds);

    if (workerError) {
      console.error("fetchAttendance worker fetch error:", workerError);
      // Still return records with placeholder names so table can render
      const fallbackRecords: AttendanceRecord[] = rows.map((r) => ({
        id: r.id,
        date: r.date,
        duty_type: r.duty_type,
        slot_number: r.slot_number,
        rate_applied: r.rate_applied,
        created_at: r.created_at,
        worker_id: r.worker_id,
        worker_name: "Unknown",
        worker_email: "",
      }));
      const fullCount = fallbackRecords.filter((r) => r.duty_type === "FULL").length;
      const halfCount = fallbackRecords.filter((r) => r.duty_type === "HALF").length;
      const totalEarnings = fallbackRecords.reduce((sum, r) => sum + (r.rate_applied ?? 0), 0);
      return {
        records: fallbackRecords,
        totals: {
          fullCount,
          halfCount,
          totalCount: fallbackRecords.length,
          totalEarnings,
        },
      };
    }

    // Build map: workerId -> {name,email}
    const workerMap = new Map<string, { name: string; email: string }>();
    for (const w of (workerRows ?? []) as unknown as Array<{
      id: string;
      profiles: { name: string; email: string } | { name: string; email: string }[] | null;
    }>) {
      const p = w.profiles;
      let name = "Unknown";
      let email = "";
      if (p) {
        if (Array.isArray(p)) {
          const first = p[0];
          if (first) {
            name = first.name ?? "Unknown";
            email = first.email ?? "";
          }
        } else {
          name = (p as { name: string; email: string }).name ?? "Unknown";
          email = (p as { name: string; email: string }).email ?? "";
        }
      }
      workerMap.set(w.id, { name, email });
    }

    const records: AttendanceRecord[] = rows.map((r) => {
      const info = workerMap.get(r.worker_id);
      return {
        id: r.id,
        date: r.date,
        duty_type: r.duty_type,
        slot_number: r.slot_number,
        rate_applied: r.rate_applied,
        created_at: r.created_at,
        worker_id: r.worker_id,
        worker_name: info?.name ?? "Unknown",
        worker_email: info?.email ?? "",
      };
    });

    const fullCount = records.filter((r) => r.duty_type === "FULL").length;
    const halfCount = records.filter((r) => r.duty_type === "HALF").length;
    const totalEarnings = records.reduce((sum, r) => sum + (r.rate_applied ?? 0), 0);

    return {
      records,
      totals: {
        fullCount,
        halfCount,
        totalCount: records.length,
        totalEarnings,
      },
    };
  } catch (err) {
    console.error("fetchAttendance unexpected error:", err);
    return { records: [], totals: emptyTotals };
  }
}

export async function fetchWorkersForFilter(): Promise<Array<{ id: string; name: string }>> {
  try {
    // Prefer active workers for filter dropdown; fall back to all if needed.
    // Admin should see all selectable workers - active is the primary use-case per spec.
    const { data, error } = await supabase
      .from("workers")
      .select("id, profiles(name)")
      .eq("is_active", true)
      .order("id", { ascending: true });

    if (error) {
      console.error("fetchWorkersForFilter (active) error:", error);
      // Fallback: try without is_active filter (e.g., if column missing or RLS)
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("workers")
        .select("id, profiles(name)");

      if (fallbackError) {
        console.error("fetchWorkersForFilter fallback error:", fallbackError);
        return [];
      }

      return mapWorkerFilterRows(
        fallbackData as unknown as Array<{ id: string; profiles: unknown }>
      );
    }

    // If no active workers found, still try returning all (admin view may want inactive too)
    // But per spec, active is sufficient; return what we have.
    return mapWorkerFilterRows(
      data as unknown as Array<{ id: string; profiles: unknown }>
    );
  } catch (err) {
    console.error("fetchWorkersForFilter unexpected error:", err);
    return [];
  }
}

function mapWorkerFilterRows(
  rows: Array<{ id: string; profiles: unknown }>
): Array<{ id: string; name: string }> {
  return (rows ?? []).map((w) => {
    let name = "Unknown";
    const p = w.profiles as
      | { name: string } | Array<{ name: string }> | null
      | undefined;
    if (p) {
      if (Array.isArray(p)) {
        name = p[0]?.name ?? "Unknown";
      } else if (typeof p === "object" && "name" in p) {
        name = (p as { name: string }).name ?? "Unknown";
      }
    }
    return { id: w.id, name };
  });
}

// ---------------------------------------------------------------------------
// Phase 5C: Admin correction / remove with audit logging (Spec Sections 17,20,21)
// ---------------------------------------------------------------------------

async function getActorUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Delete a duty record as admin and audit as DELETE_DUTY.
 * Keeps audit trail: oldValue = JSON.stringify(record), newValue = null.
 */
export async function deleteAttendanceRecord(
  record: AttendanceRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const actorUserId = await getActorUserId();
    const oldValue = JSON.stringify(record);

    const { error } = await supabase.from("duty_records").delete().eq("id", record.id);

    if (error) {
      console.error("deleteAttendanceRecord error:", error);
      return { success: false, error: error.message };
    }

    const audit = await logAction({
      actorUserId,
      action: "DELETE_DUTY",
      entityType: "duty_record",
      entityId: record.id,
      oldValue,
      newValue: null,
    });

    if (!audit.success) {
      console.warn("deleteAttendanceRecord audit failed:", audit.error);
    }

    return { success: true };
  } catch (err) {
    console.error("deleteAttendanceRecord unexpected error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Correct a duty record as admin and audit as CORRECT_DUTY.
 * MVP: Correct is implemented as Remove + CORRECT_DUTY audit (spec: admin removes incorrect
 * and worker/admin re-adds correct). This satisfies audit requirement while keeping
 * business-rule enforcement in the service layer / DB trigger.
 * Future: could accept new duty_type/slot and perform UPDATE instead.
 */
export async function correctAttendanceRecord(
  record: AttendanceRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const actorUserId = await getActorUserId();
    const oldValue = JSON.stringify(record);

    const { error } = await supabase.from("duty_records").delete().eq("id", record.id);

    if (error) {
      console.error("correctAttendanceRecord error:", error);
      return { success: false, error: error.message };
    }

    const audit = await logAction({
      actorUserId,
      action: "CORRECT_DUTY",
      entityType: "duty_record",
      entityId: record.id,
      oldValue,
      newValue: null,
    });

    if (!audit.success) {
      console.warn("correctAttendanceRecord audit failed:", audit.error);
    }

    return { success: true };
  } catch (err) {
    console.error("correctAttendanceRecord unexpected error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Delete by id when full record object is not available.
 * Fetches record first for audit oldValue if needed.
 */
export async function deleteDutyRecordById(
  id: string,
  record?: AttendanceRecord
): Promise<{ success: boolean; error?: string }> {
  if (record) return deleteAttendanceRecord(record);

  try {
    // Fetch for audit trail
    const { data, error: fetchError } = await supabase
      .from("duty_records")
      .select("*")
      .eq("id", id)
      .single();

    const oldValue = data ? JSON.stringify(data) : null;
    const actorUserId = await getActorUserId();

    const { error } = await supabase.from("duty_records").delete().eq("id", id);
    if (error) {
      console.error("deleteDutyRecordById error:", error);
      return { success: false, error: error.message };
    }

    if (fetchError) {
      console.warn("deleteDutyRecordById fetch for audit failed:", fetchError.message);
    }

    const audit = await logAction({
      actorUserId,
      action: "DELETE_DUTY",
      entityType: "duty_record",
      entityId: id,
      oldValue,
      newValue: null,
    });

    if (!audit.success) console.warn("deleteDutyRecordById audit failed:", audit.error);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
