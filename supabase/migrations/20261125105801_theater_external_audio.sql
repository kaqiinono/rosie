-- NULL means the audio metadata is unknown. An empty array means no audio tracks were found.
alter table public.theater_films
  add column external_audio_file_id text,
  add column external_audio_name text,
  add column video_audio_codecs text[],
  add column playback_audio_codecs text[],
  add constraint theater_films_external_audio_check check (
    (external_audio_file_id is null and external_audio_name is null)
    or (
      external_audio_file_id is not null and external_audio_file_id ~ '^[1-9][0-9]{0,19}$'
      and external_audio_name is not null and external_audio_name ~* '\.(mp3|m4a|aac)$'
      and position('/' in external_audio_name) = 0
      and coalesce(jsonb_typeof(file_fingerprints->'audio') = 'object', false)
    )
  );
