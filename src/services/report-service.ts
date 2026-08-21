import { supabase } from "@/lib/supabase/client";

export interface MonthlySummary {
  workerId: string;
  workerName: string;
  workerEmail: string;
  fullCount: number;
  halfCount: number;
  totalCount: number;
  earnings: number; // sum rate_applied
  isActive: boolean;
}

export interface MonthlyReport {
  monthYear: string; // YYYY-MM
  summaries: MonthlySummary[];
  totals: {
    fullCount: number;
    halfCount: number;
    totalCount: number;
    totalEarnings: number;
    workerCount: number;
  };
}

export interface Payout {
  id: string;
  worker_id: string;
  month_year: string; // YYYY-MM
  amount_paid: number;
  payment_date: string; // YYYY-MM-DD
  payment_method: string | null;
  notes: string | null;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNextMonth(monthYear: string): string {
  const [yStr, mStr] = monthYear.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const next = new Date(y, m, 1); // m is 1-based, Date month 0-based => next month
  const ny = next.getFullYear();
  const nm = String(next.getMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}-01`;
}

function isValidMonthYear(s: string): boolean {
  return /^\d{4}-\d{2}$/.test(s);
}

function generateLast12Months(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Monthly Report - aggregation using rate_applied (historical)
// ---------------------------------------------------------------------------

export async function fetchMonthlyReport(monthYear: string): Promise<MonthlyReport> {
  if (!isValidMonthYear(monthYear)) {
    throw new Error(`Invalid monthYear format, expected YYYY-MM got: ${monthYear}`);
  }

  const start = `${monthYear}-01`;
  const end = getNextMonth(monthYear);

  const emptyReport: MonthlyReport = {
    monthYear,
    summaries: [],
    totals: { fullCount: 0, halfCount: 0, totalCount: 0, totalEarnings: 0, workerCount: 0 },
  };

  try {
    // 1. Fetch duty records for month (historical earnings via rate_applied)
    const { data: dutyRows, error: dutyError } = await supabase
      .from("duty_records")
      .select("worker_id, duty_type, rate_applied")
      .gte("date", start)
      .lt("date", end);

    if (dutyError) {
      console.error("fetchMonthlyReport duty_records error:", dutyError);
      // Still attempt to return workers with 0 counts below, but if duty fetch fails we fallback
    }

    const rows = (dutyRows ?? []) as Array<{
      worker_id: string;
      duty_type: "FULL" | "HALF";
      rate_applied: number;
    }>;

    // 2. Fetch all active workers (left join source) with profile info
    // Spec: even if no duties, return all active workers with 0 counts, sorted by name
    type WorkerRow = {
      id: string;
      is_active: boolean;
      profiles: { name: string; email: string } | Array<{ name: string; email: string }> | null;
    };
    let workerRows: WorkerRow[] | null = null;

    const { data: activeWorkers, error: workerError } = await supabase
      .from("workers")
      .select("id, is_active, profiles(name,email)")
      .eq("is_active", true);

    if (workerError) {
      console.error("fetchMonthlyReport workers (active) error:", workerError);
      // Fallback: try without filter
      const { data: fallback, error: fallbackError } = await supabase
        .from("workers")
        .select("id, is_active, profiles(name,email)");
      if (fallbackError) {
        console.error("fetchMonthlyReport workers fallback error:", fallbackError);
        // No workers available — return duty-only totals if possible, else empty
        if (rows.length === 0) return emptyReport;
        // Build summaries from duty rows alone with Unknown names (degraded)
        const agg = buildAgg(rows);
        const summaries: MonthlySummary[] = [...agg.entries()].map(([wid, v]) => ({
          workerId: wid,
          workerName: "Unknown",
          workerEmail: "",
          fullCount: v.fullCount,
          halfCount: v.halfCount,
          totalCount: v.totalCount,
          earnings: v.earnings,
          isActive: true,
        }));
        summaries.sort((a, b) => a.workerName.localeCompare(b.workerName));
        return {
          monthYear,
          summaries,
          totals: computeTotals(summaries),
        };
      }
      workerRows = (fallback ?? []) as unknown as WorkerRow[];
    } else {
      workerRows = (activeWorkers ?? []) as unknown as WorkerRow[];
    }

    // Build aggregation map from duty rows
    const agg = buildAgg(rows);

    // If there are duty workers not in active list (e.g., inactive with historical duties),
    // fetch them and merge so historical data is not lost.
    const activeIds = new Set((workerRows ?? []).map((w) => w.id));
    const orphanIds = [...agg.keys()].filter((id) => !activeIds.has(id));
    if (orphanIds.length > 0) {
      const { data: orphanWorkers, error: orphanError } = await supabase
        .from("workers")
        .select("id, is_active, profiles(name,email)")
        .in("id", orphanIds);
      if (!orphanError && orphanWorkers) {
        const extra = orphanWorkers as unknown as WorkerRow[];
        workerRows = [...(workerRows ?? []), ...(extra ?? [])];
      } else if (orphanError) {
        console.warn("fetchMonthlyReport orphan workers fetch failed:", orphanError);
        // Keep orphans as Unknown entries later
      }
    }

    const workers = workerRows ?? [];

    // Build map for quick profile lookup
    const workerInfo = new Map<string, { name: string; email: string; isActive: boolean }>();
    for (const w of workers) {
      let name = "Unknown";
      let email = "";
      const p = w.profiles;
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
      workerInfo.set(w.id, { name, email, isActive: w.is_active ?? true });
    }

    // Build summaries: one per active (or merged) worker, left-joined with agg
    const summaries: MonthlySummary[] = workers.map((w) => {
      const info = workerInfo.get(w.id);
      const v = agg.get(w.id);
      return {
        workerId: w.id,
        workerName: info?.name ?? "Unknown",
        workerEmail: info?.email ?? "",
        fullCount: v?.fullCount ?? 0,
        halfCount: v?.halfCount ?? 0,
        totalCount: v?.totalCount ?? 0,
        earnings: v?.earnings ?? 0,
        isActive: info?.isActive ?? (w.is_active ?? true),
      };
    });

    // Add any remaining orphan duties that still weren't resolved (if orphan fetch failed)
    for (const [wid, v] of agg.entries()) {
      if (!workerInfo.has(wid)) {
        summaries.push({
          workerId: wid,
          workerName: "Unknown",
          workerEmail: "",
          fullCount: v.fullCount,
          halfCount: v.halfCount,
          totalCount: v.totalCount,
          earnings: v.earnings,
          isActive: false,
        });
      }
    }

    // Sort by name ascending (spec example ordered by name)
    summaries.sort((a, b) => a.workerName.localeCompare(b.workerName));

    return {
      monthYear,
      summaries,
      totals: computeTotals(summaries),
    };
  } catch (err) {
    console.error("fetchMonthlyReport unexpected error:", err);
    throw err;
  }
}

function buildAgg(
  rows: Array<{ worker_id: string; duty_type: "FULL" | "HALF"; rate_applied: number }>
): Map<string, { fullCount: number; halfCount: number; totalCount: number; earnings: number }> {
  const m = new Map<string, { fullCount: number; halfCount: number; totalCount: number; earnings: number }>();
  for (const r of rows) {
    const cur = m.get(r.worker_id) ?? { fullCount: 0, halfCount: 0, totalCount: 0, earnings: 0 };
    if (r.duty_type === "FULL") cur.fullCount += 1;
    else if (r.duty_type === "HALF") cur.halfCount += 1;
    cur.totalCount += 1;
    cur.earnings += r.rate_applied ?? 0;
    m.set(r.worker_id, cur);
  }
  return m;
}

function computeTotals(summaries: MonthlySummary[]): MonthlyReport["totals"] {
  let fullCount = 0;
  let halfCount = 0;
  let totalCount = 0;
  let totalEarnings = 0;
  for (const s of summaries) {
    fullCount += s.fullCount;
    halfCount += s.halfCount;
    totalCount += s.totalCount;
    totalEarnings += s.earnings;
  }
  return { fullCount, halfCount, totalCount, totalEarnings, workerCount: summaries.length };
}

// ---------------------------------------------------------------------------
// Available months
// ---------------------------------------------------------------------------

export async function fetchAvailableMonths(): Promise<string[]> {
  try {
    const { data, error } = await supabase.from("duty_records").select("date");

    if (error) {
      console.error("fetchAvailableMonths duty_records error:", error);
      return generateLast12Months();
    }

    const dates = (data ?? []) as Array<{ date: string }>;
    if (dates.length === 0) {
      return generateLast12Months();
    }

    const set = new Set<string>();
    for (const r of dates) {
      if (r.date && typeof r.date === "string" && r.date.length >= 7) {
        set.add(r.date.slice(0, 7)); // YYYY-MM
      }
    }

    if (set.size === 0) return generateLast12Months();

    const months = [...set].sort().reverse(); // most recent first (lexicographic works for YYYY-MM)
    return months;
  } catch (err) {
    console.error("fetchAvailableMonths unexpected error:", err);
    return generateLast12Months();
  }
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

export async function fetchPayouts(monthYear: string): Promise<Payout[]> {
  if (!isValidMonthYear(monthYear)) {
    throw new Error(`Invalid monthYear format, expected YYYY-MM got: ${monthYear}`);
  }
  try {
    const { data, error } = await supabase
      .from("payouts")
      .select("*")
      .eq("month_year", monthYear)
      .order("payment_date", { ascending: false });

    if (error) {
      console.error("fetchPayouts error:", error);
      return [];
    }
    return (data ?? []) as Payout[];
  } catch (err) {
    console.error("fetchPayouts unexpected error:", err);
    return [];
  }
}

export async function createPayout(params: {
  workerId: string;
  monthYear: string;
  amountPaid: number;
  paymentDate: string; // YYYY-MM-DD
  paymentMethod?: string | null;
  notes?: string | null;
}): Promise<{ success: boolean; error?: string; data?: Payout }> {
  const { workerId, monthYear, amountPaid, paymentDate, paymentMethod, notes } = params;

  if (!isValidMonthYear(monthYear)) {
    return { success: false, error: `Invalid monthYear: ${monthYear}` };
  }
  if (!workerId) return { success: false, error: "workerId required" };
  if (!amountPaid || amountPaid <= 0) return { success: false, error: "amountPaid must be > 0" };
  if (!paymentDate) return { success: false, error: "paymentDate required" };

  try {
    const { data, error } = await supabase
      .from("payouts")
      .insert({
        worker_id: workerId,
        month_year: monthYear,
        amount_paid: amountPaid,
        payment_date: paymentDate,
        payment_method: paymentMethod ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("createPayout insert error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Payout };
  } catch (err) {
    console.error("createPayout unexpected error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getPaymentStatus(
  workerId: string,
  monthYear: string,
  earnings: number
): Promise<"UNPAID" | "PARTIALLY_PAID" | "PAID"> {
  // Earnings 0 means nothing owed -> considered PAID
  if (earnings <= 0) return "PAID";

  try {
    const { data, error } = await supabase
      .from("payouts")
      .select("amount_paid")
      .eq("worker_id", workerId)
      .eq("month_year", monthYear);

    if (error) {
      console.error("getPaymentStatus query error:", error);
      return "UNPAID";
    }

    const rows = (data ?? []) as Array<{ amount_paid: number }>;
    const sum = rows.reduce((acc, r) => acc + (r.amount_paid ?? 0), 0);

    if (sum === 0) return "UNPAID";
    if (sum >= earnings) return "PAID";
    return "PARTIALLY_PAID";
  } catch (err) {
    console.error("getPaymentStatus unexpected error:", err);
    return "UNPAID";
  }
}

// ---------------------------------------------------------------------------
// Attendance matrix (admin printable report)
// ---------------------------------------------------------------------------

export type AttendanceMatrixCell = "F" | "F+F" | "H" | "F+H" | "A" | "";

export interface AttendanceMatrixWorker {
  workerId: string;
  workerName: string;
  cells: Record<number, AttendanceMatrixCell>;
}

export interface AttendanceMatrix {
  monthYear: string;
  endDate: string;
  days: number[];
  workers: AttendanceMatrixWorker[];
}

export async function fetchAttendanceMatrix(
  monthYear: string,
  endDate?: string
): Promise<AttendanceMatrix> {
  if (!isValidMonthYear(monthYear)) throw new Error(`Invalid monthYear: ${monthYear}`);
  const start = `${monthYear}-01`;
  const [y, m] = monthYear.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();

  let endDay = endDate && endDate.startsWith(monthYear) ? Number(endDate.slice(8, 10)) : lastDay;
  endDay = Math.min(Math.max(endDay, 1), lastDay);
  const effectiveEnd = `${monthYear}-${String(endDay).padStart(2, "0")}`;

  const days: number[] = [];
  for (let d = 1; d <= endDay; d++) days.push(d);

  const cellLabel = (fulls: number, halves: number): AttendanceMatrixCell => {
    if (fulls === 0 && halves === 0) return "A";
    if (fulls === 1 && halves === 0) return "F";
    if (fulls === 2 && halves === 0) return "F+F";
    if (fulls === 0 && halves === 1) return "H";
    if (fulls === 1 && halves === 1) return "F+H";
    return "A";
  };

  try {
    const { data: dutyRows, error } = await supabase
      .from("duty_records")
      .select("worker_id, date, duty_type")
      .gte("date", start)
      .lte("date", effectiveEnd);
    if (error) throw error;
    const rows = (dutyRows ?? []) as Array<{ worker_id: string; date: string; duty_type: "FULL" | "HALF" }>;

    const { data: workerRows, error: wErr } = await supabase
      .from("workers")
      .select("id, profiles(name)")
      .order("id");
    if (wErr) throw wErr;
    const workersRaw = (workerRows ?? []) as unknown as Array<{ id: string; profiles: { name: string } | Array<{ name: string }> | null }>;

    // per worker per day tallies
    const tally = new Map<string, Map<number, { f: number; h: number }>>();
    for (const r of rows) {
      const day = Number(r.date.slice(8, 10));
      if (!days.includes(day)) continue;
      const wm = tally.get(r.worker_id) ?? new Map<number, { f: number; h: number }>();
      const dm = wm.get(day) ?? { f: 0, h: 0 };
      if (r.duty_type === "FULL") dm.f += 1; else dm.h += 1;
      wm.set(day, dm);
      tally.set(r.worker_id, wm);
    }

    const outWorkers: AttendanceMatrixWorker[] = workersRaw.map((w) => {
      let name = "Unknown";
      const p = w.profiles;
      if (Array.isArray(p)) name = p[0]?.name ?? "Unknown";
      else if (p) name = p.name ?? "Unknown";
      const wm = tally.get(w.id);
      const cells: Record<number, AttendanceMatrixCell> = {};
      for (const d of days) {
        const dm = wm?.get(d);
        cells[d] = dm ? cellLabel(dm.f, dm.h) : "A";
      }
      return { workerId: w.id, workerName: name, cells };
    });
    outWorkers.sort((a, b) => a.workerName.localeCompare(b.workerName));

    return { monthYear, endDate: effectiveEnd, days, workers: outWorkers };
  } catch (err) {
    console.error("fetchAttendanceMatrix unexpected error:", err);
    throw err;
  }
}
