begin;

-- Recording objects are never browser-addressable. Even an unrelated permissive
-- Storage policy cannot grant browser access to this bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('exam-recordings','exam-recordings',false,20971520,
  array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'])
on conflict (id) do nothing;
do $$ begin
  if exists (select 1 from storage.buckets where id = 'exam-recordings' and public) then
    raise exception 'exam_recording_bucket_must_be_private';
  end if;
end $$;
create policy "exam recordings remain server only" on storage.objects as restrictive
  for all to anon,authenticated using (bucket_id <> 'exam-recordings')
  with check (bucket_id <> 'exam-recordings');

create table public.exam_recordings (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  attempt_id uuid not null,
  question_id text not null,
  object_path text not null unique,
  mime_type text not null check (mime_type in ('audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav')),
  size_bytes integer not null check (size_bytes between 1 and 20971520),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'uploading' check (status in ('uploading','complete','abandoned')),
  request_id uuid not null unique,
  request_hash text not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  completed_at timestamptz,
  foreign key (attempt_id,user_id) references public.exam_attempts(id,user_id),
  check ((status = 'complete') = (completed_at is not null))
);
create index exam_recordings_attempt_question on public.exam_recordings(user_id,attempt_id,question_id,status);

create table exams_private.exam_recording_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id),
  recording_id uuid not null references public.exam_recordings(id),
  receipt jsonb not null
);

create table exams_private.exam_manual_reviews (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  attempt_id uuid not null,
  question_id text not null,
  rubric_id text not null,
  dimensions jsonb not null check (pg_catalog.jsonb_typeof(dimensions) = 'array'),
  comment text not null check (pg_catalog.length(comment) <= 4000),
  points numeric not null check (points >= 0),
  max_points numeric not null check (max_points > 0 and points <= max_points),
  actor_id uuid not null references auth.users(id),
  reviewed_at timestamptz not null default pg_catalog.clock_timestamp(),
  attempt_version uuid not null,
  request_id uuid not null unique references exams_private.exam_attempt_requests(request_id),
  foreign key (attempt_id,user_id) references public.exam_attempts(id,user_id)
);
create index exam_manual_reviews_history on exams_private.exam_manual_reviews(user_id,attempt_id,question_id,reviewed_at,id);
alter table public.exam_recordings enable row level security;
alter table exams_private.exam_manual_reviews enable row level security;
alter table exams_private.exam_recording_requests enable row level security;
revoke all on public.exam_recordings,exams_private.exam_manual_reviews,exams_private.exam_recording_requests from public,anon,authenticated,service_role;
grant select,insert,update on public.exam_recordings to service_role;
grant select,insert on exams_private.exam_manual_reviews,exams_private.exam_recording_requests to service_role;

create function exams_private.exam_recording_receipt(p_row public.exam_recordings)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object('id',(p_row).id,'attemptId',(p_row).attempt_id,
    'questionId',(p_row).question_id,'mimeType',(p_row).mime_type,'sizeBytes',(p_row).size_bytes,
    'status',(p_row).status,'createdAt',(p_row).created_at,'completedAt',(p_row).completed_at)
$$;

create function exams_private.guard_exam_recording()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.attempt_id is distinct from old.attempt_id or new.question_id is distinct from old.question_id
    or new.object_path is distinct from old.object_path or new.mime_type is distinct from old.mime_type
    or new.size_bytes is distinct from old.size_bytes or new.sha256 is distinct from old.sha256
    or new.request_id is distinct from old.request_id or new.request_hash is distinct from old.request_hash
    or new.created_at is distinct from old.created_at or old.status <> 'uploading'
    or new.status not in ('complete','abandoned') then raise exception 'exam_recording_closed'; end if;
  return new;
end $$;
create trigger exam_recording_immutable before update on public.exam_recordings
for each row execute function exams_private.guard_exam_recording();

