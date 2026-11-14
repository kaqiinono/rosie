begin;

-- Answers are outside the exposed public schema. Neither schema has browser grants.
create schema exams_private;
revoke all on schema exams_private from public, anon, authenticated;
grant usage on schema exams_private to service_role;

-- These checks cover the storage envelope. The server validates the complete
-- question, provenance, template and answer-reference contracts before calling RPCs.
create function exams_private.exam_revision_is_valid(p_set jsonb, p_content jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
begin
  if pg_catalog.jsonb_typeof(p_set) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_content) is distinct from 'object'
    or not p_set ?& array['id', 'source', 'testNumber', 'title', 'kind', 'template', 'purpose']
    or not p_content ?& array['schemaVersion', 'id', 'contentSetId', 'revision', 'status',
      'materials', 'groups', 'guidance', 'vocabularyLinks', 'mediaSlots', 'mediaBindingRevisionId', 'readiness']
  then return false; end if;

  if pg_catalog.jsonb_typeof(p_set -> 'id') is distinct from 'string'
    or pg_catalog.btrim(p_set ->> 'id') = ''
    or pg_catalog.jsonb_typeof(p_set -> 'title') is distinct from 'string'
    or pg_catalog.btrim(p_set ->> 'title') = ''
    or pg_catalog.jsonb_typeof(p_set -> 'source') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_set #> '{source,id}') is distinct from 'string'
    or pg_catalog.btrim(p_set #>> '{source,id}') = ''
    or pg_catalog.jsonb_typeof(p_set #> '{source,title}') is distinct from 'string'
    or pg_catalog.btrim(p_set #>> '{source,title}') = ''
    or pg_catalog.jsonb_typeof(p_set -> 'testNumber') is distinct from 'number'
    or pg_catalog.jsonb_typeof(p_set -> 'template') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_set #> '{template,id}') is distinct from 'string'
    or pg_catalog.btrim(p_set #>> '{template,id}') = ''
    or pg_catalog.jsonb_typeof(p_set #> '{template,version}') is distinct from 'number'
    or (p_set ->> 'kind') not in ('official_paper', 'mock_paper', 'training_unit')
    or (p_set ->> 'purpose') not in ('training', 'reserved')
    or p_set ->> 'kind' is null or p_set ->> 'purpose' is null
  then return false; end if;

  if p_content -> 'schemaVersion' is distinct from '1'::jsonb
    or pg_catalog.jsonb_typeof(p_content -> 'id') is distinct from 'string'
    or pg_catalog.btrim(p_content ->> 'id') = ''
    or p_content -> 'contentSetId' is distinct from p_set -> 'id'
    or pg_catalog.jsonb_typeof(p_content -> 'revision') is distinct from 'number'
    or (p_content ->> 'status') not in ('draft', 'published', 'withdrawn')
    or p_content ->> 'status' is null
    or pg_catalog.jsonb_typeof(p_content -> 'materials') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_content -> 'groups') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_content -> 'guidance') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_content -> 'vocabularyLinks') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_content -> 'mediaSlots') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_content -> 'mediaBindingRevisionId') not in ('string', 'null')
    or pg_catalog.jsonb_typeof(p_content -> 'readiness') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_content #> '{readiness,exam}') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_content #> '{readiness,explanations}') is distinct from 'object'
    or p_content #>> '{readiness,exam,status}' is null
    or p_content #>> '{readiness,explanations,status}' is null
    or (p_content #>> '{readiness,exam,status}') not in ('pending', 'approved', 'blocked')
    or (p_content #>> '{readiness,explanations,status}') not in ('pending', 'approved', 'blocked')
  then return false; end if;

  -- Type checks above make these numeric conversions safe, including large JSON numbers.
  return (p_set ->> 'testNumber') ~ '^[1-9][0-9]*$'
    and (p_set ->> 'testNumber')::numeric <= 2147483647
    and (p_set #>> '{template,version}') ~ '^[1-9][0-9]*$'
    and (p_set #>> '{template,version}')::numeric <= 2147483647
    and (p_content ->> 'revision') ~ '^[1-9][0-9]*$'
    and (p_content ->> 'revision')::numeric <= 2147483647;
end $$;

create function exams_private.exam_solutions_is_valid(p_content jsonb)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select coalesce(
    pg_catalog.jsonb_typeof(p_content) = 'object'
    and p_content ?& array['schemaVersion', 'contentRevisionId', 'solutions', 'teacherNotes', 'mediaSlots']
    and p_content -> 'schemaVersion' = '1'::jsonb
    and pg_catalog.jsonb_typeof(p_content -> 'contentRevisionId') = 'string'
    and pg_catalog.btrim(p_content ->> 'contentRevisionId') <> ''
    and pg_catalog.jsonb_typeof(p_content -> 'solutions') = 'array'
    and pg_catalog.jsonb_typeof(p_content -> 'teacherNotes') = 'array'
    and pg_catalog.jsonb_typeof(p_content -> 'mediaSlots') = 'array', false);
$$;

create table public.exam_content_sets (
  id text primary key check (pg_catalog.btrim(id) <> ''),
  source_id text not null check (pg_catalog.btrim(source_id) <> ''),
  test_number integer not null check (test_number > 0),
  template_id text not null check (pg_catalog.btrim(template_id) <> ''),
  template_version integer not null check (template_version > 0),
  kind text not null check (kind in ('official_paper', 'mock_paper', 'training_unit')),
  created_at timestamptz not null default pg_catalog.now()
);

create table public.exam_content_revisions (
  id text primary key check (pg_catalog.btrim(id) <> ''),
  content_set_id text not null references public.exam_content_sets(id),
  revision integer not null check (revision > 0),
  version uuid not null default pg_catalog.gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  -- The full set snapshot belongs to this revision; titles/purpose are never
  -- resolved from a mutable global set when reading historical content.
  set_snapshot jsonb not null,
  content jsonb not null,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  last_request_id uuid not null,
  last_request_hash text not null check (last_request_hash ~ '^[0-9a-f]{32}$'),
  unique (content_set_id, revision),
  unique (last_request_id),
  check (exams_private.exam_revision_is_valid(set_snapshot, content)),
  check (content @> pg_catalog.jsonb_build_object(
    'id', id, 'contentSetId', content_set_id, 'revision', revision, 'status', status))
);

create unique index exam_content_sets_one_published_revision
  on public.exam_content_revisions(content_set_id) where status = 'published';

create index exam_content_revisions_list_order
  on public.exam_content_revisions(status, created_at desc, id);

create table exams_private.exam_solutions (
  content_revision_id text primary key references public.exam_content_revisions(id),
  content jsonb not null,
  check (exams_private.exam_solutions_is_valid(content)),
  check (content @> pg_catalog.jsonb_build_object('contentRevisionId', content_revision_id))
);

alter table public.exam_content_sets enable row level security;
alter table public.exam_content_revisions enable row level security;
alter table exams_private.exam_solutions enable row level security;
revoke all on public.exam_content_sets, public.exam_content_revisions,
  exams_private.exam_solutions from public, anon, authenticated, service_role;
grant select, insert on public.exam_content_sets to service_role;
grant select, insert, update on public.exam_content_revisions, exams_private.exam_solutions to service_role;

-- Stable identity cannot be changed even by direct service-role DML.
create function exams_private.guard_exam_set_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new is distinct from old then raise exception 'exam_conflict'; end if;
  return new;
end $$;
create trigger exam_content_set_identity_immutable
  before update on public.exam_content_sets
  for each row execute function exams_private.guard_exam_set_identity();

create function exams_private.guard_exam_revision()
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
      -- A future publishing workflow may withdraw a published revision, while
      -- preserving its identity, snapshot, content and solutions for references.
      if old.status = 'published' and new.status = 'withdrawn'
        and (pg_catalog.to_jsonb(new) - array['status', 'content', 'updated_at'])
          = (pg_catalog.to_jsonb(old) - array['status', 'content', 'updated_at'])
        and new.content = pg_catalog.jsonb_set(old.content, '{status}', '"withdrawn"'::jsonb)
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
create trigger exam_content_revision_guard
  before insert or update or delete on public.exam_content_revisions
  for each row execute function exams_private.guard_exam_revision();

create function exams_private.guard_exam_solutions()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_id text;
  v_status text;
begin
  if tg_op = 'UPDATE' and new.content_revision_id is distinct from old.content_revision_id
  then raise exception 'exam_invalid_draft'; end if;
  if tg_op = 'DELETE' then v_id := old.content_revision_id;
  else v_id := new.content_revision_id; end if;
  -- Shares the revision lock with saves and future publication; solutions cannot
  -- slip in concurrently after the parent revision becomes immutable.
  select status into v_status from public.exam_content_revisions where id = v_id for update;
  if not found then raise exception 'exam_invalid_draft'; end if;
  if v_status <> 'draft' then raise exception 'exam_not_editable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger exam_solutions_guard
  before insert or update or delete on exams_private.exam_solutions
  for each row execute function exams_private.guard_exam_solutions();

create function public.save_exam_draft(
  p_actor uuid,
  p_request_id uuid,
  p_expected_version uuid,
  p_set jsonb,
  p_content jsonb,
  p_solutions jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_set public.exam_content_sets%rowtype;
  v_revision public.exam_content_revisions%rowtype;
  v_hash text;
  v_created boolean := false;
begin
  -- p_actor is supplied by the authenticated admin server boundary, not JSON.
  -- Existing server-side administrator allowlists remain the server's concern.
  if p_actor is null or p_request_id is null
    or not exams_private.exam_revision_is_valid(p_set, p_content)
    or not exams_private.exam_solutions_is_valid(p_solutions)
    or p_content ->> 'status' is distinct from 'draft'
    or p_solutions -> 'contentRevisionId' is distinct from p_content -> 'id'
    or (p_content #>> '{readiness,exam,status}') not in ('pending', 'blocked')
    or (p_content #>> '{readiness,explanations,status}') not in ('pending', 'blocked')
  then raise exception 'exam_invalid_draft'; end if;

  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'actor', p_actor, 'requestId', p_request_id, 'expectedVersion', p_expected_version,
    'contentSet', p_set, 'content', p_content, 'solutions', p_solutions)::text);

  insert into public.exam_content_sets(id, source_id, test_number, template_id, template_version, kind)
    values (p_set ->> 'id', p_set #>> '{source,id}', (p_set ->> 'testNumber')::integer,
      p_set #>> '{template,id}', (p_set #>> '{template,version}')::integer, p_set ->> 'kind')
    on conflict (id) do nothing;
  select * into v_set from public.exam_content_sets where id = p_set ->> 'id';
  if v_set.source_id is distinct from p_set #>> '{source,id}'
    or v_set.test_number is distinct from (p_set ->> 'testNumber')::integer
    or v_set.template_id is distinct from p_set #>> '{template,id}'
    or v_set.template_version is distinct from (p_set #>> '{template,version}')::integer
    or v_set.kind is distinct from p_set ->> 'kind'
  then raise exception 'exam_invalid_draft'; end if;

  select * into v_revision from public.exam_content_revisions where id = p_content ->> 'id' for update;
  if not found then
    if p_expected_version is not null then raise exception 'exam_not_found'; end if;
    insert into public.exam_content_revisions(
      id, content_set_id, revision, set_snapshot, content, created_by, updated_by,
      last_request_id, last_request_hash)
      values (p_content ->> 'id', p_set ->> 'id', (p_content ->> 'revision')::integer,
        p_set, p_content, p_actor, p_actor, p_request_id, v_hash)
      on conflict do nothing returning * into v_revision;
    v_created := found;
    if not v_created then
      -- A concurrent identical create may have completed while INSERT waited.
      select * into v_revision from public.exam_content_revisions where id = p_content ->> 'id' for update;
      if not found then raise exception 'exam_conflict'; end if;
    end if;
  end if;

  if not v_created then
    if v_revision.status <> 'draft' then raise exception 'exam_not_editable'; end if;
    if v_revision.last_request_id = p_request_id then
      if v_revision.updated_by <> p_actor or v_revision.last_request_hash <> v_hash
      then raise exception 'exam_conflict'; end if;
      return pg_catalog.jsonb_build_object(
        'id', v_revision.id, 'contentSetId', v_revision.content_set_id,
        'revision', v_revision.revision, 'version', v_revision.version, 'status', v_revision.status,
        'createdAt', v_revision.created_at, 'updatedAt', v_revision.updated_at);
    end if;
    if p_expected_version is null or v_revision.version <> p_expected_version
    then raise exception 'exam_conflict'; end if;
    if v_revision.content_set_id <> p_set ->> 'id'
      or v_revision.revision <> (p_content ->> 'revision')::integer
    then raise exception 'exam_invalid_draft'; end if;
    update public.exam_content_revisions set
      set_snapshot = p_set, content = p_content, version = pg_catalog.gen_random_uuid(),
      updated_by = p_actor, updated_at = pg_catalog.clock_timestamp(),
      last_request_id = p_request_id, last_request_hash = v_hash
      where id = v_revision.id returning * into v_revision;
  end if;

  insert into exams_private.exam_solutions(content_revision_id, content)
    values (v_revision.id, p_solutions)
    on conflict (content_revision_id) do update set content = excluded.content;
  return pg_catalog.jsonb_build_object(
    'id', v_revision.id, 'contentSetId', v_revision.content_set_id,
    'revision', v_revision.revision, 'version', v_revision.version, 'status', v_revision.status,
    'createdAt', v_revision.created_at, 'updatedAt', v_revision.updated_at);
exception
  when unique_violation then raise exception 'exam_conflict';
  when check_violation or foreign_key_violation or not_null_violation
    or invalid_text_representation or numeric_value_out_of_range
  then raise exception 'exam_invalid_draft';
end $$;

create function public.read_exam_draft(p_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_result jsonb;
begin
  -- A single MVCC snapshot reads the matching face, answer and CAS token.
  select pg_catalog.jsonb_build_object(
    'draft', pg_catalog.jsonb_build_object(
      'contentSet', r.set_snapshot, 'content', r.content, 'solutions', s.content),
    'version', r.version, 'createdAt', r.created_at, 'updatedAt', r.updated_at)
    into v_result
    from public.exam_content_revisions r
    join exams_private.exam_solutions s on s.content_revision_id = r.id
    where r.id = p_id and r.status = 'draft';
  if not found then raise exception 'exam_not_found'; end if;
  return v_result;
end $$;

revoke all on function exams_private.exam_revision_is_valid(jsonb, jsonb),
  exams_private.exam_solutions_is_valid(jsonb), exams_private.guard_exam_set_identity(),
  exams_private.guard_exam_revision(), exams_private.guard_exam_solutions(),
  public.save_exam_draft(uuid, uuid, uuid, jsonb, jsonb, jsonb), public.read_exam_draft(text)
  from public, anon, authenticated;
grant execute on function exams_private.exam_revision_is_valid(jsonb, jsonb),
  exams_private.exam_solutions_is_valid(jsonb), exams_private.guard_exam_set_identity(),
  exams_private.guard_exam_revision(), exams_private.guard_exam_solutions(),
  public.save_exam_draft(uuid, uuid, uuid, jsonb, jsonb, jsonb), public.read_exam_draft(text)
  to service_role;

comment on table public.exam_content_sets is 'Stable exam source/template identity; revision-specific title and purpose live in set_snapshot.';
comment on table public.exam_content_revisions is 'Service-only authoring revisions. No student content access is granted by this migration.';
comment on table exams_private.exam_solutions is 'Private answer/explanation authoring payload; never exposed through a public catalog projection.';

commit;
