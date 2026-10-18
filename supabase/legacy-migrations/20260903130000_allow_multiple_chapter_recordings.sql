-- A learner may stop anywhere, so each chapter can own any number of clips.
ALTER TABLE public.reading_recordings
  DROP CONSTRAINT reading_recordings_user_id_content_key_scope_key;
