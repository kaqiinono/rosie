begin;

-- Publishing no longer waits for reviews, media, material families or vocabulary snapshots.
-- A published or withdrawn revision can return to draft so later corrections stay on this version.

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
        and (pg_catalog.to_jsonb(new) - array['status', 'content', 'updated_at'])
          = (pg_catalog.to_jsonb(old) - array['status', 'content', 'updated_at'])
        and new.content = pg_catalog.jsonb_set(old.content, '{status}', '"withdrawn"'::jsonb)
      then return new; end if;
      if old.status in ('published', 'withdrawn') and new.status = 'draft'
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

do $$
declare
  v_name text;
begin
  select con.conname into v_name
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_class rel on rel.oid = con.conrelid
    join pg_catalog.pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'exam_publication_events' and con.contype = 'c'
      and pg_catalog.pg_get_constraintdef(con.oid) like '%withdraw%';
  if v_name is not null then
    execute format('alter table public.exam_publication_events drop constraint %I', v_name);
  end if;
end $$;

alter table public.exam_publication_events add constraint exam_publication_events_action_check
  check (action in ('review', 'publish', 'withdraw', 'reopen'));

create or replace function public.transition_exam_publication(
  p_id text, p_expected_version uuid, p_request_id uuid, p_actor uuid,
  p_action text, p_review_ids jsonb, p_ready boolean
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_revision public.exam_content_revisions%rowtype;
  v_event public.exam_publication_events%rowtype;
  v_hash text;
  v_receipt jsonb;
begin
  if p_actor is null or p_request_id is null or p_expected_version is null
    or p_action is null or p_action not in ('publish', 'withdraw', 'reopen')
  then raise exception 'exam_invalid_request'; end if;
  -- p_ready and p_review_ids remain in the signature for existing callers.
  -- They no longer decide whether a saved draft can be published.
  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object('id', p_id, 'version', p_expected_version,
    'actor', p_actor, 'action', p_action)::text);
  select * into v_revision from public.exam_content_revisions where id = p_id for update;
  if not found then raise exception 'exam_not_found'; end if;
  select * into v_event from public.exam_publication_events where request_id = p_request_id;
  if found then
    if v_event.request_hash <> v_hash then raise exception 'exam_conflict'; end if;
    return v_event.receipt;
  end if;
  if v_revision.version <> p_expected_version then raise exception 'exam_conflict'; end if;
  if p_action = 'publish' then
    if v_revision.status <> 'draft' then raise exception 'exam_not_editable'; end if;
    if not exists (select 1 from exams_private.exam_solutions where content_revision_id = p_id)
    then raise exception 'exam_publication_blocked'; end if;
    update public.exam_content_revisions set status = 'published',
      content = pg_catalog.jsonb_set(content, '{status}', '"published"'::jsonb),
      updated_by = p_actor, updated_at = pg_catalog.clock_timestamp() where id = p_id returning * into v_revision;
  elsif p_action = 'reopen' then
    if v_revision.status not in ('published', 'withdrawn') then raise exception 'exam_not_editable'; end if;
    update public.exam_content_revisions set status = 'draft',
      content = pg_catalog.jsonb_set(content, '{status}', '"draft"'::jsonb),
      updated_by = p_actor, updated_at = pg_catalog.clock_timestamp() where id = p_id returning * into v_revision;
  else
    if v_revision.status <> 'published' then raise exception 'exam_not_editable'; end if;
    update public.exam_content_revisions set status = 'withdrawn',
      content = pg_catalog.jsonb_set(content, '{status}', '"withdrawn"'::jsonb),
      updated_at = pg_catalog.clock_timestamp() where id = p_id returning * into v_revision;
  end if;
  v_receipt := pg_catalog.jsonb_build_object('id', p_id, 'version', v_revision.version,
    'status', v_revision.status, 'updatedAt', v_revision.updated_at);
  insert into public.exam_publication_events(request_id, content_revision_id, content_version, actor_id, action, request_hash, receipt)
    values (p_request_id, p_id, p_expected_version, p_actor, p_action, v_hash, v_receipt);
  return v_receipt;
exception when unique_violation then raise exception 'exam_conflict';
end $$;

comment on function public.transition_exam_publication(text, uuid, uuid, uuid, text, jsonb, boolean)
  is 'Publish a saved draft without review or media gates. Reopen returns a published or withdrawn revision to an editable draft.';

commit;
