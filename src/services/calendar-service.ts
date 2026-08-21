import { supabase } from "@/lib/supabase/client";

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dutyType: "FULL" | "HALF" | "MIXED" | null; // MIXED shouldn't happen due to DB rule, but handle
  count: number;
  duties: Array<{ duty_type: "FULL" | "HALF"; slot_number: number; rate_applied: number }>;
}

export interface CalendarMonth {
  year: number;
  month: number; // 1-12
  weeks: CalendarDay[][]; // 5-6 weeks each 7 days Mon-Sun
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  // next month: month is 1-based, JS Date month is 0-based so passing month gives next month index
  const next = new Date(year, month, 1);
  const ny = next.getFullYear();
  const nm = String(next.getMonth() + 1).padStart(2, "0");
  const end = `${ny}-${nm}-01`;
  return { start, end };
}

export function formatMonthLabel(year: number, month: number): string {
  // e.g., 2026-08 -> "August 2026"
  const d = new Date(year, month - 1, 1);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getTodayStr(): string {
  return formatDateStr(new Date());
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchCalendarDuties(params: {
  year: number;
  month: number;
  workerId?: string;
}): Promise<Map<string, CalendarDay["duties"]>> {
  const { year, month, workerId } = params;
  const { start, end } = getMonthRange(year, month);

  const result = new Map<string, CalendarDay["duties"]>();

  try {
    let query = supabase
      .from("duty_records")
      .select("date,duty_type,slot_number,rate_applied,worker_id")
      .gte("date", start)
      .lt("date", end)
      .order("date", { ascending: true })
      .order("slot_number", { ascending: true });

    if (workerId) {
      query = query.eq("worker_id", workerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("fetchCalendarDuties query error:", error);
      return result;
    }

    const rows = (data ?? []) as Array<{
      date: string;
      duty_type: "FULL" | "HALF";
      slot_number: number;
      rate_applied: number;
      worker_id: string;
    }>;

    for (const row of rows) {
      const key = row.date;
      const entry: CalendarDay["duties"][number] = {
        duty_type: row.duty_type,
        slot_number: row.slot_number,
        rate_applied: row.rate_applied,
      };
      const existing = result.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        result.set(key, [entry]);
      }
    }

    return result;
  } catch (err) {
    console.error("fetchCalendarDuties unexpected error:", err);
    return result;
  }
}

// ---------------------------------------------------------------------------
// Grid builder - Mon-Sun
// ---------------------------------------------------------------------------

export function buildCalendarGrid(
  year: number,
  month: number,
  dutiesMap: Map<string, CalendarDay["duties"]>
): CalendarMonth {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0); // last day of target month

  // Monday-based offset: Mon=0 ... Sun=6
  const firstDow = firstDay.getDay(); // 0 Sun - 6 Sat
  const firstMonOffset = (firstDow + 6) % 7;

  const lastDow = lastDay.getDay();
  const lastMonOffset = (lastDow + 6) % 7;

  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstMonOffset);

  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + (6 - lastMonOffset));

  const todayStr = getTodayStr();
  const weeks: CalendarDay[][] = [];
  let currentWeek: CalendarDay[] = [];

  const cursor = new Date(gridStart);

  while (cursor.getTime() <= gridEnd.getTime()) {
    const dateStr = formatDateStr(cursor);
    const duties = dutiesMap.get(dateStr) ?? [];

    let dutyType: CalendarDay["dutyType"] = null;
    if (duties.length > 0) {
      const allFull = duties.every((d) => d.duty_type === "FULL");
      const allHalf = duties.every((d) => d.duty_type === "HALF");
      if (allFull) dutyType = "FULL";
      else if (allHalf) dutyType = "HALF";
      else dutyType = "MIXED";
    }

    const day: CalendarDay = {
      date: dateStr,
      day: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() + 1 === month && cursor.getFullYear() === year,
      isToday: dateStr === todayStr,
      dutyType,
      count: duties.length,
      duties: [...duties],
    };

    currentWeek.push(day);

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  // Defensive: if leftover (should not happen since gridStart..gridEnd is multiple of 7)
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return { year, month, weeks };
}
