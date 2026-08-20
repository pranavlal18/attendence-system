# Shift Attendance and Duty Management System - Design Document

## Project Overview

A responsive web application for managing workers, daily shift attendance, and monthly duty/pay information. The system distinguishes between **Full Duty** and **Half Duty** shift records, with two user roles: **Admin** and **Worker**.

---

## 1. Architecture Overview

### 1.1 Technology Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Forms:** React Hook Form + Zod validation
- **Backend:** Supabase (PostgreSQL, Auth, RLS)
- **Deployment:** Frontend on Vercel, Backend/DB/Auth on Supabase

### 1.2 Project Structure

```
app/
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
    ui/                    # shadcn/ui components
    shared/                # reusable UI (buttons, inputs, etc.)
  features/
    auth/                  # auth logic
    workers/               # worker management logic
    attendance/            # duty recording logic
    reports/               # monthly reports logic
    calendar/              # calendar view logic
  lib/
    supabase/              # supabase client configs
  services/                # business logic services
  schemas/                 # zod validation schemas
  types/                   # TypeScript type definitions

constants/
  duty-types.ts            # FULL, HALB enum
  roles.ts                 # ADMIN, WORKER enum
```

### 1.3 Approach: Hybrid (Server + Client)

- **Server Components:** Data fetching, lists, reads (dashboard stats, worker lists, calendar grids)
- **Client Components:** Interactive forms, React Hook Form, date pickups, interactive tables
- **Supabase Server Client:** For RLS, auth, and all database operations
- **Route Protection:** Middleware or `auth` middleware to enforce role-based routing

---

## 2. Database Schema

### 2.1 profiles Table

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(10) CHECK (role IN ('ADMIN', 'WORKER')) NOT NULL DEFAULT 'WORKER',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Role values:** `ADMIN`, `WORKER`

---

### 2.2 workers Table

```sql
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  full_duty_rate INTEGER NOT NULL DEFAULT 1000,
  half_duty_rate INTEGER NOT NULL DEFAULT 500,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key point:** `full_duty_rate` and `half_duty_rate` are worker-specific (not global).

---

### 2.3 duty_records Table

```sql
CREATE TABLE duty_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  duty_type VARCHAR(10) CHECK (duty_type IN ('FULL', 'HALF')) NOT NULL,
  slot_number INTEGER NOT NULL,
  rate_applied INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

**Critical field:** `rate_applied` preserves the rate at time of recording (historical accuracy).

**Indexes for performance:**
- `(worker_id, date)` - for quick lookups of a worker's duties on a date
- `(date, duty_type)` - for admin filtering
- `(worker_id, date, duty_type)` - for constraint enforcement

---

### 2.4 audit_logs Table (Recommended)

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) NOT NULL,
  action VARCHAR(50) NOT NULL,  -- e.g., 'CREATE_WORKER', 'CHANGE_RATE', 'CORRECT_DUTY'
  entity_type VARCHAR(50) NOT NULL,  -- e.g., 'worker', 'duty_record'
  entity_id UUID NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### 2.5 payouts Table (Recommended Addition)

```sql
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES workers(id) NOT NULL,
  month_year VARCHAR(7) NOT NULL,  -- e.g., '2026-07'
  amount_paid INTEGER NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50),  -- 'UPI', 'Cash', 'Bank Transfer'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 3. Supabase Row Level Security (RLS) Policies

### 3.1 Worker Policies

**Workers can:**
```sql
-- Own profile
SELECT ON profiles FOR SELECT USING (auth.uid() = user_id);

-- Own duty records
SELECT ON duty_records FOR SELECT USING (worker_id IN (
  SELECT id FROM workers WHERE profile_id = auth.uid()
));

-- Insert own duty records
INSERT ON duty_records WITH CHECK (worker_id IN (
  SELECT id FROM workers WHERE profile_id = auth.uid()
));
```

**Workers cannot:**
- SELECT another worker's records
- UPDATE another worker's records
- DELETE another worker's records
- CREATE workers
- DELETE workers
- CHANGE rates
- ACCESS admin data

---

### 3.2 Admin Policies

**Admins can:**
```sql
-- CREATE workers
INSERT INTO profiles ...;
INSERT INTO workers ...;

-- READ all workers
SELECT ON profiles FOR SELECT USING (true);  -- or check role
SELECT ON workers FOR SELECT USING (true);

-- UPDATE workers (including rate changes)
UPDATE profiles ...;
UPDATE workers ...;

-- DEACTIVATE workers (soft delete)
UPDATE profiles SET is_active = false WHERE id = ...;

-- READ all duty records
SELECT ON duty_records FOR SELECT USING (true);

