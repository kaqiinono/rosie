-- Backfill the maximum defensible adaptive-plan history from legacy snapshots.
-- Inferred records are deliberately distinguishable from exact post-0019 logs.

ALTER TABLE public.adaptive_practice_sessions
  ADD COLUMN record_kind TEXT NOT NULL DEFAULT 'exact',
  ADD COLUMN inference_basis JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.adaptive_practice_sessions
  ADD CONSTRAINT adaptive_practice_sessions_record_kind_chk
  CHECK (record_kind IN ('exact', 'inferred'));
ALTER TABLE public.adaptive_practice_sessions
  ADD CONSTRAINT adaptive_practice_sessions_inference_basis_array_chk
  CHECK (jsonb_typeof(inference_basis) = 'array');

ALTER TABLE public.adaptive_practice_word_logs
  ADD COLUMN record_kind TEXT NOT NULL DEFAULT 'exact';
ALTER TABLE public.adaptive_practice_word_logs
  ADD CONSTRAINT adaptive_practice_word_logs_record_kind_chk
  CHECK (record_kind IN ('exact', 'inferred'));
ALTER TABLE public.adaptive_practice_word_logs
  DROP CONSTRAINT adaptive_practice_word_logs_question_count_check,
  ADD CONSTRAINT adaptive_practice_word_logs_question_count_check CHECK (question_count >= 0),
  DROP CONSTRAINT adaptive_practice_word_logs_status_before_chk,
  DROP CONSTRAINT adaptive_practice_word_logs_status_after_chk,
  ALTER COLUMN status_before DROP NOT NULL,
  ALTER COLUMN status_after DROP NOT NULL,
  ADD CONSTRAINT adaptive_practice_word_logs_status_before_chk CHECK (
    status_before IS NULL OR status_before IN ('NOT_STARTED', 'LEARNING_PENDING', 'LEARNING', 'MASTERED')
  ),
  ADD CONSTRAINT adaptive_practice_word_logs_status_after_chk CHECK (
    status_after IS NULL OR status_after IN ('NOT_STARTED', 'LEARNING_PENDING', 'LEARNING', 'MASTERED')
  );

