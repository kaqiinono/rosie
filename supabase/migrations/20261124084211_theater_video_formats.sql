alter table public.theater_films
  drop constraint theater_films_video_name_check,
  add constraint theater_films_video_name_check
    check (video_name ~* '\.(mp4|mkv|rmvb)$' and position('/' in video_name) = 0),
  add column playback_file_id text,
  add column playback_name text,
  add constraint theater_films_playback_copy_check check (
    (playback_file_id is null and playback_name is null)
    or (
      video_name ~* '\.(mkv|rmvb)$'
      and playback_file_id is not null
      and playback_file_id ~ '^[1-9][0-9]{0,19}$'
      and playback_file_id <> video_file_id
      and playback_name is not null
      and playback_name = regexp_replace(video_name, '\.(mkv|rmvb)$', '', 'i') || '.playback.mp4'
      and coalesce(jsonb_typeof(file_fingerprints->'playback') = 'object', false)
    )
  );

alter table public.theater_subtitle_jobs
  add column transcription_copy jsonb,
  add constraint theater_subtitle_jobs_transcription_copy_check
    check (transcription_copy is null or jsonb_typeof(transcription_copy) = 'object');
