-- Allow workers to revert their own accidental marks
-- Needed for "revert if worker accidentally marks wrong one" requirement

ALTER TABLE public.duty_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers can delete own duty records" ON public.duty_records;
CREATE POLICY "Workers can delete own duty records" ON public.duty_records
FOR DELETE USING (
  worker_id IN (
    SELECT id FROM public.workers
    WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

-- Also allow workers to update own if needed (no-op for now, but keep consistent)
DROP POLICY IF EXISTS "Workers can update own duty records" ON public.duty_records;
CREATE POLICY "Workers can update own duty records" ON public.duty_records
FOR UPDATE USING (
  worker_id IN (
    SELECT id FROM public.workers
    WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
) WITH CHECK (
  worker_id IN (
    SELECT id FROM public.workers
    WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);
