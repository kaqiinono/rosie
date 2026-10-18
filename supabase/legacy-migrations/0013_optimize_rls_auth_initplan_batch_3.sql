-- RLS init-plan optimization, batch 3/3 (12 tables, 24 policies).

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER POLICY quiz_scratch_links_own ON public.math_quiz_scratch_links
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can manage their own rotating review" ON public.math_rotating_review
  USING (((SELECT auth.uid()))::text = user_id)
  WITH CHECK (((SELECT auth.uid()))::text = user_id);

ALTER POLICY math_scratch_drafts_delete ON public.math_scratch_drafts
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY math_scratch_drafts_insert ON public.math_scratch_drafts
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY math_scratch_drafts_select ON public.math_scratch_drafts
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY math_scratch_drafts_update ON public.math_scratch_drafts
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY math_scratch_working_delete ON public.math_scratch_working
  USING (((SELECT auth.uid()))::text = user_id::text);
ALTER POLICY math_scratch_working_insert ON public.math_scratch_working
  WITH CHECK (((SELECT auth.uid()))::text = user_id::text);
ALTER POLICY math_scratch_working_select ON public.math_scratch_working
  USING (((SELECT auth.uid()))::text = user_id::text);
ALTER POLICY math_scratch_working_update ON public.math_scratch_working
  USING (((SELECT auth.uid()))::text = user_id::text)
  WITH CHECK (((SELECT auth.uid()))::text = user_id::text);

ALTER POLICY math_skipped_own ON public.math_skipped
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY math_weekly_lesson_review_own ON public.math_weekly_lesson_review
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can delete own math_weekly_plans" ON public.math_weekly_plans
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can insert own math_weekly_plans" ON public.math_weekly_plans
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can read own math_weekly_plans" ON public.math_weekly_plans
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can update own math_weekly_plans" ON public.math_weekly_plans
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY practice_pending_sessions_own ON public.practice_pending_sessions
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Authenticated insert reading_passage_media" ON public.reading_passage_media
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
  );

ALTER POLICY star_sessions_own ON public.star_sessions
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY voucher_templates_all_authenticated ON public.voucher_templates
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER POLICY "Users can delete own weekly_plans" ON public.weekly_plans
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can insert own weekly_plans" ON public.weekly_plans
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can read own weekly_plans" ON public.weekly_plans
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can update own weekly_plans" ON public.weekly_plans
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
