-- Allow paused status on adaptive_word_plans. Incremental; no wipe.
-- Run in Supabase SQL editor after adaptive-word-plans.sql.

ALTER TABLE public.adaptive_word_plans
  DROP CONSTRAINT IF EXISTS adaptive_word_plans_status_chk;

ALTER TABLE public.adaptive_word_plans
  ADD CONSTRAINT adaptive_word_plans_status_chk
  CHECK (status IN ('active', 'paused', 'completed', 'archived'));

-- Demote surplus actives: keep newest updated_at per user as active.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.adaptive_word_plans
  WHERE status = 'active'
    AND archived_at IS NULL
)
UPDATE public.adaptive_word_plans AS plans
SET
  status = 'paused',
  updated_at = NOW()
FROM ranked
WHERE plans.id = ranked.id
  AND ranked.rn > 1;
