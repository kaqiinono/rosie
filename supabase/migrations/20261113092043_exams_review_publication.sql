begin;

create table public.exam_content_reviews (
  id uuid not null default pg_catalog.gen_random_uuid() unique,
  content_revision_id text not null references public.exam_content_revisions(id),
  content_version uuid not null,
  scope text not null check (scope in ('exam', 'explanations', 'rubric')),
  decision text not null check (decision in ('approved', 'blocked')),
  reason text check (reason is null or (pg_catalog.btrim(reason) <> '' and pg_catalog.length(reason) <= 2000)),
  actor_id uuid not null references auth.users(id),
  reviewed_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (content_revision_id, content_version, scope),
  check (decision <> 'blocked' or reason is not null)
);

-- Append-only mutation receipts also preserve every superseded review decision.
create table public.exam_publication_events (
  request_id uuid primary key,
  content_revision_id text not null references public.exam_content_revisions(id),
  content_version uuid not null,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('review', 'publish', 'withdraw')),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{32}$'),
  receipt jsonb not null check (pg_catalog.jsonb_typeof(receipt) = 'object'),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index exam_publication_events_revision on public.exam_publication_events(content_revision_id, created_at);
alter table public.exam_content_reviews enable row level security;
alter table public.exam_publication_events enable row level security;
revoke all on public.exam_content_reviews, public.exam_publication_events from public, anon, authenticated, service_role;
grant select, insert, update on public.exam_content_reviews to service_role;
grant select, insert on public.exam_publication_events to service_role;

