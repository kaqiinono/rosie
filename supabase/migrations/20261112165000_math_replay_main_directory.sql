-- Allow math replay lessons to bind a subdirectory under a bookmarked authorized root,
-- matching the English audio main-directory pattern. Existing rows keep their bookmark
-- path as main_path; scans become keyed by (directory_id, path).

begin;

alter table public.math_replay_lessons
  add column if not exists main_path text;

update public.math_replay_lessons l
set main_path = d.path
from public.baidu_sync_directories d
where l.directory_id is not null
  and l.main_path is null
  and d.id = l.directory_id
  and d.account_id = l.account_id;

alter table public.math_replay_lessons
  drop constraint if exists math_replay_main_directory_pair;

alter table public.math_replay_lessons
  add constraint math_replay_main_directory_pair
  check ((directory_id is null) = (main_path is null));

alter table public.math_replay_scans
  add column if not exists path text;

update public.math_replay_scans s
set path = d.path
from public.baidu_sync_directories d
where s.path is null and d.id = s.directory_id;

alter table public.math_replay_scans
  alter column path set not null;

alter table public.math_replay_scans
  drop constraint if exists math_replay_scans_pkey;

alter table public.math_replay_scans
  add primary key (directory_id, path);

drop view if exists public.math_replay_resolved;
create view public.math_replay_resolved with (security_invoker = true) as
select
  b.*,
  d.id as directory_id,
  l.main_path as directory,
  coalesce(s.files ->> b.fs_id, b.filename) as current_name,
  (s.version is null or coalesce(s.files ? b.fs_id, false)) as available
from public.math_replay_bindings b
join public.baidu_oauth_credentials a on a.id = 'primary' and a.account_id = b.account_id
join public.math_replay_lessons l on l.account_id = b.account_id and l.lesson_key = b.lesson_key
join public.baidu_sync_directories d on d.id = l.directory_id and d.account_id = b.account_id
left join public.math_replay_scans s on s.directory_id = d.id and s.path = l.main_path;
revoke all on public.math_replay_resolved from public, anon, authenticated;
grant select on public.math_replay_resolved to service_role;

drop function if exists public.math_replay_editor(text, uuid);
create function public.math_replay_editor(p_lesson text, p_directory uuid default null, p_path text default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'generation', a.account_generation,
    'directories', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'path', path) order by path)
      from public.baidu_sync_directories where account_id = a.account_id
    ), '[]'),
    'directoryId', l.directory_id,
    'mainPath', l.main_path,
    'revision', l.revision,
    'savedAt', l.saved_at,
    'reviewNames', coalesce(to_jsonb(l.review_names), '[]'),
    'selectedId', d.id,
    'selectedPath', case when d.id is null then null else coalesce(p_path, l.main_path, d.path) end,
    'version', s.version,
    'syncedAt', s.synced_at,
    'files', coalesce(s.files, '{}'),
    'bindings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'problemId', problem_id,
        'fileId', fs_id,
        'name', current_name,
        'available', available
      ))
      from public.math_replay_resolved
      where account_id = a.account_id and lesson_key = p_lesson
    ), '[]'),
    'occupied', coalesce((
      select jsonb_object_agg(
        b.fs_id,
        jsonb_build_object('lessonKey', b.lesson_key, 'problemId', b.problem_id)
      )
      from public.math_replay_bindings b
      where b.account_id = a.account_id
        and b.lesson_key <> p_lesson
        and s.files ? b.fs_id
    ), '{}')
  )
  from public.baidu_oauth_credentials a
  left join public.math_replay_lessons l on l.account_id = a.account_id and l.lesson_key = p_lesson
  left join public.baidu_sync_directories d
    on d.account_id = a.account_id and d.id = coalesce(p_directory, l.directory_id)
  left join public.math_replay_scans s
    on s.directory_id = d.id
    and s.path = coalesce(p_path, case when p_directory is null then l.main_path else d.path end)
  where a.id = 'primary' and a.account_id is not null and a.account_generation is not null
$$;

