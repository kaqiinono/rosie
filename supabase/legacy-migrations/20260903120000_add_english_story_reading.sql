-- Magic Tree House / English Story personal bookmarks and private recordings.

CREATE TABLE public.story_reading_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  volume_key text NOT NULL,
  chapter_key text NOT NULL,
  start_sentence_index integer NOT NULL CHECK (start_sentence_index > 0),
  start_sentence_text text NOT NULL,
  end_sentence_index integer NOT NULL CHECK (end_sentence_index >= start_sentence_index),
  end_sentence_text text NOT NULL,
  view_mode text NOT NULL DEFAULT 'chapter' CHECK (view_mode IN ('chapter', 'volume')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, volume_key)
);

ALTER TABLE public.story_reading_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY story_reading_progress_select_own
  ON public.story_reading_progress FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY story_reading_progress_insert_own
  ON public.story_reading_progress FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY story_reading_progress_update_own
  ON public.story_reading_progress FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY story_reading_progress_delete_own
  ON public.story_reading_progress FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE TABLE public.reading_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_key text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('chapter', 'volume')),
  title text NOT NULL DEFAULT '',
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'audio/mpeg',
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_key, scope)
);

CREATE INDEX idx_reading_recordings_user_updated
  ON public.reading_recordings (user_id, updated_at DESC);

ALTER TABLE public.reading_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY reading_recordings_select_own
  ON public.reading_recordings FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY reading_recordings_insert_own
  ON public.reading_recordings FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY reading_recordings_update_own
  ON public.reading_recordings FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY reading_recordings_delete_own
  ON public.reading_recordings FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'english-story-recordings',
  'english-story-recordings',
  false,
  52428800,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/mp4', 'audio/x-m4a']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "english-story-recordings: select own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'english-story-recordings'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
CREATE POLICY "english-story-recordings: insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'english-story-recordings'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
CREATE POLICY "english-story-recordings: update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'english-story-recordings'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'english-story-recordings'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
CREATE POLICY "english-story-recordings: delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'english-story-recordings'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
