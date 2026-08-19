-- Grammar module: unit content (extracted from 剑桥初级英语语法 via Vision LLM)
-- + per-user mastery progress. Content writes go through service-role only.
-- See docs/superpowers/specs/2026-08-18-grammar-framework-design.md

CREATE TABLE IF NOT EXISTS public.grammar_units (
  unit_number INT PRIMARY KEY CHECK (unit_number BETWEEN 1 AND 116),
  title TEXT NOT NULL,
  title_zh TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  category_zh TEXT NOT NULL DEFAULT '',
  difficulty INT NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  book_pages INT[] NOT NULL DEFAULT '{}',
  lesson JSONB NOT NULL DEFAULT '{"sections":[],"crossReferences":[]}'::jsonb,
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT grammar_units_lesson_obj_chk CHECK (jsonb_typeof(lesson) = 'object'),
  CONSTRAINT grammar_units_exercises_arr_chk CHECK (jsonb_typeof(exercises) = 'array')
);

ALTER TABLE public.grammar_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grammar_units_select ON public.grammar_units;
CREATE POLICY grammar_units_select
  ON public.grammar_units FOR SELECT TO authenticated
  USING (true);
-- No INSERT/UPDATE/DELETE policies: content is written by the extraction CLI
-- using the service-role key (bypasses RLS by design).

CREATE TABLE IF NOT EXISTS public.grammar_mastery (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  unit_number INT NOT NULL REFERENCES public.grammar_units (unit_number) ON DELETE CASCADE,
  correct_count INT NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  total_count INT NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  mastered BOOLEAN NOT NULL DEFAULT FALSE,
  last_practiced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, unit_number)
);

ALTER TABLE public.grammar_mastery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grammar_mastery_select ON public.grammar_mastery;
CREATE POLICY grammar_mastery_select
  ON public.grammar_mastery FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS grammar_mastery_insert ON public.grammar_mastery;
CREATE POLICY grammar_mastery_insert
  ON public.grammar_mastery FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS grammar_mastery_update ON public.grammar_mastery;
CREATE POLICY grammar_mastery_update
  ON public.grammar_mastery FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Supabase breaking change (April 2026): new tables need explicit Data API grants.
GRANT SELECT ON public.grammar_units TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.grammar_mastery TO authenticated;
