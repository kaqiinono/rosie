begin;

alter table public.exam_content_revisions add column listening_directory jsonb;

create table exams_private.exam_media_binding_directories (
  binding_id uuid not null references public.exam_media_binding_revisions(id) on delete cascade,
  directory_id uuid not null references public.baidu_sync_directories(id),
  primary key (binding_id, directory_id)
);
create index exam_media_binding_directories_directory on exams_private.exam_media_binding_directories(directory_id);
alter table exams_private.exam_media_binding_directories enable row level security;
revoke all on exams_private.exam_media_binding_directories from public, anon, authenticated, service_role;
grant insert on exams_private.exam_media_binding_directories to service_role;

create function public.save_exam_listening_directory(
  p_id text, p_expected_version uuid, p_expected_directory_version uuid, p_request_id uuid, p_actor uuid, p_account text,
  p_generation uuid, p_directory_id uuid, p_path text
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_revision public.exam_content_revisions%rowtype;
  v_root text;
  v_directory jsonb;
  v_saved_directory jsonb;
  v_saved_directory_version uuid;
begin
  if p_actor is null or p_expected_version is null or p_request_id is null or p_generation is null
    or p_directory_id is null or p_path is null then raise exception 'exam_invalid_request'; end if;
  v_directory := pg_catalog.jsonb_build_object('directory_id', p_directory_id, 'path', p_path, 'generation', p_generation);
  select * into v_revision from public.exam_content_revisions where id = p_id for update;
  if not found then raise exception 'exam_not_found'; end if;
  if v_revision.status <> 'draft' then raise exception 'exam_not_editable'; end if;
  if v_revision.version <> p_expected_version then raise exception 'exam_conflict'; end if;
  v_saved_directory := v_revision.listening_directory - 'request_id' - 'actor_id';
  v_saved_directory_version := (v_revision.listening_directory ->> 'request_id')::uuid;
  if v_saved_directory_version = p_request_id then
    if v_saved_directory is distinct from v_directory or v_revision.listening_directory ->> 'actor_id' is distinct from p_actor::text
    then raise exception 'exam_conflict'; end if;
  elsif v_saved_directory_version is distinct from p_expected_directory_version then
    raise exception 'exam_conflict';
  end if;
  perform 1 from public.baidu_oauth_credentials where id = 'primary'
    and account_id = p_account and account_generation = p_generation for share;
  if not found then raise exception 'baidu_account_changed'; end if;
  select path into v_root from public.baidu_sync_directories where id = p_directory_id and account_id = p_account for share;
  if not found or not (p_path = v_root or pg_catalog.left(p_path, pg_catalog.length(case when v_root = '/' then '/' else v_root || '/' end))
    = case when v_root = '/' then '/' else v_root || '/' end)
  then raise exception 'exam_invalid_media_binding'; end if;
  if v_saved_directory = v_directory then return v_saved_directory_version; end if;
  update public.exam_content_revisions
    set listening_directory = v_directory || pg_catalog.jsonb_build_object('request_id', p_request_id, 'actor_id', p_actor)
    where id = p_id;
  return p_request_id;
end $$;

revoke all on function public.save_exam_listening_directory(text, uuid, uuid, uuid, uuid, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.save_exam_listening_directory(text, uuid, uuid, uuid, uuid, text, uuid, uuid, text) to service_role;

-- Legacy files still use the binding's main directory. New listening files carry their own bookmark.
create or replace function public.save_exam_media_bindings(
  p_id text, p_expected_version uuid, p_expected_binding uuid, p_request_id uuid, p_actor uuid,
  p_account text, p_generation uuid, p_directory_id uuid, p_main_path text, p_files jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_revision public.exam_content_revisions%rowtype;
  v_binding public.exam_media_binding_revisions%rowtype;
  v_root text;
  v_file_root text;
  v_solutions jsonb;
  v_file jsonb;
  v_slot jsonb;
  v_hash text;
  v_version uuid := pg_catalog.gen_random_uuid();
begin
  if p_actor is null or p_expected_version is null or p_request_id is null or p_generation is null
    or p_directory_id is null or p_main_path is null or pg_catalog.jsonb_typeof(p_files) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_files) > 2000 then raise exception 'exam_invalid_request'; end if;
  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object('id', p_id, 'version', p_expected_version,
    'binding', p_expected_binding, 'actor', p_actor, 'account', p_account, 'generation', p_generation,
    'directory', p_directory_id, 'path', p_main_path, 'files', p_files)::text);
  select * into v_revision from public.exam_content_revisions where id = p_id for update;
  if not found then raise exception 'exam_not_found'; end if;
  select * into v_binding from public.exam_media_binding_revisions where request_id = p_request_id;
  if found then
    if v_binding.request_hash <> v_hash then raise exception 'exam_conflict'; end if;
    return pg_catalog.jsonb_build_object('revisionId', p_id, 'version', v_binding.version_after, 'bindingRevisionId', v_binding.id);
  end if;
  if v_revision.status <> 'draft' then raise exception 'exam_not_editable'; end if;
  if v_revision.version <> p_expected_version
    or (v_revision.content ->> 'mediaBindingRevisionId') is distinct from p_expected_binding::text
  then raise exception 'exam_conflict'; end if;
  perform 1 from public.baidu_oauth_credentials where id = 'primary' and account_id = p_account and account_generation = p_generation for share;
  if not found then raise exception 'baidu_account_changed'; end if;
  select path into v_root from public.baidu_sync_directories where id = p_directory_id and account_id = p_account for share;
  if not found or not (p_main_path = v_root or pg_catalog.left(p_main_path, pg_catalog.length(case when v_root = '/' then '/' else v_root || '/' end))
    = case when v_root = '/' then '/' else v_root || '/' end) then raise exception 'exam_invalid_media_binding'; end if;
  select content into v_solutions from exams_private.exam_solutions where content_revision_id = p_id;
  if not found then raise exception 'exam_not_found'; end if;
  if (select count(*) <> count(distinct value ->> 'slot_id') from pg_catalog.jsonb_array_elements(p_files))
  then raise exception 'exam_invalid_media_binding'; end if;
  for v_file in select value from pg_catalog.jsonb_array_elements(p_files) loop
    select value into v_slot from pg_catalog.jsonb_array_elements((v_revision.content -> 'mediaSlots') || (v_solutions -> 'mediaSlots'))
      where value ->> 'id' = v_file ->> 'slot_id';
    if not found or v_file -> 'slot' is distinct from v_slot
      or pg_catalog.jsonb_typeof(v_file -> 'file_id') is distinct from 'string' or (v_file ->> 'file_id') !~ '^[1-9][0-9]{0,19}$'
      or pg_catalog.jsonb_typeof(v_file -> 'path') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_file -> 'size') is distinct from 'number'
      or (v_file ->> 'size')::numeric <= 0
      or pg_catalog.jsonb_typeof(v_file -> 'reviewed') is distinct from 'boolean'
      or (v_file -> 'duration_ms' is distinct from 'null'::jsonb and (
        pg_catalog.jsonb_typeof(v_file -> 'duration_ms') is distinct from 'number'
        or (v_file ->> 'duration_ms')::numeric <= 0 or (v_file ->> 'duration_ms')::numeric > 86400000))
      or (v_file ->> 'md5' is null and v_file ->> 'modified_at' is null)
    then raise exception 'exam_invalid_media_binding'; end if;
    v_file_root := p_main_path;
    if v_file ? 'directory_id' then
      if v_slot ->> 'purpose' not in ('exam_listening', 'training_audio')
        or pg_catalog.jsonb_typeof(v_file -> 'directory_id') is distinct from 'string'
        or (v_file ->> 'directory_id') !~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
      then raise exception 'exam_invalid_media_binding'; end if;
      select path into v_file_root from public.baidu_sync_directories
        where id = (v_file ->> 'directory_id')::uuid and account_id = p_account for share;
      if not found then raise exception 'exam_invalid_media_binding'; end if;
    end if;
    if pg_catalog.left(v_file ->> 'path', pg_catalog.length(case when v_file_root = '/' then '/' else v_file_root || '/' end))
      <> (case when v_file_root = '/' then '/' else v_file_root || '/' end)
    then raise exception 'exam_invalid_media_binding'; end if;
  end loop;
  insert into public.exam_media_binding_revisions(content_revision_id, account_id, account_generation, directory_id,
    main_path, files, created_by, version_after, request_id, request_hash)
    values (p_id, p_account, p_generation, p_directory_id, p_main_path, p_files, p_actor, v_version, p_request_id, v_hash)
    returning * into v_binding;
  insert into exams_private.exam_media_binding_directories (binding_id, directory_id)
    select distinct v_binding.id, (file ->> 'directory_id')::uuid
    from pg_catalog.jsonb_array_elements(p_files) file where file ? 'directory_id';
  update public.exam_content_revisions set version = v_version,
    content = pg_catalog.jsonb_set(content, '{mediaBindingRevisionId}', pg_catalog.to_jsonb(v_binding.id::text)),
    updated_by = p_actor, updated_at = pg_catalog.clock_timestamp(), last_request_id = p_request_id, last_request_hash = v_hash
    where id = p_id;
  return pg_catalog.jsonb_build_object('revisionId', p_id, 'version', v_version, 'bindingRevisionId', v_binding.id);
exception when unique_violation then raise exception 'exam_conflict';
end $$;

notify pgrst, 'reload schema';

commit;
