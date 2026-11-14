begin;

create table public.exam_media_binding_revisions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  content_revision_id text not null references public.exam_content_revisions(id),
  account_id text not null,
  account_generation uuid not null,
  directory_id uuid not null references public.baidu_sync_directories(id),
  main_path text not null check (pg_catalog.left(main_path, 1) = '/'),
  files jsonb not null check (pg_catalog.jsonb_typeof(files) = 'array' and pg_catalog.jsonb_array_length(files) <= 2000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  version_after uuid not null,
  request_id uuid not null unique,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{32}$')
);
create index exam_media_bindings_content on public.exam_media_binding_revisions(content_revision_id, created_at);
alter table public.exam_media_binding_revisions enable row level security;
revoke all on public.exam_media_binding_revisions from public, anon, authenticated, service_role;
grant select, insert on public.exam_media_binding_revisions to service_role;

create function public.save_exam_media_bindings(
  p_id text, p_expected_version uuid, p_expected_binding uuid, p_request_id uuid, p_actor uuid,
  p_account text, p_generation uuid, p_directory_id uuid, p_main_path text, p_files jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_revision public.exam_content_revisions%rowtype;
  v_binding public.exam_media_binding_revisions%rowtype;
  v_root text;
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
      or pg_catalog.left(v_file ->> 'path', pg_catalog.length(case when p_main_path = '/' then '/' else p_main_path || '/' end))
        <> (case when p_main_path = '/' then '/' else p_main_path || '/' end)
      or pg_catalog.jsonb_typeof(v_file -> 'size') is distinct from 'number'
      or (v_file ->> 'size')::numeric <= 0
      or pg_catalog.jsonb_typeof(v_file -> 'reviewed') is distinct from 'boolean'
      or (v_file -> 'duration_ms' is distinct from 'null'::jsonb and (
        pg_catalog.jsonb_typeof(v_file -> 'duration_ms') is distinct from 'number'
        or (v_file ->> 'duration_ms')::numeric <= 0 or (v_file ->> 'duration_ms')::numeric > 86400000))
      or (v_file ->> 'md5' is null and v_file ->> 'modified_at' is null)
    then raise exception 'exam_invalid_media_binding'; end if;
  end loop;
  insert into public.exam_media_binding_revisions(content_revision_id, account_id, account_generation, directory_id,
    main_path, files, created_by, version_after, request_id, request_hash)
    values (p_id, p_account, p_generation, p_directory_id, p_main_path, p_files, p_actor, v_version, p_request_id, v_hash)
    returning * into v_binding;
  update public.exam_content_revisions set version = v_version,
    content = pg_catalog.jsonb_set(content, '{mediaBindingRevisionId}', pg_catalog.to_jsonb(v_binding.id::text)),
    updated_by = p_actor, updated_at = pg_catalog.clock_timestamp(), last_request_id = p_request_id, last_request_hash = v_hash
    where id = p_id;
  return pg_catalog.jsonb_build_object('revisionId', p_id, 'version', v_version, 'bindingRevisionId', v_binding.id);
exception when unique_violation then raise exception 'exam_conflict';
end $$;

create function public.exam_listening_duration_ms(p_content jsonb, p_files jsonb, p_section_id text default null)
returns bigint language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_slot jsonb; v_file jsonb; v_program jsonb; v_length bigint; v_total bigint := 0;
  v_repeat integer; v_wait bigint; v_found boolean := false; v_applies boolean;
begin
  for v_slot in select value from pg_catalog.jsonb_array_elements(p_content -> 'mediaSlots')
    where value ->> 'purpose' = 'exam_listening' and value -> 'required' = 'true'::jsonb loop
    v_applies := p_section_id is null;
    if not v_applies then
      if v_slot #>> '{target,kind}' = 'content_set' then v_applies := p_section_id = 'listening';
      elsif v_slot #>> '{target,kind}' = 'group' then
        v_applies := exists (select 1 from pg_catalog.jsonb_array_elements(p_content -> 'groups') item
          where item ->> 'id' = v_slot #>> '{target,id}' and item ->> 'sectionId' = p_section_id);
      elsif v_slot #>> '{target,kind}' = 'guidance' then
        v_applies := exists (select 1 from pg_catalog.jsonb_array_elements(p_content -> 'guidance') guidance,
          pg_catalog.jsonb_array_elements_text(guidance -> 'groupIds') as referenced_group(id),
          pg_catalog.jsonb_array_elements(p_content -> 'groups') item
          where guidance ->> 'id' = v_slot #>> '{target,id}' and item ->> 'id' = referenced_group.id and item ->> 'sectionId' = p_section_id);
      end if;
    end if;
    if not v_applies then continue; end if;
    v_found := true;
    select value into v_file from pg_catalog.jsonb_array_elements(p_files) where value ->> 'slot_id' = v_slot ->> 'id';
    v_program := v_slot -> 'playback';
    if not found or v_file -> 'slot' is distinct from v_slot or v_file -> 'reviewed' is distinct from 'true'::jsonb
      or pg_catalog.jsonb_typeof(v_program) is distinct from 'object'
    then raise exception 'exam_listening_program_missing'; end if;
    if pg_catalog.jsonb_typeof(v_slot -> 'segment') = 'object' then
      v_length := (v_slot #>> '{segment,endMs}')::bigint - (v_slot #>> '{segment,startMs}')::bigint;
      if v_file ->> 'duration_ms' is not null and (v_slot #>> '{segment,endMs}')::bigint > (v_file ->> 'duration_ms')::bigint
      then raise exception 'exam_listening_program_missing'; end if;
    else v_length := (v_file ->> 'duration_ms')::bigint; end if;
    v_repeat := (v_program ->> 'repeatCount')::integer;
    v_wait := (v_program ->> 'waitAfterMs')::bigint;
    if v_length is null or v_length <= 0 or v_repeat is null or v_repeat < 1 or v_wait is null or v_wait < 0
      or (v_program -> 'includesSourceRepetitions' = 'true'::jsonb and (v_repeat <> 1 or v_wait <> 0))
    then raise exception 'exam_listening_program_missing'; end if;
    v_total := v_total + v_length * v_repeat + v_wait;
    if v_total > 86400000 then raise exception 'exam_listening_program_missing'; end if;
  end loop;
  if not v_found then return null; end if;
  return v_total;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'exam_listening_program_missing';
end $$;

create or replace function exams_private.exam_media_publication_ready(p_content jsonb, p_solutions jsonb)
returns boolean language plpgsql stable security invoker set search_path = '' as $$
declare v_binding public.exam_media_binding_revisions%rowtype; v_slot jsonb;
begin
  if not exists (select 1 from pg_catalog.jsonb_array_elements((p_content -> 'mediaSlots') || (p_solutions -> 'mediaSlots')) slot
    where slot -> 'required' = 'true'::jsonb) then return true; end if;
  select * into v_binding from public.exam_media_binding_revisions
    where id::text = p_content ->> 'mediaBindingRevisionId' and content_revision_id = p_content ->> 'id';
  if not found then return false; end if;
  if not exists (select 1 from public.baidu_oauth_credentials where id = 'primary'
    and account_id = v_binding.account_id and account_generation = v_binding.account_generation) then return false; end if;
  for v_slot in select value from pg_catalog.jsonb_array_elements((p_content -> 'mediaSlots') || (p_solutions -> 'mediaSlots'))
    where value -> 'required' = 'true'::jsonb loop
    if not exists (select 1 from pg_catalog.jsonb_array_elements(v_binding.files) file
      where file -> 'slot' = v_slot and file -> 'reviewed' = 'true'::jsonb)
    then return false; end if;
    if exists (select 1 from pg_catalog.jsonb_array_elements(v_binding.files) file,
      pg_catalog.jsonb_array_elements(v_binding.files) sibling
      where file ->> 'slot_id' = v_slot ->> 'id' and sibling ->> 'file_id' = file ->> 'file_id'
        and sibling #>> '{slot,audience}' is distinct from file #>> '{slot,audience}') then return false; end if;
  end loop;
  perform public.exam_listening_duration_ms(p_content, v_binding.files, null);
  return true;
end $$;

revoke all on function public.save_exam_media_bindings(text, uuid, uuid, uuid, uuid, text, uuid, uuid, text, jsonb),
  public.exam_listening_duration_ms(jsonb, jsonb, text),
  exams_private.exam_media_publication_ready(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_exam_media_bindings(text, uuid, uuid, uuid, uuid, text, uuid, uuid, text, jsonb),
  public.exam_listening_duration_ms(jsonb, jsonb, text),
  exams_private.exam_media_publication_ready(jsonb, jsonb) to service_role;

comment on table public.exam_media_binding_revisions is 'Immutable private file snapshots; one file may serve multiple slots. Each content/attempt pins an exact binding revision.';

commit;
