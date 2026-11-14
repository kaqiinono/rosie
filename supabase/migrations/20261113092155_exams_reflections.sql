begin;

-- Learner-authored, optional reflections are separate from answers and scores.
-- Clearing preserves a versioned row; it never deletes the command history.
create table public.exam_question_reflections (
  attempt_id uuid not null,
  user_id uuid not null,
  question_id text not null check (pg_catalog.length(question_id) between 1 and 256),
  reason text check (reason in ('unknown_word','unclear_audio','spelling','misunderstood_question','unsure')),
  version uuid not null default pg_catalog.gen_random_uuid(),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (attempt_id,question_id),
  foreign key (attempt_id,user_id) references public.exam_attempts(id,user_id)
);
create index exam_question_reflections_owner on public.exam_question_reflections(user_id,attempt_id);

create table exams_private.exam_reflection_requests (
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  attempt_id uuid not null,
  question_id text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  receipt jsonb not null check (pg_catalog.jsonb_typeof(receipt) = 'object'),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (user_id,request_id),
  foreign key (attempt_id,user_id) references public.exam_attempts(id,user_id),
  foreign key (attempt_id,question_id) references public.exam_question_reflections(attempt_id,question_id)
);

alter table public.exam_question_reflections enable row level security;
alter table exams_private.exam_reflection_requests enable row level security;
revoke all on public.exam_question_reflections,exams_private.exam_reflection_requests from public,anon,authenticated,service_role;
grant select,insert,update on public.exam_question_reflections to service_role;
grant select,insert on exams_private.exam_reflection_requests to service_role;

create function public.read_exam_reflections(p_user uuid,p_attempt_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_attempt public.exam_attempts%rowtype; v_content jsonb; v_items jsonb;
begin
  if p_user is null or p_attempt_id is null then raise exception 'exam_invalid_request'; end if;
  select * into v_attempt from public.exam_attempts where id=p_attempt_id and user_id=p_user;
  if not found then raise exception 'exam_not_found'; end if;
  select content into v_content from public.exam_content_revisions where id=v_attempt.content_revision_id;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('questionId',r.question_id,'reason',r.reason,'version',r.version) order by r.question_id),'[]'::jsonb)
    into v_items from public.exam_question_reflections r where r.user_id=p_user and r.attempt_id=p_attempt_id
      and exists (select 1 from pg_catalog.jsonb_array_elements(v_content -> 'groups') g,
        lateral pg_catalog.jsonb_array_elements(g -> 'questions') q
        where (v_attempt.state -> 'groupIds') ? (g ->> 'id')
          and v_attempt.state #>> array['sections',g ->> 'sectionId','status']='submitted'
          and q ->> 'id'=r.question_id and q #>> '{scoring,kind}' <> 'example');
  return pg_catalog.jsonb_build_object('items',v_items);
end $$;

create function public.save_exam_reflection(
  p_user uuid,p_attempt_id uuid,p_request_id uuid,p_question_id text,p_expected_version uuid,p_reason text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_attempt public.exam_attempts%rowtype; v_content jsonb;
  v_row public.exam_question_reflections%rowtype; v_request exams_private.exam_reflection_requests%rowtype;
  v_hash text; v_now timestamptz; v_receipt jsonb;
begin
  if p_user is null or p_attempt_id is null or p_request_id is null or p_question_id is null
    or pg_catalog.length(p_question_id) not between 1 and 256
    or (p_reason is not null and p_reason not in ('unknown_word','unclear_audio','spelling','misunderstood_question','unsure'))
    then raise exception 'exam_invalid_request'; end if;
  -- Share the attempt/exposure lock ordering; reflections never update attempts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exam-attempt-owner:' || p_user::text,0));
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'owner',p_user,'attemptId',p_attempt_id,'questionId',p_question_id,
    'expectedVersion',p_expected_version,'reason',p_reason)::text,'UTF8')),'hex');
  select * into v_request from exams_private.exam_reflection_requests where user_id=p_user and request_id=p_request_id;
  if found then
    if v_request.request_hash <> v_hash then raise exception 'exam_conflict'; end if;
    -- An old retry acknowledges its original command without overwriting a later
    -- choice. Return current state; the immutable original receipt stays audited.
    select * into v_row from public.exam_question_reflections
      where user_id=p_user and attempt_id=p_attempt_id and question_id=p_question_id;
    if not found then raise exception 'exam_not_found'; end if;
    return pg_catalog.jsonb_build_object('questionId',v_row.question_id,'reason',v_row.reason,'version',v_row.version);
  end if;
  select * into v_attempt from public.exam_attempts where id=p_attempt_id and user_id=p_user for share;
  if not found then raise exception 'exam_not_found'; end if;
  select content into v_content from public.exam_content_revisions where id=v_attempt.content_revision_id;
  if not exists (select 1 from pg_catalog.jsonb_array_elements(v_content -> 'groups') g,
    lateral pg_catalog.jsonb_array_elements(g -> 'questions') q
    where (v_attempt.state -> 'groupIds') ? (g ->> 'id')
      and v_attempt.state #>> array['sections',g ->> 'sectionId','status']='submitted'
      and q ->> 'id'=p_question_id and q #>> '{scoring,kind}' <> 'example')
    then raise exception 'exam_reflection_unavailable'; end if;
  select * into v_row from public.exam_question_reflections
    where attempt_id=p_attempt_id and question_id=p_question_id and user_id=p_user for update;
  if (found and v_row.version is distinct from p_expected_version) or (not found and p_expected_version is not null)
    then raise exception 'exam_conflict'; end if;
  v_now := pg_catalog.clock_timestamp();
  if found then
    update public.exam_question_reflections set reason=p_reason,version=pg_catalog.gen_random_uuid(),updated_at=v_now
      where attempt_id=p_attempt_id and question_id=p_question_id and user_id=p_user returning * into v_row;
  else
    insert into public.exam_question_reflections(attempt_id,user_id,question_id,reason,created_at,updated_at)
      values(p_attempt_id,p_user,p_question_id,p_reason,v_now,v_now) returning * into v_row;
  end if;
  v_receipt := pg_catalog.jsonb_build_object('questionId',v_row.question_id,'reason',v_row.reason,'version',v_row.version);
  insert into exams_private.exam_reflection_requests(user_id,request_id,attempt_id,question_id,request_hash,receipt,created_at)
    values(p_user,p_request_id,p_attempt_id,p_question_id,v_hash,v_receipt,v_now);
  return v_receipt;
exception when unique_violation then raise exception 'exam_conflict';
end $$;

revoke all on function public.read_exam_reflections(uuid,uuid),public.save_exam_reflection(uuid,uuid,uuid,text,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.read_exam_reflections(uuid,uuid),public.save_exam_reflection(uuid,uuid,uuid,text,uuid,text) to service_role;
comment on table public.exam_question_reflections is 'Optional learner-selected causes; never inferred from classification or used to mutate answers, scores, or insight thresholds.';
comment on table exams_private.exam_reflection_requests is 'Permanent owner-scoped idempotency receipts; stale replay cannot overwrite a newer reflection.';

commit;
