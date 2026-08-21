-- Team duty-unit usage for a date, readable by any authenticated user despite RLS.
CREATE OR REPLACE FUNCTION public.get_team_duty_usage(p_date date)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(SUM(CASE WHEN duty_type = 'FULL' THEN 2 ELSE 1 END), 0)
  FROM public.duty_records
  WHERE date = p_date;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_duty_usage(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_team_duty_usage(date) TO authenticated;
