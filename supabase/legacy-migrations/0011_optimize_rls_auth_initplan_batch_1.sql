-- RLS init-plan optimization, batch 1/3 (12 tables, 29 policies).
-- ALTER POLICY preserves each policy's command and all unspecified clauses.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER POLICY adaptive_plan_word_progress_own ON public.adaptive_plan_word_progress
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY adaptive_word_plans_own ON public.adaptive_word_plans
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY ai_conversations_own ON public.ai_conversations
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "authenticated can read audio_assets" ON public.audio_assets
  TO authenticated USING (true);
ALTER POLICY "users delete own audio_assets" ON public.audio_assets
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "users insert own audio_assets" ON public.audio_assets
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "users update own audio_assets" ON public.audio_assets
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "authenticated can read audio_playlist_items" ON public.audio_playlist_items
  TO authenticated USING (true);
ALTER POLICY "users delete own audio_playlist_items" ON public.audio_playlist_items
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "users insert own audio_playlist_items" ON public.audio_playlist_items
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "authenticated can read audio_playlists" ON public.audio_playlists
  TO authenticated USING (true);
ALTER POLICY "users delete own audio_playlists" ON public.audio_playlists
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "users insert own audio_playlists" ON public.audio_playlists
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "users update own audio_playlists" ON public.audio_playlists
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY calc_sessions_insert_own ON public.calc_sessions
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY calc_sessions_select_own ON public.calc_sessions
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY chinese_char_mastery_delete_own ON public.chinese_char_mastery
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY chinese_char_mastery_insert_own ON public.chinese_char_mastery
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY chinese_char_mastery_select_own ON public.chinese_char_mastery
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY chinese_char_mastery_update_own ON public.chinese_char_mastery
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY chinese_reading_recordings_delete_own ON public.chinese_reading_recordings
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY chinese_reading_recordings_insert_own ON public.chinese_reading_recordings
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY chinese_reading_recordings_select_own ON public.chinese_reading_recordings
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY chinese_roadmap_plan_lesson_runs_own ON public.chinese_roadmap_plan_lesson_runs
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY chinese_roadmap_plans_own ON public.chinese_roadmap_plans
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY chinese_weekly_plans_delete_own ON public.chinese_weekly_plans
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY chinese_weekly_plans_insert_own ON public.chinese_weekly_plans
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY chinese_weekly_plans_select_own ON public.chinese_weekly_plans
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY chinese_weekly_plans_update_own ON public.chinese_weekly_plans
  USING ((SELECT auth.uid()) = user_id);
