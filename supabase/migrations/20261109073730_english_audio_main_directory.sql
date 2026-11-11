alter table public.english_audio_lessons
  add column directory_id uuid,
  add column main_path text,
  add constraint english_audio_main_directory_pair check ((directory_id is null) = (main_path is null)),
  add foreign key (account_id, directory_id) references public.baidu_sync_directories(account_id, id);

create index english_audio_lessons_directory_idx on public.english_audio_lessons(account_id, directory_id)
  where directory_id is not null;

create function public.save_english_audio_lesson_with_directory(
  p_account text, p_generation uuid, p_lesson text, p_revision uuid,
  p_files jsonb, p_directory_id uuid, p_main_path text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  new_revision uuid;
begin
  new_revision := public.save_english_audio_lesson(p_account, p_generation, p_lesson, p_revision, p_files);
  update public.english_audio_lessons set directory_id = p_directory_id, main_path = p_main_path
    where account_id = p_account and lesson_key = p_lesson;
  return new_revision;
end $$;

revoke all on function public.save_english_audio_lesson_with_directory(text,uuid,text,uuid,jsonb,uuid,text)
  from public, anon, authenticated;
grant execute on function public.save_english_audio_lesson_with_directory(text,uuid,text,uuid,jsonb,uuid,text)
  to service_role;
