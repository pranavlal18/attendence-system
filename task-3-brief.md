# Task 3: Authentication & Role Handling

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
- Form with email and password fields
- On success, get user role from profiles table
- Store role in localStorage/sessionStorage for client-side use

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
- Check role before allowing access
- /admin/* requires ADMIN role
- /worker/* requires WORKER role
- Unauthenticated redirected to /(auth)/login

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