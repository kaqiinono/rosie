-- Atomic adaptive-English round settlement plus an immutable daily progress denominator.
-- The client previously wrote progress, mastery and logs separately, allowing the
-- homepage to disagree with a round that the child had already finished.

CREATE TABLE public.adaptive_daily_progress (
  plan_id UUID NOT NULL REFERENCES public.adaptive_word_plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  practice_date DATE NOT NULL,
  new_goal INT NOT NULL CHECK (new_goal >= 0),
  review_goal INT NOT NULL CHECK (review_goal >= 0),
  new_done INT NOT NULL DEFAULT 0 CHECK (new_done >= 0),
  review_done INT NOT NULL DEFAULT 0 CHECK (review_done >= 0),
  all_done BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_id, practice_date)
);

CREATE INDEX idx_adaptive_daily_progress_user_date
  ON public.adaptive_daily_progress (user_id, practice_date DESC);

ALTER TABLE public.adaptive_daily_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY adaptive_daily_progress_select
  ON public.adaptive_daily_progress FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY adaptive_daily_progress_insert
  ON public.adaptive_daily_progress FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY adaptive_daily_progress_update
  ON public.adaptive_daily_progress FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE ON public.adaptive_daily_progress TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_adaptive_practice_round(
  p_plan_id UUID,
  p_practice_date DATE,
  p_session JSONB,
  p_progress_rows JSONB,
  p_mastery_rows JSONB,
  p_word_logs JSONB,
  p_new_goal INT,
  p_review_goal INT,
  p_all_done BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_session_id UUID := (p_session->>'id')::UUID;
  v_daily public.adaptive_daily_progress%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.adaptive_word_plans
    WHERE id = p_plan_id AND user_id = v_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active adaptive plan not found';
  END IF;
  IF jsonb_typeof(p_progress_rows) <> 'array'
    OR jsonb_typeof(p_mastery_rows) <> 'array'
    OR jsonb_typeof(p_word_logs) <> 'array' THEN
    RAISE EXCEPTION 'Settlement row payloads must be arrays';
  END IF;

  INSERT INTO public.adaptive_plan_word_progress (
    plan_id, user_id, word_key, status, box_index, target_box,
    streak_wrong, next_review_date, introduced_on, archived_at, updated_at
  )
  SELECT
    p_plan_id, v_user_id, row.word_key, row.status, row.box_index, row.target_box,
    row.streak_wrong, row.next_review_date, row.introduced_on, row.archived_at, NOW()
  FROM jsonb_to_recordset(p_progress_rows) AS row(
    word_key TEXT, status TEXT, box_index INT, target_box INT,
    streak_wrong INT, next_review_date DATE, introduced_on DATE, archived_at TIMESTAMPTZ
  )
  ON CONFLICT (plan_id, word_key) DO UPDATE SET
    status = EXCLUDED.status,
    box_index = EXCLUDED.box_index,
    target_box = EXCLUDED.target_box,
    streak_wrong = EXCLUDED.streak_wrong,
    next_review_date = EXCLUDED.next_review_date,
    introduced_on = EXCLUDED.introduced_on,
    archived_at = EXCLUDED.archived_at,
    updated_at = NOW();

  INSERT INTO public.word_mastery (
    user_id, word_key, correct, incorrect, last_seen, stage,
    next_review_date, is_hard, review_history, updated_at
  )
  SELECT
    v_user_id, row.word_key, row.correct, row.incorrect, row.last_seen,
    row.stage, row.next_review_date, row.is_hard, row.review_history, NOW()
  FROM jsonb_to_recordset(p_mastery_rows) AS row(
    word_key TEXT, correct INT, incorrect INT, last_seen DATE, stage INT,
    next_review_date DATE, is_hard BOOLEAN, review_history JSONB
  )
  ON CONFLICT (user_id, word_key) DO UPDATE SET
    correct = EXCLUDED.correct,
    incorrect = EXCLUDED.incorrect,
    last_seen = EXCLUDED.last_seen,
    stage = EXCLUDED.stage,
    next_review_date = EXCLUDED.next_review_date,
    is_hard = EXCLUDED.is_hard,
    review_history = EXCLUDED.review_history,
    updated_at = NOW();

  INSERT INTO public.adaptive_practice_sessions (
    id, plan_id, user_id, practice_date, mode, started_at, finished_at,
    new_word_count, review_word_count, question_count, correct_count,
    stars_earned, boss_passed
  ) VALUES (
    v_session_id, p_plan_id, v_user_id, p_practice_date,
    p_session->>'mode', (p_session->>'started_at')::TIMESTAMPTZ,
    (p_session->>'finished_at')::TIMESTAMPTZ,
    COALESCE((p_session->>'new_word_count')::INT, 0),
    COALESCE((p_session->>'review_word_count')::INT, 0),
    COALESCE((p_session->>'question_count')::INT, 0),
    COALESCE((p_session->>'correct_count')::INT, 0),
    COALESCE((p_session->>'stars_earned')::INT, 0),
    (p_session->>'boss_passed')::BOOLEAN
  )
  ON CONFLICT (id) DO UPDATE SET
    finished_at = EXCLUDED.finished_at,
    question_count = EXCLUDED.question_count,
    correct_count = EXCLUDED.correct_count,
    stars_earned = EXCLUDED.stars_earned,
    boss_passed = EXCLUDED.boss_passed;

  INSERT INTO public.adaptive_practice_word_logs (
    session_id, plan_id, user_id, word_key, outcomes, question_count,
    correct_count, box_before, box_after, status_before, status_after,
    next_review_before, next_review_after
  )
  SELECT
    v_session_id, p_plan_id, v_user_id, row.word_key, row.outcomes,
    row.question_count, row.correct_count, row.box_before, row.box_after,
    row.status_before, row.status_after, row.next_review_before, row.next_review_after
  FROM jsonb_to_recordset(p_word_logs) AS row(
    word_key TEXT, outcomes JSONB, question_count INT, correct_count INT,
    box_before INT, box_after INT, status_before TEXT, status_after TEXT,
    next_review_before DATE, next_review_after DATE
  )
  ON CONFLICT (session_id, word_key) DO UPDATE SET
    outcomes = EXCLUDED.outcomes,
    question_count = EXCLUDED.question_count,
    correct_count = EXCLUDED.correct_count,
    box_before = EXCLUDED.box_before,
    box_after = EXCLUDED.box_after,
    status_before = EXCLUDED.status_before,
    status_after = EXCLUDED.status_after,
    next_review_before = EXCLUDED.next_review_before,
    next_review_after = EXCLUDED.next_review_after;

  INSERT INTO public.adaptive_daily_progress (
    plan_id, user_id, practice_date, new_goal, review_goal,
    new_done, review_done, all_done, completed_at, updated_at
  )
  SELECT
    p_plan_id, v_user_id, p_practice_date, GREATEST(p_new_goal, 0),
    GREATEST(p_review_goal, 0),
    LEAST(GREATEST(p_new_goal, 0), COALESCE(SUM(new_word_count), 0)::INT),
    LEAST(GREATEST(p_review_goal, 0), COALESCE(SUM(review_word_count), 0)::INT),
    p_all_done, CASE WHEN p_all_done THEN NOW() ELSE NULL END, NOW()
  FROM public.adaptive_practice_sessions
  WHERE plan_id = p_plan_id AND user_id = v_user_id
    AND practice_date = p_practice_date AND record_kind = 'exact'
  ON CONFLICT (plan_id, practice_date) DO UPDATE SET
    new_goal = GREATEST(adaptive_daily_progress.new_goal, EXCLUDED.new_goal),
    review_goal = GREATEST(adaptive_daily_progress.review_goal, EXCLUDED.review_goal),
    new_done = GREATEST(adaptive_daily_progress.new_done, EXCLUDED.new_done),
    review_done = GREATEST(adaptive_daily_progress.review_done, EXCLUDED.review_done),
    all_done = adaptive_daily_progress.all_done OR EXCLUDED.all_done,
    completed_at = COALESCE(adaptive_daily_progress.completed_at, EXCLUDED.completed_at),
    updated_at = NOW();

  SELECT * INTO v_daily FROM public.adaptive_daily_progress
  WHERE plan_id = p_plan_id AND practice_date = p_practice_date;

  RETURN to_jsonb(v_daily);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_adaptive_practice_round(
  UUID, DATE, JSONB, JSONB, JSONB, JSONB, INT, INT, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_adaptive_practice_round(
  UUID, DATE, JSONB, JSONB, JSONB, JSONB, INT, INT, BOOLEAN
) TO authenticated;
