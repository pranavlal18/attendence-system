-- Soft-delete support for workers.
-- deleted_at IS NULL  -> worker is visible (active or deactivated, can be reactivated)
-- deleted_at NOT NULL -> worker permanently hidden from UI; all duty/payout history preserved in DB.

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_workers_deleted_at ON public.workers (deleted_at);
