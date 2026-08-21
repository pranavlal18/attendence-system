import { supabase } from "@/lib/supabase/client";
import {
  FULL_UNITS,
  HALF_UNITS,
  DAILY_TEAM_BUDGET,
  WORKER_MAX_FULL,
  WORKER_MAX_HALF,
} from "../../constants/duty-types";
import type { DutyRecord } from "@/types/duty";

export type DutyType = "FULL" | "HALF";

export const dutyUnits = (t: DutyType): number => (t === "FULL" ? FULL_UNITS : HALF_UNITS);

export interface CanRecordResult {
  allowed: boolean;
  reason?: string;
  usedUnits: number;
  remainingUnits: number;
  workerFullCount: number;
  workerHalfCount: number;
  nextSlot: number;
}

function summarize(rows: DutyRecord[]) {
  let usedUnits = 0;
  let workerFullCount = 0;
  let workerHalfCount = 0;
  let maxSlot = 0;
  for (const r of rows) {
    usedUnits += dutyUnits(r.duty_type as DutyType);
    if (r.worker_id === undefined) continue;
    if (r.duty_type === "FULL") workerFullCount += 1;
    else if (r.duty_type === "HALF") workerHalfCount += 1;
    if (r.slot_number > maxSlot) maxSlot = r.slot_number;
  }
  return { usedUnits, workerFullCount, workerHalfCount, nextSlot: maxSlot + 1 };
}

export async function canRecordDuty(
  workerId: string,
  date: string,
  dutyType: DutyType,
  options?: { excludeRecordId?: string }
): Promise<CanRecordResult> {
  try {
    // NOTE: fetches ALL workers' rows for the date (team budget is cross-worker)
    const { data, error } = await supabase
      .from("duty_records")
      .select("id, worker_id, duty_type, slot_number")
      .eq("date", date);

    if (error) {
      console.error("canRecordDuty query error:", error);
      return { allowed: false, reason: error.message, usedUnits: 0, remainingUnits: 0, workerFullCount: 0, workerHalfCount: 0, nextSlot: 1 };
    }

    const rows = ((data ?? []) as DutyRecord[]).filter(
      (r) => !options?.excludeRecordId || r.id !== options.excludeRecordId
    );
    const s = summarize(rows);
    const workerRows = rows.filter((r) => r.worker_id === workerId);
    const ws = summarize(workerRows);

    const fail = (reason: string): CanRecordResult => ({
      allowed: false,
      reason,
      usedUnits: s.usedUnits,
      remainingUnits: Math.max(0, DAILY_TEAM_BUDGET - s.usedUnits),
      workerFullCount: ws.workerFullCount,
      workerHalfCount: ws.workerHalfCount,
      nextSlot: s.nextSlot,
    });

    if (dutyType === "FULL" && ws.workerFullCount >= WORKER_MAX_FULL) {
      return fail("Maximum 2 Full Duties per person");
    }
    if (dutyType === "HALF" && ws.workerHalfCount >= WORKER_MAX_HALF) {
      return fail("Maximum 1 Half Duty per person");
    }
    const needed = dutyUnits(dutyType);
    if (s.usedUnits + needed > DAILY_TEAM_BUDGET) {
      return fail(`Daily limit reached (${s.usedUnits}/${DAILY_TEAM_BUDGET} units used)`);
    }

    return {
      allowed: true,
      usedUnits: s.usedUnits,
      remainingUnits: DAILY_TEAM_BUDGET - s.usedUnits - needed,
      workerFullCount: ws.workerFullCount,
      workerHalfCount: ws.workerHalfCount,
      nextSlot: s.nextSlot,
    };
  } catch (err) {
    console.error("canRecordDuty unexpected error:", err);
    return { allowed: false, reason: err instanceof Error ? err.message : "Unknown error", usedUnits: 0, remainingUnits: 0, workerFullCount: 0, workerHalfCount: 0, nextSlot: 1 };
  }
}

export async function getWorkerDutiesForDate(
  workerId: string,
  date: string
): Promise<DutyRecord[]> {
  try {
    const { data, error } = await supabase
      .from("duty_records")
      .select("*")
      .eq("worker_id", workerId)
      .eq("date", date)
      .order("slot_number", { ascending: true });

    if (error) {
      console.error("getWorkerDutiesForDate error:", error);
      return [];
    }

    return (data ?? []) as DutyRecord[];
  } catch (err) {
    console.error("getWorkerDutiesForDate unexpected error:", err);
    return [];
  }
}

export async function getNextSlot(
  workerId: string,
  date: string,
  dutyType: DutyType
): Promise<number | null> {
  try {
    const result = await canRecordDuty(workerId, date, dutyType);
    if (!result.allowed) {
      return null;
    }
    return result.nextSlot ?? null;
  } catch (err) {
    console.error("getNextSlot unexpected error:", err);
    return null;
  }
}

export async function recordDuty(params: {
  workerId: string;
  date: string;
  dutyType: DutyType;
  slotNumber?: number;
  createdBy?: string;
  excludeRecordId?: string;
}): Promise<{ success: boolean; data?: DutyRecord; error?: string }> {
  const { workerId, date, dutyType, slotNumber: requestedSlot, createdBy } = params;

  try {
    const can = await canRecordDuty(workerId, date, dutyType, { excludeRecordId: params.excludeRecordId });
    if (!can.allowed) {
      return { success: false, error: can.reason ?? "Cannot record duty" };
    }

    const slotNumber = requestedSlot ?? can.nextSlot ?? 1;

    // Fetch worker's current rate for historical preservation
    const { data: worker, error: workerError } = await supabase
      .from("workers")
      .select("full_duty_rate, half_duty_rate")
      .eq("id", workerId)
      .single();

    if (workerError || !worker) {
      console.error("recordDuty worker fetch error:", workerError);
      return {
        success: false,
        error: workerError?.message ?? "Worker not found",
      };
    }

    const rateApplied =
      dutyType === "FULL"
        ? (worker as { full_duty_rate: number }).full_duty_rate
        : (worker as { half_duty_rate: number }).half_duty_rate;

    const { data, error } = await supabase
      .from("duty_records")
      .insert({
        worker_id: workerId,
        date,
        duty_type: dutyType,
        slot_number: slotNumber,
        rate_applied: rateApplied,
        created_by: createdBy ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("recordDuty insert error:", error);
      // Map unique violation to friendly message
      if (
        error.message.includes("duplicate") ||
        error.message.includes("idx_duty_slots") ||
        error.code === "23505"
      ) {
        return { success: false, error: "Slot already taken for this worker/date" };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data as DutyRecord };
  } catch (err) {
    console.error("recordDuty unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function removeDuty(
  dutyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("duty_records").delete().eq("id", dutyId);

    if (error) {
      console.error("removeDuty error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("removeDuty unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
