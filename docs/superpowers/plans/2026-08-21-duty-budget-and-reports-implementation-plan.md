# Duty Budget and Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-08-21
**Spec:** `docs/superpowers/specs/2026-08-21-duty-budget-and-reports-design.md`

**Goal:** Enforce a 4-unit daily team budget (FULL=2, HALF=1) replacing old per-worker rules; add an admin printable attendance matrix and a worker monthly summary with earnings.

**Architecture:** Three-layer enforcement (service → DB trigger → Zod/UI) matching the existing convention. Report features are read-only aggregations added to `src/services/report-service.ts`, consumed by one new admin section and one new worker page.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript 5, Supabase (PostgreSQL), Tailwind CSS v4, Zod.

## Global Constraints

- FULL = 2 units, HALF = 1 unit; team total per calendar date ≤ 4 units
- Per worker/day: max 2 FULL, max 1 HALF; mixing FULL+HALF for the same person IS allowed
- Old removed rules: no-mixing ban, HALF_MAX=4
- Constants: `FULL_UNITS=2`, `HALF_UNITS=1`, `DAILY_TEAM_BUDGET=4`, `WORKER_MAX_FULL=2`, `WORKER_MAX_HALF=1` (replace `FULL_MAX`/`HALF_MAX`)
- Historical data untouched; rules apply going forward
- No schema changes beyond replacing the validation trigger
- Print via `window.print()`; non-print chrome hidden with Tailwind `print:hidden`
- Earnings always summed from `rate_applied` snapshots
- Slots are globally unique per worker/date (`idx_duty_slots`); next slot = max(all slot_number)+1 across BOTH types (mixing makes per-type counters collide)

---

### Task 1: Constants

**Files:**
- Modify: `src/constants/duty-types.ts` (entire file — currently just a re-export line)
- Modify: `constants/duty-types.ts` (root copy — same replacement, since other files import from root path)

**Interfaces:**
- Produces: `FULL_UNITS=2`, `HALF_UNITS=1`, `DAILY_TEAM_BUDGET=4`, `WORKER_MAX_FULL=2`, `WORKER_MAX_HALF=1`

- [ ] **Step 1:** Replace content of both files with:

```typescript
// Duty unit model: FULL = 2 units, HALF = 1 unit.
// Team-wide daily budget across ALL workers:
export const FULL_UNITS = 2;
export const HALF_UNITS = 1;
export const DAILY_TEAM_BUDGET = 4;
// Per-worker caps (in addition to the team budget):
export const WORKER_MAX_FULL = 2;
export const WORKER_MAX_HALF = 1;
```

- [ ] **Step 2:** Commit: `git add constants/duty-types.ts src/constants/duty-types.ts && git commit -m "feat: replace duty max constants with unit-budget constants"`

### Task 2: Rewrite `canRecordDuty` in `src/services/duty-service.ts`

**Files:**
- Modify: `src/services/duty-service.ts:1-149` (imports, `CanRecordResult`, `canRecordDuty`, `recordDuty` signature)

**Interfaces:**
- Consumes: constants from Task 1
- Produces:
  - `interface CanRecordResult { allowed: boolean; reason?: string; usedUnits: number; remainingUnits: number; workerFullCount: number; workerHalfCount: number; nextSlot: number; }`
  - `canRecordDuty(workerId: string, date: string, dutyType: "FULL"|"HALF", options?: { excludeRecordId?: string }): Promise<CanRecordResult>`
  - `recordDuty(params: { workerId; date; dutyType; slotNumber?; createdBy?; excludeRecordId? })` passes `excludeRecordId` through

- [ ] **Step 1:** Replace import line 2 with:
```typescript
import {
  FULL_UNITS,
  HALF_UNITS,
  DAILY_TEAM_BUDGET,
  WORKER_MAX_FULL,
  WORKER_MAX_HALF,
} from "../../constants/duty-types";
```

- [ ] **Step 2:** Replace `CanRecordResult` and `canRecordDuty` with:
```typescript
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
```
(Delete the old body entirely, including the empty-rows early return.)

- [ ] **Step 3:** In `getNextSlot`, no change needed (it delegates). In `recordDuty`, add `excludeRecordId?: string` to params and pass: `const can = await canRecordDuty(workerId, date, dutyType, { excludeRecordId: params.excludeRecordId });`

