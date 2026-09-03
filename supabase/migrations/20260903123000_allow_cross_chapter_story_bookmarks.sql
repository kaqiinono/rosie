-- A visible viewport in full-volume mode can span a chapter boundary, so the
-- final sentence has its own chapter-local index and may be lower than the first.
ALTER TABLE public.story_reading_progress
  DROP CONSTRAINT story_reading_progress_check;

ALTER TABLE public.story_reading_progress
  ADD CONSTRAINT story_reading_progress_end_sentence_index_check
  CHECK (end_sentence_index > 0);
