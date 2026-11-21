begin;

alter table public.exam_content_revisions
  add column superseded_by text references public.exam_content_revisions(id);

create or replace function exams_private.guard_exam_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_set public.exam_content_sets%rowtype;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'exam_not_editable'; end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.status <> 'draft' then
      if old.status = 'published' and new.status = 'withdrawn'
        and (pg_catalog.to_jsonb(new) - array['status', 'content', 'updated_at', 'superseded_by'])
          = (pg_catalog.to_jsonb(old) - array['status', 'content', 'updated_at', 'superseded_by'])
        and new.content = pg_catalog.jsonb_set(old.content, '{status}', '"withdrawn"'::jsonb)
      then return new; end if;
      if old.status = 'published' and new.status = 'published'
        and (to_jsonb(new) - 'listening_directory') = (to_jsonb(old) - 'listening_directory')
      then return new; end if;
      if old.status = 'withdrawn' and new.status = 'withdrawn'
        and old.superseded_by is null and new.superseded_by is not null
        and (to_jsonb(new) - 'superseded_by') = (to_jsonb(old) - 'superseded_by')
      then return new; end if;
      if old.status = 'withdrawn' and old.superseded_by is null and new.status = 'draft'
        and not exists (select 1 from public.exam_attempts where content_revision_id = old.id)
        and (pg_catalog.to_jsonb(new) - array['status', 'content', 'updated_at', 'updated_by'])
          = (pg_catalog.to_jsonb(old) - array['status', 'content', 'updated_at', 'updated_by'])
        and new.content = pg_catalog.jsonb_set(old.content, '{status}', '"draft"'::jsonb)
      then return new; end if;
      raise exception 'exam_not_editable';
    end if;
    if new.id is distinct from old.id
      or new.content_set_id is distinct from old.content_set_id
      or new.revision is distinct from old.revision
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then raise exception 'exam_invalid_draft'; end if;
  end if;

  select * into v_set from public.exam_content_sets where id = new.content_set_id;
  if not found or not coalesce(new.set_snapshot @> pg_catalog.jsonb_build_object(
    'id', v_set.id, 'source', pg_catalog.jsonb_build_object('id', v_set.source_id),
    'testNumber', v_set.test_number, 'template', pg_catalog.jsonb_build_object(
      'id', v_set.template_id, 'version', v_set.template_version), 'kind', v_set.kind), false)
  then raise exception 'exam_invalid_draft'; end if;
  return new;
end $$;

