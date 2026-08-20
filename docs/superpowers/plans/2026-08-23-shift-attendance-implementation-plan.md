# Shift Attendance and Duty Management System - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive web application for managing workers, daily shift attendance, and monthly duty/pay information using Next.js, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, Zod, and Supabase. The system distinguishes between Full Duty and Half Duty shift records with two user roles: Admin and Worker.

**Architecture:** Hybrid Next.js App Router with Server Components for data fetching and Client Components with React Hook Form for interactive UI. All authorization enforced via Supabase Row Level Security (RLS) at the database level. Mobile-first responsive design.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, Zod, Supabase (PostgreSQL, Auth, RLS), Vercel for deployment.

---

## Global Constraints (from Spec)

1. Next.js + TypeScript + Tailwind + shadcn/ui + React Hook Form + Zod
2. Supabase for PostgreSQL, Auth, RLS, API access
3. Frontend: Vercel deployment; Backend/DB/Auth: Supabase
4. Two roles: ADMIN and WORKER (enforced server-side via RLS)
5. Worker-specific Full Duty and Half Duty rates (not global)
6. Max 2 Full Duties per worker per day
7. Max 4 Half Duties per worker per day
8. No mixing Full and Half Duty on same worker/date
9. Slot uniqueness: same worker cannot use same slot twice daily
10. Historical rate preservation via `rate_applied` field
11. Soft delete/deactivation for workers (is_active = false)
12. All authorization via Supabase RLS, NOT frontend-only checks
13. Mobile-first, responsive design
14. 10-phase implementation order (spec Section 26)
15. All 20 acceptance criteria must be met

---

## File Structure Map

```
docs/superpowers/plans/          # Implementation plans
docs/superpowers/specs/          # Design documents (already created)

app/                              # Next.js App Router
  (auth)/
    login/
  admin/
    dashboard/
    workers/
    attendance/
    calendar/
    reports/
    audit-log/
    settings/
  worker/
    dashboard/
    attendance/
    profile/

src/
  components/
    ui/                           # shadcn/ui components
    shared/                       # reusable UI components
    features/
      auth/
      workers/
      attendance/
      reports/
      calendar/
  lib/
    supabase/                     # supabase client configs
  services/                       # business logic services
  schemas/                        # zod validation schemas
  types/                          # TypeScript type definitions

constants/
  duty-types.ts                   # FULL, HALF enum
  roles.ts                        # ADMIN, WORKER enum
  pagination.ts                   # table pagination configs

lib/
  auth.ts                         # auth utilities
  rls-policies.sql                # RLS policy scripts
  duty-service.ts                 # duty recording business logic
  earnings-service.ts             # monthly earnings calculations
  calendar-service.ts              # calendar view logic
```

---

## Implementation Plan

### Task 1: Project Setup Foundation

**Files:**
- Create: `package.json` with initial dependencies
- Create: `tsconfig.json` TypeScript configuration
- Create: `tailwind.config.ts` Tailwind configuration
- Create: `next.config.js` Next.js configuration
- Modify: `app/layout.tsx` root layout with metadata
- Create: `env.d.ts` environment type definitions

**Interfaces:**
- Consumes: None (foundation task)
- Produces: Base project structure

**Steps:**

[ ] **Step 1: Initialize Next.js project with TypeScript**
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
```
Expected: Project scaffolded with Next.js 14, TypeScript, Tailwind CSS

[ ] **Step 2: Install shadcn/ui dependencies**
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input select dialog dropdown-menu table tabs scroll-area accordion
```
Expected: shadcn/ui components installed and configured

[ ] **Step 3: Install Supabase dependencies**
```bash
npm install @supabase/supabase-js @supabase/ui
```
Expected: Supabase JavaScript client and UI components

[ ] **Step 4: Install form and validation dependencies**
```bash
npm install react-hook-form zod
npm install -D @types/react-hook-form @types/zod
```
Expected: React Hook Form and Zod for form validation

[ ] **Step 5: Install date utility dependencies**
```bash
npm install date-fns
```
Expected: date-fns for date handling

[ ] **Step 6: Configure Tailwind CSS for shadcn/ui**
Verify `tailwind.config.ts` includes `classNameVariants` and correct content paths