- [ ] **Step 4:** Verify TypeScript compiles: `npx tsc --noEmit`. Fix callers that destructure removed fields (`remainingFull`/`remainingHalf`/`existingType`) — grep: `rg "remainingFull|remainingHalf|existingType"` and update them to the new shape (expected hits: `duty-record-card.tsx`, `attendance-service.ts`, `calendar-service.ts`; replace with `usedUnits`/`remainingUnits` equivalents).

- [ ] **Step 5:** Commit: `git commit -am "feat: rewrite canRecordDuty to enforce 4-unit daily team budget"`

### Task 3: DB trigger migration

**Files:**
- Create: `supabase/migrations/20260821000002_duty_budget_trigger.sql`

- [ ] **Step 1:** Write the migration:
```sql
-- Replace per-worker no-mixing rules with:
-- 1) Team-wide daily budget of 4 units (FULL=2, HALF=1)
-- 2) Per-worker caps: max 2 FULL, max 1 HALF (mixing allowed)
-- Ref spec: docs/superpowers/specs/2026-08-21-duty-budget-and-reports-design.md

-- Drop every user trigger on duty_records (removes old enforce_duty_business_rules trigger)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.duty_records'::regclass AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.duty_records', t);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS enforce_duty_business_rules();

CREATE OR REPLACE FUNCTION enforce_duty_budget_rules()
RETURNS TRIGGER AS $$
DECLARE
  v_team_units INT;
  v_worker_fulls INT;
  v_worker_halves INT;
  v_new_units INT := CASE WHEN NEW.duty_type = 'FULL' THEN 2 ELSE 1 END;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN dr.duty_type = 'FULL' THEN 2 ELSE 1 END), 0)
    INTO v_team_units
  FROM duty_records dr
  WHERE dr.date = NEW.date
    AND (TG_OP = 'INSERT' OR dr.id <> NEW.id);

  IF v_team_units + v_new_units > 4 THEN
    RAISE EXCEPTION 'Daily limit reached (%/4 units used)', v_team_units
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE duty_type = 'FULL'),
    COUNT(*) FILTER (WHERE duty_type = 'HALF')
    INTO v_worker_fulls, v_worker_halves
  FROM duty_records
  WHERE worker_id = NEW.worker_id AND date = NEW.date
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF NEW.duty_type = 'FULL' AND v_worker_fulls >= 2 THEN
    RAISE EXCEPTION 'Maximum 2 Full Duties per person';
  END IF;
  IF NEW.duty_type = 'HALF' AND v_worker_halves >= 1 THEN
    RAISE EXCEPTION 'Maximum 1 Half Duty per person';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER duty_budget_trigger
BEFORE INSERT OR UPDATE ON public.duty_records
FOR EACH ROW EXECUTE FUNCTION enforce_duty_budget_rules();
```

- [ ] **Step 2:** Commit: `git add supabase/migrations/20260821000002_duty_budget_trigger.sql && git commit -m "feat: team budget + per-worker cap DB trigger"`

### Task 4: Zod schema

**Files:**
- Modify: `src/schemas/duty.ts` (whole file)

- [ ] **Step 1:** Replace with:
```typescript
import { z } from "zod";
import { WORKER_MAX_FULL, WORKER_MAX_HALF } from "../../constants/duty-types";

const MAX_SLOTS_PER_DAY = WORKER_MAX_FULL + WORKER_MAX_HALF; // 3 (2F + 1H)

export const dutySchema = z.object({
  worker_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  duty_type: z.enum(["FULL", "HALF"]),
  slot_number: z.number().int().min(1).max(MAX_SLOTS_PER_DAY),
});

export type DutyFormValues = z.infer<typeof dutySchema>;
```

- [ ] **Step 2:** `npx tsc --noEmit` passes. Commit: `git commit -am "refactor: simplify duty Zod schema for budget rules"`

### Task 5: Duty form UI

**Files:**
- Modify: `src/features/attendance/duty-form.tsx`

**Interfaces:**
- Consumes: constants from Task 1

- [ ] **Step 1:** Change import (line 5) to the new constants. Add team-usage state:
```typescript
const [teamUsedUnits, setTeamUsedUnits] = useState<number>(0);
```
In `fetchDuties`, after fetching own duties, run a second query WITHOUT the worker filter and compute:
```typescript
const { data: teamRows } = await supabase
  .from("duty_records")
  .select("duty_type")
  .eq("date", selectedDate);
const used = (teamRows ?? []).reduce(
  (acc: number, r: { duty_type: string }) =>
    acc + (r.duty_type === "FULL" ? FULL_UNITS : HALF_UNITS),
  0
);
setTeamUsedUnits(used);
```

