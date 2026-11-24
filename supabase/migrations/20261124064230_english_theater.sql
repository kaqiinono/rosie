create table public.theater_films (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  account_id text not null,
  account_generation uuid not null,
  directory_id uuid references public.baidu_sync_directories(id) on delete set null,
  directory_path text not null check (left(directory_path, 1) = '/'),
  video_file_id text not null check (video_file_id ~ '^[1-9][0-9]{0,19}$'),
  video_name text not null check (video_name ~* '\.mp4$' and position('/' in video_name) = 0),
  subtitle_en_file_id text check (subtitle_en_file_id ~ '^[1-9][0-9]{0,19}$'),
  subtitle_en_name text check (subtitle_en_name ~* '\.(srt|vtt|ass)$' and position('/' in subtitle_en_name) = 0),
  subtitle_zh_file_id text check (subtitle_zh_file_id ~ '^[1-9][0-9]{0,19}$'),
  subtitle_zh_name text check (subtitle_zh_name ~* '\.(srt|vtt|ass)$' and position('/' in subtitle_zh_name) = 0),
  file_fingerprints jsonb not null check (jsonb_typeof(file_fingerprints) = 'object'),
  published boolean not null default false,
  revision uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  check ((subtitle_en_file_id is null) = (subtitle_en_name is null)),
  check ((subtitle_zh_file_id is null) = (subtitle_zh_name is null)),
  check (coalesce(subtitle_en_file_id, subtitle_zh_file_id) is not null),
  check (subtitle_en_file_id is null or subtitle_zh_file_id is null or subtitle_en_file_id <> subtitle_zh_file_id)
);
create unique index theater_films_video on public.theater_films(account_id, account_generation, video_file_id)
  where published and directory_id is not null;
create index theater_films_directory on public.theater_films(directory_id);

alter table public.theater_films enable row level security;
revoke all on public.theater_films from public, anon, authenticated, service_role;
grant select, insert, update on public.theater_films to service_role;

create table public.theater_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  film_id uuid not null references public.theater_films(id),
  position_ms integer not null check (position_ms between 0 and 86400000),
  revision integer not null check (revision >= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, film_id)
);

alter table public.theater_progress enable row level security;
revoke all on public.theater_progress from public, anon, authenticated;
grant select, insert, update on public.theater_progress to authenticated;
create policy theater_progress_read on public.theater_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy theater_progress_insert on public.theater_progress for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy theater_progress_update on public.theater_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.save_theater_progress(p_film_id uuid, p_position_ms integer, p_revision integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_revision integer;
begin
  if v_user is null or p_revision is null or p_revision < 0 then
    return null;
  end if;
  if p_revision = 0 then
    insert into public.theater_progress(user_id, film_id, position_ms, revision)
      values (v_user, p_film_id, p_position_ms, 1)
      on conflict (user_id, film_id) do nothing
      returning revision into v_revision;
  else
    update public.theater_progress set position_ms = p_position_ms, revision = revision + 1,
      updated_at = pg_catalog.clock_timestamp()
      where user_id = v_user and film_id = p_film_id and revision = p_revision
      returning revision into v_revision;
  end if;
  return v_revision;
end;
$$;
revoke all on function public.save_theater_progress(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.save_theater_progress(uuid, integer, integer) to authenticated;

create table public.theater_study_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  film_id uuid not null references public.theater_films(id),
  kind text not null check (kind in ('favorite', 'note', 'word')),
  item_key text not null check (char_length(item_key) between 1 and 300),
  position_ms integer not null check (position_ms between 0 and 86400000),
  cue_text text not null check (char_length(cue_text) between 1 and 4000),
  detail text not null default '' check (char_length(detail) <= 2000),
  headword_id uuid references public.vocabulary_headwords(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, film_id, kind, item_key)
);

alter table public.theater_study_items enable row level security;
revoke all on public.theater_study_items from public, anon, authenticated;
grant select, insert, update, delete on public.theater_study_items to authenticated;
create policy theater_study_items_owner on public.theater_study_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
