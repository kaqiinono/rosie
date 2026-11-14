begin;

-- Pen strokes remain inside owner-bound attempt answers. No public image URLs or OCR.
create function exams_private.exam_ink_valid(p_ink jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare stroke jsonb; point jsonb; points_count integer := 0;
begin
  if pg_catalog.jsonb_typeof(p_ink) is distinct from 'object'
    or not p_ink ? 'strokes' or (p_ink - 'strokes') <> '{}'::jsonb
    or pg_catalog.jsonb_typeof(p_ink -> 'strokes') is distinct from 'array' then return false; end if;
  if pg_catalog.jsonb_array_length(p_ink -> 'strokes') not between 1 and 250 then return false; end if;
  for stroke in select value from pg_catalog.jsonb_array_elements(p_ink -> 'strokes') loop
    if pg_catalog.jsonb_typeof(stroke) is distinct from 'array' then return false; end if;
    if pg_catalog.jsonb_array_length(stroke) = 0 then return false; end if;
    points_count := points_count + pg_catalog.jsonb_array_length(stroke);
    if points_count > 10000 then return false; end if;
    for point in select value from pg_catalog.jsonb_array_elements(stroke) loop
      if pg_catalog.jsonb_typeof(point) is distinct from 'object'
        or not point ?& array['x','y'] or (point - array['x','y']) <> '{}'::jsonb
        or pg_catalog.jsonb_typeof(point -> 'x') is distinct from 'number'
        or pg_catalog.jsonb_typeof(point -> 'y') is distinct from 'number' then return false; end if;
      if (point ->> 'x')::numeric not between 0 and 600 or (point ->> 'y')::numeric not between 0 and 440 then return false; end if;
    end loop;
  end loop;
  return true;
end $$;

create function exams_private.guard_exam_handwriting()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare content jsonb; entry record; gap record; question jsonb; section_id text;
begin
  select r.content into content from public.exam_content_revisions r where r.id = new.content_revision_id;
  for entry in select * from pg_catalog.jsonb_each(new.state -> 'answers') where value ? 'ink' loop
    select q,g ->> 'sectionId' into question,section_id from pg_catalog.jsonb_array_elements(content -> 'groups') g
      cross join lateral pg_catalog.jsonb_array_elements(g -> 'questions') q
      where q ->> 'id' = entry.key and new.state -> 'groupIds' ? (g ->> 'id');
    if question is null or question ->> 'answerType' <> 'gap_fill'
      or question ->> 'optionPoolId' is not null or entry.value ->> 'type' <> 'gap_fill'
      or (entry.value - array['type','values','ink']) <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(entry.value -> 'values') is distinct from 'object'
      or pg_catalog.jsonb_typeof(entry.value -> 'ink') is distinct from 'object' then raise exception 'exam_invalid_answer'; end if;
    for gap in select * from pg_catalog.jsonb_each(entry.value -> 'ink') loop
      if not exists (select 1 from pg_catalog.jsonb_array_elements(question -> 'gaps') g where g ->> 'id' = gap.key)
        or not exams_private.exam_ink_valid(gap.value)
        or pg_catalog.btrim(coalesce(entry.value #>> array['values',gap.key],'')) <> '' then raise exception 'exam_invalid_answer'; end if;
    end loop;
    -- A first submission with original pen strokes must await human judgement.
    if question #>> '{scoring,kind}' = 'objective' and entry.value -> 'ink' <> '{}'::jsonb
      and new.state #>> array['sections',section_id,'status'] = 'submitted' then
      if tg_op = 'INSERT' or old.state #>> array['sections',section_id,'status'] is distinct from 'submitted' then
        if new.state #>> array['results',entry.key,'outcome'] is distinct from 'pending'
          or new.state #> array['results',entry.key,'points'] is distinct from 'null'::jsonb
          or new.state #> array['results',entry.key,'maxPoints'] is distinct from 'null'::jsonb then raise exception 'exam_invalid_grade'; end if;
      end if;
    end if;
  end loop;
  return new;
end $$;
create trigger exam_handwriting_guard before insert or update on public.exam_attempts
  for each row execute function exams_private.guard_exam_handwriting();

create table exams_private.exam_handwriting_reviews (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id text not null,
  decision text not null check (decision in ('correct','incorrect','unclear')),
  comment text not null check (pg_catalog.length(comment) <= 4000),
  points numeric, max_points numeric,
  actor_id uuid not null references auth.users(id),
  reviewed_at timestamptz not null default pg_catalog.clock_timestamp(),
  attempt_version uuid not null,
  request_id uuid not null unique,
  check ((decision = 'unclear' and points is null and max_points is null)
    or (decision <> 'unclear' and points is not null and max_points is not null and max_points > 0
      and points = case when decision = 'correct' then max_points else 0 end))
);
create index exam_handwriting_review_history on exams_private.exam_handwriting_reviews(user_id,attempt_id,reviewed_at,id);
alter table exams_private.exam_handwriting_reviews enable row level security;
revoke all on exams_private.exam_handwriting_reviews from public,anon,authenticated,service_role;
grant select,insert on exams_private.exam_handwriting_reviews to service_role;

create function public.read_exam_handwriting_reviews(p_user uuid,p_attempt_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.exam_attempts where id=p_attempt_id and user_id=p_user) then raise exception 'exam_not_found'; end if;
  return (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',r.id,'attemptId',r.attempt_id,
    'questionId',r.question_id,'decision',r.decision,'comment',r.comment,'points',r.points,'maxPoints',r.max_points,
    'actorId',r.actor_id,'reviewedAt',r.reviewed_at,'attemptVersion',r.attempt_version) order by r.reviewed_at,r.id),'[]'::jsonb)
    from exams_private.exam_handwriting_reviews r where r.user_id=p_user and r.attempt_id=p_attempt_id);
