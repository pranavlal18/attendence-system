# Task 2: Supabase Project Configuration

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