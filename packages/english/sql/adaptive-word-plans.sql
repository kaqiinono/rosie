-- Adaptive word plans (English) — incremental schema.
-- Aligns with docs/superpowers/specs/2026-07-09-adaptive-word-plan-design.md §6.
-- Tracked mirror of docs/sql/adaptive-word-plans.sql (docs/ is gitignored).
-- Run in Supabase SQL editor. Idempotent. No destructive data ops.

-- ── 1. Plan header ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.adaptive_word_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  scope JSONB NOT NULL,
  -- knobs (spec defaults)
  new_words_per_day INT NOT NULL DEFAULT 10,
  review_cap INT NOT NULL DEFAULT 40,
  review_batch_size INT NOT NULL DEFAULT 20,
  backlog_fuse INT NOT NULL DEFAULT 50,
  boss_every_n_new INT NOT NULL DEFAULT 50,
  boss_stubborn_threshold INT NOT NULL DEFAULT 15,
  boss_pack_limit INT NOT NULL DEFAULT 50,
  -- runtime
  mode VARCHAR(50) NOT NULL DEFAULT 'normal',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  stats JSONB NOT NULL DEFAULT '{
    "bossFailStreak": 0,
    "bossQuestionTier": 1,
    "everActivatedCount": 0,
    "totalActivatedCount": 0,
    "lastBossActivatedCount": 0
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT adaptive_word_plans_mode_chk
    CHECK (mode IN ('normal', 'review_only', 'boss')),
  CONSTRAINT adaptive_word_plans_status_chk
    CHECK (status IN ('active', 'completed', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_adaptive_plans_user
  ON public.adaptive_word_plans (user_id, status);

ALTER TABLE public.adaptive_word_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adaptive_word_plans_own ON public.adaptive_word_plans;
CREATE POLICY adaptive_word_plans_own ON public.adaptive_word_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 2. Per-word progress (plan-local Leitner) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.adaptive_plan_word_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.adaptive_word_plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  word_key VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
  box_index INT,
  target_box INT,
  streak_wrong INT NOT NULL DEFAULT 0,
  -- plan-local due dates: DATE only (spec §4.4)
  next_review_date DATE,
  introduced_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT uq_adaptive_plan_word UNIQUE (plan_id, word_key),
  CONSTRAINT adaptive_progress_status_chk
    CHECK (status IN ('NOT_STARTED', 'LEARNING_PENDING', 'LEARNING', 'MASTERED')),
  CONSTRAINT adaptive_progress_box_chk
    CHECK (box_index IS NULL OR box_index BETWEEN 1 AND 5),
  CONSTRAINT adaptive_progress_target_box_chk
    CHECK (target_box IS NULL OR target_box IN (1, 3))
);

CREATE INDEX IF NOT EXISTS idx_adaptive_progress_scheduler
  ON public.adaptive_plan_word_progress (plan_id, status, next_review_date);

CREATE INDEX IF NOT EXISTS idx_adaptive_progress_user
  ON public.adaptive_plan_word_progress (user_id, plan_id);

ALTER TABLE public.adaptive_plan_word_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adaptive_plan_word_progress_own ON public.adaptive_plan_word_progress;
CREATE POLICY adaptive_plan_word_progress_own ON public.adaptive_plan_word_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Incremental: existing deployments (idempotent)
ALTER TABLE public.adaptive_word_plans
  ADD COLUMN IF NOT EXISTS boss_pack_limit INT NOT NULL DEFAULT 50;
