# Shift Attendance System

A full-featured Next.js 16 attendance management system built with React 19, Tailwind CSS, and Supabase. Track daily duties (FULL/HALF), manage workers, view earnings, and maintain complete audit trails.

![Next.js](https://img.shields.io/badge/Next.js-16.3.1-black)
![React](https://img.shields.io/badge/React-19.2.8-black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0.0-black)
![Supabase](https://img.shields.io/badge/Supabase-2.109.0-black)

## 📋 Overview

The **Shift Attendance System** manages daily duty records for workers with intelligent business rules around duty scheduling. Admins can also add, remove, correct, and convert duties while maintaining complete audit logs. Workers can record their own duties and view their attendance history.

### Core Business Rules
- **Team budget**: 4 units/day across ALL workers (FULL = 2 units, HALF = 1 unit)
- **Per worker/day caps**: max **2 FULL** + max **1 HALF** duties (mixing FULL and HALF allowed)
- **2 HALF duties = 1 FULL duty** equivalent (business equivalence)
- **Slot uniqueness**: each worker can only have one duty per slot number on a given date
- Rate tracking preserved per duty record for historical accuracy

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16.3.1 (App Router) |
| **Language** | TypeScript 5 |
| **UI** | React 19 + Tailwind CSS v4 |
| **Components** | shadcn/ui primitives (Radix UI underpinning) |
| **Database** | Supabase (PostgreSQL) with Row Level Security |
| **Auth** | Supabase Auth (email/password + role-based access) |
| **State Management** | React Hooks + useQueryClient (implicit) |
| **Form Handling** | React Hook Form + Zod validation |
| **Date Handling** | date-fns |
| **Charts/Stats** | Custom progress-based statistics |

## 📦 Available Scripts

In the project directory:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (`localhost:3000`) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## 🏗️ Architecture

### Directory Structure

```
attendence-system/
├── app/                    # Next.js App Router pages
├── src/
│   ├── features/          # Feature modules (attendance, auth, workers)
│   ├── components/        # Reusable UI components
│   ├── services/          # Supabase service functions
│   ├── lib/               # Utilities (auth, audit logger, constants)
│   ├── constants/         # Duty type constants
│   └── types/             # TypeScript type definitions
├── supabase/
│   └── migrations/        # Database schema migrations
└── package.json
```

### Key Flows

#### 1. **Admin Dashboard** (`/admin`)
- View aggregated attendance statistics
- Filter by date, month, worker, duty type
- Add duties on behalf of workers
- Override/convert existing duties with business rule enforcement
- View worker-wise breakdown with earnings
- Access to audit logs and worker management

#### 2. **Worker Dashboard** (`/worker`)
- Record FULL/HALF duties for the selected date
- Real-time validation with business rule enforcement
- View own recorded duties for the day
- Logout functionality

#### 3. **Authentication**
- Supabase Auth with two roles: `ADMIN` and `WORKER`
- Role stored in `localStorage` after login
- Route-based access control (Admin panel vs Worker dashboard)

#### 4. **Audit Logging** (Phase 8A)
- All duty actions logged: `CREATE_DUTY_ADMIN`, `RECORD_DUTY`, `DELETE_DUTY`, `CORRECT_DUTY`
- Audit trail includes actor user ID, action type, entity ID, old/new values
- Admins can view filtered/paginated audit logs

#### 5. **Worker Management**
- Create/edit worker profiles with individual duty rates
- Full/half duty rates per worker (defaults: FULL=1000, HALF=500)
- Soft-delete support (`deleted_at` column)

## 👥 User Roles

### **Admin** (`/admin`)
- Full access to all attendance records
- Can add/remove/convert duties for any worker
- Can manage workers (create/edit)
- View audit logs
- Manage payouts
- Access to all filters and reports

### **Worker** (`/worker`)
- Record duties for own profile only
- View own duty records
- Max 1 HALF duty per person per day (mixing with FULL allowed)
- Self-service logout

## 📱 Screen Descriptions

### Admin Dashboard
![Admin Dashboard](https://via.placeholder.com/800x400?text=Admin+Dashboard)

- **Period filters**: Date, month, worker dropdown, duty type toggle
- **Key statistics**: Active workers, full/half counts, total records, total earnings
- **Worker breakdown table**: Per-worker full/half counts and earnings
- **Add duty form**: Admin can add duties on behalf of any worker
- **Business rule warnings**: Prevents invalid duty additions (mixing, capacity exceeded)

### Admin Attendance Page
![Admin Attendance](https://via.placeholder.com/800x600?text=Admin+Attendance)

- Advanced filtering with date/month/worker/duty type
- Table of duty records with date, worker, type, slot, amount
- Per-record actions: **Correct** (removes and logs CORRECT_DUTY) and **Remove** (logs DELETE_DUTY)
- Admin add duty overlay with live preview of existing duties
- Convert existing duties between FULL and HALF (respecting 2:1 equivalence)

### Worker Dashboard
![Worker Dashboard](https://via.placeholder.com/400x600?text=Worker+Dashboard)

- Date picker to select recording date
- Duty form with FULL/HALF buttons (disabled when at capacity)
- Progress bars showing remaining slots
- Real-time validation feedback
- Logout

## 🗄️ Database Schema (Supabase)

Core tables created via migrations:

| Table | Description |
|-------|-------------|
| `profiles` | User profiles with role (ADMIN/WORKER) and is_active flag |
| `workers` | Worker business profiles with `full_duty_rate` and `half_duty_rate` |
| `duty_records` | Daily duty records with business rule enforcement (triggers) |
| `audit_logs` | Complete audit trail of all duty actions |
| `payouts` | Monthly payment records per worker |

**Key Constraints**:
- `duty_records`: CHECK constraints on duty_type and slot_number
- `duty_records`: Unique index on `(worker_id, date, slot_number)` — prevents slot conflicts
- `duty_records`: Trigger `enforce_duty_budget_rules()` — database-level enforcement of the team budget (4 units/day, FULL=2, HALF=1) and per-worker caps (max 2 FULL + max 1 HALF, mixing allowed)
- `workers`: Soft-delete via `deleted_at` column (20260824000000 migration)

## 🔐 Authentication & Authorization

### Supabase Auth Settings
- Email/password authentication
- Two predefined roles: `ADMIN` and `WORKER`
- Role stored in `localStorage.userRole` after login

### Row Level Security (RLS)
- **Profiles**: Workers can view/update own profile; admins manage all
- **Workers**: Authenticated users can view active workers; admins manage all
- **Duty Records**: Workers can view/insert own records; admins have full CRUD
- **Audit Logs**: Admins only can view; admins can insert
- **Payouts**: Workers can view own; admins manage all

### Access Control
- `isAuthenticated()` — checks `localStorage.userRole !== null`
- `isRole('ADMIN')` / `isRole('WORKER')` — role checks
- Navigation component conditionally renders links based on role

## 🚀 Development & Setup

### Prerequisites
- Node.js 18+ (verified with Node 20+)
- npm/pnpm/bun/yarn
- Supabase project with enabled authentication

### Environment Variables

Create `.env.local` (or use the existing `.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The `.env.local` file already exists in the project root.

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000 in your browser
```

### Default Login Credentials
(Set up via Supabase Auth UI or admin onboarding flow)
- **Admin**: Typically created first with email + role assignment
- **Worker**: Created by admin, linked via `profiles.user_id` → `workers.profile_id`

## 🔧 Customization

### Adding New Duty Types
Modify `src/constants/duty-types.ts` and update business rule enforcement in:
- `src/services/attendance-service.ts` — `fetchAttendance` logic
- `supabase/migrations/20260823000001_duty_records.sql` — trigger function

### Changing Default Rates
Update `src/lib/supabase/migrations/20260821000000_init_core.sql`:
- `full_duty_rate INTEGER NOT NULL DEFAULT 1000`
- `half_duty_rate INTEGER NOT NULL DEFAULT 500`

### UI Theme
Tailwind CSS v4 config in `tailwind.config.ts`. Colors use the `zinc` (gray) palette with `green`/`yellow` for duty type visual indicators.

## 📚 API Endpoints (Supabase)

The app uses Supabase client methods directly. Key operations:

| Operation | Method | Table |
|-----------|--------|-------|
| Fetch attendance | `supabase.from("duty_records").select("*")` | `duty_records` |
| Add duty record | `supabase.from("duty_records").insert({...})` | `duty_records` |
| Remove duty | `supabase.from("duty_records").delete().eq("id", ...)` | `duty_records` |
| Correct duty | Delete + audit log `CORRECT_DUTY` | `duty_records` + `audit_logs` |
| View audit logs | `supabase.from("audit_logs").select("*")` | `audit_logs` |
| Worker lookup | `supabase.from("workers").select("...*")` | `workers` |
| Manage workers | CRUD on `profiles` and `workers` tables | `profiles`, `workers` |
| Payout management | CRUD on `payouts` table | `payouts` |

## 🧪 Testing & Verification

### Business Rule Validation
The system enforces these rules through multiple layers:

1. **Service layer** (`src/services/attendance-service.ts`): Rich error messages before DB interaction
2. **Database trigger** (`enforce_duty_budget_rules()`): Defense-in-depth constraint enforcement (team budget of 4 units/day, FULL=2 units, HALF=1 unit; per worker max 2 FULL + max 1 HALF, mixing allowed)
3. **UI layer**: Disabled buttons, real-time warnings, progress bar states

### Common Scenarios Tested
- Adding 2nd FULL duty on same date ✓
- Adding 3rd FULL duty (blocked) ✓
- Mixing FULL + HALF on same worker/date ✓
- Exceeding the team budget of 4 units/day (blocked) ✓
- Converting 2 HALF → 1 FULL ✓
- Converting FULL → HALF when it would exceed max 1 HALF per worker (blocked) ✓
- Removing a duty and re-adding ✓
- Audit log entries created for all CRUD operations ✓

## 📦 Deployment

### Vercel (Recommended)
The project is configured for seamless deployment on Vercel:

```bash
vercel deploy
# Or connect your GitHub repo to Vercel for automatic deployments
```

### Production Build
```bash
npm run build
npm run start
```

### Environment Requirements
- `NEXT_PUBLIC_SUPABASE_URL` must be set
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set
- Supabase project must have the migration SQL executed

## 🐛 Known Issues & TODOs

| Area | Status |
|------|--------|
| Worker self-registration flow | Not implemented — admin creates workers |
| Payout generation automation | Manual entry currently |
| Multi-language support | English only |
| Offline capability | Not implemented |
| Advanced audit log filtering | Available via Phase 8A fetchAuditLogs |

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with [shadcn/ui](https://ui.shadcn.com) components and Radix UI primitives
- Font: [Geist](https://vercel.com/font) (Next.js default)
- Date formatting: [date-fns](https://date-fns.org/)
- Database: [Supabase](https://supabase.io) for auth and PostgreSQL hosting

---

*Shift Attendance System — Managing daily duties with integrity and auditability.*