[ ] **Step 7: Create directory structure**
```bash
mkdir -p src/components/{ui,shared,features/{auth,workers,attendance,reports,calendar}}
mkdir -p src/{lib,services,schemas,types}
mkdir -p constants
mkdir -p docs/superpowers/{specs,plans}
```
Expected: All source directories created

[ ] **Step 8: Verify project runs**
```bash
npm run dev
```
Expected: Next.js dev server starts at http://localhost:3000

**Commit:**
```bash
git add .
git commit -m "feat: project setup with Next.js, TypeScript, Tailwind, shadcn/ui, Supabase"
```

---
### Task 2: Supabase Project Configuration

**Files:**
- Create: `.env.local` with Supabase environment variables (template only)
- Create: `src/lib/supabase/client.ts` Supabase client configuration
- Create: `src/lib/supabase/server-client.ts` Server-side Supabase client
- Create: `src/lib/supabase/rls-policies.sql` RLS policy scripts

**Interfaces:**
- Consumes: None
- Produces: Supabase configured and ready for use

**Steps:**

[ ] **Step 1: Create Supabase project** (user action - create project at supabase.io)

[ ] **Step 2: Set up authentication** in Supabase dashboard
- Enable email/password authentication
- Configure redirect URLs (http://localhost:3000, https://your-vercel-domain.vercel.app)

[ ] **Step 3: Create database tables** using rls-policies.sql (see Task 12 for full schemas)

[ ] **Step 4: Configure RLS policies** for all 5 tables (profiles, workers, duty_records, audit_logs, payouts)

[ ] **Step 5: Add role column to profiles table** with CHECK constraint (`CHECK (role IN ('ADMIN', 'WORKER'))`)

[ ] **Step 6: Set up Supabase Anon Key** and URL in `.env.local` template
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

[ ] **Step 7: Initialize Supabase types**
```bash
npx supabase init
```
Expected: Generates `supabase.ts` with typed interfaces

[ ] **Step 8: Test auth flow** - verify login works locally

**Commit:**
```bash
git add .
git commit -m "feat: Supabase project configuration with auth and RLS setup"
```

---
### Task 3: Authentication & Role Handling

**Files:**
- Create: `src/features/auth/login/page.tsx` login page
- Create: `src/features/auth/auth-provider.tsx` auth provider
- Modify: `app/(auth)/login/page.tsx` auth login route
- Create: `middleware.ts` route protection middleware
- Create: `src/lib/auth.ts` auth utilities

**Interfaces:**
- Consumes: Supabase client from Task 2
- Produces: Authenticated sessions with role detection

**Steps:**

[ ] **Step 1: Create auth provider** wrapping next-auth or supabase client
```typescript
// src/features/auth/auth-provider.tsx
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

[ ] **Step 2: Create login page** with email/password form
```typescript
// Login form with email and password
// On success, get user role from profiles table
```

[ ] **Step 3: Implement role detection** - fetch user's role from profiles table on login
```typescript
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('user_id', user.id)
  .single();
```

[ ] **Step 4: Create middleware.ts** for route protection
```typescript
// Middleware that checks role before allowing access
// /admin/* requires ADMIN role
// /worker/* requires WORKER role
```

[ ] **Step 5: Set up route groups**
- `app/(auth)/login/` - public access (unauthenticated redirected here)
- `app/admin/` - requires ADMIN role
- `app/worker/` - requires WORKER role

[ ] **Step 6: Test login flow**
- Login as admin, verify access to /admin/dashboard
- Login as worker, verify access to /worker/dashboard
- Unauthenticated user redirected to login

[ ] **Step 7: Handle role-based UI rendering**
- Conditionally show/hide admin navigation vs worker navigation
- Per Section 24: Do not expose admin navigation to workers

**Commit:**
```bash
git add .
git commit -m "feat: authentication with role handling and route protection"
```

---
### Task 4: Worker Management - Create/Edit/Deactivate

**Files:**
- Create: `src/features/workers/page.tsx` worker list page (admin)
- Create: `src/features/workers/create-modal.tsx` create worker form
- Create: `src/features/workers/edit-modal.tsx` edit worker form
- Create: `src/components/features/worker-card.tsx` worker display component
- Modify: `app/admin/workers/page.tsx` admin workers page

**Interfaces:**
- Consumes: supabase client, auth context (role = ADMIN)
- Produces: CRUD operations for workers

**Steps:**

[ ] **Step 1: Create worker schema** with Zod validation
```typescript
import { z } from 'zod';

export const workerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  full_duty_rate: z.number().int().positive('Full duty rate must be positive'),
  half_duty_rate: z.number().int().positive('Half duty rate must be positive'),
  is_active: z.boolean().default(true),
});
```

[ ] **Step 2: Create create worker form** using React Hook Form + Zod
```typescript
// Form with name, email, full_duty_rate, half_duty_rate, is_active toggle
// On success, create profile + worker records
// Link profile_id between profiles and workers tables
```

[ ] **Step 3: Implement create worker logic**
1. Create profile in `profiles` table (user_id from auth, role=WORKER, name, email, phone)
2. Create worker in `workers` table (profile_id, full_duty_rate, half_duty_rate, is_active=true)

[ ] **Step 4: Create edit worker form** pre-filled with current data
- Can modify: name, email, full_duty_rate, half_duty_rate, is_active
- Rate changes should NOT affect historical duty records (per Section 14)

[ ] **Step 5: Implement soft delete/deactivate**
- Set `is_active = false` on profile and worker records
- Worker cannot log in when deactivated (handle in auth flow)
- Worker does not appear in active worker list (RLS filter)

[ ] **Step 6: Create worker list page** (admin only)
- Show only active workers
- Each worker card shows: name, full_duty_rate, half_duty_rate, status
- Edit and deactivate buttons per worker

[ ] **Step 7: Test worker CRUD**
- Create admin, create 2-3 workers with different rates
- Edit worker rates
- Deactivate worker, verify they disappear from list and cannot log in
- Reactivate by setting is_active = true

**Commit:**
```bash
git add .
git commit -m "feat: worker management with CRUD and soft delete"
```

---
### Task 5: Duty Recording Business Rules

**Files:**
- Create: `src/features/attendance/page.tsx` worker duty recording page
- Create: `src/features/attendance/duty-form.tsx` duty type selection form
- Create: `src/features/attendance/rate-display.tsx` rate with historical notice
- Create: `src/services/duty-service.ts` business logic for duty enforcement
- Modify: `app/worker/attendance/page.tsx` worker attendance page

**Interfaces:**
- Consumes: auth context (role = WORKER), worker id, date selection
- Produces: Duty record creation with business rule enforcement

**Steps:**

[ ] **Step 1: Create duty service** with business rule enforcement
```typescript
// src/services/duty-service.ts

