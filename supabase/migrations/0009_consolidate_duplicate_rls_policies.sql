-- Consolidate equivalent/overlapping permissive RLS policies without changing
-- the effective row-access rules. Keep DDL lock waits short in production.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- Calc tables: the ALL policy already covers SELECT, so remove the redundant
-- SELECT policy and recreate the retained policy with an init-plan auth lookup.
DROP POLICY IF EXISTS calc_mistakes_select_own ON public.calc_mistakes;
DROP POLICY IF EXISTS calc_mistakes_modify_own ON public.calc_mistakes;
CREATE POLICY calc_mistakes_modify_own ON public.calc_mistakes
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS calc_problem_state_select_own ON public.calc_problem_state;
DROP POLICY IF EXISTS calc_problem_state_modify_own ON public.calc_problem_state;
CREATE POLICY calc_problem_state_modify_own ON public.calc_problem_state
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS calc_settings_select_own ON public.calc_settings;
DROP POLICY IF EXISTS calc_settings_modify_own ON public.calc_settings;
CREATE POLICY calc_settings_modify_own ON public.calc_settings
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS calc_vouchers_select_own ON public.calc_vouchers;
DROP POLICY IF EXISTS calc_vouchers_modify_own ON public.calc_vouchers;
CREATE POLICY calc_vouchers_modify_own ON public.calc_vouchers
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Chinese catalog tables: authenticated SELECT remains handled by the existing
-- *_select_auth policy. Split admin ALL into mutation-only policies so admin
-- reads do not cause a second permissive SELECT policy.
DROP POLICY IF EXISTS chinese_char_entries_mutate_admin ON public.chinese_char_entries;
DROP POLICY IF EXISTS chinese_char_entries_insert_admin ON public.chinese_char_entries;
DROP POLICY IF EXISTS chinese_char_entries_update_admin ON public.chinese_char_entries;
DROP POLICY IF EXISTS chinese_char_entries_delete_admin ON public.chinese_char_entries;
CREATE POLICY chinese_char_entries_insert_admin ON public.chinese_char_entries
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY chinese_char_entries_update_admin ON public.chinese_char_entries
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY chinese_char_entries_delete_admin ON public.chinese_char_entries
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS chinese_lesson_chars_mutate_admin ON public.chinese_lesson_chars;
DROP POLICY IF EXISTS chinese_lesson_chars_insert_admin ON public.chinese_lesson_chars;
DROP POLICY IF EXISTS chinese_lesson_chars_update_admin ON public.chinese_lesson_chars;
DROP POLICY IF EXISTS chinese_lesson_chars_delete_admin ON public.chinese_lesson_chars;
CREATE POLICY chinese_lesson_chars_insert_admin ON public.chinese_lesson_chars
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY chinese_lesson_chars_update_admin ON public.chinese_lesson_chars
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY chinese_lesson_chars_delete_admin ON public.chinese_lesson_chars
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS chinese_lessons_mutate_admin ON public.chinese_lessons;
DROP POLICY IF EXISTS chinese_lessons_insert_admin ON public.chinese_lessons;
DROP POLICY IF EXISTS chinese_lessons_update_admin ON public.chinese_lessons;
DROP POLICY IF EXISTS chinese_lessons_delete_admin ON public.chinese_lessons;
CREATE POLICY chinese_lessons_insert_admin ON public.chinese_lessons
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY chinese_lessons_update_admin ON public.chinese_lessons
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY chinese_lessons_delete_admin ON public.chinese_lessons
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- Legacy pairs below are semantically equivalent. Retain one explicitly
-- checked, authenticated-only policy per table.
DROP POLICY IF EXISTS users_own_daily ON public.daily_progress;
DROP POLICY IF EXISTS "users manage own daily_progress" ON public.daily_progress;
CREATE POLICY "users manage own daily_progress" ON public.daily_progress
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS users_own_math ON public.math_solved;
DROP POLICY IF EXISTS "users manage own math_solved" ON public.math_solved;
CREATE POLICY "users manage own math_solved" ON public.math_solved
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users manage own wrong" ON public.math_wrong;
DROP POLICY IF EXISTS "users manage own math_wrong" ON public.math_wrong;
CREATE POLICY "users manage own math_wrong" ON public.math_wrong
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users can manage own problem mastery" ON public.problem_mastery;
DROP POLICY IF EXISTS "users manage own problem_mastery" ON public.problem_mastery;
CREATE POLICY "users manage own problem_mastery" ON public.problem_mastery
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Word entries remain readable under the existing public-read policy. Split
-- creator ownership into mutation commands to avoid overlapping SELECT rules.
DROP POLICY IF EXISTS users_own_words ON public.word_entries;
DROP POLICY IF EXISTS word_entries_insert_own ON public.word_entries;
DROP POLICY IF EXISTS word_entries_update_own ON public.word_entries;
DROP POLICY IF EXISTS word_entries_delete_own ON public.word_entries;
CREATE POLICY word_entries_insert_own ON public.word_entries
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = creator);
CREATE POLICY word_entries_update_own ON public.word_entries
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = creator)
  WITH CHECK ((SELECT auth.uid()) = creator);
CREATE POLICY word_entries_delete_own ON public.word_entries
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = creator);

DROP POLICY IF EXISTS user_own ON public.word_mastery;
DROP POLICY IF EXISTS "users manage own word_mastery" ON public.word_mastery;
CREATE POLICY "users manage own word_mastery" ON public.word_mastery
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
