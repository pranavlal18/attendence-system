# Spec: Duty Budget Rules + Attendance Reports

**Date:** 2026-08-21
**Status:** Approved by user (pending file commit)

## 1. Duty Budget Rules (replaces existing per-worker rules)

**Unit model:** FULL = 2 units, HALF = 1 unit.

**Rules:**
1. **Team budget:** Sum of units across ALL workers per calendar date ≤ **4**
2. **Per worker/day:** max **2 FULL**, max **1 HALF**, mixing allowed
3. Old rules removed: no-mixing ban, HALF_MAX=4

**Validation examples (must all pass/fail correctly):**

| Scenario | Units | Result |
|---|---|---|
| a: 2 FULL | 4/4 | b, c blocked |
| a: 1 FULL | 2/4 | b: H + c: H allowed |
| a: H | 1/4 | b: F + c: H allowed |
| a: F + b: F | 4/4 | c blocked |
| a: F + H | 3/4 | one more H allowed team-wide |
| any worker: 2nd HALF | — | blocked (max 1/person) |
| anyone: H + 2F | 5 | blocked (over budget) |

**Enforcement layers (all updated):**
- `constants/duty-types.ts`: replace `FULL_MAX=2`/`HALF_MAX=4` with `FULL_UNITS=2`, `HALF_UNITS=1`, `DAILY_TEAM_BUDGET=4`, `WORKER_MAX_FULL=2`, `WORKER_MAX_HALF=1`
- `src/services/duty-service.ts` → rewrite `canRecordDuty()`: fetch all workers' records for date, sum units; return `{allowed, reason, usedUnits, remainingUnits}`; add optional `excludeRecordId` param so admin corrections don't double-count the record being replaced
- New Supabase migration: replace `enforce_duty_business_rules()` trigger to enforce team budget across all workers + per-worker caps
- `src/schemas/duty.ts`: update Zod refinements
- `src/features/attendance/duty-form.tsx`: show "X / 4 units used", disable FULL button when < 2 remain, HALF when < 1 remain; clear reason messages
- Historical data untouched; rules apply to new records only

## 2. Admin Printable Attendance Report

**Location:** `app/admin/reports/page.tsx` — new "Print Attendance Sheet" section.

**Inputs:** month selector (existing pattern), end-date picker defaulting to today (clamped to month).

**Output grid:** rows = active workers; columns = day numbers 1 → end-date.
Cell values: `F` (1 full), `F+F`, `H`, `F+H`, `A` (absent — no record that day), blank for future days.

**Print:** dedicated print stylesheet (`@media print`) hiding nav/controls; button calls `window.print()`.

**Service:** new `fetchAttendanceMatrix(monthYear, endDate)` in `src/services/report-service.ts` returning `{workers: [{id, name, days: Map<dayNum, cellValue>}], dates}`.

## 3. Worker Monthly Summary Tab

**Location:** new page `app/worker/monthly-report/page.tsx` ("My Monthly Work") + nav links from worker dashboard and attendance pages.

**Content:**
- Month selector (default current month)
- Per-day list: date, duties done ("1 Full", "1 Full + 1 Half", …), earning that day
- Days with no duty marked absent
- Footer totals: total shifts, total earnings for month — summed from `rate_applied` snapshots

**Service:** new `fetchWorkerMonthlyDetail(workerId, monthYear)` in report-service.

## 4. Non-goals
- No DB schema migration (all data exists)
- No changes to payouts logic
- No backfilling/correcting historical records

## 5. Testing / verification
- Unit-test `canRecordDuty()` against every scenario in the table above, plus correction-path exclusion
- Manual verify: trigger rejects over-budget inserts via direct SQL; matrix matches duty_records; worker totals match admin summary totals