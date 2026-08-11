-- RLS init-plan optimization, batch 2/3 (12 tables, 27 policies).

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER POLICY chinese_wrong_delete_own ON public.chinese_wrong_items
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY chinese_wrong_insert_own ON public.chinese_wrong_items
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY chinese_wrong_select_own ON public.chinese_wrong_items
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY chinese_wrong_update_own ON public.chinese_wrong_items
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY english_wrong_delete_own ON public.english_wrong
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY english_wrong_insert_own ON public.english_wrong
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY english_wrong_select_own ON public.english_wrong
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY english_wrong_update_own ON public.english_wrong
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Authenticated insert flipbook_books" ON public.flipbook_books
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
  );

ALTER POLICY "Users insert own flipbook_progress" ON public.flipbook_progress
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users read own flipbook_progress" ON public.flipbook_progress
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users update own flipbook_progress" ON public.flipbook_progress
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY knowledge_chunks_insert_import ON public.knowledge_chunks
  WITH CHECK (user_id = (SELECT auth.uid()));
ALTER POLICY knowledge_chunks_select ON public.knowledge_chunks
  USING (user_id IS NULL OR user_id = (SELECT auth.uid()));

ALTER POLICY knowledge_documents_insert_import ON public.knowledge_documents
  WITH CHECK (
    source_type = 'import'
    AND owner_id = (SELECT auth.uid())
  );
ALTER POLICY knowledge_documents_select ON public.knowledge_documents
  USING (owner_id IS NULL OR owner_id = (SELECT auth.uid()));

ALTER POLICY knowledge_imports_own ON public.knowledge_imports
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY math_favorites_delete_own ON public.math_favorites
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY math_favorites_insert_own ON public.math_favorites
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY math_favorites_select_own ON public.math_favorites
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY math_practice_attempts_delete ON public.math_practice_attempts
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY math_practice_attempts_insert ON public.math_practice_attempts
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY math_practice_attempts_select ON public.math_practice_attempts
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY math_practice_attempts_update ON public.math_practice_attempts
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Authenticated insert math_problem_images" ON public.math_problem_images
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND user_id = (SELECT auth.uid())
    AND image_kind = ANY (ARRAY['analysis'::text, 'figure'::text, 'summary'::text])
    AND (
      (
        image_kind = ANY (ARRAY['analysis'::text, 'figure'::text])
        AND problem_id LIKE lesson_id || '-%'
        AND (
          (image_kind = 'analysis' AND storage_path LIKE 'analysis/' || lesson_id || '/%')
          OR (image_kind = 'figure' AND storage_path LIKE 'figures/' || lesson_id || '/%')
        )
      )
      OR (
        image_kind = 'summary'
        AND problem_id = lesson_id || '__SUMMARY'
        AND storage_path LIKE 'summaries/' || lesson_id || '/summary.%'
      )
    )
  );

ALTER POLICY math_quiz_batches_user ON public.math_quiz_batches
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY math_quiz_papers_user ON public.math_quiz_papers
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