end $$;

-- Separate from rubric grading: only submitted, genuinely handwritten open gaps qualify.
-- No caller-supplied score, answer replacement, deadline changes or OCR transcription.
create function public.grade_exam_handwriting(p_user uuid,p_actor uuid,p_id uuid,p_expected_version uuid,
  p_request_id uuid,p_command_hash text,p_question_id text,p_decision text,p_comment text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare attempt public.exam_attempts%rowtype; prior exams_private.exam_attempt_requests%rowtype;
  content jsonb; question jsonb; answer jsonb; points numeric; maximum numeric;
  next_version uuid; receipt jsonb; request_hash text;
begin
  if p_user is null or p_actor is null or p_id is null or p_expected_version is null or p_request_id is null
    or p_question_id is null or p_decision is null or p_decision not in ('correct','incorrect','unclear')
    or p_comment is null or pg_catalog.length(p_comment)>4000 or p_command_hash is null or p_command_hash !~ '^[0-9a-f]{64}$'
    then raise exception 'exam_invalid_grade'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exam-attempt-owner:' || p_user::text,0));
  select * into prior from exams_private.exam_attempt_requests where request_id=p_request_id;
  if found then
    if prior.user_id<>p_user or prior.actor_id<>p_actor or prior.attempt_id<>p_id or prior.expected_version<>p_expected_version
      or prior.operation<>'grade' or prior.command_hash<>p_command_hash
      or not exists(select 1 from exams_private.exam_handwriting_reviews where request_id=p_request_id) then raise exception 'exam_conflict'; end if;
    return prior.receipt;
  end if;
  select * into attempt from public.exam_attempts where id=p_id and user_id=p_user for update;
  if not found then raise exception 'exam_not_found'; end if;
  if attempt.version<>p_expected_version then raise exception 'exam_conflict'; end if;
  select r.content into content from public.exam_content_revisions r where r.id=attempt.content_revision_id;
  select q into question from pg_catalog.jsonb_array_elements(content -> 'groups') g
    cross join lateral pg_catalog.jsonb_array_elements(g -> 'questions') q where q ->> 'id'=p_question_id
      and attempt.state -> 'groupIds' ? (g ->> 'id') and attempt.state #>> array['sections',g ->> 'sectionId','status']='submitted';
  answer := attempt.state #> array['answers',p_question_id];
  if question is null or question ->> 'answerType'<>'gap_fill' or question ->> 'optionPoolId' is not null
    or question #>> '{scoring,kind}'<>'objective' or answer ->> 'type' is distinct from 'gap_fill'
    or pg_catalog.jsonb_typeof(answer -> 'ink') is distinct from 'object' then raise exception 'exam_invalid_grade'; end if;
  if answer -> 'ink'='{}'::jsonb then raise exception 'exam_invalid_grade'; end if;
  maximum := case when p_decision='unclear' then null else (question #>> '{scoring,maxPoints}')::numeric end;
  points := case when p_decision='unclear' then null when p_decision='correct' then maximum else 0 end;
  next_version := pg_catalog.gen_random_uuid();
  update public.exam_attempts set state=pg_catalog.jsonb_set(state,array['results',p_question_id],pg_catalog.jsonb_build_object(
    'questionId',p_question_id,'outcome',case when p_decision='unclear' then 'pending' else p_decision end,
    'points',points,'maxPoints',maximum)),version=next_version,updated_at=pg_catalog.clock_timestamp() where id=p_id and user_id=p_user;
  insert into exams_private.exam_handwriting_reviews(user_id,attempt_id,question_id,decision,comment,points,max_points,actor_id,attempt_version,request_id)
    values(p_user,p_id,p_question_id,p_decision,p_comment,points,maximum,p_actor,next_version,p_request_id);
  receipt := public.read_exam_attempt(p_user,p_id);
  request_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'user',p_user,'actor',p_actor,'attempt',p_id,'expectedVersion',p_expected_version,'operation','grade','commandHash',p_command_hash)::text,'UTF8')),'hex');
  insert into exams_private.exam_attempt_requests(request_id,user_id,actor_id,attempt_id,expected_version,operation,command_hash,request_hash,receipt)
    values(p_request_id,p_user,p_actor,p_id,p_expected_version,'grade',p_command_hash,request_hash,receipt);
  return receipt;
end $$;

create function public.exam_handwriting_ready()
returns boolean language sql immutable security invoker set search_path = '' as $$ select true $$;
revoke all on function exams_private.exam_ink_valid(jsonb),exams_private.guard_exam_handwriting(),
  public.exam_handwriting_ready(),public.read_exam_handwriting_reviews(uuid,uuid),
  public.grade_exam_handwriting(uuid,uuid,uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function exams_private.exam_ink_valid(jsonb),exams_private.guard_exam_handwriting(),
  public.exam_handwriting_ready(),public.read_exam_handwriting_reviews(uuid,uuid),
  public.grade_exam_handwriting(uuid,uuid,uuid,uuid,uuid,text,text,text,text) to service_role;

commit;
