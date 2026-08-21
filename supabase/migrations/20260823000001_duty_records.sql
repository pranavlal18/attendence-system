-- Migration: duty_records table for Phase 4A
-- Spec: docs/superpowers/specs/2026-08-23-shift-attendance-system-design.md Section 2.3
-- Business rules enforced via CHECK constraints + service layer; trigger provided for defense in depth.

-- Ensure pgcrypto for gen_random_uuid() (idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.duty_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  duty_type VARCHAR(10) NOT NULL CHECK (duty_type IN ('FULL', 'HALF')),
  slot_number INTEGER NOT NULL CHECK (slot_number >= 1 AND slot_number <= 4),
  rate_applied INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Unique slot enforcement: same worker cannot use same slot twice on same date
CREATE UNIQUE INDEX IF NOT EXISTS idx_duty_slots ON public.duty_records (worker_id, date, slot_number);

-- Performance indexes per spec
CREATE INDEX IF NOT EXISTS idx_duty_worker_date ON public.duty_records (worker_id, date);
CREATE INDEX IF NOT EXISTS idx_duty_date_type ON public.duty_records (date, duty_type);

-- Business rule enforcement:
-- Max 2 FULL per worker/date, max 4 HALF, no mixing FULL+HALF on same worker/date.
-- Primary enforcement is in service layer (src/services/*) for richer error messages.
-- The trigger below provides database-level defense in depth and can be kept enabled.

CREATE OR REPLACE FUNCTION public.enforce_duty_business_rules()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
  existing_type VARCHAR(10);
BEGIN
  -- Slot range already enforced by CHECK (1-4); keep explicit guard for clarity
  IF NEW.slot_number < 1 OR NEW.slot_number > 4 THEN
    RAISE EXCEPTION 'slot_number must be between 1 and 4';
  END IF;

  -- Enforce duty_type-specific slot ceiling: FULL <=2, HALF <=4
  IF NEW.duty_type = 'FULL' AND NEW.slot_number > 2 THEN
    RAISE EXCEPTION 'FULL duty slot_number must be <= 2 (got %)', NEW.slot_number;
  END IF;

  IF NEW.duty_type = 'HALF' AND NEW.slot_number > 4 THEN
    RAISE EXCEPTION 'HALF duty slot_number must be <= 4 (got %)', NEW.slot_number;
  END IF;

  -- No mixing: if any existing record for same worker/date has different duty_type, reject
  SELECT duty_type INTO existing_type
  FROM public.duty_records
  WHERE worker_id = NEW.worker_id AND date = NEW.date
  LIMIT 1;

  IF existing_type IS NOT NULL AND existing_type <> NEW.duty_type THEN
    RAISE EXCEPTION 'Cannot mix FULL and HALF duties for same worker/date (%)', NEW.date;
  END IF;

  -- Max per type per date
  SELECT COUNT(*) INTO existing_count
  FROM public.duty_records
  WHERE worker_id = NEW.worker_id AND date = NEW.date AND duty_type = NEW.duty_type;

  -- For UPDATE, exclude current row if it already exists (id match)
  IF TG_OP = 'UPDATE' THEN
    SELECT COUNT(*) INTO existing_count
    FROM public.duty_records
    WHERE worker_id = NEW.worker_id AND date = NEW.date AND duty_type = NEW.duty_type AND id <> NEW.id;
  END IF;

  IF NEW.duty_type = 'FULL' AND existing_count >= 2 THEN
    RAISE EXCEPTION 'Max 2 FULL duties per worker/date exceeded for % on %', NEW.worker_id, NEW.date;
  END IF;

  IF NEW.duty_type = 'HALF' AND existing_count >= 4 THEN
    RAISE EXCEPTION 'Max 4 HALF duties per worker/date exceeded for % on %', NEW.worker_id, NEW.date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_duty_rules ON public.duty_records;

CREATE TRIGGER trg_enforce_duty_rules
BEFORE INSERT OR UPDATE ON public.duty_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_duty_business_rules();

-- RLS for duty_records (profiles/workers/payouts/audit_logs already enabled in 20260821000000)
ALTER TABLE public.duty_records ENABLE ROW LEVEL SECURITY;

-- Helper already created in init: public.is_admin()
DROP POLICY IF EXISTS "Workers can view own duty records" ON public.duty_records;
CREATE POLICY "Workers can view own duty records" ON public.duty_records
FOR SELECT USING (
  worker_id IN (SELECT id FROM public.workers WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Workers can insert own duty records" ON public.duty_records;
CREATE POLICY "Workers can insert own duty records" ON public.duty_records
FOR INSERT WITH CHECK (
  worker_id IN (SELECT id FROM public.workers WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Admins can view all duty records" ON public.duty_records;
CREATE POLICY "Admins can view all duty records" ON public.duty_records FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert duty records" ON public.duty_records;
CREATE POLICY "Admins can insert duty records" ON public.duty_records FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update duty records" ON public.duty_records;
CREATE POLICY "Admins can update duty records" ON public.duty_records FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete duty records" ON public.duty_records;
CREATE POLICY "Admins can delete duty records" ON public.duty_records FOR DELETE USING (public.is_admin());

COMMENT ON TABLE public.duty_records IS 'Daily duty records; rate_applied preserves historical rate. Business rules: max 2 FULL / 4 HALF per worker/date, no mixing, slot uniqueness.';
COMMENT ON COLUMN public.duty_records.slot_number IS '1-4; FULL allows 1-2, HALF allows 1-4. Enforced via CHECK and trigger + Zod superRefine.';
