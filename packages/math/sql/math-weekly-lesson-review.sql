-- 本周旧讲复习进度（per-user JSON state）.
-- Used by useMathWeeklyLessonReview → math_weekly_lesson_review.
-- Run in Supabase SQL editor. Idempotent. No destructive data ops.

CREATE TABLE IF NOT EXISTS public.math_weekly_lesson_review (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  state_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

ALTER TABLE public.math_weekly_lesson_review ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS math_weekly_lesson_review_own ON public.math_weekly_lesson_review;
CREATE POLICY math_weekly_lesson_review_own ON public.math_weekly_lesson_review
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.math_weekly_lesson_review TO authenticated;

-- Refresh PostgREST schema cache so the new table is visible immediately.
NOTIFY pgrst, 'reload schema';
