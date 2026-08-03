-- Chinese roadmap plans — incremental. No destructive data ops.
-- Run in Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS public.chinese_roadmap_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  book_slug VARCHAR(16) NOT NULL,
  start_lesson_key VARCHAR(64) NOT NULL,
  current_lesson_key VARCHAR(64) NOT NULL,
  lessons_per_batch INT NOT NULL DEFAULT 1,
  quiz_types TEXT[] NOT NULL DEFAULT ARRAY['recognize','stroke','phrase','blank','passage','pinyin-write']::text[],
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  completed_lesson_keys TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT chinese_roadmap_plans_book_chk
    CHECK (book_slug IN ('g1b', 'g2a', 'g2b')),
  CONSTRAINT chinese_roadmap_plans_status_chk
    CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  CONSTRAINT chinese_roadmap_plans_batch_chk
    CHECK (lessons_per_batch >= 1 AND lessons_per_batch <= 10)
);

CREATE INDEX IF NOT EXISTS idx_chinese_roadmap_plans_user_status
  ON public.chinese_roadmap_plans (user_id, status);

-- At most one non-archived active plan per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_chinese_roadmap_plans_one_active
  ON public.chinese_roadmap_plans (user_id)
  WHERE status = 'active' AND archived_at IS NULL;

ALTER TABLE public.chinese_roadmap_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chinese_roadmap_plans_own ON public.chinese_roadmap_plans;
CREATE POLICY chinese_roadmap_plans_own ON public.chinese_roadmap_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.chinese_roadmap_plan_lesson_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.chinese_roadmap_plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lesson_key VARCHAR(64) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed BOOLEAN NOT NULL DEFAULT false,
  total INT NOT NULL DEFAULT 0,
  correct INT NOT NULL DEFAULT 0,
  accuracy NUMERIC(5, 2),
  by_type JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiz_types TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chinese_roadmap_plan_runs_plan_lesson
  ON public.chinese_roadmap_plan_lesson_runs (plan_id, lesson_key, finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_chinese_roadmap_plan_runs_user
  ON public.chinese_roadmap_plan_lesson_runs (user_id, plan_id);

ALTER TABLE public.chinese_roadmap_plan_lesson_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chinese_roadmap_plan_lesson_runs_own ON public.chinese_roadmap_plan_lesson_runs;
CREATE POLICY chinese_roadmap_plan_lesson_runs_own ON public.chinese_roadmap_plan_lesson_runs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Incremental: include 填空题 (blank) in default quiz_types for new rows.
ALTER TABLE public.chinese_roadmap_plans
  ALTER COLUMN quiz_types
  SET DEFAULT ARRAY['recognize','stroke','phrase','blank','passage','pinyin-write']::text[];
