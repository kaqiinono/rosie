-- packages/chinese/sql/chinese-reading-recordings.sql
-- Incremental. No destructive data ops. Run in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.chinese_reading_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  book_slug TEXT NOT NULL,
  lesson_key TEXT NOT NULL,
  lesson_title TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'audio/webm',
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chinese_reading_recordings_book_chk
    CHECK (book_slug IN ('g1b', 'g2a', 'g2b')),
  CONSTRAINT chinese_reading_recordings_duration_chk
    CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_chinese_reading_recordings_user_created
  ON public.chinese_reading_recordings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chinese_reading_recordings_user_book
  ON public.chinese_reading_recordings (user_id, book_slug, created_at DESC);

ALTER TABLE public.chinese_reading_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chinese_reading_recordings_select_own ON public.chinese_reading_recordings;
CREATE POLICY chinese_reading_recordings_select_own ON public.chinese_reading_recordings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS chinese_reading_recordings_insert_own ON public.chinese_reading_recordings;
CREATE POLICY chinese_reading_recordings_insert_own ON public.chinese_reading_recordings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS chinese_reading_recordings_delete_own ON public.chinese_reading_recordings;
CREATE POLICY chinese_reading_recordings_delete_own ON public.chinese_reading_recordings
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
