begin;

-- Independent evidence only: these routines never write vocabulary mastery or plans.
create table public.exam_word_review_batches (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  version uuid not null default pg_catalog.gen_random_uuid(),
  status text not null check (status in ('collecting','active','completed')),
  state jsonb not null check (pg_catalog.jsonb_typeof(state) = 'object'),
  completed_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (id,user_id),
  check ((status = 'completed') = (completed_at is not null))
);
create unique index exam_word_review_one_collection on public.exam_word_review_batches(user_id) where status = 'collecting';
create index exam_word_review_owner_updated on public.exam_word_review_batches(user_id,updated_at desc,id);
create table public.exam_word_review_items (
  batch_id uuid not null,
  user_id uuid not null,
  -- No FK to the mutable dictionary: deletion must preserve historical identity.
  word_entry_id uuid not null,
  word_snapshot jsonb not null,
  sources jsonb not null check (pg_catalog.jsonb_typeof(sources) = 'array'),
  progress jsonb not null,
  primary key (batch_id,word_entry_id),
  foreign key (batch_id,user_id) references public.exam_word_review_batches(id,user_id)
);
create table public.exam_word_review_evidence (
  batch_id uuid not null,
  user_id uuid not null,
  word_entry_id uuid not null,
  evidence jsonb not null,
  completed_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (batch_id,word_entry_id),
  foreign key (batch_id,user_id) references public.exam_word_review_batches(id,user_id)
);
create table exams_private.exam_word_review_requests (
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  batch_id uuid not null,
  command_hash text not null check (command_hash ~ '^[0-9a-f]{64}$'),
  operation text not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (user_id,request_id),
  foreign key (batch_id,user_id) references public.exam_word_review_batches(id,user_id)
);
alter table public.exam_word_review_batches enable row level security;
alter table public.exam_word_review_items enable row level security;
alter table public.exam_word_review_evidence enable row level security;
alter table exams_private.exam_word_review_requests enable row level security;
revoke all on public.exam_word_review_batches, public.exam_word_review_items, public.exam_word_review_evidence, exams_private.exam_word_review_requests from public,anon,authenticated,service_role;
grant select,insert,update on public.exam_word_review_batches,public.exam_word_review_items to service_role;
grant delete on public.exam_word_review_items to service_role;
grant select,insert on public.exam_word_review_evidence,exams_private.exam_word_review_requests to service_role;