create function public.read_exam_publication(p_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  select pg_catalog.jsonb_build_object(
    'id', r.id, 'version', r.version, 'status', r.status, 'updatedAt', r.updated_at,
    'draft', pg_catalog.jsonb_build_object('contentSet', r.set_snapshot, 'content', r.content, 'solutions', s.content),
    'reviews', pg_catalog.jsonb_build_object('exam', null, 'explanations', null, 'rubric', null) || coalesce((
      select pg_catalog.jsonb_object_agg(review.scope, pg_catalog.jsonb_build_object(
        'id', review.id, 'contentRevisionId', review.content_revision_id, 'contentVersion', review.content_version,
        'scope', review.scope, 'decision', review.decision, 'reason', review.reason,
        'actorId', review.actor_id, 'reviewedAt', review.reviewed_at))
      from public.exam_content_reviews review where review.content_revision_id = r.id and review.content_version = r.version
    ), '{}'::jsonb)) into v_result
    from public.exam_content_revisions r join exams_private.exam_solutions s on s.content_revision_id = r.id
    where r.id = p_id;
  if not found then raise exception 'exam_not_found'; end if;
  return v_result;
end $$;

create function public.record_exam_review(
  p_id text, p_expected_version uuid, p_request_id uuid, p_actor uuid,
  p_scope text, p_decision text, p_reason text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_revision public.exam_content_revisions%rowtype;
  v_review public.exam_content_reviews%rowtype;
  v_event public.exam_publication_events%rowtype;
  v_hash text;
  v_receipt jsonb;
begin
  if p_actor is null or p_request_id is null or p_expected_version is null
    or p_scope is null or p_scope not in ('exam', 'explanations', 'rubric')
    or p_decision is null or p_decision not in ('approved', 'blocked')
    or (p_decision = 'blocked' and p_reason is null)
    or (p_reason is not null and (pg_catalog.btrim(p_reason) = '' or pg_catalog.length(p_reason) > 2000))
  then raise exception 'exam_invalid_request'; end if;
  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object('id', p_id, 'version', p_expected_version,
    'actor', p_actor, 'action', 'review', 'scope', p_scope, 'decision', p_decision, 'reason', p_reason)::text);
  select * into v_revision from public.exam_content_revisions where id = p_id for update;
  if not found then raise exception 'exam_not_found'; end if;
  select * into v_event from public.exam_publication_events where request_id = p_request_id;
  if found then
    if v_event.request_hash <> v_hash then raise exception 'exam_conflict'; end if;
    return v_event.receipt;
  end if;
  if v_revision.version <> p_expected_version then raise exception 'exam_conflict'; end if;
  if v_revision.status <> 'draft' then raise exception 'exam_not_editable'; end if;
  insert into public.exam_content_reviews(content_revision_id, content_version, scope, decision, reason, actor_id)
    values (p_id, p_expected_version, p_scope, p_decision, p_reason, p_actor)
    on conflict (content_revision_id, content_version, scope) do update set
      id = excluded.id, decision = excluded.decision, reason = excluded.reason,
      actor_id = excluded.actor_id, reviewed_at = excluded.reviewed_at
    returning * into v_review;
  v_receipt := pg_catalog.jsonb_build_object('id', v_review.id, 'contentRevisionId', p_id,
    'contentVersion', p_expected_version, 'scope', v_review.scope, 'decision', v_review.decision,
    'reason', v_review.reason, 'actorId', v_review.actor_id, 'reviewedAt', v_review.reviewed_at);
  insert into public.exam_publication_events(request_id, content_revision_id, content_version, actor_id, action, request_hash, receipt)
    values (p_request_id, p_id, p_expected_version, p_actor, 'review', v_hash, v_receipt);
  return v_receipt;
exception when unique_violation then raise exception 'exam_conflict';
end $$;

-- Later media migrations replace this fail-closed adapter without weakening review checks.
create function exams_private.exam_media_publication_ready(p_content jsonb, p_solutions jsonb)
returns boolean language sql stable security invoker set search_path = '' as $$
  select not exists (select 1 from pg_catalog.jsonb_array_elements(p_content -> 'mediaSlots') slot where slot -> 'required' = 'true'::jsonb)
    and not exists (select 1 from pg_catalog.jsonb_array_elements(p_solutions -> 'mediaSlots') slot where slot -> 'required' = 'true'::jsonb);
$$;

create function public.transition_exam_publication(
  p_id text, p_expected_version uuid, p_request_id uuid, p_actor uuid,
  p_action text, p_review_ids jsonb, p_ready boolean
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_revision public.exam_content_revisions%rowtype;
  v_solutions jsonb;
  v_event public.exam_publication_events%rowtype;
  v_hash text;
  v_receipt jsonb;
  v_approved integer;
begin
  if p_actor is null or p_request_id is null or p_expected_version is null
    or p_action is null or p_action not in ('publish', 'withdraw')
  then raise exception 'exam_invalid_request'; end if;
  -- Hash only the authenticated command. Server preflight state is not client input.
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
    if p_ready is distinct from true then raise exception 'exam_publication_blocked'; end if;
    if exists (select 1 from pg_catalog.jsonb_array_elements(v_revision.content -> 'groups') item
      where item ->> 'role' = 'exam' and pg_catalog.jsonb_array_length(item -> 'materialIds') = 0)
    then raise exception 'exam_publication_blocked'; end if;
    select count(*) into v_approved from public.exam_content_reviews review
      where review.content_revision_id = p_id and review.content_version = p_expected_version
        and review.scope in ('exam', 'explanations') and review.decision = 'approved'
        and review.id::text = p_review_ids ->> review.scope;
    if v_approved <> 2 then raise exception 'exam_review_changed'; end if;
    select content into v_solutions from exams_private.exam_solutions where content_revision_id = p_id;
    if not found then raise exception 'exam_publication_blocked'; end if;
    if pg_catalog.jsonb_path_exists(v_revision.content, '$.** ? (@.status == "blocked")')
      or pg_catalog.jsonb_path_exists(v_solutions, '$.** ? (@.status == "blocked")')
    then raise exception 'exam_publication_blocked'; end if;
    if not exams_private.exam_media_publication_ready(v_revision.content, v_solutions)
    then raise exception 'exam_publication_blocked'; end if;
    if pg_catalog.jsonb_path_exists(v_revision.content, '$.groups[*].questions[*] ? (@.scoring.kind == "manual")')
      and not exists (select 1 from public.exam_content_reviews review
        where review.content_revision_id = p_id and review.content_version = p_expected_version
          and review.scope = 'rubric' and review.decision = 'approved' and review.id::text = p_review_ids ->> 'rubric')
    then raise exception 'exam_review_changed'; end if;
    -- Lock current word rows before comparing snapshots, closing the preflight race.
    perform 1 from public.word_entries word where word.id::text in (
      select pg_catalog.lower(link ->> 'wordEntryId') from pg_catalog.jsonb_array_elements(v_revision.content -> 'vocabularyLinks') link
    ) for share;
    if exists (select 1 from pg_catalog.jsonb_array_elements(v_revision.content -> 'vocabularyLinks') link
      where not exists (select 1 from public.word_entries word
        where word.id::text = pg_catalog.lower(link ->> 'wordEntryId')
          and word.stage = link #>> '{sourceSnapshot,stage}' and word.unit = link #>> '{sourceSnapshot,unit}'
          and word.lesson = link #>> '{sourceSnapshot,lesson}' and word.word = link #>> '{sourceSnapshot,word}'))
    then raise exception 'exam_invalid_vocabulary_reference'; end if;
    update public.exam_content_revisions set status = 'published',
      content = pg_catalog.jsonb_set(content, '{status}', '"published"'::jsonb),
      updated_by = p_actor, updated_at = pg_catalog.clock_timestamp() where id = p_id returning * into v_revision;
  else
    if v_revision.status <> 'published' then raise exception 'exam_not_editable'; end if;
    -- The foundation trigger permits only status/content.status/updated_at here.
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

revoke all on function public.read_exam_publication(text),
  exams_private.exam_media_publication_ready(jsonb, jsonb),
  public.record_exam_review(text, uuid, uuid, uuid, text, text, text),
  public.transition_exam_publication(text, uuid, uuid, uuid, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.read_exam_publication(text),
  exams_private.exam_media_publication_ready(jsonb, jsonb),
  public.record_exam_review(text, uuid, uuid, uuid, text, text, text),
  public.transition_exam_publication(text, uuid, uuid, uuid, text, jsonb, boolean)
  to service_role;

comment on table public.exam_content_reviews is 'Administrator reviews apply to one edit version. Saving a draft makes earlier-version decisions inapplicable.';
comment on table public.exam_publication_events is 'Service-only append-only review/publication receipts. Withdrawal preserves historical revision content.';

commit;