export async function canRecordDuty(
  workerId: string,
  date: string,
  dutyType: 'FULL' | 'HALF'
): Promise<{ allowed: boolean; reason: string; remainingFull?: number; remainingHalf?: number }> {
  // Check: max 2 Full per worker per date
  // Check: max 4 Half per worker per date
  // Check: No mixing FULL + HALF on same worker/date
  // Query duty_records for this worker/date
}

export async function recordDuty(
  workerId: string,
  date: string,
  dutyType: 'FULL' | 'HALF',
  slotNumber: number,
  rateApplied: number,
  createdBy: string
): Promise<duty_record> {
  // Insert duty_record with rate_applied
  // Also log to audit_logs
}
```

[ ] **Step 2: Implement date selection** via calendar picker
- Allow worker to select any date (per Section 11: design for future policies)
- Use native date picker or shadcn/ui DatePicker

[ ] **Step 3: Implement Full Duty recording**
- Show "Add Full Duty" button
- If clicked, record FULL duty in slot 1 or 2
- Max 2 per day - disable after 2 recorded
- Store `rate_applied` from worker's current full_duty_rate

[ ] **Step 4: Implement Half Duty recording**
- Show "Add Half Duty" button
- If clicked, record HALF duty in slot 1, 2, 3, or 4
- Max 4 per day - disable after 4 recorded
- Store `rate_applied` from worker's current half_duty_rate

[ ] **Step 5: Implement no-mixing rule**
- If worker has any FULL duty recorded for date, HALF becomes disabled and vice versa
- UI clearly shows: "Full Duty already recorded for today - Half Duty unavailable"
- Or: "Half Duty already recorded for today - Full Duty unavailable"

[ ] **Step 6: Show remaining slots**
- Display: "You have 1 Full Duty remaining today"
- Display: "You have 3 Half Duties remaining today"
- Visual progress bar or count

[ ] **Step 7: Implement rate_applied storage**
- When recording duty, use worker's current rate as `rate_applied`
- Mark duty record with: "Rate at time of recording: ₹X"
- Future rate changes won't affect this record

[ ] **Step 8: View today's records**
- After recording, show summary of duties for selected date
- Can remove own records (with confirmation, or admin-only removal)
- Per Section 19: Worker should see "View Today's Records"

**Commit:**
```bash
git add .
git commit -m "feat: duty recording with business rule enforcement"
```

---
### Task 6: Admin Attendance View

**Files:**
- Create: `src/features/admin/attendance/page.tsx` admin attendance view
- Create: `src/components/admin/filters/attendance-filters.tsx` filter bar
- Create: `src/components/admin/records/attendance-table.tsx` records table
- Create: `src/components/admin/actions/record-actions.tsx` edit/remove actions
- Modify: `app/admin/attendance/page.tsx` admin attendance page

**Interfaces:**
- Consumes: supabase client, auth context (role = ADMIN)
- Produces: Filterable view of all duty records

**Steps:**

[ ] **Step 1: Create filter bar** with date/month/worker/duty-type selectors
- Date picker: select specific date
- Month selector: select month/year (e.g., "August 2026")
- Worker dropdown: filter by specific worker
- Duty type filter: FULL / HALF / ALL

[ ] **Step 2: Implement records table** showing all duty records
Columns: Date | Worker | Type | Slot | Amount (rate_applied)
- Filter results update table dynamically
- Pagination for large datasets

[ ] **Step 3: Implement edit record functionality**
- Admin can click "Correct" on any duty record
- Open form to modify (or remove and re-add)
- Show old value vs new value for audit trail
- After correction, log to audit_logs

[ ] **Step 4: Implement remove/delete record**
- Admin can remove incorrect duty record
- Show confirmation dialog: "This will remove the duty record. Continue?"
- After deletion, log to audit_logs
- Historical data preserved (soft remove, not cascading delete)

[ ] **Step 5: Calculate and display totals** at bottom of table
- Full Duty count
- Half Duty count
- Total duty records
- Total earnings (using rate_applied from each record)

[ ] **Step 6: Add worker filtering**
- Dropdown to select specific worker
- Table updates to show only that worker's records

[ ] **Step 7: Add duty type filtering**
- Toggle FULL/HALF/ALL
- Table filters accordingly

[ ] **Step 8: Test admin attendance view**
- Create multiple workers with duties
- Filter by date, month, worker, duty type
- Edit and remove records
- Verify audit log entries created

**Commit:**
```bash
git add .
git commit -m "feat: admin attendance view with filters and corrections"
```

---
### Task 7: Monthly Reports & Earnings Calculation

**Files:**
- Create: `src/features/reports/monthly/page.tsx` monthly reports page
- Create: `src/components/reports/monthly/worker-summary.tsx` worker summary card
- Create: `src/components/reports/monthly/earnings-breakdown.tsx` earnings detail
- Modify: `app/admin/reports/page.tsx` admin reports page

**Interfaces:**
- Consumes: auth context (role = ADMIN), month/year selector
- Produces: Worker monthly summary with Full/Half/Total counts and earnings

**Steps:**

[ ] **Step 1: Create month/year selector**
- Dropdown or calendar to select month (e.g., "August 2026")
- Format: "2026-08" or full display "August 2026"

[ ] **Step 2: Fetch worker monthly summaries**
- Query duty_records for selected month
- Group by worker_id
- For each worker, count: Full duties, Half duties, Total duties
- Calculate earnings: SUM of rate_applied for Full + SUM of rate_applied for Half

[ ] **Step 3: Create worker summary component**
```typescript
interface WorkerMonthlySummary {
  workerId: string;
  fullCount: number;
  halfCount: number;
  totalCount: number;
  earnings: number;  // calculated from rate_applied
}
```

[ ] **Step 4: Display earnings breakdown** per worker
```
Arun:
  18 Full × ₹1,000 = ₹18,000
    6 Half × ₹500   = ₹3,000
  Total = ₹21,000