- [ ] **Step 2:** Replace lines 64–68 (existingType/fullCount/isFullDisabled logic):
```typescript
const fullCount = duties.filter((d) => d.duty_type === "FULL").length;
const halfCount = duties.filter((d) => d.duty_type === "HALF").length;
const remainingUnits = Math.max(0, DAILY_TEAM_BUDGET - teamUsedUnits);
const isFullDisabled =
  fullCount >= WORKER_MAX_FULL || remainingUnits < FULL_UNITS;
const isHalfDisabled =
  halfCount >= WORKER_MAX_HALF || remainingUnits < HALF_UNITS;
```

- [ ] **Step 3:** In `handleAddDuty`, delete the entire inline pre-check block (lines 73–89) and the per-type slot guards (lines 114–122). Replace slot computation (line 112) with global max across types:
```typescript
const maxSlot = duties.reduce((m, d) => Math.max(m, d.slot_number), 0);
const nextSlot = maxSlot + 1;
```
On insert error, map trigger messages to friendly text: if message includes "Daily limit" or "Maximum", show it directly.

- [ ] **Step 4:** Replace progress-bar section (lines 230–268) with a single team budget bar:
```typescript
<div className="mb-4">
  <div className="mb-1 flex justify-between text-xs">
    <span className="font-medium">Daily Team Budget</span>
    <span className="text-zinc-500">
      {teamUsedUnits}/{DAILY_TEAM_BUDGET} • {remainingUnits} remaining
    </span>
  </div>
  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
    <div className="h-full bg-blue-500 transition-all"
      style={{ width: `${(Math.min(teamUsedUnits, DAILY_TEAM_BUDGET) / DAILY_TEAM_BUDGET) * 100}%` }}
      role="progressbar" aria-valuenow={teamUsedUnits} aria-valuemin={0} aria-valuemax={DAILY_TEAM_BUDGET} />
  </div>
</div>
```

- [ ] **Step 5:** Replace per-type "remaining" labels (`{FULL_MAX - fullCount} remaining` etc.) with worker-cap labels: `{WORKER_MAX_FULL - fullCount} of 2 full left` / `{WORKER_MAX_HALF - halfCount} of 1 half left`. Remove the dashed "Empty slot" placeholder lists and the `existingType` disabled-reason paragraphs; disabled reasons become:
```typescript
{isFullDisabled && (
  <p className="mt-2 text-xs text-zinc-500">
    {fullCount >= WORKER_MAX_FULL ? "Maximum 2 Full Duties per person" : `Daily limit reached (${teamUsedUnits}/${DAILY_TEAM_BUDGET} units)`}
  </p>
)}
{isHalfDisabled && (
  <p className="mt-2 text-xs text-zinc-500">
    {halfCount >= WORKER_MAX_HALF ? "Maximum 1 Half Duty per person" : `Daily limit reached (${teamUsedUnits}/${DAILY_TEAM_BUDGET} units)`}
  </p>
)}
```
Also remove now-unused vars (`fullProgress`, `halfProgress`, `existingType`, `FULL_MAX`/`HALF_MAX` imports).

- [ ] **Step 6:** `npx tsc --noEmit` passes; `npm run lint` clean. Commit: `git commit -am "feat: budget-aware duty form UI"`

### Task 6: Attendance matrix service (admin print data)

**Files:**
- Modify: `src/services/report-service.ts` (append)

**Interfaces:**
- Produces:
```typescript
export interface AttendanceMatrixCell = "F" | "F+F" | "H" | "F+H" | "A" | "";
export interface AttendanceMatrixWorker { workerId: string; workerName: string; cells: Record<number, AttendanceMatrixCell>; }
export interface AttendanceMatrix { monthYear: string; endDate: string; days: number[]; workers: AttendanceMatrixWorker[]; }
export async function fetchAttendanceMatrix(monthYear: string, endDate?: string): Promise<AttendanceMatrix>
```

- [ ] **Step 1:** Append to `report-service.ts`:
```typescript
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
```

- [ ] **Step 2:** `npx tsc --noEmit` passes. Commit: `git commit -am "feat: attendance matrix service for printable report"`

### Task 7: Admin print UI

**Files:**
- Create: `src/components/reports/print-attendance-sheet.tsx`
- Modify: `app/admin/reports/page.tsx`