drop function if exists public.math_replay_store_scan(uuid, uuid, uuid, jsonb);
create function public.math_replay_store_scan(
  p_generation uuid, p_directory uuid, p_path text, p_version uuid, p_files jsonb
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  acct text;
  old_version uuid;
begin
  select account_id into strict acct
  from public.baidu_oauth_credentials
  where id = 'primary' and account_generation = p_generation
  for update;
  perform 1 from public.baidu_sync_directories where id = p_directory and account_id = acct for key share;
  if not found then raise exception 'directory_changed'; end if;
  if p_path is null or left(p_path, 1) <> '/' then raise exception 'directory_changed'; end if;
  select version into old_version
  from public.math_replay_scans
  where directory_id = p_directory and path = p_path;
  if old_version is distinct from p_version then raise exception 'scan_changed'; end if;
  insert into public.math_replay_scans(directory_id, path, files)
  values (p_directory, p_path, p_files)
  on conflict (directory_id, path) do update
    set files = excluded.files, version = excluded.version, synced_at = excluded.synced_at;
  update public.math_replay_bindings b
  set fs_id = f.key
  from public.math_replay_lessons l, jsonb_each_text(p_files) f
  where old_version is null
    and l.directory_id = p_directory
    and l.main_path = p_path
    and b.account_id = l.account_id
    and b.lesson_key = l.lesson_key
    and b.fs_id is null
    and b.filename = f.value
    and not exists (
      select 1 from public.math_replay_bindings used
      where used.account_id = acct and used.fs_id = f.key
    );
end $$;

drop function if exists public.math_replay_publish(uuid, text, uuid, uuid, uuid, jsonb);
create function public.math_replay_publish(
  p_generation uuid,
  p_lesson text,
  p_directory uuid,
  p_path text,
  p_revision uuid,
  p_version uuid,
  p_picks jsonb
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  acct text;
  prev public.math_replay_lessons;
  scan public.math_replay_scans;
  rows_to_save jsonb;
begin
  select account_id into strict acct
  from public.baidu_oauth_credentials
  where id = 'primary' and account_generation = p_generation
  for update;
  select * into prev from public.math_replay_lessons where account_id = acct and lesson_key = p_lesson;
  if prev.revision is distinct from p_revision then raise exception 'lesson_changed'; end if;
  if p_directory is null then
    if p_path is not null then raise exception 'directory_changed'; end if;
    if p_picks <> '{}'::jsonb then raise exception 'invalid_file'; end if;
  else
    if p_path is null or left(p_path, 1) <> '/' then raise exception 'directory_changed'; end if;
    perform 1 from public.baidu_sync_directories where id = p_directory and account_id = acct for key share;
    if not found then raise exception 'directory_changed'; end if;
    select * into scan from public.math_replay_scans where directory_id = p_directory and path = p_path;
    if scan.version is null or scan.version is distinct from p_version then raise exception 'scan_changed'; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'problem_id', p.key,
    'fs_id', case when scan.files ? p.value then p.value else b.fs_id end,
    'filename', coalesce(scan.files ->> p.value, b.filename)
  )), '[]')
  into rows_to_save
  from jsonb_each_text(p_picks) p
  left join public.math_replay_bindings b
    on b.account_id = acct
    and b.lesson_key = p_lesson
    and b.problem_id = p.key
    and prev.directory_id = p_directory
    and prev.main_path = p_path
    and coalesce(b.fs_id, 'legacy:' || b.filename) = p.value;
  if exists (select 1 from jsonb_array_elements(rows_to_save) r where r->>'filename' is null) then
    raise exception 'invalid_file';
  end if;
  insert into public.math_replay_lessons(account_id, lesson_key, directory_id, main_path, review_names)
  values (
    acct,
    p_lesson,
    p_directory,
    p_path,
    array(
      select n from unnest(prev.review_names) n
      where prev.directory_id = p_directory
        and prev.main_path = p_path
        and not exists (
          select 1 from jsonb_array_elements(rows_to_save) r where r->>'filename' = n
        )
    )
  )
  on conflict (account_id, lesson_key) do update
    set directory_id = excluded.directory_id,
        main_path = excluded.main_path,
        revision = excluded.revision,
        saved_at = excluded.saved_at,
        review_names = excluded.review_names;
  delete from public.math_replay_bindings where account_id = acct and lesson_key = p_lesson;
  insert into public.math_replay_bindings(account_id, lesson_key, problem_id, fs_id, filename)
  select acct, p_lesson, r.problem_id, r.fs_id, r.filename
  from jsonb_to_recordset(rows_to_save) as r(problem_id text, fs_id text, filename text);
end $$;

revoke all on function public.math_replay_editor(text, uuid, text),
  public.math_replay_store_scan(uuid, uuid, text, uuid, jsonb),
  public.math_replay_publish(uuid, text, uuid, text, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.math_replay_editor(text, uuid, text),
  public.math_replay_store_scan(uuid, uuid, text, uuid, jsonb),
  public.math_replay_publish(uuid, text, uuid, text, uuid, uuid, jsonb)
  to service_role;

commit;
