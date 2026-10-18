-- Story recordings are always chapter clips; whole-volume recordings are not supported.
ALTER TABLE public.reading_recordings
  DROP CONSTRAINT reading_recordings_scope_check;

ALTER TABLE public.reading_recordings
  ADD CONSTRAINT reading_recordings_scope_check
  CHECK (scope = 'chapter');