- [ ] **Step 1:** Create `print-attendance-sheet.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import {
  fetchAttendanceMatrix,
  type AttendanceMatrix,
} from "@/services/report-service";

interface Props {
  monthYear: string;
}

export function PrintAttendanceSheet({ monthYear }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultEnd = today.startsWith(monthYear) ? today : `${monthYear}-01`;
  const [endDate, setEndDate] = useState(defaultEnd);
  const [matrix, setMatrix] = useState<AttendanceMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEndDate(today.startsWith(monthYear) ? today : `${monthYear}-01`);
  }, [monthYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setMatrix(await fetchAttendanceMatrix(monthYear, endDate));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <label htmlFor="print-end-date" className="block text-xs font-medium text-zinc-500">Until date</label>
          <input id="print-end-date" type="date" value={endDate} min={`${monthYear}-01`}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800" />
        </div>
        <button type="button" onClick={load} disabled={loading}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-700">
          {loading ? "Loading…" : "Load Sheet"}
        </button>
        <button type="button" onClick={() => window.print()} disabled={!matrix}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900">
          Print
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {matrix && matrix.workers.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <h3 className="mb-2 text-sm font-semibold">
            Attendance {matrix.monthYear} (until {matrix.endDate})
          </h3>
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-zinc-300 px-1 py-0.5 text-left dark:border-zinc-600">Worker</th>
                {matrix.days.map((d) => (
                  <th key={d} className="border border-zinc-300 px-1 py-0.5 dark:border-zinc-600">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.workers.map((w) => (
                <tr key={w.workerId}>
                  <td className="border border-zinc-300 px-1 py-0.5 whitespace-nowrap dark:border-zinc-600">{w.workerName}</td>
                  {matrix.days.map((d) => (
                    <td key={d}
                      className={`border border-zinc-300 px-1 py-0.5 text-center ${w.cells[d] === "A" ? "text-red-500" : ""}`}>
                      {w.cells[d]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-zinc-500 print:text-black">F = 1 Full · F+F = 2 Full · H = Half · F+H · A = Absent</p>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2:** In `app/admin/reports/page.tsx`: import `PrintAttendanceSheet`, render `<PrintAttendanceSheet monthYear={monthYear} />` below the existing summary table (before closing container div), and add `print:hidden` to the AdminNav usage and payout section wrapper so printing shows only the sheet.

- [ ] **Step 3:** Manual verify: `npm run dev`, open `/admin/reports`, Load Sheet, Print preview shows only grid. Commit: `git commit -am "feat: printable admin attendance sheet"`

### Task 8: Worker monthly detail service

**Files:**
- Modify: `src/services/report-service.ts` (append)

**Interfaces:**
- Produces:
```typescript
export interface WorkerDayEntry { date: string; present: boolean; label: string; earning: number; }
export interface WorkerMonthDetail { monthYear: string; days: WorkerDayEntry[]; totalShifts: number; totalEarnings: number; }
export async function fetchWorkerMonthlyDetail(workerId: string, monthYear: string): Promise<WorkerMonthDetail>
```

- [ ] **Step 1:** Append:
```typescript
export interface WorkerDayEntry {
  date: string;
  present: boolean;
  label: string; // "Absent" | "1 Full" | "1 Full + 1 Half" | ...
  earning: number;
}

export interface WorkerMonthDetail {
  monthYear: string;
  days: WorkerDayEntry[];
  totalShifts: number;
  totalEarnings: number;
}

