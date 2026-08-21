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