-- CREATE/correct/delete duty records
INSERT ON duty_records ...;
UPDATE duty_records ...;
DELETE FROM duty_records ...;

-- VIEW reports
SELECT on audit_logs, etc.
```

**Admins cannot:**
- Nothing (full access within role)

---

### 3.3 RLS Enforcement Note

**All authorization must be enforced through Supabase/database policies.** Do not trust frontend role checks alone. Even if a worker manually calls the API or changes a request, the database must reject unauthorized operations.

---

## 4. Business Rules & Constraints

### 4.1 Per-Worker Per-Date Limits

| Rule | Database Constraint | Implementation |
|------|---------------------|----------------|
| Max 2 FULL records per worker per date | Partial unique index or trigger | Check before INSERT |
| Max 4 HALF records per worker per date | Partial unique index or trigger | Check before INSERT |
| No mixing FULL + HALF on same worker/date | Total count check + constraint | Enforce in service layer + RLS |

### 4.2 Slot Uniqueness

```sql
-- Same worker cannot use same slot twice on same date
CREATE UNIQUE INDEX idx_duty_slots ON duty_records (worker_id, date, slot_number);
```

### 4.3 Historical Rate Preservation

- `rate_applied` field stores the rate at time of duty recording
- When admin changes worker's rate later, previously recorded duties use `rate_applied`, not current rate
- Future duties use the updated rate

### 4.4 Date Restrictions (Future-Proofing)

- Initial version: workers can select any date via calendar
- Designed for later configurable policies:
  - Only today
  - Today and previous N days
  - Current month only
  - Admin-controlled date range

---

## 5. UI/UX Design

### 5.1 Worker Dashboard Flow

```
📅 Select Date (calendar picker)
    ↓
⚡ Select Duty Type (Full/Half)
    ↓
📝 Record Duty (one-tap action)
    ↓
📊 View Today's Records (swipeable)
```

**Mobile States:**
- **No duties recorded:** "Add Full Duty" / "Add Half Duty" buttons
- **Duties recorded:** Show entries with option to remove (admin only)
- **Limits reached:** Display "Maximum 2 Full Duties reached for today"

**Visual Indicators:**
- Progress bar showing slots used / total available
- Disabled opposite duty type once any duty recorded for that date
- Clear "Full" vs "Half" distinction with color coding

### 5.2 Admin Dashboard Flow

**Overview Section:**
```
Total Active Workers: 4
Full Duties Today: 6
Half Duties Today: 22
Total Earnings Today: ₹78,500
```

**Filter Controls:**
- Date picker
- Month selector
- Worker dropdown
- Duty type filter (FULL/HALB/ALL)

**Worker Details Section:**
```
Worker: Arun
Full Duty Rate: ₹1,000
Half Duty Rate: ₹500

Attendance:
  Today: 1 Full, 2 Half
  This Week: 5 Full, 8 Half
  This Month: 18 Full, 6 Half

Earnings:
  This Month: ₹21,000
    18 × ₹1,000 + 6 × ₹500 = ₹21,000
