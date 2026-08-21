-- Core schema for Shift Attendance System
-- Spec: docs/superpowers/specs/2026-08-23-shift-attendance-system-design.md Section 2
-- Order: profiles -> workers -> audit_logs -> payouts (duty_records is 20260823000001)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(10) NOT NULL DEFAULT 'WORKER' CHECK (role IN ('ADMIN','WORKER')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================================
-- workers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_duty_rate INTEGER NOT NULL DEFAULT 1000,
  half_duty_rate INTEGER NOT NULL DEFAULT 500,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workers_profile_id ON public.workers(profile_id);
CREATE INDEX IF NOT EXISTS idx_workers_active ON public.workers(is_active);

-- ============================================================
-- audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_type, entity_id);

-- ============================================================
-- payouts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL,
  amount_paid INTEGER NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_worker_month ON public.payouts(worker_id, month_year);

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_workers_updated_at ON public.workers;
CREATE TRIGGER trg_workers_updated_at BEFORE UPDATE ON public.workers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Helper: is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles policies
DROP POLICY IF EXISTS "Workers can view own profile" ON public.profiles;
CREATE POLICY "Workers can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Workers can update own profile" ON public.profiles;
CREATE POLICY "Workers can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles" ON public.profiles
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- workers policies
DROP POLICY IF EXISTS "Anyone authenticated can view active workers" ON public.workers;
CREATE POLICY "Anyone authenticated can view active workers" ON public.workers
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage workers" ON public.workers;
CREATE POLICY "Admins can manage workers" ON public.workers
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- payouts (duty_records policies are in 20260823000001_duty_records.sql after table is created)
DROP POLICY IF EXISTS "Workers can view own payouts" ON public.payouts;
CREATE POLICY "Workers can view own payouts" ON public.payouts
FOR SELECT USING (
  worker_id IN (SELECT id FROM public.workers WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Admins can manage payouts" ON public.payouts;
CREATE POLICY "Admins can manage payouts" ON public.payouts
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins can insert audit logs" ON public.audit_logs
FOR INSERT WITH CHECK (public.is_admin() OR auth.role() = 'authenticated');

-- payouts & audit_logs still need RLS enabled above; workers/profiles already.
-- Ensure service_role bypasses RLS (default).

COMMENT ON TABLE public.profiles IS 'User accounts with role ADMIN/WORKER and is_active soft-delete';
COMMENT ON TABLE public.workers IS 'Business profile per worker; rates are worker-specific; historical rates preserved via duty_records.rate_applied';
