-- Incremental: math_practice_attempts gains status + embedded canvas objects.
-- Run in Supabase SQL Editor (entire script). Idempotent. No data wipe.
--
-- Apply order: run BEFORE shipping the client that writes status/objects (preferred),
-- or immediately after deploy if the app tolerates missing columns via optional selects.
-- Prerequisite: math-scratch-rls.sql (math_practice_attempts + scratch tables exist).
--
-- After running: refresh the app (NOTIFY pgrst below reloads PostgREST schema cache).

-- ── 1) New columns ───────────────────────────────────────────────────────────
ALTER TABLE public.math_practice_attempts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

ALTER TABLE public.math_practice_attempts
  ADD COLUMN IF NOT EXISTS objects JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Allow null correct for in_progress rows
ALTER TABLE public.math_practice_attempts
  ALTER COLUMN correct DROP NOT NULL;

UPDATE public.math_practice_attempts
SET status = 'completed'
WHERE status IS NULL OR status = '';

ALTER TABLE public.math_practice_attempts
  DROP CONSTRAINT IF EXISTS math_practice_attempts_status_check;

ALTER TABLE public.math_practice_attempts
  ADD CONSTRAINT math_practice_attempts_status_check
  CHECK (status IN ('in_progress', 'completed'));

-- ── 2) One in-progress per problem ───────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS math_practice_attempts_one_in_progress_practice
  ON public.math_practice_attempts (user_id, problem_id)
  WHERE status = 'in_progress' AND paper_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS math_practice_attempts_one_in_progress_quiz
  ON public.math_practice_attempts (user_id, problem_id, paper_id)
  WHERE status = 'in_progress' AND paper_id IS NOT NULL;

-- ── 3) Backfill objects from archived drafts ─────────────────────────────────
UPDATE public.math_practice_attempts a
SET objects = d.objects
FROM public.math_scratch_drafts d
WHERE a.draft_id = d.id
  AND (a.objects IS NULL OR a.objects = '[]'::jsonb)
  AND d.objects IS NOT NULL
  AND d.objects <> '[]'::jsonb;

-- ── 4) Backfill working → in_progress (practice scope '') ────────────────────
-- lesson_id left '' — app rewrites on next open if needed.
INSERT INTO public.math_practice_attempts (
  user_id, problem_id, lesson_id, section, paper_id,
  status, correct, objects, answer_snapshot, attempted_at
)
SELECT
  w.user_id,
  w.problem_id,
  '',
  'lesson',
  NULL,
  'in_progress',
  NULL,
  w.objects,
  w.answer_draft,
  w.updated_at
FROM public.math_scratch_working w
WHERE w.paper_scope = ''
  AND w.objects IS NOT NULL
  AND w.objects <> '[]'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM public.math_practice_attempts a
    WHERE a.user_id = w.user_id
      AND a.problem_id = w.problem_id
      AND a.status = 'in_progress'
      AND a.paper_id IS NULL
  );

-- ── 5) Backfill quiz working (paper_scope = uuid text) → in_progress ─────────
-- Live DB: math_practice_attempts.paper_id is uuid; math_scratch_working.paper_scope is text.
INSERT INTO public.math_practice_attempts (
  user_id, problem_id, lesson_id, section, paper_id,
  status, correct, objects, answer_snapshot, attempted_at
)
SELECT DISTINCT ON (w.user_id, w.problem_id, w.paper_scope)
  w.user_id,
  w.problem_id,
  '',
  'quiz',
  w.paper_scope::uuid,
  'in_progress',
  NULL,
  w.objects,
  w.answer_draft,
  w.updated_at
FROM public.math_scratch_working w
WHERE w.paper_scope <> ''
  AND w.paper_scope ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND w.objects IS NOT NULL
  AND w.objects <> '[]'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM public.math_practice_attempts a
    WHERE a.user_id = w.user_id
      AND a.problem_id = w.problem_id
      AND a.status = 'in_progress'
      AND a.paper_id = w.paper_scope::uuid
  )
ORDER BY w.user_id, w.problem_id, w.paper_scope, w.updated_at DESC;

NOTIFY pgrst, 'reload schema';