create function public.find_exam_word_review_request(p_user uuid,p_request_id uuid,p_command_hash text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_row exams_private.exam_word_review_requests%rowtype;
begin
  select * into v_row from exams_private.exam_word_review_requests where user_id=p_user and request_id=p_request_id;
  if not found then return null; end if;
  if v_row.command_hash is distinct from p_command_hash then raise exception 'exam_conflict'; end if;
  return v_row.batch_id;
end $$;

create function public.save_exam_word_review(p_user uuid,p_id uuid,p_expected_version uuid,p_request_id uuid,p_command_hash text,p_operation text,p_state jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_row public.exam_word_review_batches%rowtype;
  v_previous uuid;
  v_item jsonb;
  v_source jsonb;
  v_word public.word_entries%rowtype;
  v_attempt public.exam_attempts%rowtype;
  v_content jsonb;
  v_link jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_user is null or p_id is null or p_request_id is null or p_command_hash !~ '^[0-9a-f]{64}$'
    or p_operation not in ('add','start','answer','help','retry','next','remove') then raise exception 'exam_invalid_request'; end if;
  -- Serialize owner commands, including concurrent creation of the collecting batch.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exam-word-review:' || p_user::text,0));
  v_previous := public.find_exam_word_review_request(p_user,p_request_id,p_command_hash);
  if v_previous is not null then
    if v_previous <> p_id and p_expected_version is not null then raise exception 'exam_conflict'; end if;
    select * into v_row from public.exam_word_review_batches where id=v_previous and user_id=p_user;
    return pg_catalog.to_jsonb(v_row);
  end if;
  if pg_catalog.jsonb_typeof(p_state) is distinct from 'object'
    or p_state -> 'schemaVersion' is distinct from '1'::jsonb
    or pg_catalog.jsonb_typeof(p_state -> 'items') is distinct from 'array'
    or pg_catalog.octet_length(p_state::text) > 2097152
    or coalesce(p_state ->> 'status','') not in ('collecting','active','completed')
    or coalesce(p_state ->> 'cursor','') !~ '^[0-9]+$' then raise exception 'exam_invalid_request'; end if;
  if pg_catalog.jsonb_array_length(p_state -> 'items') not between 0 and 10
    or (pg_catalog.jsonb_array_length(p_state -> 'items')=0 and (p_operation <> 'remove' or p_state ->> 'status' <> 'collecting'))
    or (p_state ->> 'cursor')::numeric > 20 then raise exception 'exam_invalid_request'; end if;
  if (select count(*) <> count(distinct item ->> 'wordEntryId') from pg_catalog.jsonb_array_elements(p_state -> 'items') item) then raise exception 'exam_invalid_request'; end if;
  select * into v_row from public.exam_word_review_batches where id=p_id and user_id=p_user for update;
  if p_expected_version is null then
    if found or p_operation <> 'add' or p_state ->> 'status' <> 'collecting' or p_state ->> 'cursor' <> '0' then raise exception 'exam_conflict'; end if;
  else
    if not found then raise exception 'exam_not_found'; end if;
    if v_row.version <> p_expected_version or v_row.status='completed' then raise exception 'exam_conflict'; end if;
    if (p_operation in ('add','start','remove') and v_row.status <> 'collecting')
      or (p_operation not in ('add','start','remove') and v_row.status <> 'active') then raise exception 'exam_invalid_request'; end if;
    if v_row.status='active' and (
      (select pg_catalog.jsonb_agg(item - array['meaning','spelling'] order by ord) from pg_catalog.jsonb_array_elements(v_row.state -> 'items') with ordinality as x(item,ord))
      is distinct from (select pg_catalog.jsonb_agg(item - array['meaning','spelling'] order by ord) from pg_catalog.jsonb_array_elements(p_state -> 'items') with ordinality as x(item,ord))
    ) then raise exception 'exam_invalid_request'; end if;
  end if;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_state -> 'items') loop
    -- Removing a stale item must remain possible even if another old item is stale.
    if p_operation='remove' then continue; end if;
    select * into v_word from public.word_entries where id=(v_item ->> 'wordEntryId')::uuid for share;
    if not found or v_item #>> '{word,id}' is distinct from v_word.id::text
      or v_item #>> '{word,stage}' is distinct from v_word.stage
      or v_item #>> '{word,unit}' is distinct from v_word.unit
      or v_item #>> '{word,lesson}' is distinct from v_word.lesson
      or v_item #>> '{word,word}' is distinct from v_word.word then raise exception 'exam_word_invalid'; end if;
    if pg_catalog.jsonb_typeof(v_item -> 'sources') is distinct from 'array' or pg_catalog.jsonb_array_length(v_item -> 'sources')=0 then raise exception 'exam_invalid_request'; end if;
    for v_source in select value from pg_catalog.jsonb_array_elements(v_item -> 'sources') loop
      select * into v_attempt from public.exam_attempts where id=(v_source ->> 'attemptId')::uuid and user_id=p_user for share;
      if not found or v_attempt.content_revision_id is distinct from v_source ->> 'contentRevisionId' then raise exception 'exam_not_found'; end if;
      select r.content into v_content from public.exam_content_revisions r where r.id=v_attempt.content_revision_id
        and r.status in ('published','withdrawn') and (select count(*) from public.exam_content_reviews review
          where review.content_revision_id=r.id and review.content_version=r.version and review.scope in ('exam','explanations') and review.decision='approved')=2;
      if not found then raise exception 'exam_word_invalid'; end if;
      select link into v_link from pg_catalog.jsonb_array_elements(v_content -> 'vocabularyLinks') link where link ->> 'id'=v_source ->> 'linkId';
      if not found or pg_catalog.lower(v_link ->> 'wordEntryId') is distinct from v_item ->> 'wordEntryId'
        or v_link -> 'sourceSnapshot' is distinct from v_source -> 'sourceSnapshot'
        or v_link #>> '{review,status}' = 'blocked'
        or not (v_link -> 'questionIds') ? (v_source ->> 'questionId') then raise exception 'exam_word_invalid'; end if;
      if v_source #>> '{sourceSnapshot,stage}' is distinct from v_word.stage
        or v_source #>> '{sourceSnapshot,unit}' is distinct from v_word.unit
        or v_source #>> '{sourceSnapshot,lesson}' is distinct from v_word.lesson
        or v_source #>> '{sourceSnapshot,word}' is distinct from v_word.word then raise exception 'exam_word_invalid'; end if;
      if not exists (select 1 from pg_catalog.jsonb_array_elements(v_content -> 'groups') g,
        lateral pg_catalog.jsonb_array_elements(g -> 'questions') q
        where q ->> 'id'=v_source ->> 'questionId'
          and (v_attempt.state -> 'groupIds') ? (g ->> 'id')
          and v_attempt.state #>> array['sections',g ->> 'sectionId','status']='submitted') then raise exception 'exam_not_found'; end if;
    end loop;
  end loop;
  if p_state ->> 'status'='completed' and ((p_state ->> 'cursor')::int <> pg_catalog.jsonb_array_length(p_state -> 'items')*2
    or exists (select 1 from pg_catalog.jsonb_array_elements(p_state -> 'items') item where item #> '{meaning,lastCorrect}' is distinct from 'true'::jsonb or item #> '{spelling,lastCorrect}' is distinct from 'true'::jsonb)) then raise exception 'exam_invalid_request'; end if;
  if p_expected_version is null then
    insert into public.exam_word_review_batches(id,user_id,status,state) values(p_id,p_user,p_state ->> 'status',p_state) returning * into v_row;
  else
    update public.exam_word_review_batches set version=pg_catalog.gen_random_uuid(),state=p_state,status=p_state ->> 'status',updated_at=v_now,
      completed_at=case when p_state ->> 'status'='completed' then v_now else null end
      where id=p_id and user_id=p_user returning * into v_row;
  end if;
  if p_operation='remove' then
    delete from public.exam_word_review_items where batch_id=p_id and user_id=p_user and word_entry_id::text not in (select item ->> 'wordEntryId' from pg_catalog.jsonb_array_elements(p_state -> 'items') item);
  end if;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_state -> 'items') loop
    insert into public.exam_word_review_items(batch_id,user_id,word_entry_id,word_snapshot,sources,progress)
      values(p_id,p_user,(v_item ->> 'wordEntryId')::uuid,v_item -> 'word',v_item -> 'sources',pg_catalog.jsonb_build_object('meaning',v_item -> 'meaning','spelling',v_item -> 'spelling'))
      on conflict(batch_id,word_entry_id) do update set sources=excluded.sources,progress=excluded.progress;
    if v_row.status='completed' then
      insert into public.exam_word_review_evidence(batch_id,user_id,word_entry_id,evidence,completed_at)
        values(p_id,p_user,(v_item ->> 'wordEntryId')::uuid,pg_catalog.jsonb_build_object('version','word-review-v1','wordSnapshot',v_item -> 'word','sources',v_item -> 'sources','meaning',v_item -> 'meaning','spelling',v_item -> 'spelling'),v_now)
        on conflict(batch_id,word_entry_id) do nothing;
    end if;
  end loop;
  insert into exams_private.exam_word_review_requests(user_id,request_id,batch_id,command_hash,operation) values(p_user,p_request_id,p_id,p_command_hash,p_operation);
  return pg_catalog.to_jsonb(v_row);
end $$;
revoke all on function public.find_exam_word_review_request(uuid,uuid,text),public.save_exam_word_review(uuid,uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.find_exam_word_review_request(uuid,uuid,text),public.save_exam_word_review(uuid,uuid,uuid,uuid,text,text,jsonb) to service_role;

create table public.exam_word_review_transfers (
  batch_id uuid not null,
  user_id uuid not null,
  attempt_id uuid not null unique,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (batch_id,attempt_id),
  foreign key (batch_id,user_id) references public.exam_word_review_batches(id,user_id),
  foreign key (attempt_id,user_id) references public.exam_attempts(id,user_id)
);
alter table public.exam_word_review_transfers enable row level security;
revoke all on public.exam_word_review_transfers from public,anon,authenticated,service_role;
grant select,insert on public.exam_word_review_transfers to service_role;

create function public.create_exam_transfer_attempt(p_user uuid,p_request_id uuid,p_content_revision_id text,p_state jsonb,p_command_hash text,p_batch_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_batch public.exam_word_review_batches%rowtype;
  v_revision public.exam_content_revisions%rowtype;
  v_request exams_private.exam_attempt_requests%rowtype;
  v_group jsonb;
  v_receipt jsonb;
  v_id uuid;
begin
  if p_user is null or p_batch_id is null or p_request_id is null or p_command_hash is null
    or p_command_hash !~ '^[0-9a-f]{64}$' then raise exception 'exam_invalid_request'; end if;
  -- Same lock as attempt creation/exposure: no new exposure can race this unseen check.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exam-attempt-owner:' || p_user::text,0));
  select * into v_request from exams_private.exam_attempt_requests where request_id=p_request_id;
  if found then
    if v_request.user_id <> p_user or v_request.command_hash <> p_command_hash
      or not exists (select 1 from public.exam_word_review_transfers t where t.user_id=p_user and t.batch_id=p_batch_id and t.attempt_id=v_request.attempt_id)
      then raise exception 'exam_conflict'; end if;
    return v_request.receipt;
  end if;
  select * into v_batch from public.exam_word_review_batches where id=p_batch_id and user_id=p_user and status='completed' for share;
  if not found then raise exception 'exam_not_found'; end if;
  select * into v_revision from public.exam_content_revisions where id=p_content_revision_id for share;
  if not found or v_revision.status <> 'published' or v_revision.set_snapshot ->> 'purpose' <> 'training' then raise exception 'exam_content_unavailable'; end if;
  if p_state ->> 'mode' is distinct from 'practice' or pg_catalog.jsonb_typeof(p_state -> 'groupIds') is distinct from 'array' then raise exception 'exam_invalid_request'; end if;
  if pg_catalog.jsonb_array_length(p_state -> 'groupIds') <> 1 then raise exception 'exam_invalid_request'; end if;
  select g into v_group from pg_catalog.jsonb_array_elements(v_revision.content -> 'groups') g where g ->> 'id'=p_state #>> '{groupIds,0}';
  if not found or pg_catalog.jsonb_array_length(v_group -> 'materialIds')=0 then raise exception 'exam_content_unavailable'; end if;
  if (select count(*) from public.exam_content_reviews review where review.content_revision_id=v_revision.id
    and review.content_version=v_revision.version and review.scope in ('exam','explanations') and review.decision='approved') <> 2 then raise exception 'exam_content_unavailable'; end if;
  perform 1 from public.word_entries word where word.id in (select item.word_entry_id from public.exam_word_review_items item where item.batch_id=p_batch_id and item.user_id=p_user) for share;
  if not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_revision.content -> 'vocabularyLinks') link
      join public.word_entries word on word.id::text=pg_catalog.lower(link ->> 'wordEntryId')
      join public.exam_word_review_items item on item.batch_id=p_batch_id and item.user_id=p_user and item.word_entry_id::text=pg_catalog.lower(link ->> 'wordEntryId')
    where link ->> 'role'='key' and link #>> '{review,status}' is distinct from 'blocked'
      and word.stage=link #>> '{sourceSnapshot,stage}' and word.unit=link #>> '{sourceSnapshot,unit}'
      and word.lesson=link #>> '{sourceSnapshot,lesson}' and word.word=link #>> '{sourceSnapshot,word}'
      and link #>> '{sourceSnapshot,stage}'=item.word_snapshot ->> 'stage'
      and link #>> '{sourceSnapshot,unit}'=item.word_snapshot ->> 'unit'
      and link #>> '{sourceSnapshot,lesson}'=item.word_snapshot ->> 'lesson'
      and link #>> '{sourceSnapshot,word}'=item.word_snapshot ->> 'word'
      and exists (select 1 from pg_catalog.jsonb_array_elements(v_group -> 'questions') q where (link -> 'questionIds') ? (q ->> 'id'))
  ) then raise exception 'exam_content_unavailable'; end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(v_revision.content -> 'materials') m
    join public.exam_material_exposures e on e.user_id=p_user and e.family_id=m ->> 'familyId'
    where (v_group -> 'materialIds') ? (m ->> 'id')) then raise exception 'exam_content_unavailable'; end if;
  v_receipt := public.create_exam_attempt(p_user,p_request_id,p_content_revision_id,p_state,p_command_hash);
  v_id := (v_receipt #>> '{attempt,id}')::uuid;
  insert into public.exam_word_review_transfers(batch_id,user_id,attempt_id) values(p_batch_id,p_user,v_id) on conflict(batch_id,attempt_id) do nothing;
  return v_receipt;
end $$;
revoke all on function public.create_exam_transfer_attempt(uuid,uuid,text,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.create_exam_transfer_attempt(uuid,uuid,text,jsonb,text,uuid) to service_role;
commit;
