begin;

-- Add optional annotations to the existing atomic answer-save transaction.
-- Preserve legacy states, immutable content, deadlines, scope locks and receipts.
-- Enumerate only authored sentence blocks in frozen, selected question groups.
create function exams_private.exam_annotation_blocks(p_content jsonb,p_groups text[])
returns table(key text,block jsonb) language sql immutable security invoker set search_path = '' as $$
  select (g ->> 'id') || '/' || (b ->> 'id'), b
  from pg_catalog.jsonb_array_elements(p_content -> 'groups') g
  cross join lateral (
    select value b from pg_catalog.jsonb_array_elements(g -> 'instructions')
    union all
    select b from pg_catalog.jsonb_array_elements(g -> 'questions') q
      cross join lateral pg_catalog.jsonb_array_elements(q -> 'prompt') b
    union all
    select b from pg_catalog.jsonb_array_elements(p_content -> 'materials') m
      cross join lateral pg_catalog.jsonb_array_elements(m -> 'blocks') b
      where (g -> 'materialIds') ? (m ->> 'id')
  ) blocks
  where (g ->> 'id') = any(p_groups) and b ? 'sentences';
$$;

create function public.exam_sentence_annotations_ready()
returns boolean language sql immutable security invoker set search_path = '' as $$ select true $$;
revoke all on function exams_private.exam_annotation_blocks(jsonb,text[]),public.exam_sentence_annotations_ready() from public,anon,authenticated;
grant execute on function exams_private.exam_annotation_blocks(jsonb,text[]),public.exam_sentence_annotations_ready() to service_role;

create or replace function exams_private.exam_attempt_state_valid(p_state jsonb, p_content jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_block jsonb; v_group jsonb; v_section record; v_entry record; v_question jsonb;
  v_ids text[]; v_section_ids text[]; v_question_ids text[]; v_active integer := 0;
begin
  if pg_catalog.jsonb_typeof(p_state) is distinct from 'object'
    or pg_catalog.octet_length(p_state::text) > 2097152
    or not p_state ?& array['schemaVersion','mode','groupIds','currentSectionId','currentGroupId',
      'sections','answers','results','helpQuestionIds','priorExposureFamilies','groupActiveMs',
      'lastActivityAt','playbackPositionMs','scriptGrant']
    or (p_state - array['schemaVersion','mode','groupIds','currentSectionId','currentGroupId',
      'sections','answers','results','helpQuestionIds','priorExposureFamilies','groupActiveMs',
      'lastActivityAt','playbackPositionMs','scriptGrant','annotations']) <> '{}'::jsonb
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
  if p_state ? 'annotations' then
    if pg_catalog.jsonb_typeof(p_state -> 'annotations') is distinct from 'object' then return false; end if;
    for v_entry in select * from pg_catalog.jsonb_each(p_state -> 'annotations') loop
      select b.block into v_block from exams_private.exam_annotation_blocks(p_content,v_ids) b where b.key=v_entry.key;
      if not found or pg_catalog.jsonb_typeof(v_entry.value) is distinct from 'array' then return false; end if;
      if (select count(*) <> count(distinct value) from pg_catalog.jsonb_array_elements(v_entry.value))
        or exists (select 1 from pg_catalog.jsonb_array_elements(v_entry.value) selected
          where pg_catalog.jsonb_typeof(selected) <> 'string' or not exists (
            select 1 from pg_catalog.jsonb_array_elements(v_block -> 'sentences') sentence
              where sentence -> 'id' = selected)) then return false; end if;
    end loop;
  end if;
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

create or replace function public.commit_exam_attempt(
  p_user uuid,p_id uuid,p_expected_version uuid,p_request_id uuid,p_operation text,
  p_state jsonb,p_exposure_group_ids text[],p_command_hash text,p_actor uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt public.exam_attempts%rowtype; v_request exams_private.exam_attempt_requests%rowtype;
  v_actor uuid := coalesce(p_actor,p_user); v_content jsonb; v_files jsonb; v_old jsonb; v_state jsonb;
  v_section_id text; v_section jsonb; v_ids text[]; v_scope text[]; v_annotation_keys text[]; v_questions text[]; v_manual text[];
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
        select coalesce(array_agg(b.key),'{}'::text[]) into v_annotation_keys
          from exams_private.exam_annotation_blocks(v_content,v_scope) b;
        if (coalesce(p_state -> 'annotations','{}'::jsonb) - v_annotation_keys)
          is distinct from (coalesce(v_old -> 'annotations','{}'::jsonb) - v_annotation_keys)
          then raise exception 'exam_invalid_answer'; end if;
        if p_operation = 'expire' and coalesce(p_state -> 'annotations','{}'::jsonb)
          is distinct from coalesce(v_old -> 'annotations','{}'::jsonb)
          then raise exception 'exam_invalid_transition'; end if;

        if (p_state -> 'answers') - v_questions <> (v_old -> 'answers') - v_questions
          or exists (select 1 from pg_catalog.jsonb_object_keys(v_old -> 'answers') k where not (p_state -> 'answers') ? k)
          then raise exception 'exam_invalid_answer'; end if;
        if p_operation = 'expire' then
          if v_deadline is null or v_now < v_deadline or p_state -> 'answers' <> v_old -> 'answers'
            then raise exception 'exam_invalid_transition'; end if;
        else
          v_state := pg_catalog.jsonb_set(v_state,'{answers}',p_state -> 'answers');
          if p_state ? 'annotations' then
            v_state := pg_catalog.jsonb_set(v_state,'{annotations}',p_state -> 'annotations');
          end if;

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

commit;
