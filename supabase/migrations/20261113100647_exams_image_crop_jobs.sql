begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('exam-image-sources','exam-image-sources',false,20971520,array['image/png'])
on conflict (id) do nothing;

create table public.exam_image_source_pages (
  id text primary key,
  source_id text not null,
  pdf_page integer not null check (pdf_page>0),
  source_file_hash text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  object_path text not null unique,
  width integer not null check (width>0),
  height integer not null check (height>0),
  state text not null default 'ready' check (state in ('ready','deleting','deleted')),
  unique (source_id,pdf_page,source_file_hash)
);
create table public.exam_image_task_states (
  content_revision_id text not null references public.exam_content_revisions(id),
  slot_id text not null,
  retired boolean not null default false,
  actor_id uuid not null references auth.users(id),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(content_revision_id,slot_id)
);
alter table public.exam_image_source_pages enable row level security;
alter table public.exam_image_task_states enable row level security;
revoke all on public.exam_image_source_pages, public.exam_image_task_states from public,anon,authenticated;
grant select,insert,update on public.exam_image_source_pages, public.exam_image_task_states to service_role;

create table public.exam_image_crop_jobs (
  request_id uuid primary key,
  content_revision_id text not null references public.exam_content_revisions(id),
  slot_id text not null,
  actor_id uuid not null references auth.users(id),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  command jsonb not null check (jsonb_typeof(command) = 'object'),
  destination jsonb not null check (jsonb_typeof(destination) = 'object'),
  uploaded_file jsonb,
  cleanup_state text not null default 'pending' check (cleanup_state in ('pending','deleting','deleted','retained')),
  receipt jsonb,
  lease_id uuid,
  lease_until timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index exam_image_crop_jobs_revision on public.exam_image_crop_jobs(content_revision_id, updated_at desc);
alter table public.exam_image_crop_jobs enable row level security;
revoke all on public.exam_image_crop_jobs from public, anon, authenticated, service_role;
grant select, insert, update on public.exam_image_crop_jobs to service_role;

create function public.begin_exam_image_crop(
  p_request uuid, p_actor uuid, p_hash text, p_command jsonb, p_destination jsonb, p_lease uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_job public.exam_image_crop_jobs%rowtype;
begin
  insert into public.exam_image_crop_jobs(request_id, content_revision_id, slot_id, actor_id, request_hash, command, destination)
    values (p_request, p_command->>'revisionId', p_command->>'slotId', p_actor, p_hash, p_command, p_destination)
    on conflict (request_id) do nothing;
  select * into v_job from public.exam_image_crop_jobs where request_id=p_request for update;
  if v_job.actor_id <> p_actor or v_job.request_hash <> p_hash then raise exception 'exam_conflict'; end if;
  if v_job.receipt is not null then return pg_catalog.to_jsonb(v_job); end if;
  if v_job.cleanup_state in ('deleting','deleted') then raise exception 'exam_conflict'; end if;
  if v_job.lease_until > pg_catalog.clock_timestamp() then raise exception 'exam_image_busy'; end if;
  update public.exam_image_crop_jobs set lease_id=p_lease, lease_until=pg_catalog.clock_timestamp()+interval '4 minutes',
    updated_at=pg_catalog.clock_timestamp() where request_id=p_request returning * into v_job;
  return pg_catalog.to_jsonb(v_job);
end $$;

-- The binding and receipt commit together. Retrying a successful request never creates a second binding.
create function public.finish_exam_image_crop(
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
  perform 1 from public.exam_content_revisions where id=p_id for update;
  perform 1 from public.exam_image_task_states where content_revision_id=p_id and slot_id=v_job.slot_id and retired;
  if found then raise exception 'exam_image_task_removed'; end if;
  v_receipt := public.save_exam_media_bindings(p_id,p_expected_version,p_expected_binding,p_request_id,p_actor,
    p_account,p_generation,p_directory_id,p_main_path,p_files);
  update public.exam_image_crop_jobs set receipt=v_receipt, lease_id=null, lease_until=null,
    updated_at=pg_catalog.clock_timestamp() where request_id=p_request_id;
  return v_receipt;
end $$;

revoke all on function public.begin_exam_image_crop(uuid,uuid,text,jsonb,jsonb,uuid),
  public.finish_exam_image_crop(text,uuid,uuid,uuid,uuid,text,uuid,uuid,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.begin_exam_image_crop(uuid,uuid,text,jsonb,jsonb,uuid),
  public.finish_exam_image_crop(text,uuid,uuid,uuid,uuid,text,uuid,uuid,text,jsonb,uuid) to service_role;

-- A tombstone is visible before touching remote files. New bindings cannot race cleanup.
create function public.guard_exam_crop_file_binding() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_job public.exam_image_crop_jobs%rowtype;
begin
  for v_job in select j.* from public.exam_image_crop_jobs j
    where j.destination->>'accountId'=new.account_id and exists (
      select 1 from pg_catalog.jsonb_array_elements(new.files) f where f->>'file_id'=j.uploaded_file->>'id')
    order by j.request_id for share
  loop
    if v_job.cleanup_state in ('deleting','deleted') then raise exception 'exam_image_file_deleted'; end if;
  end loop;
  return new;
end $$;
create trigger exam_crop_file_binding_guard before insert on public.exam_media_binding_revisions
  for each row execute function public.guard_exam_crop_file_binding();

create function public.claim_exam_crop_cleanup(p_request uuid) returns text
language plpgsql security invoker set search_path = '' as $$
declare v_job public.exam_image_crop_jobs%rowtype;
begin
  select * into v_job from public.exam_image_crop_jobs where request_id=p_request for update;
  if not found then raise exception 'exam_not_found'; end if;
  if v_job.cleanup_state='deleted' then return 'deleted'; end if;
  if v_job.lease_until > pg_catalog.clock_timestamp() or v_job.uploaded_file is null then return 'pending'; end if;
  if exists (
    select 1 from public.exam_media_binding_revisions b
    where b.account_id=v_job.destination->>'accountId'
      and exists (select 1 from pg_catalog.jsonb_array_elements(b.files) f where f->>'file_id'=v_job.uploaded_file->>'id')
      and (exists (select 1 from public.exam_content_revisions r where r.content->>'mediaBindingRevisionId'=b.id::text)
        or exists (select 1 from public.exam_attempts a where a.media_binding_revision_id=b.id))
  ) then
    update public.exam_image_crop_jobs set cleanup_state='retained' where request_id=p_request;
    return 'retained';
  end if;
  update public.exam_image_crop_jobs set cleanup_state='deleting' where request_id=p_request;
  return 'deleting';
end $$;
revoke all on function public.guard_exam_crop_file_binding(), public.claim_exam_crop_cleanup(uuid) from public, anon, authenticated;
grant execute on function public.guard_exam_crop_file_binding(), public.claim_exam_crop_cleanup(uuid) to service_role;

-- Retire the authoring task only. Student slots, finished images and bindings stay intact.
create function public.retire_exam_image_task(p_revision text,p_slot text,p_actor uuid,p_retired boolean,p_version uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_revision public.exam_content_revisions%rowtype; v_slot jsonb; v_source public.exam_image_source_pages%rowtype;
begin
  select * into v_revision from public.exam_content_revisions where id=p_revision for update;
  if not found or v_revision.status<>'draft' then raise exception 'exam_not_editable'; end if;
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
    where r.status='draft' and r.set_snapshot#>>'{source,fileHash}'=v_source.source_file_hash
      and s->>'purpose'='question_image' and s#>>'{provenance,sources,0,sourceId}'=v_source.source_id
      and (s#>>'{provenance,sources,0,pdfPage}')::integer=v_source.pdf_page
      and not exists(select 1 from public.exam_image_task_states t where t.content_revision_id=r.id and t.slot_id=s->>'id' and t.retired)
  ) then return pg_catalog.jsonb_build_object('state','retained'); end if;
  update public.exam_image_source_pages set state='deleting' where id=v_source.id;
  return pg_catalog.jsonb_build_object('state','deleting','sourceId',v_source.id,'path',v_source.object_path);
end $$;
revoke all on function public.retire_exam_image_task(text,text,uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.retire_exam_image_task(text,text,uuid,boolean,uuid) to service_role;
commit;