create function public.prepare_exam_recording(p_user uuid,p_attempt_id uuid,p_expected_version uuid,
  p_request_id uuid,p_question_id text,p_mime_type text,p_size_bytes integer,p_sha256 text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_attempt public.exam_attempts%rowtype; v_row public.exam_recordings%rowtype;
  v_content jsonb; v_group jsonb; v_hash text; v_id uuid := pg_catalog.gen_random_uuid();
begin
  if p_user is null or p_attempt_id is null or p_expected_version is null or p_request_id is null
    or p_question_id is null or p_mime_type is null or p_mime_type not in ('audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav')
    or p_size_bytes is null or p_size_bytes not between 1 and 20971520
    or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'exam_invalid_request'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exam-attempt-owner:' || p_user::text,0));
  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_array(p_user,p_attempt_id,p_expected_version,p_question_id,p_mime_type,p_size_bytes,p_sha256)::text);
  select * into v_row from public.exam_recordings where request_id = p_request_id;
  if found then
    if v_row.user_id <> p_user or v_row.request_hash <> v_hash then raise exception 'exam_conflict'; end if;
    return exams_private.exam_recording_receipt(v_row);
  end if;
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and user_id = p_user for update;
  if not found then raise exception 'exam_not_found'; end if;
  if v_attempt.version <> p_expected_version then raise exception 'exam_conflict'; end if;
  select content into v_content from public.exam_content_revisions where id = v_attempt.content_revision_id;
  select g into v_group from pg_catalog.jsonb_array_elements(v_content -> 'groups') g
    where g ->> 'id' = v_attempt.state ->> 'currentGroupId' and v_attempt.state -> 'groupIds' ? (g ->> 'id')
    and exists (select 1 from pg_catalog.jsonb_array_elements(g -> 'questions') q
      where q ->> 'id' = p_question_id and q ->> 'answerType' = 'speaking' and q #>> '{scoring,kind}' <> 'example');
  if v_group is null or v_group ->> 'sectionId' <> 'speaking'
    or v_attempt.state #>> '{sections,speaking,status}' <> 'active' then raise exception 'exam_recording_closed'; end if;
  if v_attempt.state #>> '{sections,speaking,deadlineAt}' is not null
    and (v_attempt.state #>> '{sections,speaking,deadlineAt}')::timestamptz <= pg_catalog.clock_timestamp()
    then raise exception 'exam_expired'; end if;
  if (select count(*) from public.exam_recordings where attempt_id = p_attempt_id and question_id = p_question_id and status <> 'abandoned') >= 4
    or (select count(*) from public.exam_recordings where attempt_id = p_attempt_id) >= 40
    then raise exception 'exam_recording_limit'; end if;
  insert into public.exam_recordings(id,user_id,attempt_id,question_id,object_path,mime_type,size_bytes,sha256,request_id,request_hash)
    values (v_id,p_user,p_attempt_id,p_question_id,p_user::text || '/' || p_attempt_id::text || '/' || v_id::text,
      p_mime_type,p_size_bytes,p_sha256,p_request_id,v_hash) returning * into v_row;
  return exams_private.exam_recording_receipt(v_row);
exception when unique_violation then raise exception 'exam_conflict';
end $$;

create function public.finish_exam_recording(p_user uuid,p_attempt_id uuid,p_recording_id uuid,p_status text,p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_attempt public.exam_attempts%rowtype; v_row public.exam_recordings%rowtype;
  v_request exams_private.exam_recording_requests%rowtype;
begin
  if p_user is null or p_attempt_id is null or p_recording_id is null or p_status is null
    or p_status not in ('complete','abandoned') or (p_status = 'abandoned' and p_request_id is null)
    or (p_status = 'complete' and p_request_id is not null) then raise exception 'exam_invalid_request'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exam-attempt-owner:' || p_user::text,0));
  if p_request_id is not null then
    select * into v_request from exams_private.exam_recording_requests where request_id = p_request_id;
    if found then
      if v_request.user_id <> p_user or v_request.recording_id <> p_recording_id
        or v_request.receipt ->> 'attemptId' <> p_attempt_id::text then raise exception 'exam_conflict'; end if;
      return v_request.receipt;
    end if;
  end if;
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and user_id = p_user for update;
  if not found then raise exception 'exam_not_found'; end if;
  select * into v_row from public.exam_recordings where id = p_recording_id and user_id = p_user and attempt_id = p_attempt_id for update;
  if not found then raise exception 'exam_not_found'; end if;
  if v_row.status = p_status then
    if p_request_id is not null then insert into exams_private.exam_recording_requests values
      (p_request_id,p_user,p_recording_id,exams_private.exam_recording_receipt(v_row)); end if;
    return exams_private.exam_recording_receipt(v_row);
  end if;
  if v_row.status <> 'uploading' then raise exception 'exam_recording_closed'; end if;
  if p_status = 'complete' then
    if v_attempt.state #>> '{sections,speaking,status}' <> 'active'
      or (v_attempt.state #>> '{sections,speaking,deadlineAt}' is not null
        and (v_attempt.state #>> '{sections,speaking,deadlineAt}')::timestamptz <= pg_catalog.clock_timestamp())
      then raise exception 'exam_recording_closed'; end if;
    -- Only the server uploads; existence is checked inside the same finalization
    -- transaction. HTTP has already verified exact byte count and SHA-256.
    if not exists (select 1 from storage.objects where bucket_id = 'exam-recordings' and name = v_row.object_path
      and (metadata ->> 'size')::bigint = v_row.size_bytes) then raise exception 'exam_recording_incomplete'; end if;
  end if;
  update public.exam_recordings set status = p_status,
    completed_at = case when p_status = 'complete' then pg_catalog.clock_timestamp() else null end
    where id = p_recording_id returning * into v_row;
  if p_request_id is not null then insert into exams_private.exam_recording_requests values
    (p_request_id,p_user,p_recording_id,exams_private.exam_recording_receipt(v_row)); end if;
  return exams_private.exam_recording_receipt(v_row);
exception when unique_violation then raise exception 'exam_conflict';
end $$;

create function exams_private.guard_exam_recording_submission()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_content jsonb; v_group jsonb; v_question jsonb; v_answer jsonb; v_id text;
begin
  select content into v_content from public.exam_content_revisions where id = new.content_revision_id;
  for v_group in select g from pg_catalog.jsonb_array_elements(v_content -> 'groups') g
    where new.state -> 'groupIds' ? (g ->> 'id')
      and new.state #>> array['sections',g ->> 'sectionId','status'] = 'submitted'
      and old.state #>> array['sections',g ->> 'sectionId','status'] <> 'submitted'
      -- Automatic expiry locks the existing answer even if a network upload never
      -- finished. Such objects never become complete/playable after submission.
      and new.state #>> array['sections',g ->> 'sectionId','timedOut'] <> 'true'
  loop
    for v_question in select q from pg_catalog.jsonb_array_elements(v_group -> 'questions') q
      where q ->> 'answerType' = 'speaking' and q #>> '{scoring,kind}' <> 'example'
    loop
      v_answer := new.state #> array['answers',v_question ->> 'id'];
      if v_answer ->> 'abandoned' = 'true' then continue; end if;
      if exists (select 1 from public.exam_recordings where attempt_id = new.id and question_id = v_question ->> 'id' and status = 'uploading')
        then raise exception 'exam_recording_incomplete'; end if;
      for v_id in select value from pg_catalog.jsonb_array_elements_text(coalesce(v_answer -> 'recordingIds','[]'::jsonb)) loop
        if not exists (select 1 from public.exam_recordings where id::text = v_id and user_id = new.user_id
          and attempt_id = new.id and question_id = v_question ->> 'id' and status = 'complete') then raise exception 'exam_recording_incomplete'; end if;
      end loop;
    end loop;
  end loop;
  return new;
end $$;
create trigger exam_recording_submission before update on public.exam_attempts
for each row execute function exams_private.guard_exam_recording_submission();

create function public.read_exam_manual_reviews(p_user uuid,p_attempt_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_attempt public.exam_attempts%rowtype; v_content jsonb; v_result jsonb;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id and user_id = p_user;
  if not found then raise exception 'exam_not_found'; end if;
  select content into v_content from public.exam_content_revisions where id = v_attempt.content_revision_id;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',r.id,'attemptId',r.attempt_id,
    'questionId',r.question_id,'rubricId',r.rubric_id,'dimensions',r.dimensions,'comment',r.comment,
    'points',r.points,'maxPoints',r.max_points,'actorId',r.actor_id,'reviewedAt',r.reviewed_at,
    'attemptVersion',r.attempt_version) order by r.reviewed_at,r.id),'[]'::jsonb) into v_result
    from exams_private.exam_manual_reviews r where r.user_id = p_user and r.attempt_id = p_attempt_id
      and exists (select 1 from pg_catalog.jsonb_array_elements(v_content -> 'groups') g
        cross join lateral pg_catalog.jsonb_array_elements(g -> 'questions') q
        where q ->> 'id' = r.question_id and v_attempt.state -> 'groupIds' ? (g ->> 'id')
          and v_attempt.state #>> array['sections',g ->> 'sectionId','status'] = 'submitted');
  return v_result;
end $$;

create function public.grade_exam_attempt(p_user uuid,p_actor uuid,p_id uuid,p_expected_version uuid,
  p_request_id uuid,p_command_hash text,p_question_id text,p_rubric_id text,p_dimensions jsonb,
  p_comment text,p_points numeric,p_max_points numeric)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_attempt public.exam_attempts%rowtype; v_request exams_private.exam_attempt_requests%rowtype;
  v_content jsonb; v_question jsonb; v_state jsonb; v_receipt jsonb; v_reviews jsonb;
begin
  if p_user is null or p_actor is null or p_id is null or p_expected_version is null or p_request_id is null
    or p_command_hash is null or p_command_hash !~ '^[0-9a-f]{64}$' or p_question_id is null or p_rubric_id is null
    or p_dimensions is null or pg_catalog.jsonb_typeof(p_dimensions) <> 'array'
    or pg_catalog.jsonb_array_length(p_dimensions) not between 1 and 20 or p_comment is null or pg_catalog.length(p_comment) > 4000
    or p_points is null or p_max_points is null or p_points < 0 or p_max_points <= 0 or p_points > p_max_points
    then raise exception 'exam_invalid_grade'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exam-attempt-owner:' || p_user::text,0));
  select * into v_request from exams_private.exam_attempt_requests where request_id = p_request_id;
  if found then
    if v_request.user_id <> p_user or v_request.actor_id <> p_actor or v_request.attempt_id <> p_id
      or v_request.expected_version <> p_expected_version or v_request.operation <> 'grade'
      or v_request.command_hash <> p_command_hash then raise exception 'exam_conflict'; end if;
    if not exists (select 1 from exams_private.exam_manual_reviews where request_id = p_request_id)
      then raise exception 'exam_conflict'; end if;
    return v_request.receipt;
  end if;
  select * into v_attempt from public.exam_attempts where id = p_id and user_id = p_user for update;
  if not found then raise exception 'exam_not_found'; end if;
  if v_attempt.version <> p_expected_version then raise exception 'exam_conflict'; end if;
  select content into v_content from public.exam_content_revisions where id = v_attempt.content_revision_id;
  select q into v_question from pg_catalog.jsonb_array_elements(v_content -> 'groups') g
    cross join lateral pg_catalog.jsonb_array_elements(g -> 'questions') q where q ->> 'id' = p_question_id
      and v_attempt.state -> 'groupIds' ? (g ->> 'id')
      and v_attempt.state #>> array['sections',g ->> 'sectionId','status'] = 'submitted';
  if v_question is null or v_question #>> '{scoring,kind}' <> 'manual'
    or v_question #>> '{scoring,rubricId}' <> p_rubric_id then raise exception 'exam_invalid_grade'; end if;
  -- Full rubric/ranges are checked by the server template; SQL additionally keeps
  -- dimensions and the submitted aggregate consistent and finite.
  if exists (select 1 from pg_catalog.jsonb_array_elements(p_dimensions) d
    where pg_catalog.jsonb_typeof(d) <> 'object' or not d ?& array['dimensionId','score','comment']
      or (d - array['dimensionId','score','comment']) <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(d -> 'dimensionId') <> 'string' or pg_catalog.btrim(d ->> 'dimensionId') = ''
      or pg_catalog.jsonb_typeof(d -> 'score') <> 'number' or (d ->> 'score')::numeric < 0
      or pg_catalog.jsonb_typeof(d -> 'comment') <> 'string' or pg_catalog.length(d ->> 'comment') > 2000)
    or (select count(distinct d ->> 'dimensionId') from pg_catalog.jsonb_array_elements(p_dimensions) d) <> pg_catalog.jsonb_array_length(p_dimensions)
    or (select sum((d ->> 'score')::numeric) from pg_catalog.jsonb_array_elements(p_dimensions) d) <> p_points
    then raise exception 'exam_invalid_grade'; end if;
  v_state := pg_catalog.jsonb_set(v_attempt.state,array['results',p_question_id],pg_catalog.jsonb_build_object(
    'questionId',p_question_id,'outcome','graded','points',p_points,'maxPoints',p_max_points));
  v_receipt := public.commit_exam_attempt(p_user,p_id,p_expected_version,p_request_id,'grade',v_state,'{}'::text[],p_command_hash,p_actor);
  insert into exams_private.exam_manual_reviews(user_id,attempt_id,question_id,rubric_id,dimensions,comment,
    points,max_points,actor_id,attempt_version,request_id)
    values (p_user,p_id,p_question_id,p_rubric_id,p_dimensions,p_comment,p_points,p_max_points,p_actor,
      (v_receipt #>> '{attempt,version}')::uuid,p_request_id);
  return v_receipt;
end $$;

create function public.revoke_exam_parent_session(p_user uuid,p_session_id text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if p_user is null or p_session_id is null
    or p_session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then raise exception 'exam_invalid_request'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exam-attempt-owner:' || p_user::text,0));
  for v_id in select id from public.exam_attempts where user_id = p_user
    and state #>> '{scriptGrant,sessionId}' = p_session_id order by id for update
  loop
    update public.exam_attempts set state = pg_catalog.jsonb_set(state,'{scriptGrant}','null'::jsonb),
      version = pg_catalog.gen_random_uuid(),updated_at = pg_catalog.clock_timestamp() where id = v_id;
  end loop;
end $$;

revoke all on function exams_private.exam_recording_receipt(public.exam_recordings),exams_private.guard_exam_recording(),
  exams_private.guard_exam_recording_submission(),
  public.prepare_exam_recording(uuid,uuid,uuid,uuid,text,text,integer,text),
  public.finish_exam_recording(uuid,uuid,uuid,text,uuid),public.read_exam_manual_reviews(uuid,uuid),
  public.grade_exam_attempt(uuid,uuid,uuid,uuid,uuid,text,text,text,jsonb,text,numeric,numeric),
  public.revoke_exam_parent_session(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function exams_private.exam_recording_receipt(public.exam_recordings),exams_private.guard_exam_recording(),
  exams_private.guard_exam_recording_submission(),
  public.prepare_exam_recording(uuid,uuid,uuid,uuid,text,text,integer,text),
  public.finish_exam_recording(uuid,uuid,uuid,text,uuid),public.read_exam_manual_reviews(uuid,uuid),
  public.grade_exam_attempt(uuid,uuid,uuid,uuid,uuid,text,text,text,jsonb,text,numeric,numeric),
  public.revoke_exam_parent_session(uuid,text)
  to service_role;

comment on table public.exam_recordings is 'Private immutable recording bytes. Owner HTTP upload validates SHA-256 and exact length; attempt lock serializes finalization/submission.';
comment on table exams_private.exam_manual_reviews is 'Append-only human rubric assessments. Latest reviewed_at/id per question is effective; original answers and objective scores are unchanged.';
commit;
