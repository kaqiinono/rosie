create table private.offline_learning_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  payload_hash bytea not null,
  primary key (user_id, operation_id)
);

revoke all on private.offline_learning_receipts from public, anon, authenticated;
alter table private.offline_learning_receipts enable row level security;

create function public.settle_offline_math_practice(
  p_operation uuid, p_problem text, p_lesson text, p_section text, p_answer text,
  p_correct boolean, p_plan text, p_day date, p_assignment text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  payload bytea := sha256(convert_to(jsonb_build_array(
    'math', p_problem, p_lesson, p_section, p_answer, p_correct, p_plan, p_day, p_assignment
  )::text, 'UTF8'));
  plan_data jsonb;
  progress jsonb;
  day_rows jsonb;
  done_keys jsonb;
begin
  if owner_id is null or p_operation is null or p_correct is null
    or p_day is null or p_day > (now() at time zone 'Asia/Shanghai')::date
    or p_assignment is null or p_answer is null or length(p_answer) not between 1 and 4000 then
    raise exception 'invalid offline math practice' using errcode = '22023';
  end if;
  insert into private.offline_learning_receipts values (owner_id, p_operation, payload)
    on conflict do nothing;
  if not found then
    if not exists (
      select 1 from private.offline_learning_receipts
      where user_id = owner_id and operation_id = p_operation and payload_hash = payload
    ) then raise exception 'offline operation mismatch' using errcode = '22023'; end if;
    return;
  end if;
  select p.plan_data, coalesce(p.progress_data, '{}'::jsonb) into plan_data, progress
    from public.math_weekly_plans p where p.user_id = owner_id and p.week_start::text = p_plan for update;
  select d->'problems' into day_rows from jsonb_array_elements(plan_data) as d where d->>'date' = p_day::text;
  if not exists (
    select 1 from jsonb_array_elements(day_rows) as q
    where q->>'problemId' = p_problem and q->>'section' = p_section
      and coalesce(q->>'assignmentId', p_day::text || '::' || (q->>'key')) = p_assignment
  ) then raise exception 'offline math assignment changed' using errcode = 'PT409'; end if;

  perform public.submit_math_practice_attempt(
    owner_id, p_problem, p_lesson, p_section, case when p_correct then 'correct' else 'wrong' end,
    '[]'::jsonb, to_jsonb(p_answer), null, null
  );
  if p_correct then
    done_keys := coalesce(progress #> array[p_day::text, 'doneKeys'], '[]'::jsonb);
    if not done_keys ? p_assignment then
      done_keys := done_keys || to_jsonb(p_assignment);
    end if;
    progress := jsonb_set(progress, array[p_day::text],
      coalesce(progress -> (p_day::text), '{}'::jsonb) || jsonb_build_object('doneKeys', done_keys));
    if not exists (
      select 1 from jsonb_array_elements(day_rows) as q
      where not (done_keys ? coalesce(q->>'assignmentId', p_day::text || '::' || (q->>'key')))
        and not (q->>'assignmentId' is null and done_keys ? (q->>'key'))
    ) and progress #>> array[p_day::text, 'completedAt'] is null then
      progress := jsonb_set(progress, array[p_day::text, 'completedAt'], to_jsonb(now()));
    end if;
    update public.math_weekly_plans set progress_data = progress, updated_at = now()
      where user_id = owner_id and week_start::text = p_plan;
  end if;
end;
$$;

create function public.settle_offline_english_weekly(
  p_operation uuid, p_plan uuid, p_day date, p_score integer, p_attempts jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  payload bytea := sha256(convert_to(jsonb_build_array('english', p_plan, p_day, p_score, p_attempts)::text, 'UTF8'));
  plan_data jsonb;
  progress jsonb;
  plan_days jsonb;
  attempt jsonb;
begin
  if owner_id is null or p_operation is null or p_plan is null or p_day is null
    or p_day > (now() at time zone 'Asia/Shanghai')::date
    or p_score is null or p_score not between 0 and 100 or jsonb_typeof(p_attempts) is distinct from 'array'
    or jsonb_array_length(p_attempts) > 500 then
    raise exception 'invalid offline english practice' using errcode = '22023';
  end if;
  insert into private.offline_learning_receipts values (owner_id, p_operation, payload)
    on conflict do nothing;
  if not found then
    if not exists (
      select 1 from private.offline_learning_receipts
      where user_id = owner_id and operation_id = p_operation and payload_hash = payload
    ) then raise exception 'offline operation mismatch' using errcode = '22023'; end if;
    return;
  end if;
  select p.plan_data, coalesce(p.progress_data, '{}'::jsonb) into plan_data, progress
    from public.weekly_plans p where p.user_id = owner_id and p.id = p_plan for update;
  plan_days := case when jsonb_typeof(plan_data) = 'array' then plan_data else plan_data->'days' end;
  if not exists (select 1 from jsonb_array_elements(plan_days) as d where d->>'date' = p_day::text) then
    raise exception 'offline english assignment changed' using errcode = 'PT409';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_attempts) as evidence
    where not exists (
      select 1
      from public.word_entries w
      cross join lateral jsonb_array_elements(plan_days) as d
      where w.id = (evidence->>'wordEntryId')::uuid and d->>'date' <= p_day::text
        and (d->'newWordKeys') ? (w.unit || '::' || w.lesson || '::' || w.word)
    )
  ) then raise exception 'offline english vocabulary assignment changed' using errcode = 'PT409'; end if;
  if p_attempts <> '[]'::jsonb then
    perform pg_advisory_xact_lock(hashtextextended('rosie.vocabulary.progress:' || owner_id, 0));
    for attempt in select value from jsonb_array_elements(p_attempts) loop
      perform vocabulary_private.record_evidence(owner_id, 'quiz:' || ((attempt->>'id')::uuid)::text,
        (attempt->>'wordEntryId')::uuid, attempt->>'skill', (attempt->>'targetId')::uuid,
        (attempt->>'correct')::boolean, coalesce((attempt->>'independent')::boolean, false), p_day);
    end loop;
  end if;
  if progress #>> array[p_day::text, 'quizDone'] is distinct from 'true' then
    progress := jsonb_set(progress, array[p_day::text],
      coalesce(progress -> (p_day::text), '{}'::jsonb) ||
      jsonb_build_object('quizDone', true, 'lastScore', p_score, 'completedAt', p_day::text));
    update public.weekly_plans set progress_data = progress, updated_at = now() where user_id = owner_id and id = p_plan;
  end if;
end;
$$;

revoke all on function public.settle_offline_math_practice(uuid,text,text,text,text,boolean,text,date,text) from public, anon;
revoke all on function public.settle_offline_english_weekly(uuid,uuid,date,integer,jsonb) from public, anon;
grant execute on function public.settle_offline_math_practice(uuid,text,text,text,text,boolean,text,date,text) to authenticated;
grant execute on function public.settle_offline_english_weekly(uuid,uuid,date,integer,jsonb) to authenticated;

notify pgrst, 'reload schema';