create or replace function public.save_exam_listening_directory(
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
  if v_revision.status not in ('draft', 'published') then raise exception 'exam_not_editable'; end if;
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


-- Requests for live saves keep a durable receipt after the source becomes historical.
create table exams_private.exam_live_save_receipts (
  request_id uuid primary key,
  request_hash text not null,
  receipt jsonb not null
);
alter table exams_private.exam_live_save_receipts enable row level security;
revoke all on exams_private.exam_live_save_receipts from public, anon, authenticated;
grant select, insert on exams_private.exam_live_save_receipts to service_role;

create function exams_private.switch_exam_publication(p_old text, p_new text, p_actor uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_old is not null then
    update public.exam_content_revisions set status = 'withdrawn', superseded_by = p_new,
      content = jsonb_set(content, '{status}', '"withdrawn"'), updated_at = clock_timestamp()
      where id = p_old and status = 'published';
    if not found then raise exception 'exam_conflict'; end if;
  end if;
  update public.exam_content_revisions set status = 'published',
    content = jsonb_set(content, '{status}', '"published"'), updated_by = p_actor, updated_at = clock_timestamp()
    where id = p_new and status = 'draft';
  if not found then raise exception 'exam_conflict'; end if;
end $$;

-- A new revision keeps the original questions, media grants and answers available
-- to attempts that opened before the save.
create function exams_private.fork_exam_revision(
  p_old public.exam_content_revisions, p_actor uuid, p_set jsonb, p_content jsonb, p_solutions jsonb
)
returns public.exam_content_revisions language plpgsql security invoker set search_path = '' as $$
declare
  v_id text := 'exam-revision:' || gen_random_uuid()::text;
  v_revision integer;
  v_new public.exam_content_revisions%rowtype;
begin
  select max(revision) + 1 into v_revision from public.exam_content_revisions
    where content_set_id = p_old.content_set_id;
  perform public.save_exam_draft(p_actor, gen_random_uuid(), null, p_set,
    p_content || jsonb_build_object('id', v_id, 'revision', v_revision, 'status', 'draft', 'mediaBindingRevisionId', null),
    p_solutions || jsonb_build_object('contentRevisionId', v_id));
  update public.exam_content_revisions set listening_directory = p_old.listening_directory
    where id = v_id returning * into v_new;
  insert into public.exam_image_task_states(content_revision_id, slot_id, retired, actor_id, updated_at)
    select v_id, t.slot_id, t.retired, t.actor_id, t.updated_at from public.exam_image_task_states t
    where t.content_revision_id = p_old.id
      and exists (select 1 from jsonb_array_elements(p_content->'mediaSlots') s where s->>'id' = t.slot_id);
  insert into public.exam_image_task_reviews(content_revision_id, slot_id, status, file_snapshot, actor_id, version, updated_at)
    select v_id, t.slot_id, t.status, t.file_snapshot, t.actor_id, t.version, t.updated_at
    from public.exam_image_task_reviews t where t.content_revision_id = p_old.id
      and exists (select 1 from jsonb_array_elements(p_content->'mediaSlots') s where s->>'id' = t.slot_id);
  return v_new;
end $$;

create function exams_private.copy_exam_media_binding(
  p_source public.exam_media_binding_revisions, p_target public.exam_content_revisions, p_actor uuid, p_files jsonb
)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_binding_id uuid;
begin
  if p_source.id is null then return; end if;
  insert into public.exam_media_binding_revisions(content_revision_id, account_id, account_generation, directory_id,
    main_path, files, created_by, version_after, request_id, request_hash)
  values (p_target.id, p_source.account_id, p_source.account_generation, p_source.directory_id,
    p_source.main_path, p_files, p_actor, p_target.version, gen_random_uuid(), p_source.request_hash)
  returning id into v_binding_id;
  insert into exams_private.exam_media_binding_directories(binding_id, directory_id)
    select distinct v_binding_id, (f->>'directory_id')::uuid from jsonb_array_elements(p_files) f where f ? 'directory_id';
  update public.exam_content_revisions set content = jsonb_set(content, '{mediaBindingRevisionId}', to_jsonb(v_binding_id::text))
    where id = p_target.id;
end $$;

create function public.save_exam_edited_revision(
  p_actor uuid, p_request_id uuid, p_expected_version uuid, p_set jsonb, p_content jsonb, p_solutions jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_old public.exam_content_revisions%rowtype;
  v_new public.exam_content_revisions%rowtype;
  v_binding public.exam_media_binding_revisions%rowtype;
  v_files jsonb := '[]';
  v_hash text := md5(jsonb_build_array('content', p_actor, p_expected_version, p_set, p_content, p_solutions)::text);
  v_saved exams_private.exam_live_save_receipts%rowtype;
  v_receipt jsonb;
begin
  select r.* into v_old from public.exam_content_revisions r where id = p_content->>'id';
  if not found then raise exception 'exam_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('exam-publication:' || v_old.content_set_id, 0));
  select r.* into v_old from public.exam_content_revisions r where id = v_old.id for update;
  select * into v_saved from exams_private.exam_live_save_receipts where request_id = p_request_id;
  if found then
    if v_saved.request_hash <> v_hash then raise exception 'exam_conflict'; end if;
    return v_saved.receipt;
  end if;
  if v_old.status = 'draft' then
    return public.save_exam_draft(p_actor, p_request_id, p_expected_version, p_set, p_content, p_solutions);
  end if;
  if v_old.status <> 'published' or v_old.version is distinct from p_expected_version
    or v_old.content_set_id is distinct from p_set->>'id'
    or v_old.revision is distinct from (p_content->>'revision')::integer
    or v_old.content->'mediaBindingRevisionId' is distinct from p_content->'mediaBindingRevisionId'
  then raise exception 'exam_conflict'; end if;

  select * into v_binding from public.exam_media_binding_revisions
    where content_revision_id = v_old.id and id::text = v_old.content->>'mediaBindingRevisionId';
  if found then
    select coalesce(jsonb_agg(f order by f->>'slot_id'), '[]'::jsonb) into v_files
    from jsonb_array_elements(v_binding.files) f where exists (
      select 1 from jsonb_array_elements((p_content->'mediaSlots') || (p_solutions->'mediaSlots')) slot
      where slot->>'id' = f->>'slot_id' and slot = f->'slot');
  end if;
  -- A content edit must not detach a resource that previously worked or add an
  -- unbound required resource to the student paper.
  if exists (
    select 1 from jsonb_array_elements(p_content->'mediaSlots') slot where slot->'required' = 'true'
      and not exists (select 1 from jsonb_array_elements(v_files) f where f->>'slot_id' = slot->>'id' and f->'reviewed' = 'true')
      and (
        not exists (select 1 from jsonb_array_elements(v_old.content->'mediaSlots') previous_slot where previous_slot = slot)
        or exists (select 1 from jsonb_array_elements(coalesce(v_binding.files, '[]')) f
          where f->>'slot_id' = slot->>'id' and f->'reviewed' = 'true')
      )
  ) then raise exception 'exam_invalid_media_binding'; end if;

  v_new := exams_private.fork_exam_revision(v_old, p_actor, p_set, p_content, p_solutions);
  perform exams_private.copy_exam_media_binding(v_binding, v_new, p_actor, v_files);
  perform exams_private.switch_exam_publication(v_old.id, v_new.id, p_actor);
  v_receipt := jsonb_build_object('id', v_new.id, 'contentSetId', v_new.content_set_id, 'revision', v_new.revision,
    'version', v_new.version, 'status', 'published', 'createdAt', v_new.created_at, 'updatedAt', clock_timestamp());
  insert into exams_private.exam_live_save_receipts values (p_request_id, v_hash, v_receipt);
  return v_receipt;
exception when unique_violation then raise exception 'exam_conflict';
end $$;

alter function public.save_exam_media_bindings(text, uuid, uuid, uuid, uuid, text, uuid, uuid, text, jsonb)
  rename to save_exam_draft_media_bindings;

create function public.save_exam_media_bindings(
  p_id text, p_expected_version uuid, p_expected_binding uuid, p_request_id uuid, p_actor uuid,
  p_account text, p_generation uuid, p_directory_id uuid, p_main_path text, p_files jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_old public.exam_content_revisions%rowtype;
  v_new public.exam_content_revisions%rowtype;
  v_solutions jsonb;
  v_hash text := md5(jsonb_build_array('media', p_id, p_expected_version, p_expected_binding, p_actor,
    p_account, p_generation, p_directory_id, p_main_path, p_files)::text);
  v_saved exams_private.exam_live_save_receipts%rowtype;
  v_receipt jsonb;
begin
  select r.* into v_old from public.exam_content_revisions r where id = p_id;
  if not found then raise exception 'exam_not_found'; end if;
  -- The draft binding function also handles existing image crop receipts.
  if v_old.status = 'draft' then
    return public.save_exam_draft_media_bindings(p_id, p_expected_version, p_expected_binding,
      p_request_id, p_actor, p_account, p_generation, p_directory_id, p_main_path, p_files);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('exam-publication:' || v_old.content_set_id, 0));
  select r.* into v_old from public.exam_content_revisions r where id = p_id for update;
  select * into v_saved from exams_private.exam_live_save_receipts where request_id = p_request_id;
  if found then
    if v_saved.request_hash <> v_hash then raise exception 'exam_conflict'; end if;
    return v_saved.receipt;
  end if;
  if v_old.status <> 'published' or v_old.version is distinct from p_expected_version
    or v_old.content->>'mediaBindingRevisionId' is distinct from p_expected_binding::text
  then raise exception 'exam_conflict'; end if;
  select content into strict v_solutions from exams_private.exam_solutions where content_revision_id = p_id;
  v_new := exams_private.fork_exam_revision(v_old, p_actor, v_old.set_snapshot, v_old.content, v_solutions);
  v_receipt := public.save_exam_draft_media_bindings(v_new.id, v_new.version, null,
    p_request_id, p_actor, p_account, p_generation, p_directory_id, p_main_path, p_files);
  perform exams_private.switch_exam_publication(v_old.id, v_new.id, p_actor);
  insert into exams_private.exam_live_save_receipts values (p_request_id, v_hash, v_receipt);
  return v_receipt;
exception when unique_violation then raise exception 'exam_conflict';
end $$;

revoke all on function exams_private.switch_exam_publication(text, text, uuid),
  exams_private.fork_exam_revision(public.exam_content_revisions, uuid, jsonb, jsonb, jsonb),
  exams_private.copy_exam_media_binding(public.exam_media_binding_revisions, public.exam_content_revisions, uuid, jsonb),
  public.save_exam_edited_revision(uuid, uuid, uuid, jsonb, jsonb, jsonb),
  public.save_exam_media_bindings(text, uuid, uuid, uuid, uuid, text, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function exams_private.switch_exam_publication(text, text, uuid),
  exams_private.fork_exam_revision(public.exam_content_revisions, uuid, jsonb, jsonb, jsonb),
  exams_private.copy_exam_media_binding(public.exam_media_binding_revisions, public.exam_content_revisions, uuid, jsonb),
  public.save_exam_edited_revision(uuid, uuid, uuid, jsonb, jsonb, jsonb),
  public.save_exam_media_bindings(text, uuid, uuid, uuid, uuid, text, uuid, uuid, text, jsonb)
  to service_role;

create or replace function public.transition_exam_publication(
  p_id text, p_expected_version uuid, p_request_id uuid, p_actor uuid,
  p_action text, p_review_ids jsonb, p_ready boolean
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_revision public.exam_content_revisions%rowtype;
  v_event public.exam_publication_events%rowtype;
  v_hash text;
  v_published text;
  v_solutions jsonb;
  v_binding public.exam_media_binding_revisions%rowtype;
  v_new public.exam_content_revisions%rowtype;
  v_receipt jsonb;
begin
  if p_actor is null or p_request_id is null or p_expected_version is null
    or p_action is null or p_action not in ('publish', 'withdraw', 'reopen')
  then raise exception 'exam_invalid_request'; end if;
  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object('id', p_id, 'version', p_expected_version,
    'actor', p_actor, 'action', p_action)::text);
  select * into v_revision from public.exam_content_revisions where id = p_id;
  if not found then raise exception 'exam_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('exam-publication:' || v_revision.content_set_id, 0));
  select * into v_revision from public.exam_content_revisions where id = p_id for update;
  select * into v_event from public.exam_publication_events where request_id = p_request_id;
  if found then
    if v_event.request_hash <> v_hash then raise exception 'exam_conflict'; end if;
    return v_event.receipt;
  end if;
  if v_revision.version <> p_expected_version then raise exception 'exam_conflict'; end if;
  if p_action = 'publish' then
    if v_revision.status <> 'draft' then raise exception 'exam_not_editable'; end if;
    select content into v_solutions from exams_private.exam_solutions where content_revision_id = p_id;
    if not found or p_ready is distinct from true
      or not exams_private.exam_media_publication_ready(v_revision.content, v_solutions)
    then raise exception 'exam_publication_blocked'; end if;
    select id into v_published from public.exam_content_revisions
      where content_set_id = v_revision.content_set_id and status = 'published';
    perform exams_private.switch_exam_publication(v_published, p_id, p_actor);
    select * into v_revision from public.exam_content_revisions where id = p_id;
  elsif p_action = 'reopen' then
    if v_revision.status <> 'withdrawn' or v_revision.superseded_by is not null then raise exception 'exam_not_editable'; end if;
    if exists (select 1 from public.exam_attempts where content_revision_id = p_id) then
      select content into strict v_solutions from exams_private.exam_solutions where content_revision_id = p_id;
      v_new := exams_private.fork_exam_revision(v_revision, p_actor, v_revision.set_snapshot, v_revision.content, v_solutions);
      select * into v_binding from public.exam_media_binding_revisions
        where content_revision_id = p_id and id::text = v_revision.content->>'mediaBindingRevisionId';
      perform exams_private.copy_exam_media_binding(v_binding, v_new, p_actor, v_binding.files);
      update public.exam_content_revisions set superseded_by = v_new.id where id = p_id;
      v_revision := v_new;
    else
      update public.exam_content_revisions set status = 'draft',
        content = pg_catalog.jsonb_set(content, '{status}', '"draft"'::jsonb),
        updated_by = p_actor, updated_at = pg_catalog.clock_timestamp() where id = p_id returning * into v_revision;
    end if;
  else
    if v_revision.status <> 'published' then raise exception 'exam_not_editable'; end if;
    update public.exam_content_revisions set status = 'withdrawn',
      content = pg_catalog.jsonb_set(content, '{status}', '"withdrawn"'::jsonb),
      updated_at = pg_catalog.clock_timestamp() where id = p_id returning * into v_revision;
  end if;
  v_receipt := pg_catalog.jsonb_build_object('id', v_revision.id, 'version', v_revision.version,
    'status', v_revision.status, 'updatedAt', v_revision.updated_at);
  insert into public.exam_publication_events(request_id, content_revision_id, content_version, actor_id, action, request_hash, receipt)
    values (p_request_id, p_id, p_expected_version, p_actor, p_action, v_hash, v_receipt);
  return v_receipt;
exception when unique_violation then raise exception 'exam_conflict';
end $$;

comment on function public.transition_exam_publication(text, uuid, uuid, uuid, text, jsonb, boolean)
  is 'Publish a validated draft and switch the student catalog atomically.';

create or replace function public.finish_exam_image_crop(
  p_id text, p_expected_version uuid, p_expected_binding uuid, p_request_id uuid, p_actor uuid,
  p_account text, p_generation uuid, p_directory_id uuid, p_main_path text, p_files jsonb, p_lease uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_job public.exam_image_crop_jobs%rowtype; v_receipt jsonb;
begin
  select * into v_job from public.exam_image_crop_jobs where request_id=p_request_id for update;
  if not found or v_job.actor_id<>p_actor or v_job.content_revision_id<>p_id then raise exception 'exam_conflict'; end if;
  if v_job.receipt is not null then return v_job.receipt; end if;
  if v_job.lease_id is distinct from p_lease or v_job.lease_until <= pg_catalog.clock_timestamp()
    or v_job.command->>'expectedVersion' is distinct from p_expected_version::text
    or v_job.command->>'expectedBindingRevisionId' is distinct from p_expected_binding::text
    or v_job.destination->>'accountId' is distinct from p_account
    or v_job.destination->>'generation' is distinct from p_generation::text
    or v_job.destination->>'mainPath' is distinct from p_main_path
    or not exists (select 1 from pg_catalog.jsonb_array_elements(p_files) f
      where f->>'slot_id'=v_job.slot_id and f->>'file_id'=v_job.uploaded_file->>'id'
        and f->>'path'=v_job.uploaded_file->>'path' and f->'reviewed'='true'::jsonb)
  then raise exception 'exam_conflict'; end if;
  perform pg_advisory_xact_lock(hashtextextended('exam-publication:' || content_set_id, 0))
    from public.exam_content_revisions where id = p_id;
  perform 1 from public.exam_content_revisions where id=p_id for update;
  perform 1 from public.exam_image_task_states where content_revision_id=p_id and slot_id=v_job.slot_id and retired;
  if found then raise exception 'exam_image_task_removed'; end if;
  v_receipt := public.save_exam_media_bindings(p_id,p_expected_version,p_expected_binding,p_request_id,p_actor,
    p_account,p_generation,p_directory_id,p_main_path,p_files);
  update public.exam_image_crop_jobs set receipt=v_receipt, lease_id=null, lease_until=null,
    updated_at=pg_catalog.clock_timestamp() where request_id=p_request_id;
  return v_receipt;
end $$;

create or replace function public.retire_exam_image_task(p_revision text,p_slot text,p_actor uuid,p_retired boolean,p_version uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_revision public.exam_content_revisions%rowtype; v_slot jsonb; v_source public.exam_image_source_pages%rowtype;
begin
  select * into v_revision from public.exam_content_revisions where id=p_revision for update;
  if not found or v_revision.status not in ('draft', 'published') then raise exception 'exam_not_editable'; end if;
  if v_revision.version is distinct from p_version then raise exception 'exam_conflict'; end if;
  select value into v_slot from pg_catalog.jsonb_array_elements(v_revision.content->'mediaSlots')
    where value->>'id'=p_slot and value->>'purpose'='question_image';
  if not found then raise exception 'exam_not_found'; end if;
  select * into v_source from public.exam_image_source_pages
    where source_id=v_slot#>>'{provenance,sources,0,sourceId}'
      and pdf_page=(v_slot#>>'{provenance,sources,0,pdfPage}')::integer
      and source_file_hash=v_revision.set_snapshot#>>'{source,fileHash}' for update;
  if not p_retired and (v_source.id is null or v_source.state<>'ready') then raise exception 'exam_image_source_missing'; end if;
  insert into public.exam_image_task_states(content_revision_id,slot_id,actor_id,retired)
    values (p_revision,p_slot,p_actor,p_retired)
    on conflict(content_revision_id,slot_id) do update set actor_id=excluded.actor_id,retired=excluded.retired,updated_at=pg_catalog.clock_timestamp();
  if not p_retired or v_source.id is null or v_source.state='deleted' then
    return pg_catalog.jsonb_build_object('state',case when p_retired then 'deleted' else 'ready' end);
  end if;
  if exists (
    select 1 from public.exam_content_revisions r cross join lateral pg_catalog.jsonb_array_elements(r.content->'mediaSlots') s
    where r.status in ('draft', 'published') and r.set_snapshot#>>'{source,fileHash}'=v_source.source_file_hash
      and s->>'purpose'='question_image' and s#>>'{provenance,sources,0,sourceId}'=v_source.source_id
      and (s#>>'{provenance,sources,0,pdfPage}')::integer=v_source.pdf_page
      and not exists(select 1 from public.exam_image_task_states t where t.content_revision_id=r.id and t.slot_id=s->>'id' and t.retired)
  ) then return pg_catalog.jsonb_build_object('state','retained'); end if;
  update public.exam_image_source_pages set state='deleting' where id=v_source.id;
  return pg_catalog.jsonb_build_object('state','deleting','sourceId',v_source.id,'path',v_source.object_path);
end $$;
create or replace function public.review_exam_image_task(
  p_revision text, p_slot text, p_actor uuid, p_status text, p_file jsonb, p_expected_review uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_revision public.exam_content_revisions%rowtype;
  v_review public.exam_image_task_reviews%rowtype;
  v_file jsonb;
begin
  if p_status is null or p_status not in ('pending','approved','flagged')
    or pg_catalog.jsonb_typeof(p_file) is distinct from 'object' or p_actor is null
  then raise exception 'exam_invalid_request'; end if;
  select * into v_revision from public.exam_content_revisions where id=p_revision for update;
  if not found then raise exception 'exam_not_found'; end if;
  if v_revision.status not in ('draft', 'published') then raise exception 'exam_not_editable'; end if;
  if exists(select 1 from public.exam_image_task_states
    where content_revision_id=p_revision and slot_id=p_slot and retired)
  then raise exception 'exam_image_task_removed'; end if;
  select f into v_file from public.exam_media_binding_revisions b,
    lateral pg_catalog.jsonb_array_elements(b.files) f
    where b.id::text=v_revision.content->>'mediaBindingRevisionId'
      and b.content_revision_id=p_revision and f->>'slot_id'=p_slot
      and f#>>'{slot,purpose}'='question_image'
      and exists(select 1 from pg_catalog.jsonb_array_elements(v_revision.content->'mediaSlots') s
        where s=f->'slot');
  if v_file is null or v_file is distinct from p_file then raise exception 'exam_image_review_changed'; end if;
  select * into v_review from public.exam_image_task_reviews
    where content_revision_id=p_revision and slot_id=p_slot for update;
  -- Repeating a lost response is harmless and does not create another approval.
  if found and v_review.file_snapshot=p_file and v_review.status=p_status and v_review.actor_id=p_actor then
    return pg_catalog.jsonb_build_object('status',v_review.status,'version',v_review.version);
  end if;
  if v_review.version is distinct from p_expected_review then raise exception 'exam_image_review_changed'; end if;
  insert into public.exam_image_task_reviews(content_revision_id,slot_id,status,file_snapshot,actor_id)
    values(p_revision,p_slot,p_status,p_file,p_actor)
    on conflict(content_revision_id,slot_id) do update set status=excluded.status,
      file_snapshot=excluded.file_snapshot,actor_id=excluded.actor_id,
      version=pg_catalog.gen_random_uuid(),updated_at=pg_catalog.clock_timestamp()
    returning * into v_review;
  return pg_catalog.jsonb_build_object('status',v_review.status,'version',v_review.version);
end $$;

create function public.read_exam_editable_revision(p_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'status', r.status, 'supersededBy', r.superseded_by, 'version', r.version,
    'createdAt', r.created_at, 'updatedAt', r.updated_at,
    'draft', jsonb_build_object('contentSet', r.set_snapshot,
      'content', jsonb_set(r.content, '{status}', '"draft"'), 'solutions', s.content))
  from public.exam_content_revisions r join exams_private.exam_solutions s on s.content_revision_id = r.id
  where r.id = p_id
$$;

revoke all on function public.read_exam_editable_revision(text) from public, anon, authenticated;
grant execute on function public.read_exam_editable_revision(text) to service_role;

notify pgrst, 'reload schema';

commit;
