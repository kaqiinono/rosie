-- Restrict shared curriculum mutations to trusted administrators.
-- Set auth.users.raw_app_meta_data.role = 'admin' for parent/admin accounts.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS chinese_char_entries_mutate_auth ON public.chinese_char_entries;
DROP POLICY IF EXISTS chinese_char_entries_mutate_admin ON public.chinese_char_entries;
CREATE POLICY chinese_char_entries_mutate_admin ON public.chinese_char_entries
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS chinese_lesson_chars_mutate_auth ON public.chinese_lesson_chars;
DROP POLICY IF EXISTS chinese_lesson_chars_mutate_admin ON public.chinese_lesson_chars;
CREATE POLICY chinese_lesson_chars_mutate_admin ON public.chinese_lesson_chars
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS chinese_lessons_mutate_auth ON public.chinese_lessons;
DROP POLICY IF EXISTS chinese_lessons_mutate_admin ON public.chinese_lessons;
CREATE POLICY chinese_lessons_mutate_admin ON public.chinese_lessons
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated delete flipbook_books" ON public.flipbook_books;
DROP POLICY IF EXISTS "Owners or admins delete flipbook_books" ON public.flipbook_books;
CREATE POLICY "Owners or admins delete flipbook_books" ON public.flipbook_books
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated update flipbook_books" ON public.flipbook_books;
DROP POLICY IF EXISTS "Owners or admins update flipbook_books" ON public.flipbook_books;
CREATE POLICY "Owners or admins update flipbook_books" ON public.flipbook_books
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated delete reading_passage_media" ON public.reading_passage_media;
DROP POLICY IF EXISTS "Owners or admins delete reading_passage_media" ON public.reading_passage_media;
CREATE POLICY "Owners or admins delete reading_passage_media" ON public.reading_passage_media
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated update reading_passage_media" ON public.reading_passage_media;
DROP POLICY IF EXISTS "Owners or admins update reading_passage_media" ON public.reading_passage_media;
CREATE POLICY "Owners or admins update reading_passage_media" ON public.reading_passage_media
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated delete math_problem_images" ON public.math_problem_images;
DROP POLICY IF EXISTS "Owners or admins delete math_problem_images" ON public.math_problem_images;
CREATE POLICY "Owners or admins delete math_problem_images" ON public.math_problem_images
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated update math_problem_images" ON public.math_problem_images;
DROP POLICY IF EXISTS "Owners or admins update math_problem_images" ON public.math_problem_images;
CREATE POLICY "Owners or admins update math_problem_images" ON public.math_problem_images
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
  WITH CHECK (
    ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
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