export async function fetchWorkerMonthlyDetail(
  workerId: string,
  monthYear: string
): Promise<WorkerMonthDetail> {
  if (!isValidMonthYear(monthYear)) throw new Error(`Invalid monthYear: ${monthYear}`);
  const start = `${monthYear}-01`;
  const end = getNextMonth(monthYear);
  const [y, m] = monthYear.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();

  try {
    const { data, error } = await supabase
      .from("duty_records")
      .select("date, duty_type, rate_applied")
      .eq("worker_id", workerId)
      .gte("date", start)
      .lt("date", end)
      .order("date", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as Array<{ date: string; duty_type: "FULL" | "HALF"; rate_applied: number }>;

    const byDate = new Map<string, { f: number; h: number; earning: number }>();
    for (const r of rows) {
      const cur = byDate.get(r.date) ?? { f: 0, h: 0, earning: 0 };
      if (r.duty_type === "FULL") cur.f += 1; else cur.h += 1;
      cur.earning += r.rate_applied ?? 0;
      byDate.set(r.date, cur);
    }

    const days: WorkerDayEntry[] = [];
    let totalShifts = 0;
    let totalEarnings = 0;
    for (let d = 1; d <= lastDay; d++) {
      const date = `${monthYear}-${String(d).padStart(2, "0")}`;
      const rec = byDate.get(date);
      const shifts = rec ? rec.f + rec.h : 0;
      const label = !rec ? "Absent"
        : [
            rec.f > 0 ? `${rec.f} Full${rec.f > 1 ? "s" : ""}` : null,
            rec.h > 0 ? `${rec.h} Half` : null,
          ].filter(Boolean).join(" + ");
      totalShifts += shifts;
      totalEarnings += rec?.earning ?? 0;
      days.push({ date, present: !!rec, label, earning: rec?.earning ?? 0 });
    }
    return { monthYear, days, totalShifts, totalEarnings };
  } catch (err) {
    console.error("fetchWorkerMonthlyDetail unexpected error:", err);
    throw err;
  }
}
```

- [ ] **Step 2:** `npx tsc --noEmit` passes. Commit: `git commit -am "feat: worker monthly detail service"`

### Task 9: Worker monthly page + navigation

**Files:**
- Create: `app/worker/monthly-report/page.tsx`
- Modify: `app/worker/page.tsx` and `app/worker/attendance/page.tsx` (add nav link)

- [ ] **Step 1:** Create the page — resolve worker exactly like `app/worker/page.tsx` (auth user → `profiles` by `user_id` → `workers` by `profile_id`), then:
```tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchWorkerMonthlyDetail, type WorkerMonthDetail } from "@/services/report-service";

export default function WorkerMonthlyReportPage() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [monthYear, setMonthYear] = useState(thisMonth);
  const [detail, setDetail] = useState<WorkerMonthDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Not authenticated. Please log in.");
        const { data: profile, error: profileError } = await supabase
          .from("profiles").select("id").eq("user_id", user.id).single();
        if (profileError || !profile) throw new Error("Profile not found.");
        const { data: worker, error: workerError } = await supabase
          .from("workers").select("id").eq("profile_id", profile.id).single();
        if (workerError || !worker) throw new Error("Worker record not found.");
        const d = await fetchWorkerMonthlyDetail(worker.id, monthYear);
        if (!cancelled) setDetail(d);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [monthYear]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("userRole");
    window.location.href = "/login";
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">My Monthly Work</h1>
        <button type="button" onClick={handleLogout} className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-700">Logout</button>
      </header>

      <div className="mb-4">
        <label htmlFor="month" className="block text-xs font-medium text-zinc-500">Month</label>
        <input id="month" type="month" value={monthYear}
          onChange={(e) => setMonthYear(e.target.value)}
          className="mt-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800" />
      </div>

      {loading && <p className="py-8 text-center text-sm text-zinc-500">Loading…</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300" role="alert">{error}</p>}

      {detail && (
        <>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-700">
                <th className="py-2">Date</th><th className="py-2">Shifts</th><th className="py-2 text-right">Earned</th>
              </tr>
            </thead>
            <tbody>
              {detail.days.map((d) => (
                <tr key={d.date} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2">{d.date}</td>
                  <td className={`py-2 ${d.present ? "" : "text-red-500"}`}>{d.label}</td>
                  <td className="py-2 text-right">{d.present ? `₹${d.earning}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-between rounded-lg border border-zinc-200 p-4 font-semibold dark:border-zinc-700">
            <span>Total shifts: {detail.totalShifts}</span>
            <span>Total earned: ₹{detail.totalEarnings}</span>
          </div>
        </>
      )}

      <nav className="mt-8 flex gap-4 text-sm">
        <a href="/worker" className="underline">Dashboard</a>
        <a href="/worker/attendance" className="underline">Attendance</a>
        <a href="/worker/monthly-report" className="underline">My Monthly Work</a>
      </nav>
    </main>
  );
}
```
(Adjust currency symbol to match `rate-display.tsx` conventions.)

- [ ] **Step 2:** Add the same 3-link `<nav>` (Dashboard / Attendance / My Monthly Work) to `app/worker/page.tsx` and `app/worker/attendance/page.tsx` footers, linking `/worker`, `/worker/attendance`, `/worker/monthly-report`.

- [ ] **Step 3:** Manual verify: log in as worker, check month totals match admin Reports summary for same month. Commit: `git commit -am "feat: worker monthly summary page"`
