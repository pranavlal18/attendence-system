import { supabase } from "@/lib/supabase/client";
import { FULL_MAX, HALF_MAX } from "../../constants/duty-types";
import type { DutyRecord } from "@/types/duty";

export type DutyType = "FULL" | "HALF";

export interface CanRecordResult {
  allowed: boolean;
  reason?: string;
  remainingFull?: number;
  remainingHalf?: number;
  existingType?: DutyType | null;
  nextSlot?: number;
}

export async function canRecordDuty(
  workerId: string,
  date: string,
  dutyType: DutyType
): Promise<CanRecordResult> {
  try {
    const { data, error } = await supabase
      .from("duty_records")
      .select("*")
      .eq("worker_id", workerId)
      .eq("date", date);

    if (error) {
      console.error("canRecordDuty query error:", error);
      return { allowed: false, reason: error.message };
    }

    const rows = (data ?? []) as DutyRecord[];

    if (rows.length === 0) {
      return {
        allowed: true,
        remainingFull: FULL_MAX,
        remainingHalf: HALF_MAX,
        existingType: null,
        nextSlot: 1,
      };
    }

    const existingType = rows[0].duty_type as DutyType;
    const count = rows.length;
    const maxSlot = Math.max(...rows.map((r) => r.slot_number));
    const nextSlot = maxSlot + 1;

    // No mixing FULL + HALF same worker/date
    if (existingType !== dutyType) {
      return {
        allowed: false,
        reason: "Cannot mix FULL and HALF on same date",
        existingType,
        remainingFull: existingType === "FULL" ? FULL_MAX - count : 0,
        remainingHalf: existingType === "HALF" ? HALF_MAX - count : 0,
        nextSlot,
      };
    }

    if (dutyType === "FULL" && count >= FULL_MAX) {
      return {
        allowed: false,
        reason: "Maximum 2 Full Duties reached",
        existingType,
        remainingFull: 0,
        remainingHalf: 0,
        nextSlot,
      };
    }

    if (dutyType === "HALF" && count >= HALF_MAX) {
      return {
        allowed: false,
        reason: "Maximum 4 Half Duties reached",
        existingType,
        remainingFull: 0,
        remainingHalf: 0,
        nextSlot,
      };
    }

    // Allowed – remaining for current type, 0 for opposite (mixing disallowed)
    if (dutyType === "FULL") {
      return {
        allowed: true,
        remainingFull: FULL_MAX - count,
        remainingHalf: 0,
        existingType,
        nextSlot,
      };
    }
    return {
      allowed: true,
      remainingFull: 0,
      remainingHalf: HALF_MAX - count,
      existingType,
      nextSlot,
    };
  } catch (err) {
    console.error("canRecordDuty unexpected error:", err);
    return {
      allowed: false,
      reason: err instanceof Error ? err.message : "Unknown error",
    };
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
}): Promise<{ success: boolean; data?: DutyRecord; error?: string }> {
  const { workerId, date, dutyType, slotNumber: requestedSlot, createdBy } = params;

  try {
    const can = await canRecordDuty(workerId, date, dutyType);
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
