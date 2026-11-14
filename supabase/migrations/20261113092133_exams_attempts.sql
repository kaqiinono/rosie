begin;

-- All RPC parameters are supplied by the authenticated application server.
-- In particular, actor IDs, command hashes, computed results and PIN grants are
-- never accepted directly from a browser. The SQL clock remains authoritative.
create function exams_private.exam_attempt_state_valid(p_state jsonb, p_content jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_group jsonb; v_section record; v_entry record; v_question jsonb;
  v_ids text[]; v_section_ids text[]; v_question_ids text[]; v_active integer := 0;
begin
  if pg_catalog.jsonb_typeof(p_state) is distinct from 'object'
    or pg_catalog.octet_length(p_state::text) > 2097152
    or not p_state ?& array['schemaVersion','mode','groupIds','currentSectionId','currentGroupId',
      'sections','answers','results','helpQuestionIds','priorExposureFamilies','groupActiveMs',
      'lastActivityAt','playbackPositionMs','scriptGrant']
    or (p_state - array['schemaVersion','mode','groupIds','currentSectionId','currentGroupId',
      'sections','answers','results','helpQuestionIds','priorExposureFamilies','groupActiveMs',
      'lastActivityAt','playbackPositionMs','scriptGrant']) <> '{}'::jsonb
    or p_state -> 'schemaVersion' is distinct from '1'::jsonb
    or coalesce(p_state ->> 'mode','') not in ('practice','mock')
    or pg_catalog.jsonb_typeof(p_state -> 'groupIds') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_state -> 'sections') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_state -> 'answers') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_state -> 'results') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_state -> 'helpQuestionIds') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_state -> 'priorExposureFamilies') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_state -> 'groupActiveMs') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_state -> 'currentSectionId') not in ('null','string')
    or pg_catalog.jsonb_typeof(p_state -> 'currentGroupId') not in ('null','string')
    or pg_catalog.jsonb_typeof(p_state -> 'lastActivityAt') not in ('null','string')
    or pg_catalog.jsonb_typeof(p_state -> 'playbackPositionMs') is distinct from 'number'
  then return false; end if;
  if (p_state ->> 'playbackPositionMs')::numeric < 0 or (p_state ->> 'playbackPositionMs')::numeric > 86400000 then return false; end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(p_state -> 'groupIds') x where pg_catalog.jsonb_typeof(x) <> 'string') then return false; end if;
  select array_agg(value) into v_ids from pg_catalog.jsonb_array_elements_text(p_state -> 'groupIds');
  if coalesce(cardinality(v_ids),0) = 0 or cardinality(v_ids) > 2000
    or cardinality(v_ids) <> (select count(distinct value) from pg_catalog.unnest(v_ids) value)
    or exists (select 1 from pg_catalog.unnest(v_ids) id where not exists (
      select 1 from pg_catalog.jsonb_array_elements(p_content -> 'groups') g where g ->> 'id' = id))
  then return false; end if;
  select array_agg(distinct g ->> 'sectionId') into v_section_ids
    from pg_catalog.jsonb_array_elements(p_content -> 'groups') g where g ->> 'id' = any(v_ids);
  select array_agg(q ->> 'id') into v_question_ids
    from pg_catalog.jsonb_array_elements(p_content -> 'groups') g
    cross join lateral pg_catalog.jsonb_array_elements(g -> 'questions') q where g ->> 'id' = any(v_ids);
  if (select count(*) from pg_catalog.jsonb_object_keys(p_state -> 'sections')) <> cardinality(v_section_ids) then return false; end if;
  for v_section in select * from pg_catalog.jsonb_each(p_state -> 'sections') loop
    if not v_section.key = any(v_section_ids) or pg_catalog.jsonb_typeof(v_section.value) <> 'object'
      or not v_section.value ?& array['status','startedAt','deadlineAt','submittedAt','interruptedAt','technicalInterruption','timedOut']
      or (v_section.value - array['status','startedAt','deadlineAt','submittedAt','interruptedAt','technicalInterruption','timedOut']) <> '{}'::jsonb
      or coalesce(v_section.value ->> 'status','') not in ('not_started','active','interrupted','submitted')
      or pg_catalog.jsonb_typeof(v_section.value -> 'technicalInterruption') is distinct from 'boolean'
      or pg_catalog.jsonb_typeof(v_section.value -> 'timedOut') is distinct from 'boolean'
    then return false; end if;
    for v_entry in select key,value from pg_catalog.jsonb_each(v_section.value)
      where key in ('startedAt','deadlineAt','submittedAt','interruptedAt') loop
      if pg_catalog.jsonb_typeof(v_entry.value) not in ('null','string') then return false; end if;
      if pg_catalog.jsonb_typeof(v_entry.value) = 'string' then
        if not pg_catalog.isfinite((v_entry.value #>> '{}')::timestamptz) then return false; end if;
      end if;
    end loop;
    if v_section.value ->> 'status' in ('active','interrupted') then
      v_active := v_active + 1;
      if p_state ->> 'currentSectionId' is distinct from v_section.key
        or v_section.value ->> 'startedAt' is null then return false; end if;
    end if;
    if v_section.value ->> 'status' = 'interrupted' and v_section.value ->> 'interruptedAt' is null then return false; end if;
    if v_section.value ->> 'status' = 'submitted' and v_section.value ->> 'submittedAt' is null then return false; end if;
  end loop;
  if v_active > 1 or (v_active = 0 and (p_state ->> 'currentSectionId' is not null or p_state ->> 'currentGroupId' is not null)) then return false; end if;
  if v_active = 1 and not exists (select 1 from pg_catalog.jsonb_array_elements(p_content -> 'groups') g
    where g ->> 'id' = p_state ->> 'currentGroupId' and g ->> 'id' = any(v_ids)
      and g ->> 'sectionId' = p_state ->> 'currentSectionId') then return false; end if;
  if p_state ->> 'lastActivityAt' is not null and not pg_catalog.isfinite((p_state ->> 'lastActivityAt')::timestamptz) then return false; end if;
  for v_entry in select * from pg_catalog.jsonb_each(p_state -> 'answers') loop
    if not coalesce(v_entry.key = any(v_question_ids),false) or pg_catalog.jsonb_typeof(v_entry.value) <> 'object' then return false; end if;
    select q into v_question from pg_catalog.jsonb_array_elements(p_content -> 'groups') g
      cross join lateral pg_catalog.jsonb_array_elements(g -> 'questions') q where q ->> 'id' = v_entry.key;
    if v_entry.value ->> 'type' is distinct from v_question ->> 'answerType'
      or v_question #>> '{scoring,kind}' = 'example' then return false; end if;
  end loop;
  for v_entry in select * from pg_catalog.jsonb_each(p_state -> 'results') loop
    if not coalesce(v_entry.key = any(v_question_ids),false) or pg_catalog.jsonb_typeof(v_entry.value) <> 'object'
      or not v_entry.value ?& array['questionId','outcome','points','maxPoints']
      or (v_entry.value - array['questionId','outcome','points','maxPoints']) <> '{}'::jsonb
      or v_entry.value ->> 'questionId' is distinct from v_entry.key
      or coalesce(v_entry.value ->> 'outcome','') not in ('correct','incorrect','unanswered','pending','unscored','graded')
      or pg_catalog.jsonb_typeof(v_entry.value -> 'points') not in ('null','number')
      or pg_catalog.jsonb_typeof(v_entry.value -> 'maxPoints') not in ('null','number') then return false; end if;
    if (v_entry.value ->> 'points' is null) <> (v_entry.value ->> 'maxPoints' is null)
      or (v_entry.value ->> 'points')::numeric < 0
      or (v_entry.value ->> 'maxPoints')::numeric < 0
      or (v_entry.value ->> 'points')::numeric > (v_entry.value ->> 'maxPoints')::numeric then return false; end if;
    if not exists (select 1 from pg_catalog.jsonb_array_elements(p_content -> 'groups') g
      cross join lateral pg_catalog.jsonb_array_elements(g -> 'questions') q
      where q ->> 'id' = v_entry.key and p_state #>> array['sections',g ->> 'sectionId','status'] = 'submitted') then return false; end if;
  end loop;
  if exists (select 1 from pg_catalog.jsonb_array_elements(p_state -> 'helpQuestionIds') h
    where pg_catalog.jsonb_typeof(h) <> 'string' or not coalesce((h #>> '{}') = any(v_question_ids),false))
    or (select count(*) <> count(distinct value) from pg_catalog.jsonb_array_elements(p_state -> 'helpQuestionIds'))
    or exists (select 1 from pg_catalog.jsonb_array_elements(p_state -> 'priorExposureFamilies') f where pg_catalog.jsonb_typeof(f) <> 'string')
  then return false; end if;
  for v_entry in select * from pg_catalog.jsonb_each(p_state -> 'groupActiveMs') loop
    if not v_entry.key = any(v_ids) or pg_catalog.jsonb_typeof(v_entry.value) <> 'number'
      or (v_entry.value #>> '{}') !~ '^[0-9]+$' then return false; end if;
  end loop;
  if p_state -> 'scriptGrant' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_state -> 'scriptGrant') <> 'object'
      or not (p_state -> 'scriptGrant') ?& array['partNumber','expiresAt','sessionId']
      or ((p_state -> 'scriptGrant') - array['partNumber','expiresAt','sessionId']) <> '{}'::jsonb
      or coalesce(p_state #>> '{scriptGrant,partNumber}','') !~ '^[1-9][0-9]*$'
      or coalesce(p_state #>> '{scriptGrant,sessionId}','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or p_state #>> '{scriptGrant,expiresAt}' is null
      or not pg_catalog.isfinite((p_state #>> '{scriptGrant,expiresAt}')::timestamptz) then return false; end if;
  end if;
  return true;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range
  then return false;
end $$;

create table public.exam_attempts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  content_revision_id text not null references public.exam_content_revisions(id),
  media_binding_revision_id uuid references public.exam_media_binding_revisions(id),
  version uuid not null default pg_catalog.gen_random_uuid(),
  state jsonb not null check (pg_catalog.jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (id,user_id)
);
create index exam_attempts_owner_updated on public.exam_attempts(user_id,updated_at desc,id);

create table public.exam_material_exposures (
  user_id uuid not null references auth.users(id),
  family_id text not null check (pg_catalog.btrim(family_id) <> ''),
  attempt_id uuid not null,
  group_ids text[] not null,
  seen_before boolean not null,
  first_exposed_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (user_id,family_id,attempt_id),
  foreign key (attempt_id,user_id) references public.exam_attempts(id,user_id)
);
create index exam_material_exposures_owner_time on public.exam_material_exposures(user_id,first_exposed_at,family_id);

-- Receipts can contain the private server envelope. Keep them outside public.
create table exams_private.exam_attempt_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id),
  actor_id uuid not null references auth.users(id),
  attempt_id uuid not null,
  expected_version uuid,
  operation text not null check (operation in ('create','start','save','submit','expire','help','interrupt','resume','script','grade')),
  command_hash text not null check (command_hash ~ '^[0-9a-f]{64}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  receipt jsonb not null check (pg_catalog.jsonb_typeof(receipt) = 'object'),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  foreign key (attempt_id,user_id) references public.exam_attempts(id,user_id)
);
create index exam_attempt_requests_attempt on exams_private.exam_attempt_requests(attempt_id,created_at);

alter table public.exam_attempts enable row level security;
alter table public.exam_material_exposures enable row level security;
alter table exams_private.exam_attempt_requests enable row level security;
revoke all on public.exam_attempts, public.exam_material_exposures, exams_private.exam_attempt_requests
  from public, anon, authenticated, service_role;
grant select, insert, update on public.exam_attempts to service_role;
grant select, insert on public.exam_material_exposures, exams_private.exam_attempt_requests to service_role;

create function exams_private.guard_exam_attempt()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_content jsonb; v_status text;
begin
  select content,status into v_content,v_status from public.exam_content_revisions where id = new.content_revision_id;
  if not found or not exams_private.exam_attempt_state_valid(new.state,v_content) then raise exception 'exam_invalid_attempt'; end if;
  if tg_op = 'INSERT' and v_status <> 'published' then raise exception 'exam_content_unavailable'; end if;
  if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.content_revision_id is distinct from old.content_revision_id
    or new.media_binding_revision_id is distinct from old.media_binding_revision_id
    or new.created_at is distinct from old.created_at) then raise exception 'exam_conflict'; end if;
  if new.media_binding_revision_id is not null and not exists (select 1 from public.exam_media_binding_revisions b
    where b.id = new.media_binding_revision_id and b.content_revision_id = new.content_revision_id) then raise exception 'exam_invalid_attempt'; end if;
  return new;
end $$;
create trigger exam_attempt_guard before insert or update on public.exam_attempts
  for each row execute function exams_private.guard_exam_attempt();

create function exams_private.record_exam_exposure(p_user uuid,p_attempt uuid,p_content jsonb,p_groups text[])
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_family record; v_prior jsonb;
begin
  -- Caller holds the owner's advisory transaction lock across registration and response.
  for v_family in
    select m ->> 'familyId' as family_id,array_agg(distinct g ->> 'id') as groups
      from pg_catalog.jsonb_array_elements(p_content -> 'groups') g
      cross join lateral pg_catalog.jsonb_array_elements_text(g -> 'materialIds') mids(material_id)
      join lateral pg_catalog.jsonb_array_elements(p_content -> 'materials') m on m ->> 'id' = mids.material_id
      where g ->> 'id' = any(p_groups) group by m ->> 'familyId'
  loop
    insert into public.exam_material_exposures(user_id,family_id,attempt_id,group_ids,seen_before)
      values (p_user,v_family.family_id,p_attempt,v_family.groups,exists (
        select 1 from public.exam_material_exposures e where e.user_id = p_user
          and e.family_id = v_family.family_id and e.attempt_id <> p_attempt))
      on conflict (user_id,family_id,attempt_id) do nothing;
  end loop;
  -- A later exposure in another attempt never retroactively changes this attempt.
  select coalesce(pg_catalog.jsonb_agg(family_id order by family_id),'[]'::jsonb) into v_prior
    from public.exam_material_exposures where user_id = p_user and attempt_id = p_attempt and seen_before;
  return v_prior;
end $$;

create function public.read_exam_attempt(p_user uuid,p_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  select pg_catalog.jsonb_build_object(
    'attempt',pg_catalog.jsonb_build_object('id',a.id,'userId',a.user_id,'contentRevisionId',a.content_revision_id,
      'mediaBindingRevisionId',a.media_binding_revision_id,'version',a.version,'createdAt',a.created_at,'updatedAt',a.updated_at,'state',a.state),
    'draft',pg_catalog.jsonb_build_object('contentSet',r.set_snapshot,
      'content',pg_catalog.jsonb_set(r.content,'{status}','"draft"'::jsonb),'solutions',s.content),
    'serverNow',pg_catalog.clock_timestamp()) into v_result
    from public.exam_attempts a join public.exam_content_revisions r on r.id = a.content_revision_id
    join exams_private.exam_solutions s on s.content_revision_id = r.id
    where a.id = p_id and a.user_id = p_user;
  if not found then raise exception 'exam_not_found'; end if;
  return v_result;
end $$;

create function public.find_exam_attempt_request(p_user uuid,p_request_id uuid,p_command_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_request exams_private.exam_attempt_requests%rowtype;
begin
  if p_user is null or p_request_id is null or p_command_hash is null or p_command_hash !~ '^[0-9a-f]{64}$' then raise exception 'exam_invalid_request'; end if;
  select * into v_request from exams_private.exam_attempt_requests where user_id = p_user and request_id = p_request_id;
  if not found then return null; end if;
  if v_request.command_hash <> p_command_hash then raise exception 'exam_conflict'; end if;
  return pg_catalog.jsonb_build_object('attemptId',v_request.attempt_id);
end $$;

create function public.create_exam_attempt(p_user uuid,p_request_id uuid,p_content_revision_id text,p_state jsonb,p_command_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_revision public.exam_content_revisions%rowtype; v_request exams_private.exam_attempt_requests%rowtype;
  v_id uuid := pg_catalog.gen_random_uuid(); v_binding uuid; v_state jsonb; v_group jsonb;
  v_groups jsonb; v_sections jsonb := '{}'::jsonb; v_section text; v_current text;
  v_now timestamptz; v_hash text; v_prior jsonb; v_receipt jsonb; v_ids text[];
begin
  if p_user is null or p_request_id is null or p_command_hash is null or p_command_hash !~ '^[0-9a-f]{64}$'
    or p_content_revision_id is null then raise exception 'exam_invalid_request'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exam-attempt-owner:' || p_user::text,0));
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'user',p_user,'actor',p_user,'revision',p_content_revision_id,'operation','create','expectedVersion',null,'commandHash',p_command_hash)::text,'UTF8')),'hex');
  select * into v_request from exams_private.exam_attempt_requests where request_id = p_request_id;
  if found then
    if v_request.user_id <> p_user or v_request.request_hash <> v_hash then raise exception 'exam_conflict'; end if;
    return v_request.receipt;
  end if;
  select * into v_revision from public.exam_content_revisions where id = p_content_revision_id for share;
  if not found or v_revision.status <> 'published' then raise exception 'exam_content_unavailable'; end if;
  if not exams_private.exam_attempt_state_valid(p_state,v_revision.content) then raise exception 'exam_invalid_attempt'; end if;
  if p_state ->> 'mode' = 'practice' then
    if v_revision.set_snapshot ->> 'purpose' <> 'training' or pg_catalog.jsonb_array_length(p_state -> 'groupIds') <> 1 then raise exception 'exam_invalid_mode'; end if;
    v_groups := p_state -> 'groupIds';
    select g into v_group from pg_catalog.jsonb_array_elements(v_revision.content -> 'groups') g where g ->> 'id' = v_groups ->> 0;
    v_current := v_group ->> 'sectionId';
  else
    if v_revision.set_snapshot ->> 'kind' = 'training_unit' then raise exception 'exam_invalid_mode'; end if;
    select coalesce(pg_catalog.jsonb_agg(g -> 'id' order by ord),'[]'::jsonb) into v_groups
      from pg_catalog.jsonb_array_elements(v_revision.content -> 'groups') with ordinality a(g,ord) where g ->> 'role' = 'exam';
    if v_groups <> p_state -> 'groupIds' or pg_catalog.jsonb_array_length(v_groups) = 0 then raise exception 'exam_invalid_attempt'; end if;
  end if;
  select array_agg(value) into v_ids from pg_catalog.jsonb_array_elements_text(v_groups);
  if v_revision.content ->> 'mediaBindingRevisionId' is not null then
    select id into v_binding from public.exam_media_binding_revisions
      where id::text = v_revision.content ->> 'mediaBindingRevisionId' and content_revision_id = v_revision.id;
    if not found then raise exception 'exam_content_unavailable'; end if;
  end if;
  v_now := pg_catalog.clock_timestamp();
  for v_section in select distinct g ->> 'sectionId' from pg_catalog.jsonb_array_elements(v_revision.content -> 'groups') g where g ->> 'id' = any(v_ids) loop
    v_sections := v_sections || pg_catalog.jsonb_build_object(v_section,pg_catalog.jsonb_build_object(
      'status',case when v_section = v_current then 'active' else 'not_started' end,
      'startedAt',case when v_section = v_current then v_now else null end,'deadlineAt',null,'submittedAt',null,
      'interruptedAt',null,'technicalInterruption',false,'timedOut',false));
  end loop;
  v_state := pg_catalog.jsonb_build_object('schemaVersion',1,'mode',p_state ->> 'mode','groupIds',v_groups,
    'currentSectionId',v_current,'currentGroupId',case when v_current is not null then v_groups ->> 0 else null end,
    'sections',v_sections,'answers','{}'::jsonb,'results','{}'::jsonb,'helpQuestionIds','[]'::jsonb,
    'priorExposureFamilies','[]'::jsonb,'groupActiveMs','{}'::jsonb,'lastActivityAt',case when v_current is not null then v_now else null end,
    'playbackPositionMs',0,'scriptGrant',null);
  insert into public.exam_attempts(id,user_id,content_revision_id,media_binding_revision_id,state,created_at,updated_at)
    values (v_id,p_user,p_content_revision_id,v_binding,v_state,v_now,v_now);
  if v_current is not null then
    v_prior := exams_private.record_exam_exposure(p_user,v_id,v_revision.content,v_ids);
    update public.exam_attempts set state = pg_catalog.jsonb_set(state,'{priorExposureFamilies}',v_prior) where id = v_id;
  end if;
  v_receipt := public.read_exam_attempt(p_user,v_id);
  insert into exams_private.exam_attempt_requests(request_id,user_id,actor_id,attempt_id,operation,command_hash,request_hash,receipt)
    values (p_request_id,p_user,p_user,v_id,'create',p_command_hash,v_hash,v_receipt);
  return v_receipt;
exception when unique_violation then raise exception 'exam_conflict';
end $$;

-- A slot is authorized only when every material scope covered by it is open.
-- This helper also follows actual references, so a misleading target cannot
-- hide a second group which references the same slot.
create function exams_private.exam_media_slot_in_scope(
  p_content jsonb,p_solutions jsonb,p_state jsonb,p_slot jsonb,p_session_id text,p_now timestamptz
) returns boolean language plpgsql stable security invoker set search_path = '' as $$
declare
  v_groups text[] := '{}'::text[]; v_group jsonb; v_item jsonb; v_id text;
  v_section jsonb; v_part jsonb; v_audience text := p_slot ->> 'audience';
  v_vars jsonb := pg_catalog.jsonb_build_object('slot',p_slot ->> 'id');
begin
  if v_audience not in ('student','review','parent') then return false; end if;
  if p_slot #>> '{target,kind}' = 'group' then
    v_groups := array[p_slot #>> '{target,id}'];
  elsif p_slot #>> '{target,kind}' = 'guidance' then
    select g into v_item from pg_catalog.jsonb_array_elements(p_content -> 'guidance') g where g ->> 'id' = p_slot #>> '{target,id}';
    if not found then return false; end if;
    select coalesce(array_agg(value),'{}'::text[]) into v_groups from pg_catalog.jsonb_array_elements_text(v_item -> 'groupIds');
  elsif p_slot #>> '{target,kind}' = 'teacher_notes' then
    select n into v_item from pg_catalog.jsonb_array_elements(p_solutions -> 'teacherNotes') n where n ->> 'id' = p_slot #>> '{target,id}';
    if not found or v_audience = 'student' then return false; end if;
    select coalesce(array_agg(value),'{}'::text[]) into v_groups from pg_catalog.jsonb_array_elements_text(v_item -> 'groupIds');
  elsif p_slot #>> '{target,kind}' = 'content_set' then
    if p_slot #>> '{target,id}' is distinct from p_content ->> 'contentSetId' then return false; end if;
    if p_slot ->> 'purpose' = 'exam_listening' then
      select coalesce(array_agg(g ->> 'id'),'{}'::text[]) into v_groups
        from pg_catalog.jsonb_array_elements(p_content -> 'groups') g where g ->> 'sectionId' = 'listening';
    elsif v_audience <> 'student' then
      select coalesce(array_agg(g ->> 'id'),'{}'::text[]) into v_groups from pg_catalog.jsonb_array_elements(p_content -> 'groups') g;
    end if;
  else return false; end if;

  for v_group in select value from pg_catalog.jsonb_array_elements(p_content -> 'groups') loop
    if pg_catalog.jsonb_path_exists(v_group,'$.**.mediaSlotId ? (@ == $slot)',v_vars)
      or pg_catalog.jsonb_path_exists(v_group,'$.**.imageSlotId ? (@ == $slot)',v_vars)
      or exists (select 1 from pg_catalog.jsonb_array_elements(p_content -> 'materials') m
        where (v_group -> 'materialIds') ? (m ->> 'id')
          and pg_catalog.jsonb_path_exists(m,'$.**.mediaSlotId ? (@ == $slot)',v_vars))
      then v_groups := pg_catalog.array_append(v_groups,v_group ->> 'id'); end if;
  end loop;
  for v_item in select value from pg_catalog.jsonb_array_elements(
    coalesce(p_content -> 'guidance','[]'::jsonb) || coalesce(p_solutions -> 'teacherNotes','[]'::jsonb)) loop
    if pg_catalog.jsonb_path_exists(v_item,'$.**.mediaSlotId ? (@ == $slot)',v_vars) then
      for v_id in select value from pg_catalog.jsonb_array_elements_text(v_item -> 'groupIds') loop
        v_groups := pg_catalog.array_append(v_groups,v_id);
      end loop;
    end if;
  end loop;
  if cardinality(v_groups) = 0 then return false; end if;
  if v_audience = 'parent' then
    select g -> 'partNumber' into v_part from pg_catalog.jsonb_array_elements(p_content -> 'groups') g
      where g ->> 'id' = p_state ->> 'currentGroupId' and g ->> 'sectionId' = 'speaking';
    if not found or p_state ->> 'currentSectionId' <> 'speaking'
      or p_state #>> '{sections,speaking,status}' <> 'active'
      or p_session_id is null or p_state #>> '{scriptGrant,sessionId}' is distinct from p_session_id
      or p_state #> '{scriptGrant,partNumber}' is distinct from v_part
      or p_state #>> '{scriptGrant,expiresAt}' is null
      or (p_state #>> '{scriptGrant,expiresAt}')::timestamptz <= p_now then return false; end if;
  end if;
  foreach v_id in array v_groups loop
    if not (p_state -> 'groupIds') ? v_id then return false; end if;
    select g into v_group from pg_catalog.jsonb_array_elements(p_content -> 'groups') g where g ->> 'id' = v_id;
    if not found then return false; end if;
    v_section := p_state #> array['sections',v_group ->> 'sectionId'];
    if v_audience = 'student' then
      if coalesce(v_section ->> 'status','') not in ('active','submitted') then return false; end if;
      if v_section ->> 'status' = 'active' and (p_state ->> 'currentSectionId' is distinct from v_group ->> 'sectionId'
        or ((v_section ->> 'deadlineAt')::timestamptz <= p_now)) then return false; end if;
    elsif v_audience = 'review' then
      if v_section ->> 'status' is distinct from 'submitted' then return false; end if;
    elsif v_group ->> 'sectionId' <> 'speaking' or v_group -> 'partNumber' is distinct from v_part then return false;
    end if;
  end loop;
  return true;
end $$;

create function public.authorize_exam_media(
  p_user uuid,p_attempt_id uuid,p_slot_id text,p_audience text,p_session_id text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt public.exam_attempts%rowtype; v_content jsonb; v_solutions jsonb; v_files jsonb;
  v_slots jsonb; v_slot jsonb; v_file jsonb; v_sibling jsonb; v_actual jsonb; v_now timestamptz;
begin
  if p_user is null or p_attempt_id is null or p_slot_id is null
    or p_audience is null or p_audience not in ('student','review','parent') then raise exception 'exam_forbidden'; end if;
  -- Lock against a simultaneous Part change or submission for this grant decision.
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and user_id = p_user for share;
  if not found then raise exception 'exam_not_found'; end if;
  select r.content,s.content into v_content,v_solutions from public.exam_content_revisions r
    join exams_private.exam_solutions s on s.content_revision_id = r.id where r.id = v_attempt.content_revision_id;
  select files into v_files from public.exam_media_binding_revisions where id = v_attempt.media_binding_revision_id
    and content_revision_id = v_attempt.content_revision_id;
  if not found or v_content ->> 'mediaBindingRevisionId' is distinct from v_attempt.media_binding_revision_id::text
    then raise exception 'exam_playback_unavailable'; end if;
  v_slots := (v_content -> 'mediaSlots') || (v_solutions -> 'mediaSlots');
  select slot into v_slot from pg_catalog.jsonb_array_elements(v_slots) slot where slot ->> 'id' = p_slot_id;
  if not found or v_slot ->> 'audience' is distinct from p_audience then raise exception 'exam_forbidden'; end if;
  select f into v_file from pg_catalog.jsonb_array_elements(v_files) f where f ->> 'slot_id' = p_slot_id;
  if not found or v_file -> 'reviewed' is distinct from 'true'::jsonb or v_file -> 'slot' is distinct from v_slot
    or v_file ->> 'file_id' is null then raise exception 'exam_playback_unavailable'; end if;
  v_now := pg_catalog.clock_timestamp();
  -- A byte-range request can retrieve any part of a file. Segment metadata is
  -- never an access boundary: every sibling binding must be safe in its entirety.
  for v_sibling in select f from pg_catalog.jsonb_array_elements(v_files) f
    where f ->> 'file_id' = v_file ->> 'file_id' loop
    select slot into v_actual from pg_catalog.jsonb_array_elements(v_slots) slot where slot ->> 'id' = v_sibling ->> 'slot_id';
    if not found or v_actual ->> 'audience' is distinct from p_audience
      or v_sibling -> 'slot' is distinct from v_actual or v_sibling -> 'reviewed' is distinct from 'true'::jsonb
      or not exams_private.exam_media_slot_in_scope(v_content,v_solutions,v_attempt.state,v_actual,p_session_id,v_now)
      then raise exception 'exam_forbidden'; end if;
  end loop;
  return pg_catalog.jsonb_build_object('contentRevisionId',v_attempt.content_revision_id,
    'mediaBindingRevisionId',v_attempt.media_binding_revision_id,'slotId',p_slot_id,'audience',p_audience,'wholeFileAllowed',true);
end $$;

create function public.commit_exam_attempt(
  p_user uuid,p_id uuid,p_expected_version uuid,p_request_id uuid,p_operation text,
  p_state jsonb,p_exposure_group_ids text[],p_command_hash text,p_actor uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt public.exam_attempts%rowtype; v_request exams_private.exam_attempt_requests%rowtype;
  v_actor uuid := coalesce(p_actor,p_user); v_content jsonb; v_files jsonb; v_old jsonb; v_state jsonb;
  v_section_id text; v_section jsonb; v_ids text[]; v_scope text[]; v_questions text[]; v_manual text[];
  v_current_group jsonb; v_next_group jsonb; v_now timestamptz; v_deadline timestamptz;
  v_duration bigint; v_elapsed bigint; v_activity jsonb; v_hash text; v_receipt jsonb;
begin
  if p_user is null or p_id is null or p_expected_version is null or p_request_id is null
    or p_command_hash is null or p_command_hash !~ '^[0-9a-f]{64}$'
    or p_operation is null or p_operation not in ('start','save','submit','expire','help','interrupt','resume','script','grade')
    or (p_operation <> 'grade' and v_actor <> p_user)
    or p_exposure_group_ids is null then raise exception 'exam_invalid_request'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exam-attempt-owner:' || p_user::text,0));
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'user',p_user,'actor',v_actor,'attempt',p_id,'expectedVersion',p_expected_version,
    'operation',p_operation,'commandHash',p_command_hash)::text,'UTF8')),'hex');
  select * into v_request from exams_private.exam_attempt_requests where request_id = p_request_id;
  if found then
    if v_request.user_id <> p_user or v_request.request_hash <> v_hash then raise exception 'exam_conflict'; end if;
    return v_request.receipt;
  end if;
  select * into v_attempt from public.exam_attempts where id = p_id and user_id = p_user for update;
  if not found then raise exception 'exam_not_found'; end if;
  if v_attempt.version <> p_expected_version then raise exception 'exam_conflict'; end if;
  select content into v_content from public.exam_content_revisions where id = v_attempt.content_revision_id;
  select files into v_files from public.exam_media_binding_revisions where id = v_attempt.media_binding_revision_id;
  v_old := v_attempt.state;
  if not exams_private.exam_attempt_state_valid(p_state,v_content)
    or p_state -> 'mode' <> v_old -> 'mode' or p_state -> 'groupIds' <> v_old -> 'groupIds'
    then raise exception 'exam_invalid_attempt'; end if;
  v_now := pg_catalog.clock_timestamp();
  v_state := v_old;
  select array_agg(value) into v_ids from pg_catalog.jsonb_array_elements_text(v_old -> 'groupIds');
  v_section_id := v_old ->> 'currentSectionId';
  v_section := v_old #> array['sections',v_section_id];
  v_deadline := (v_section ->> 'deadlineAt')::timestamptz;
  if v_section ->> 'status' = 'active' and v_deadline is not null and v_now >= v_deadline
    and p_operation <> 'expire' then raise exception 'exam_expired'; end if;

  if p_operation = 'start' then
    v_section_id := p_state ->> 'currentSectionId';
    if v_old ->> 'mode' <> 'mock' or v_old ->> 'currentSectionId' is not null
      or coalesce(v_old #>> array['sections',v_section_id,'status'],'') <> 'not_started'
      then raise exception 'exam_invalid_transition'; end if;
    select array_agg(g ->> 'id' order by ord) into v_scope
      from pg_catalog.jsonb_array_elements(v_content -> 'groups') with ordinality a(g,ord)
      where g ->> 'id' = any(v_ids) and g ->> 'sectionId' = v_section_id;
    if coalesce(cardinality(v_scope),0) = 0 then raise exception 'exam_invalid_transition'; end if;
    if p_exposure_group_ids is distinct from v_scope then raise exception 'exam_invalid_attempt'; end if;
    v_duration := case when v_section_id = 'reading_writing' then 3600000 else null end;
    if v_section_id = 'listening' then
      v_duration := public.exam_listening_duration_ms(v_content,v_files,v_section_id);
      if v_duration is null or v_duration <= 0 then raise exception 'exam_playback_unavailable'; end if;
    end if;
    v_section := pg_catalog.jsonb_build_object('status','active','startedAt',v_now,
      'deadlineAt',case when v_duration is not null then v_now + v_duration * interval '1 millisecond' else null end,
      'submittedAt',null,'interruptedAt',null,'technicalInterruption',false,'timedOut',false);
    v_state := pg_catalog.jsonb_set(v_state,array['sections',v_section_id],v_section)
      || pg_catalog.jsonb_build_object('currentSectionId',v_section_id,'currentGroupId',v_scope[1],
        'lastActivityAt',v_now,'playbackPositionMs',0,'scriptGrant',null);
    v_state := pg_catalog.jsonb_set(v_state,'{priorExposureFamilies}',
      exams_private.record_exam_exposure(p_user,p_id,v_content,v_scope));
  else
    if cardinality(p_exposure_group_ids) <> 0 then raise exception 'exam_invalid_attempt'; end if;
    select coalesce(array_agg(g ->> 'id'),'{}'::text[]) into v_scope
      from pg_catalog.jsonb_array_elements(v_content -> 'groups') g
      where g ->> 'id' = any(v_ids) and g ->> 'sectionId' = v_section_id;
    select coalesce(array_agg(q ->> 'id'),'{}'::text[]) into v_questions
      from pg_catalog.jsonb_array_elements(v_content -> 'groups') g
      cross join lateral pg_catalog.jsonb_array_elements(g -> 'questions') q where g ->> 'id' = any(v_scope);
    select g into v_current_group from pg_catalog.jsonb_array_elements(v_content -> 'groups') g where g ->> 'id' = v_old ->> 'currentGroupId';

    if p_operation = 'grade' then
      -- The application computes a rubric result; no grading command can alter an
      -- original answer, a previously scored objective result, or section timing.
      select coalesce(array_agg(q ->> 'id'),'{}'::text[]) into v_manual
        from pg_catalog.jsonb_array_elements(v_content -> 'groups') g
        cross join lateral pg_catalog.jsonb_array_elements(g -> 'questions') q
        where g ->> 'id' = any(v_ids) and q #>> '{scoring,kind}' = 'manual'
          and v_old #>> array['sections',g ->> 'sectionId','status'] = 'submitted';
      if p_state -> 'answers' <> v_old -> 'answers' or p_state -> 'sections' <> v_old -> 'sections'
        or (p_state -> 'results') - v_manual <> (v_old -> 'results') - v_manual
        or exists (select 1 from pg_catalog.jsonb_object_keys(v_old -> 'results') k where not (p_state -> 'results') ? k)
        then raise exception 'exam_invalid_transition'; end if;
      v_state := pg_catalog.jsonb_set(v_state,'{results}',p_state -> 'results');
    else
      if v_section_id is null then raise exception 'exam_invalid_transition'; end if;
      if v_section ->> 'status' = 'interrupted' and p_operation <> 'resume' then raise exception 'exam_interrupted'; end if;
      if v_section ->> 'status' <> 'active' and p_operation <> 'resume' then raise exception 'exam_invalid_transition'; end if;
      if p_operation in ('save','submit','expire') then
        if (p_state -> 'answers') - v_questions <> (v_old -> 'answers') - v_questions
          or exists (select 1 from pg_catalog.jsonb_object_keys(v_old -> 'answers') k where not (p_state -> 'answers') ? k)
          then raise exception 'exam_invalid_answer'; end if;
        if p_operation = 'expire' then
          if v_deadline is null or v_now < v_deadline or p_state -> 'answers' <> v_old -> 'answers'
            then raise exception 'exam_invalid_transition'; end if;
        else
          v_state := pg_catalog.jsonb_set(v_state,'{answers}',p_state -> 'answers');
          v_activity := v_old -> 'groupActiveMs';
          if v_old ->> 'lastActivityAt' is not null then
            v_elapsed := least(30000,greatest(0,pg_catalog.floor(extract(epoch from (v_now - (v_old ->> 'lastActivityAt')::timestamptz)) * 1000)))::bigint;
            v_activity := v_activity || pg_catalog.jsonb_build_object(v_old ->> 'currentGroupId',
              coalesce((v_activity ->> (v_old ->> 'currentGroupId'))::bigint,0) + v_elapsed);
          end if;
          v_state := pg_catalog.jsonb_set(v_state,'{groupActiveMs}',v_activity);
        end if;
        if v_section_id = 'listening' then
          v_state := pg_catalog.jsonb_set(v_state,'{playbackPositionMs}',p_state -> 'playbackPositionMs');
        elsif p_state -> 'playbackPositionMs' <> v_old -> 'playbackPositionMs' then raise exception 'exam_invalid_transition'; end if;
        if p_operation = 'save' then
          if not coalesce((p_state ->> 'currentGroupId') = any(v_scope),false)
            or p_state -> 'results' <> v_old -> 'results' then raise exception 'exam_invalid_transition'; end if;
          select g into v_next_group from pg_catalog.jsonb_array_elements(v_content -> 'groups') g where g ->> 'id' = p_state ->> 'currentGroupId';
          v_state := v_state || pg_catalog.jsonb_build_object('currentGroupId',p_state ->> 'currentGroupId','lastActivityAt',v_now);
          if v_next_group -> 'partNumber' <> v_current_group -> 'partNumber' then
            v_state := pg_catalog.jsonb_set(v_state,'{scriptGrant}','null'::jsonb);
          end if;
        else
          if (p_state -> 'results') - v_questions <> (v_old -> 'results') - v_questions
            or not (p_state -> 'results') ?& v_questions then raise exception 'exam_invalid_transition'; end if;
          v_state := pg_catalog.jsonb_set(v_state,'{results}',p_state -> 'results');
          v_section := v_section || pg_catalog.jsonb_build_object('status','submitted','submittedAt',v_now,'timedOut',p_operation = 'expire');
          v_state := pg_catalog.jsonb_set(v_state,array['sections',v_section_id],v_section)
            || pg_catalog.jsonb_build_object('currentSectionId',null,'currentGroupId',null,'lastActivityAt',null,'scriptGrant',null);
        end if;
      elsif p_operation = 'interrupt' then
        if v_old ->> 'mode' <> 'mock' or v_section_id <> 'listening' then raise exception 'exam_invalid_transition'; end if;
        v_section := v_section || pg_catalog.jsonb_build_object('status','interrupted','interruptedAt',v_now,'technicalInterruption',true);
        v_state := pg_catalog.jsonb_set(v_state,array['sections',v_section_id],v_section)
          || pg_catalog.jsonb_build_object('scriptGrant',null);
      elsif p_operation = 'resume' then
        if v_section ->> 'status' <> 'interrupted' or v_section ->> 'interruptedAt' is null
          or v_old ->> 'mode' <> 'mock' or v_section_id <> 'listening' then raise exception 'exam_invalid_transition'; end if;
        v_section := v_section || pg_catalog.jsonb_build_object('status','active','interruptedAt',null,
          'deadlineAt',case when v_deadline is not null then v_deadline + greatest(interval '0',v_now - (v_section ->> 'interruptedAt')::timestamptz) else null end);
        v_state := pg_catalog.jsonb_set(v_state,array['sections',v_section_id],v_section)
          || pg_catalog.jsonb_build_object('lastActivityAt',v_now,'scriptGrant',null);
      elsif p_operation = 'help' then
        if v_old ->> 'mode' <> 'practice' or not (p_state -> 'helpQuestionIds') @> (v_old -> 'helpQuestionIds')
          or pg_catalog.jsonb_array_length(p_state -> 'helpQuestionIds') > pg_catalog.jsonb_array_length(v_old -> 'helpQuestionIds') + 1
          or exists (select 1 from pg_catalog.jsonb_array_elements_text(p_state -> 'helpQuestionIds') h
            where not (v_old -> 'helpQuestionIds') ? h and not h = any(v_questions)) then raise exception 'exam_help_unavailable'; end if;
        v_state := pg_catalog.jsonb_set(v_state,'{helpQuestionIds}',p_state -> 'helpQuestionIds');
      elsif p_operation = 'script' then
        if v_section_id <> 'speaking' or p_state -> 'scriptGrant' = 'null'::jsonb
          or p_state #> '{scriptGrant,partNumber}' <> v_current_group -> 'partNumber' then raise exception 'exam_script_unavailable'; end if;
        v_state := pg_catalog.jsonb_set(v_state,'{scriptGrant}',(p_state -> 'scriptGrant')
          || pg_catalog.jsonb_build_object('expiresAt',v_now + interval '10 minutes'));
      else raise exception 'exam_invalid_transition'; end if;
    end if;
  end if;
  update public.exam_attempts set state = v_state,version = pg_catalog.gen_random_uuid(),updated_at = v_now where id = p_id;
  v_receipt := public.read_exam_attempt(p_user,p_id);
  insert into exams_private.exam_attempt_requests(request_id,user_id,actor_id,attempt_id,expected_version,operation,command_hash,request_hash,receipt)
    values (p_request_id,p_user,v_actor,p_id,p_expected_version,p_operation,p_command_hash,v_hash,v_receipt);
  return v_receipt;
exception when unique_violation then raise exception 'exam_conflict';
end $$;

revoke all on function exams_private.exam_attempt_state_valid(jsonb,jsonb),
  exams_private.guard_exam_attempt(),
  exams_private.record_exam_exposure(uuid,uuid,jsonb,text[]),
  exams_private.exam_media_slot_in_scope(jsonb,jsonb,jsonb,jsonb,text,timestamptz),
  public.create_exam_attempt(uuid,uuid,text,jsonb,text),
  public.read_exam_attempt(uuid,uuid),
  public.find_exam_attempt_request(uuid,uuid,text),
  public.commit_exam_attempt(uuid,uuid,uuid,uuid,text,jsonb,text[],text,uuid),
  public.authorize_exam_media(uuid,uuid,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function exams_private.exam_attempt_state_valid(jsonb,jsonb),
  exams_private.guard_exam_attempt(),
  exams_private.record_exam_exposure(uuid,uuid,jsonb,text[]),
  exams_private.exam_media_slot_in_scope(jsonb,jsonb,jsonb,jsonb,text,timestamptz),
  public.create_exam_attempt(uuid,uuid,text,jsonb,text),
  public.read_exam_attempt(uuid,uuid),
  public.find_exam_attempt_request(uuid,uuid,text),
  public.commit_exam_attempt(uuid,uuid,uuid,uuid,text,jsonb,text[],text,uuid),
  public.authorize_exam_media(uuid,uuid,text,text,text)
  to service_role;

comment on table public.exam_attempts is 'Owner-bound immutable-content attempts. Only server RPCs may implement transitions; withdrawal retains historical attempts.';
comment on table public.exam_material_exposures is 'Material family exposure committed before initial body disclosure. Same-attempt reopening never creates prior exposure.';
comment on table exams_private.exam_attempt_requests is 'Permanent command receipts. Hashes bind authenticated actor and original command, excluding derived clocks/state. Private envelopes never reach a browser.';
comment on function public.authorize_exam_media(uuid,uuid,text,text,text) is 'Owner and full-file scope authorization. Parent grants require the verified JWT session_id and current speaking Part within ten minutes.';

commit;