```

[ ] **Step 5: Add payment status tracking**
- Each worker summary includes payment_status: UNPAID | PARTIALLY_PAID | PAID
- Visual indicator (color-coded badge)
- Per Sections 13 and 15 recommendations

[ ] **Step 6: Create payout/settlement table** (optional per Sections 13/15)
- SQL table structure as defined in spec Section 15
- Form to record actual transactions
- Fields: amount_paid, payment_date, payment_method (UPI/Cash/Bank Transfer), notes

[ ] **Step 7: Filter by month** across all reports
- Previous month, current month, custom date range
- Navigation: ← Previous, Next →

[ ] **Step 8: Test earnings calculations**
- Create workers with known rates
- Record duties for a month
- Verify: earnings = (full_count × full_rate) + (half_count × half_rate)
- Verify historical rates preserved when rates change
- Verify payment status badges work

**Commit:**
```bash
git add .
git commit -m "feat: monthly reports with earnings calculation and payment status"
```

---
### Task 8: Calendar View

**Files:**
- Create: `src/features/calendar/page.tsx` monthly calendar view
- Create: `src/components/calendar/calendar-grid.tsx` calendar grid component
- Create: `src/components/calendar/day-cell.tsx` individual day cell
- Modify: `app/admin/calendar/page.tsx` admin calendar page

**Interfaces:**
- Consumes: auth context, worker filtering, month/year data
- Produces: Visual monthly calendar with duty indicators

**Steps:**

[ ] **Step 1: Create calendar grid component**
- Render days of selected month (Mon-Sun header)
- Each day cell shows duty status
- Support worker filtering (show duties for specific worker or all)

[ ] **Step 2: Implement visual indicators per cell**
- No duty: empty or light background
- Full Duty: colored indicator (e.g., green dot)
- Half Duty: colored indicator (e.g., yellow dot)
- Multiple duties: number badge showing count
- For multiple duty types: show F/H iconography

[ ] **Step 3: Design for easy scanning** (per Section 19)
- Quick visual scan of entire month
- Color scheme consistent with app theme
- Mobile: scrollable month view, tap day for details
- Desktop: full grid visible, hover for details

[ ] **Step 4: Implement worker filtering**
- Dropdown to select specific worker
- Or toggle: "Show All Workers" / "Show My Duties"

[ ] **Step 5: Add date navigation**
- Previous month / Next month buttons
- Jump to specific month/year

[ ] **Step 6: Responsive design**
- Mobile: single column, swipe left/right for months
- Tablet: two-column or compact grid
- Desktop: full 7-day grid visible

[ ] **Step 7: Test calendar view**
- Create duties across multiple dates/months
- Verify visual indicators match actual duty records
- Test worker filtering
- Test mobile responsiveness

**Commit:**
```bash
git add .
git commit -m "feat: calendar view with visual duty indicators"
```

---
### Task 9: Audit Logs

**Files:**
- Create: `src/lib/audit-logger.ts` audit logging utility
- Create: `src/features/audit-log/page.tsx` admin audit log view
- Modify: `src/services/duty-service.ts` to auto-log duty actions
- Modify: Admin forms to log rate changes and worker changes

**Interfaces:**
- Consumes: actor_user_id, action, entity_type, entity_id, old_value, new_value
- Produces: Audit trail of all important actions

**Steps:**

[ ] **Step 1: Create audit log schema** (ensure database table exists)
- Per spec Section 21: id, actor_user_id, action, entity_type, entity_id, old_value, new_value, created_at

[ ] **Step 2: Create audit logger utility**
```typescript
// src/lib/audit-logger.ts
export async function logAction({
  actorUserId: string,
  action: string,        // e.g., 'CREATE_WORKER', 'CHANGE_RATE', 'CORRECT_DUTY'
  entityType: string,    // e.g., 'worker', 'duty_record'
  entityId: string,      // record UUID
  oldValue: string | null,
  newValue: string | null,
}) {
  await supabase.from('audit_logs').insert({...});
}
```

[ ] **Step 3: Auto-log worker creation**
- When admin creates a worker, log: CREATE_WORKER
- Actor: admin user_id
- Entity: worker record id
- Old: null, New: worker details summary

[ ] **Step 4: Auto-log rate changes**
- When admin changes worker's full_duty_rate or half_duty_rate, log: CHANGE_RATE
- Capture old_rate and new_rate in old_value/new_value

[ ] **Step 5: Auto-log duty recording**
- Per Task 5: When duty recorded, log: RECORD_DUTY
- Actor: worker's user_id (for worker-created) or admin_user_id (for admin-created)
- Entity: duty_record id
- Old: null, New: duty details (date, type, slot)

[ ] **Step 6: Auto-log duty corrections/deletions**
- When admin edits or removes a duty record, log: CORRECT_DUTY or DELETE_DUTY
- Capture old duty details vs new/details

[ ] **Step 7: Create admin audit log view**
- Filter by action type, date range, actor
- Pagination for long lists
- Search capability
- Show: who did what, when, old value, new value

[ ] **Step 8: Test audit trail**
- Create worker → verify audit log entry
- Change rate → verify audit log entry
- Record duty → verify audit log entry
- Correct duty → verify audit log entry
- Delete duty → verify audit log entry

**Commit:**
```bash
git add .
git commit -m "feat: audit trail logging for all administrative actions"
```

---
### Task 10: UI Polish & Mobile Responsiveness

**Files:**
- Create: All responsive UI components with mobile-first breakpoints
- Create: Loading states, empty states, error handling
- Create: Confirmation dialogs for destructive actions
- Modify: All pages for consistent design and accessibility

**Interfaces:**
- Consumes: design system tokens, color palette, typography scale
- Produces: Polished, production-ready UI

**Steps:**

[ ] **Step 1: Implement mobile-first breakpoints**
- `<640px`: Mobile - single column, large tap targets
- `640-1024px`: Tablet - two-column, collapsible panels
- `>1024px`: Desktop - full grid, multi-panel layouts

[ ] **Step 2: Add loading states** to all data-fetching components
- Shadcn/ui skeleton or spinner
- Disable interaction during load
- Show meaningful text ("Loading duties...")

[ ] **Step 3: Add empty states** when no records exist
- Friendly message: "No duties recorded for this date"
- Call-to-action: "Add your first Full Duty"
- Illustrative graphic or icon

[ ] **Step 4: Add error handling** for API failures
- User-friendly error messages
- "Failed to load duties. Please try again."
- Option to retry

[ ] **Step 5: Add confirmation dialogs** for destructive actions
- Delete worker: "Are you sure you want to deactivate this worker? Historical data will be retained."
- Remove duty record: "This will remove the duty record. Continue?"
- Rate changes affecting historical data warning

[ ] **Step 6: Verify accessibility** (a11y)
- Color contrast ratios meet WCAG AA
- Keyboard navigation works throughout
- ARIA labels on interactive elements
- Focus management in modals and dialogs

[ ] **Step 7: Test on mobile devices** (or browser devtools)
- Navigate complete worker flow: login → select date → record duty → view records
- Navigate complete admin flow: login → manage workers → view attendance → correct records
- Verify mobile calendar grid works
- Verify responsive navigation (hamburger menu)

[ ] **Step 8: Cross-browser testing**
- Chrome, Firefox, Safari compatibility
- Verify Supabase auth works across browsers
- Verify Tailwind rendering consistency

[ ] **Step 9: Final design review** against all 29 acceptance criteria
- Confirm all 20+ criteria met
- Verify business rules enforced correctly
- Verify mobile responsiveness
- Verify RLS policies working (try accessing as wrong role)

**Commit:**
```bash
git add .
git commit -m "feat: UI polish with mobile responsiveness and accessibility"
```

---
### Task 11: Deployment Configuration

**Files:**
- Create: `vercel.json` Vercel deployment config
- Modify: `next.config.js` for production optimizations
- Modify: `.env.production` production environment variables
- Create: Supabase production RLS verification script

**Interfaces:**
- Consumes: production-ready code from Tasks 1-10
- Produces: Live application at Vercel domain

**Steps:**

[ ] **Step 1: Configure Vercel deployment**
```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "output": "export"
}
```

[ ] **Step 2: Set production environment variables** in Vercel dashboard
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Any other env vars needed

[ ] **Step 3: Configure Supabase for production**
- Enable production RLS policies
- Verify all policies work with production URLs
- Set up custom domains if needed

[ ] **Step 4: Run production build**
```bash
npm run build
```
Expected: Successful production build

[ ] **Step 5: Deploy to Vercel**
```bash
vercel
vercel --prod
```
Expected: Application live at Vercel domain

[ ] **Step 6: Verify production deployment**
- Login as admin, verify all features work
- Login as worker, verify all features work
- Test RLS policies in production
- Verify mobile responsiveness still works

[ ] **Step 7: Set up Supabase backups** (production best practice)
- Enable point-in-time recovery
- Configure backup retention policy

[ ] **Step 8: Document deployment process**
- README with deployment steps
- Environment variable requirements
- RLS policy verification checklist

**Commit:**
```bash
git add .
git commit -m "feat: deployment configuration for Vercel + Supabase production"
```

---
### Task 12: Final Verification & Acceptance Criteria

**Files:**
- Run comprehensive tests against all 29 acceptance criteria
- Fix any failing criteria
- Final code review
- Prepare deployment checklist

**Interfaces:**
- Consumes: completed code from all previous tasks
- Produces: verified, working application meeting all acceptance criteria

**Steps:**

[ ] **Step 1: Verify all 29 acceptance criteria**
Create a test checklist referencing each criterion:

1. ✅ Admin can log in - Test admin authentication flow
2. ✅ Admin can create workers - Test worker creation with different rates
3. ✅ Admin can set different Full and Half rates - Verify worker-specific rates
4. ✅ Workers can log in - Test worker authentication flow
5. ✅ Workers can only access their own information - Test RLS policies
6. ✅ Workers can select dates and record duties - Test worker duty recording flow
7. ✅ Max 2 Full Duties per worker/day enforced - Test exceeding limit
8. ✅ Max 4 Half Duties per worker/day enforced - Test exceeding limit
9. ✅ Full and Half cannot be mixed - Test mixed duty prevention
10. ✅ Admin can view all attendance - Test admin attendance view
11. ✅ Admin can correct/remove attendance - Test edit/remove functionality
12. ✅ Admin can deactivate workers - Test soft delete
13. ✅ Historical attendance available after deactivation - Verify data retention
14. ✅ Monthly Full/Half/Total counts displayed - Test monthly reports
15. ✅ Monthly earnings calculated correctly - Verify earnings = (full×rate) + (half×rate)
16. ✅ Historical duty rates unchanged after rate changes - Test rate change doesn't affect old records
17. ✅ RLS prevents workers from other workers' data - Test cross-worker access denial
18. ✅ Mobile-friendly application - Test on mobile/browser devtools
19. ✅ Admin dashboard provides overall view - Verify dashboard statistics
20. ✅ App deployable via Vercel + Supabase - Test deployment

[ ] **Step 2: Run manual testing** of critical user flows
- Admin flow: login → create workers → record duties (as worker) → view attendance → deactivate worker → monthly reports
- Worker flow: login → select date → record duty → view today's records → view profile

[ ] **Step 3: Fix any failing criteria**
- If any acceptance criterion fails, create tasks to fix
- Commit fixes with clear messages

[ ] **Step 4: Performance testing**
- Verify page load times
- Test with large number of duty records (stress test)
- Verify database query performance with RLS policies

[ ] **Step 5: Security testing**
- Verify RLS blocks unauthorized access
- Test that frontend-only role checks are insufficient (try API calls directly)
- Verify no secrets in client-side code
- Check Supabase dashboard for RLS policy status

[ ] **Step 6: Final deployment verification**
- Deploy to production (or verify production if already deployed)
- Run acceptance criteria checklist against production
- Confirm all criteria met before considering complete

**Commit:**
```bash
git add .
git commit -m "feat: final verification of all 29 acceptance criteria"
```