```

### 5.3 Mobile-First Responsive Design

| Breakpoint | Layout | Key Features |
|------------|--------|--------------|
| <640px (Mobile) | Single column | Large tap targets, native date picker, stacked forms |
| 640-1024px (Tablet) | Two-column | Collapsible panels, summarized stats |
| >1024px (Desktop) | Full grid | Multi-filter panels, calendar grid view, detailed tables |

**Touch Guidelines:**
- Minimum 44px height for tap targets
- Adequate spacing between interactive elements
- Native scrolling where possible
- Hamburger menu for admin navigation on mobile

### 5.4 Key UI Components

- `CalendarPicker` - month/date selection
- `DutyForm` - React Hook Form schema with Zod validation
- `DutyRecordCard` - individual duty entry display
- `RateDisplay` - shows rate_applied with historical notice
- `FilterBar` - date/month/worker/type filters
- `EmptyState` - when no records exist
- `ConfirmationDialog` - for delete/correct actions

---

## 6. Implementation Phases

### Phase 1: Project Setup
- [x] Next.js with TypeScript
- [x] Tailwind CSS configuration
- [x] shadcn/ui installation
- [x] Supabase project creation
- [x] Environment variables config
- [x] Directory structure setup

### Phase 2: Authentication & Roles
- [ ] Supabase Auth setup (email/password)
- [ ] Role column in profiles table
- [ ] Route protection middleware
- [ ] Admin vs Worker routing
- [ ] Supabase RLS policies creation

### Phase 3: Worker Management
- [ ] Create worker form (admin)
- [ ] Worker list page (admin)
- [ ] Edit worker functionality
- [ ] Soft delete / deactivate worker
- [ ] Worker details page

### Phase 4: Duty Recording (Business Rules)
- [ ] Date selection component
- [ ] Full Duty recording with max 2 limit
- [ ] Half Duty recording with max 4 limit
- [ ] No-mixing rule enforcement
- [ ] rate_applied field storage
- [ ] UI: disable opposite type after duty recorded

### Phase 5: Admin Attendance View
- [ ] All records table
- [ ] Date/month/worker/type filters
- [ ] Edit/remove record functionality
- [ ] Confirmation dialogs
- [ ] Audit trail logging

### Phase 6: Monthly Reports
- [ ] Month selector
- [ ] Worker summary table
- [ ] Earnings calculation (rate_applied based)
- [ ] Payment status tracking (UNPAID/PARTIALLY_PAID/PAID)
- [ ] Payout/settlement table

### Phase 7: Calendar View
- [ ] Monthly calendar grid
- [ ] Visual indicators per cell (No/Full/Half/Multiple)
- [ ] Worker filtering
- [ ] Easy scan visual design

### Phase 8: Audit Logs
- [ ] audit_logs table
- [ ] Log administrative actions
- [ ] Log duty corrections
- [ ] Log rate changes
- [ ] Log worker account changes

### Phase 9: UI Polish
- [ ] Loading states
- [ ] Empty states
- [ ] Error handling
- [ ] Mobile responsiveness verification
- [ ] Confirmation dialogs for destructive actions
- [ ] Accessibility review

### Phase 10: Deployment
- [ ] Vercel deployment
- [ ] Supabase production config
- [ ] Environment variables setup
- [ ] RLS policies verification in production
- [ ] Final testing

---

## 7. Acceptance Criteria Mapping

| # | Criteria | Status |
|---|----------|--------|
| 1 | Admin can log in | ✅ Phase 2 |
| 2 | Admin can create workers | ✅ Phase 3 |
| 3 | Admin can set different Full and Half rates | ✅ Phase 3 (worker-specific rates) |
| 4 | Workers can log in | ✅ Phase 2 |
| 5 | Workers can only access their own information | ✅ Phase 2 (RLS) |
| 6 | Workers can select dates and record duties | ✅ Phase 4 |
| 7 | Max 2 Full Duties per worker/day enforced | ✅ Phase 4 (database + UI) |
| 8 | Max 4 Half Duties per worker/day enforced | ✅ Phase 4 (database + UI) |
| 9 | Full and Half cannot be mixed | ✅ Phase 4 (business rule + RLS) |
| 10 | Admin can view all attendance | ✅ Phase 5 |
| 11 | Admin can correct/remove attendance | ✅ Phase 5 |
| 12 | Admin can deactivate workers | ✅ Phase 3 |
| 13 | Historical attendance available after deactivation | ✅ Soft delete approach (Phase 3) |
| 14 | Monthly Full/Half/Total counts displayed | ✅ Phase 6 |
| 15 | Monthly earnings calculated correctly | ✅ Phase 6 (rate_applied based) |
| 16 | Historical duty rates unchanged after rate changes | ✅ rate_applied field (Phase 4) |
| 17 | RLS prevents workers from other workers' data | ✅ Phase 2 (RLS policies) |
| 18 | Mobile-friendly application | ✅ Phase 9 (mobile-first design) |
| 19 | Admin dashboard provides overall view | ✅ Phase 5 (overview section) |
| 20 | App deployable via Vercel + Supabase | ✅ Phase 10 |

---

## 8. Security Summary

### Worker Permissions (Supabase RLS)
```
SELECT own profile
SELECT own duty records
INSERT own duty records
```

### Admin Permissions (Supabase RLS)
```
CREATE workers
READ all workers
UPDATE workers
DEACTIVATE workers
READ all duty records
CREATE/correct/delete duty records
VIEW reports
```

**Critical:** Do not trust frontend role checks alone. All authorization enforced through Supabase/database policies.

---

## 9. Audit Trail Summary

**Recommended actions to log:**
- Admin created worker
- Admin deactivated worker
- Admin changed worker rate
- Worker added duty
- Admin deleted duty
- Admin corrected duty

**audit_logs fields:** actor_user_id, action, entity_type, entity_id, old_value, new_value, created_at

---

## 10. Development Order & Priority

**Most Important (in order):**
1. Authentication ✅
2. Roles ✅
3. Workers ✅
4. Duty records ✅
5. Business rules ✅
6. Monthly calculation ✅
7. UI polish ✅

> "Every business rule affecting attendance or money must be enforced on the backend/database side and not only through UI restrictions."

---

*Design Document Generated: 2026-08-23*
*Project: Shift Attendance and Duty Management System*