WITH plan_words AS (
  SELECT
    progress.plan_id,
    progress.user_id,
    progress.word_key,
    progress.introduced_on,
    (plan.created_at AT TIME ZONE 'Asia/Shanghai')::date AS plan_start,
    COALESCE(mastery.review_history, '[]'::jsonb) AS review_history
  FROM public.adaptive_plan_word_progress AS progress
  JOIN public.adaptive_word_plans AS plan ON plan.id = progress.plan_id
  LEFT JOIN public.word_mastery AS mastery
    ON mastery.user_id = progress.user_id AND mastery.word_key = progress.word_key
),
review_candidates AS (
  SELECT
    pw.plan_id,
    pw.user_id,
    pw.word_key,
    (review.item->>'date')::date AS practice_date,
    (review.item->>'correct')::boolean AS correct,
    review.ordinality
  FROM plan_words AS pw
  CROSS JOIN LATERAL jsonb_array_elements(pw.review_history)
    WITH ORDINALITY AS review(item, ordinality)
  WHERE review.item ? 'date'
    AND review.item ? 'correct'
    AND (review.item->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
    AND (review.item->>'date')::date >= pw.plan_start
    AND (pw.introduced_on IS NULL OR (review.item->>'date')::date >= pw.introduced_on)
),
review_candidate_counts AS (
  SELECT user_id, word_key, practice_date, COUNT(DISTINCT plan_id) AS plan_count
  FROM review_candidates
  GROUP BY user_id, word_key, practice_date
),
unique_reviews AS (
  SELECT candidate.*
  FROM review_candidates AS candidate
  JOIN review_candidate_counts AS counts
    USING (user_id, word_key, practice_date)
  WHERE counts.plan_count = 1
),
activation_days AS (
  SELECT plan_id, user_id, introduced_on AS practice_date
  FROM plan_words
  WHERE introduced_on IS NOT NULL
  GROUP BY plan_id, user_id, introduced_on
),
review_days AS (
  SELECT plan_id, user_id, practice_date
  FROM unique_reviews
  GROUP BY plan_id, user_id, practice_date
),
history_days AS (
  SELECT * FROM activation_days
  UNION
  SELECT * FROM review_days
),
session_rows AS (
  SELECT
    (
      substr(md5(day.plan_id::text || ':' || day.practice_date::text || ':inferred'), 1, 8) || '-' ||
      substr(md5(day.plan_id::text || ':' || day.practice_date::text || ':inferred'), 9, 4) || '-' ||
      substr(md5(day.plan_id::text || ':' || day.practice_date::text || ':inferred'), 13, 4) || '-' ||
      substr(md5(day.plan_id::text || ':' || day.practice_date::text || ':inferred'), 17, 4) || '-' ||
      substr(md5(day.plan_id::text || ':' || day.practice_date::text || ':inferred'), 21, 12)
    )::uuid AS id,
    day.plan_id,
    day.user_id,
    day.practice_date,
    (SELECT COUNT(*) FROM plan_words AS word
      WHERE word.plan_id = day.plan_id AND word.introduced_on = day.practice_date) AS new_word_count,
    (SELECT COUNT(DISTINCT review.word_key) FROM unique_reviews AS review
      WHERE review.plan_id = day.plan_id AND review.practice_date = day.practice_date) AS review_word_count,
    (SELECT COUNT(*) FROM unique_reviews AS review
      WHERE review.plan_id = day.plan_id AND review.practice_date = day.practice_date) AS question_count,
    (SELECT COUNT(*) FROM unique_reviews AS review
      WHERE review.plan_id = day.plan_id AND review.practice_date = day.practice_date
        AND review.correct) AS correct_count,
    to_jsonb(array_remove(ARRAY[
      CASE WHEN EXISTS (SELECT 1 FROM plan_words AS word
        WHERE word.plan_id = day.plan_id AND word.introduced_on = day.practice_date)
        THEN 'introduced_on' END,
      CASE WHEN EXISTS (SELECT 1 FROM unique_reviews AS review
        WHERE review.plan_id = day.plan_id AND review.practice_date = day.practice_date)
        THEN 'unique_plan_word_review_history' END
    ], NULL)) AS inference_basis
  FROM history_days AS day
  WHERE NOT EXISTS (
    SELECT 1 FROM public.adaptive_practice_sessions AS exact
    WHERE exact.plan_id = day.plan_id
      AND exact.practice_date = day.practice_date
      AND exact.record_kind = 'exact'
  )
)
INSERT INTO public.adaptive_practice_sessions (
  id, plan_id, user_id, practice_date, mode, started_at, finished_at,
  new_word_count, review_word_count, question_count, correct_count,
  stars_earned, boss_passed, record_kind, inference_basis
)
SELECT
  id, plan_id, user_id, practice_date, 'normal',
  (practice_date::timestamp + time '12:00') AT TIME ZONE 'Asia/Shanghai',
  (practice_date::timestamp + time '12:00') AT TIME ZONE 'Asia/Shanghai',
  new_word_count, review_word_count, question_count, correct_count,
  0, NULL, 'inferred', inference_basis
FROM session_rows
ON CONFLICT (id) DO NOTHING;

WITH inferred_sessions AS (
  SELECT id, plan_id, user_id, practice_date
  FROM public.adaptive_practice_sessions
  WHERE record_kind = 'inferred'
),
plan_words AS (
  SELECT
    progress.plan_id, progress.user_id, progress.word_key, progress.introduced_on,
    (plan.created_at AT TIME ZONE 'Asia/Shanghai')::date AS plan_start,
    COALESCE(mastery.review_history, '[]'::jsonb) AS review_history
  FROM public.adaptive_plan_word_progress AS progress
  JOIN public.adaptive_word_plans AS plan ON plan.id = progress.plan_id
  LEFT JOIN public.word_mastery AS mastery
    ON mastery.user_id = progress.user_id AND mastery.word_key = progress.word_key
),
review_candidates AS (
  SELECT pw.plan_id, pw.user_id, pw.word_key, (review.item->>'date')::date AS practice_date,
    (review.item->>'correct')::boolean AS correct, review.ordinality
  FROM plan_words AS pw
  CROSS JOIN LATERAL jsonb_array_elements(pw.review_history)
    WITH ORDINALITY AS review(item, ordinality)
  WHERE review.item ? 'date' AND review.item ? 'correct'
    AND (review.item->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
    AND (review.item->>'date')::date >= pw.plan_start
    AND (pw.introduced_on IS NULL OR (review.item->>'date')::date >= pw.introduced_on)
),
candidate_counts AS (
  SELECT user_id, word_key, practice_date, COUNT(DISTINCT plan_id) AS plan_count
  FROM review_candidates GROUP BY user_id, word_key, practice_date
),
unique_reviews AS (
  SELECT candidate.* FROM review_candidates AS candidate
  JOIN candidate_counts AS counts USING (user_id, word_key, practice_date)
  WHERE counts.plan_count = 1
),
session_words AS (
  SELECT session.id AS session_id, session.plan_id, session.user_id, word.word_key,
    COALESCE(jsonb_agg(
      jsonb_build_object('phase', 'unknown', 'quizType', NULL, 'correct', review.correct,
        'usedRetry', false, 'inferred', true)
      ORDER BY review.ordinality
    ) FILTER (WHERE review.word_key IS NOT NULL), '[]'::jsonb) AS outcomes,
    COUNT(review.word_key) AS question_count,
    COUNT(review.word_key) FILTER (WHERE review.correct) AS correct_count
  FROM inferred_sessions AS session
  JOIN plan_words AS word ON word.plan_id = session.plan_id
    AND (word.introduced_on = session.practice_date OR EXISTS (
      SELECT 1 FROM unique_reviews AS candidate
      WHERE candidate.plan_id = session.plan_id
        AND candidate.practice_date = session.practice_date
        AND candidate.word_key = word.word_key
    ))
  LEFT JOIN unique_reviews AS review ON review.plan_id = session.plan_id
    AND review.practice_date = session.practice_date AND review.word_key = word.word_key
  GROUP BY session.id, session.plan_id, session.user_id, word.word_key
)
INSERT INTO public.adaptive_practice_word_logs (
  session_id, plan_id, user_id, word_key, outcomes, question_count, correct_count,
  box_before, box_after, status_before, status_after,
  next_review_before, next_review_after, record_kind
)
SELECT session_id, plan_id, user_id, word_key, outcomes, question_count, correct_count,
  NULL, NULL, NULL, NULL, NULL, NULL, 'inferred'
FROM session_words
ON CONFLICT (session_id, word_key) DO NOTHING;
