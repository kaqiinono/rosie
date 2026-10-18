ALTER TABLE public.story_reading_progress
  DROP CONSTRAINT story_reading_progress_check;

ALTER TABLE public.story_reading_progress
  ADD CONSTRAINT story_reading_progress_end_sentence_index_check
  CHECK (end_sentence_index > 0);
