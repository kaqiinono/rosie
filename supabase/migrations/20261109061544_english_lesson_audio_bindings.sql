begin;

create table public.english_audio_lessons (
  account_id text not null,
  lesson_key text not null,
  revision uuid not null default gen_random_uuid(),
  primary key (account_id, lesson_key)
);

create table public.english_audio_bindings (
  account_id text not null,
  lesson_key text not null,
  slot text not null,
  directory_id uuid not null,
  path text not null,
  file_id text not null check (file_id ~ '^[1-9][0-9]{0,19}$'),
  primary key (account_id, lesson_key, slot),
  foreign key (account_id, lesson_key) references public.english_audio_lessons on delete cascade,
  foreign key (account_id, directory_id) references public.baidu_sync_directories(account_id, id)
);
create index on public.english_audio_bindings(account_id, directory_id);
alter table public.english_audio_lessons enable row level security;
alter table public.english_audio_bindings enable row level security;
revoke all on public.english_audio_lessons, public.english_audio_bindings from public, anon, authenticated;
grant select, insert, update, delete on public.english_audio_lessons, public.english_audio_bindings to service_role;

create function public.save_english_audio_lesson(p_account text, p_generation uuid, p_lesson text, p_revision uuid, p_files jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  new_revision uuid := gen_random_uuid();
begin
  perform 1 from public.baidu_oauth_credentials where id = 'primary'
    and account_id = p_account and account_generation = p_generation for share;
  if not found then raise exception 'baidu_account_changed'; end if;
  if p_revision is null then
    insert into public.english_audio_lessons values (p_account, p_lesson, new_revision)
      on conflict do nothing;
  else
    update public.english_audio_lessons set revision = new_revision
      where account_id = p_account and lesson_key = p_lesson and revision = p_revision;
  end if;
  if not found then raise exception 'english_audio_conflict'; end if;
  delete from public.english_audio_bindings where account_id = p_account and lesson_key = p_lesson;
  insert into public.english_audio_bindings(account_id,lesson_key,slot,directory_id,path,file_id)
    select p_account,p_lesson,f.slot,f.directory_id,f.path,f.file_id
    from jsonb_to_recordset(p_files) as f(slot text,directory_id uuid,path text,file_id text);
  return new_revision;
end $$;
revoke all on function public.save_english_audio_lesson(text,uuid,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_english_audio_lesson(text,uuid,text,uuid,jsonb) to service_role;

commit;
