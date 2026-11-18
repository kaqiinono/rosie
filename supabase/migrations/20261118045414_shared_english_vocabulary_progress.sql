create table public.vocabulary_skill_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null check (skill in ('meaning', 'usage', 'spelling', 'dictation')),
  target_id uuid not null,
  correct integer not null default 0,
  incorrect integer not null default 0,
  stage integer not null default 0,
  due_on date,
  last_seen date,
  last_adjusted_on date,
  is_hard boolean not null default false,
  primary key (user_id, skill, target_id)
);
create index vocabulary_skill_progress_due on public.vocabulary_skill_progress(user_id, due_on)
  where due_on is not null;

create table vocabulary_private.practice_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_key text not null,
  word_entry_id uuid not null references public.word_entries(id),
  skill text not null,
  target_id uuid not null,
  correct boolean not null,
  independent boolean not null,
  practice_date date not null,
  primary key (user_id, receipt_key)
);

alter table public.vocabulary_skill_progress enable row level security;
revoke all on public.vocabulary_skill_progress from public, anon, authenticated, service_role;
grant select on public.vocabulary_skill_progress to authenticated, service_role;
create policy vocabulary_skill_progress_owner on public.vocabulary_skill_progress for select to authenticated
  using (user_id = (select auth.uid()));

create function vocabulary_private.record_evidence(
  p_user uuid, p_receipt text, p_position uuid, p_skill text, p_target uuid,
  p_correct boolean, p_independent boolean, p_day date
) returns void language plpgsql set search_path = '' as $$
declare
  v_progress public.vocabulary_skill_progress;
  v_stage integer;
  v_due date;
  v_hard boolean;
  v_adjusted date;
begin
  if p_user is null or p_receipt is null or p_position is null or p_skill is null or p_target is null
    or p_correct is null or p_independent is null or p_day is null then return; end if;

  if not (
    (p_skill in ('spelling', 'dictation') and exists (
      select 1 from public.word_entries where id = p_position and spelling_group_id = p_target
    )) or
    (p_skill in ('meaning', 'usage') and exists (
      select 1 from public.vocabulary_position_senses l
      join public.vocabulary_senses s on s.id = l.sense_id and s.verified
      where l.word_entry_id = p_position and (
        s.id = p_target or (p_skill = 'usage' and exists (
          select 1 from public.vocabulary_usages u
          join public.vocabulary_position_usages pu on pu.usage_id = u.id and pu.word_entry_id = p_position
          where u.id = p_target and u.sense_id = s.id
        ))
      )
    ))
  ) then return; end if;

  insert into vocabulary_private.practice_receipts values
    (p_user, p_receipt, p_position, p_skill, p_target, p_correct, p_independent, p_day)
    on conflict (user_id, receipt_key) do nothing;
  if not found then
    if p_receipt like 'quiz:%' and not exists (
      select 1 from vocabulary_private.practice_receipts
      where user_id = p_user and receipt_key = p_receipt and word_entry_id = p_position
        and skill = p_skill and target_id = p_target and correct = p_correct and independent = p_independent
    ) then
      raise exception 'Vocabulary attempt ID already used for another answer' using errcode = '40001';
    end if;
    return;
  end if;
  if not p_independent then return; end if;

  insert into public.vocabulary_skill_progress(user_id, skill, target_id)
    values (p_user, p_skill, p_target) on conflict do nothing;
  select * into strict v_progress from public.vocabulary_skill_progress
    where user_id = p_user and skill = p_skill and target_id = p_target for update;

  v_stage := v_progress.stage;
  v_due := v_progress.due_on;
  v_hard := v_progress.is_hard;
  v_adjusted := v_progress.last_adjusted_on;
  if (v_adjusted is null or v_adjusted < p_day) and (not p_correct or (
    (v_due is null and v_stage = 0) or v_due <= p_day
  )) then
    if p_correct then
      v_stage := v_stage + 1;
      v_due := p_day + case when v_hard then (array[1,2,4,7,14,30,60,90])[v_stage + 1]
        else (array[1,3,7,14,30,60,90])[v_stage + 1] end;
    else
      v_stage := case when v_stage <= 1 then 0 when v_stage <= 4 then 1 else 3 end;
      v_hard := true;
      v_due := p_day + case when v_stage <= 1 then 1 else 7 end;
    end if;
    v_adjusted := p_day;
  end if;

  update public.vocabulary_skill_progress set
    correct = correct + p_correct::integer, incorrect = incorrect + (not p_correct)::integer,
    stage = v_stage, due_on = v_due, last_seen = greatest(last_seen, p_day),
    last_adjusted_on = v_adjusted, is_hard = v_hard
    where user_id = p_user and skill = p_skill and target_id = p_target;
end;
$$;

create function vocabulary_private.record_practice(p_user_id uuid, p_attempts jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_attempt jsonb;
  v_today date := (statement_timestamp() at time zone 'Asia/Shanghai')::date;
begin
  if v_user is null or p_user_id is distinct from v_user then
    raise exception 'Vocabulary session owner changed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_attempts) is distinct from 'array' or jsonb_array_length(p_attempts) > 500 then
    raise exception 'Invalid vocabulary attempts' using errcode = '22023';
  end if;
  -- All vocabulary evidence producers take the same owner lock first.
  perform pg_advisory_xact_lock(hashtextextended('rosie.vocabulary.progress:' || v_user, 0));
  for v_attempt in select value from jsonb_array_elements(p_attempts) loop
    perform vocabulary_private.record_evidence(v_user, 'quiz:' || ((v_attempt->>'id')::uuid)::text,
      (v_attempt->>'wordEntryId')::uuid, v_attempt->>'skill', (v_attempt->>'targetId')::uuid,
      (v_attempt->>'correct')::boolean, coalesce((v_attempt->>'independent')::boolean, false), v_today);
  end loop;
end;
$$;

create function public.record_vocabulary_practice(p_user_id uuid, p_attempts jsonb)
returns void language sql set search_path = '' as $$
  select vocabulary_private.record_practice(p_user_id, p_attempts)
$$;

create function vocabulary_private.ingest_pet_evidence(p_row public.pet_practice_sessions)
returns void language plpgsql set search_path = '' as $$
declare
  v_item jsonb;
  v_answer jsonb;
  v_position uuid;
  v_target uuid;
  v_skill text;
begin
  perform pg_advisory_xact_lock(hashtextextended('rosie.vocabulary.progress:' || p_row.user_id, 0));
  for v_item in select value from jsonb_array_elements(p_row.items) loop
    v_answer := p_row.answers -> (v_item->>'id');
    if v_answer->>'firstCorrect' is null or (v_answer->>'skippedAudio')::boolean is true then continue; end if;
    v_position := (v_item->>'wordEntryId')::uuid;
    case v_item->>'kind'
      when 'spelling' then v_skill := 'spelling';
      when 'listening' then v_skill := 'dictation';
      when 'context' then v_skill := 'usage';
      else continue;
    end case;
    if v_skill = 'usage' then
      select sense_id into v_target from public.vocabulary_position_senses
        where word_entry_id = v_position and source_key = 'pet:' || (v_item->>'senseId');
    else
      select g.id into v_target from public.word_entries w
      join public.vocabulary_spelling_groups g on g.id = w.spelling_group_id
        and (v_item->>'sharedSpellingGroupId' is null or g.id::text = v_item->>'sharedSpellingGroupId')
      where w.id = v_position and exists (
        select 1 from unnest(g.answers) a
        where case when (v_answer->>'firstCorrect')::boolean
          then lower(vocabulary_private.clean(a)) = lower(vocabulary_private.clean(v_answer->'firstAnswers'->>0))
          else exists (
            select 1 from jsonb_array_elements(v_item->'acceptedAnswerSets') answer
              where lower(vocabulary_private.clean(answer->>0)) = lower(vocabulary_private.clean(a))
          ) end
      );
    end if;
    perform vocabulary_private.record_evidence(p_row.user_id,
      'pet:' || p_row.id || ':' || (v_item->>'id'), v_position, v_skill, v_target,
      (v_answer->>'firstCorrect')::boolean, not coalesce((v_answer->>'usedHelp')::boolean, false),
      (p_row.completed_at at time zone 'Asia/Shanghai')::date);
  end loop;
  return;
end;
$$;

create function vocabulary_private.capture_pet_evidence()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform vocabulary_private.ingest_pet_evidence(new);
  return new;
end;
$$;

create trigger vocabulary_capture_pet_evidence after update of status on public.pet_practice_sessions
for each row when (new.status = 'completed' and old.status <> 'completed')
execute function vocabulary_private.capture_pet_evidence();

create function vocabulary_private.ingest_adaptive_evidence(p_row public.adaptive_practice_word_logs)
returns void language plpgsql set search_path = '' as $$
declare
  v_outcome jsonb;
  v_index bigint;
  v_position uuid;
  v_target uuid;
  v_skill text;
  v_day date;
  v_retry boolean;
begin
  if p_row.outcomes is null or jsonb_typeof(p_row.outcomes) <> 'array' then return; end if;
  select (s.finished_at at time zone 'Asia/Shanghai')::date into v_day
    from public.adaptive_practice_sessions s where s.id = p_row.session_id and s.user_id = p_row.user_id;
  perform pg_advisory_xact_lock(hashtextextended('rosie.vocabulary.progress:' || p_row.user_id, 0));
  for v_outcome, v_index in select value, ordinality from jsonb_array_elements(p_row.outcomes) with ordinality loop
    if v_outcome->>'phase' = 'boss_sink' or (v_outcome->>'inferred')::boolean is true then continue; end if;
    v_position := (v_outcome->>'wordEntryId')::uuid;
    v_target := (v_outcome->>'targetId')::uuid;
    v_skill := v_outcome->>'skill';
    if v_target is null and v_outcome->>'quizType' = 'C' then
      select (array_agg(w.id order by w.id))[1], (array_agg(w.spelling_group_id order by w.id))[1]
      into v_position, v_target from public.word_entries w
      where w.unit || '::' || w.lesson || '::' || w.word = p_row.word_key
      having count(distinct w.spelling_group_id) = 1 and bool_and(w.spelling_group_id is not null);
      v_skill := 'spelling';
    end if;
    v_retry := coalesce((v_outcome->>'usedRetry')::boolean, false);
    perform vocabulary_private.record_evidence(p_row.user_id,
      'adaptive:' || p_row.session_id || ':' || jsonb_build_array(p_row.word_key, v_index)::text,
      v_position, v_skill, v_target, not v_retry and (v_outcome->>'correct')::boolean,
      not coalesce((v_outcome->>'usedHelp')::boolean, false), v_day);
  end loop;
  return;
end;
$$;

create function vocabulary_private.capture_adaptive_evidence()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform vocabulary_private.ingest_adaptive_evidence(new);
  return new;
end;
$$;

create trigger vocabulary_capture_adaptive_evidence after insert or update of outcomes
  on public.adaptive_practice_word_logs for each row execute function vocabulary_private.capture_adaptive_evidence();

-- Existing components still address these summaries by a course key. The
-- skill rows remain authoritative and can be read directly by new schedulers.
create view public.vocabulary_mastery_overlay with (security_invoker = true) as
select progress.user_id, w.unit || '::' || w.lesson || '::' || w.word as word_key,
  case when bool_or(exists (
    select 1 from public.vocabulary_position_senses l
    join public.vocabulary_senses s on s.id = l.sense_id and s.verified
    where l.word_entry_id = w.id and not exists (
      select 1 from public.vocabulary_skill_progress meaning
      where meaning.user_id = progress.user_id and meaning.skill = 'meaning' and meaning.target_id = s.id
    )
  )) then null else min(progress.correct) filter (where progress.skill = 'meaning') end as correct,
  max(progress.incorrect) as incorrect,
  max(progress.last_seen) as last_seen, min(progress.stage) as stage,
  min(progress.due_on) as next_review_date, bool_or(progress.is_hard) as is_hard
from public.vocabulary_skill_progress progress
join public.word_entries w on w.archived_at is null and (
  (progress.skill in ('spelling', 'dictation') and progress.target_id = w.spelling_group_id)
  or (progress.skill in ('meaning', 'usage') and exists (
    select 1 from public.vocabulary_position_senses l where l.word_entry_id = w.id
    and (l.sense_id = progress.target_id or (progress.skill = 'usage' and exists (
      select 1 from public.vocabulary_usages u where u.id = progress.target_id and u.sense_id = l.sense_id
    )))
  ))
)
group by progress.user_id, w.unit, w.lesson, w.word;

revoke all on public.vocabulary_mastery_overlay from public, anon, authenticated, service_role;
grant select on public.vocabulary_mastery_overlay to authenticated, service_role;
revoke execute on function vocabulary_private.record_evidence(uuid,text,uuid,text,uuid,boolean,boolean,date),
  vocabulary_private.record_practice(uuid,jsonb), vocabulary_private.capture_pet_evidence(),
  vocabulary_private.ingest_pet_evidence(public.pet_practice_sessions),
  vocabulary_private.ingest_adaptive_evidence(public.adaptive_practice_word_logs),
  vocabulary_private.capture_adaptive_evidence(), public.record_vocabulary_practice(uuid,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function vocabulary_private.record_practice(uuid,jsonb),
  public.record_vocabulary_practice(uuid,jsonb) to authenticated;

-- PET's compatibility queue is keyed by position and asks spelling questions.
-- Mirror only that skill, so a dictation result cannot postpone a spelling review.
create function vocabulary_private.mirror_pet_due_date()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pet_review_progress(user_id, word_entry_id, interval_index, due_on, last_reviewed_on, updated_at)
  select new.user_id, w.id, least(new.stage, 4), coalesce(new.due_on, 'infinity'::date),
    new.last_adjusted_on, statement_timestamp()
  from public.word_entries w
  where w.stage = 'PET' and w.archived_at is null and w.spelling_group_id = new.target_id
  on conflict (user_id, word_entry_id) do update set
    interval_index = excluded.interval_index, due_on = excluded.due_on,
    last_reviewed_on = excluded.last_reviewed_on, updated_at = excluded.updated_at;
  return new;
end;
$$;

create trigger vocabulary_mirror_pet_due_date after insert or update on public.vocabulary_skill_progress
for each row when (new.skill = 'spelling' and new.last_adjusted_on is not null)
execute function vocabulary_private.mirror_pet_due_date();

create function vocabulary_private.freeze_pet_spellings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.set_id is not null then return new; end if;
  select jsonb_agg(
    case when cardinality(g.answers) > 1 and items.item->>'kind' in ('spelling', 'listening') then
      items.item || jsonb_build_object('sharedSpellingGroupId', g.id, 'spokenText', w.preferred_spelling,
        'acceptedAnswerSets', (
          select jsonb_agg(jsonb_build_array(answer) order by (answer = w.preferred_spelling) desc, answer)
          from unnest(g.answers) as answers(answer)
        ))
    else items.item end order by items.ordinal
  ) into new.items
  from jsonb_array_elements(new.items) with ordinality as items(item, ordinal)
  left join public.word_entries w on w.id = (items.item->>'wordEntryId')::uuid
  left join public.vocabulary_spelling_groups g on g.id = w.spelling_group_id;
  return new;
end;
$$;

create trigger vocabulary_freeze_pet_spellings before insert on public.pet_practice_sessions
for each row execute function vocabulary_private.freeze_pet_spellings();

revoke execute on function vocabulary_private.mirror_pet_due_date(), vocabulary_private.freeze_pet_spellings()
  from public, anon, authenticated, service_role;

create or replace function public.pet_learning_command(p_command text, p_input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is not null then
    perform pg_advisory_xact_lock(hashtextextended('rosie.vocabulary.progress:' || auth.uid(), 0));
  end if;
  return pet_private.learning_command(p_command, p_input);
end;
$$;

-- Backfill in chronological windows, before switching the active UI. Receipts
-- prevent a replay or overlapping windows from counting an answer again.
create function vocabulary_private.backfill_vocabulary_practice(p_from timestamptz, p_until timestamptz)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_event record;
  v_count integer := 0;
begin
  if (auth.jwt()->>'role') is distinct from 'service_role' then
    raise exception 'Vocabulary backfill requires service role' using errcode = '42501';
  end if;
  if p_from is null or p_until is null or p_from >= p_until or p_until - p_from > interval '31 days' then
    raise exception 'Use a chronological backfill window of up to 31 days' using errcode = '22023';
  end if;

  for v_event in
    select 'pet' as kind, s.user_id, s.completed_at as completed, s.id, null::text as word_key, to_jsonb(s) as row
    from public.pet_practice_sessions s
    where s.status = 'completed' and s.completed_at >= p_from and s.completed_at < p_until
    union all
    select 'adaptive', s.user_id, s.finished_at, s.id, l.word_key, to_jsonb(l)
    from public.adaptive_practice_sessions s
    join public.adaptive_practice_word_logs l on l.session_id = s.id and l.user_id = s.user_id
    where s.finished_at >= p_from and s.finished_at < p_until
    order by user_id, completed, id, word_key
  loop
    if v_event.kind = 'pet' then
      perform vocabulary_private.ingest_pet_evidence(jsonb_populate_record(null::public.pet_practice_sessions, v_event.row));
    else
      perform vocabulary_private.ingest_adaptive_evidence(jsonb_populate_record(null::public.adaptive_practice_word_logs, v_event.row));
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.backfill_vocabulary_practice(p_from timestamptz, p_until timestamptz)
returns integer language sql set search_path = '' as $$
  select vocabulary_private.backfill_vocabulary_practice(p_from, p_until)
$$;

revoke execute on function vocabulary_private.backfill_vocabulary_practice(timestamptz,timestamptz),
  public.backfill_vocabulary_practice(timestamptz,timestamptz) from public, anon, authenticated, service_role;
grant execute on function vocabulary_private.backfill_vocabulary_practice(timestamptz,timestamptz),
  public.backfill_vocabulary_practice(timestamptz,timestamptz) to service_role;

create function public.read_vocabulary_sense_queue(p_positions uuid[], p_limit integer default 10)
returns table(word_entry_id uuid, sense_id uuid, written jsonb)
language sql stable set search_path = '' as $$
  with targets as (
    select distinct on (s.id) w.id as word_entry_id, s.id as sense_id, s.written,
      progress.due_on, legacy.next_review_date as legacy_due, legacy.word_key is not null as had_legacy,
      progress.target_id is not null as had_progress,
      array_position(p_positions, w.id) as scope_order
    from public.word_entries w
    join public.vocabulary_position_senses link on link.word_entry_id = w.id
    join public.vocabulary_senses s on s.id = link.sense_id and s.verified
    left join public.vocabulary_skill_progress progress
      on progress.user_id = (select auth.uid()) and progress.skill = 'meaning' and progress.target_id = s.id
    left join public.word_mastery legacy
      on legacy.user_id = (select auth.uid()) and legacy.word_key = w.unit || '::' || w.lesson || '::' || w.word
    where (select auth.uid()) is not null and w.id = any(p_positions) and w.archived_at is null
      and (nullif(btrim(s.written->>'definitionEn'), '') is not null or nullif(btrim(s.written->>'definitionZh'), '') is not null)
    order by s.id, array_position(p_positions, w.id)
  ), scheduled as (
    select t.*, (statement_timestamp() at time zone 'Asia/Shanghai')::date as today
    from targets t
  )
  select t.word_entry_id, t.sense_id, t.written
  from scheduled t
  where (t.had_progress and t.due_on <= t.today)
    or (not t.had_progress and (t.legacy_due is null or t.legacy_due <= t.today))
  order by case when t.had_progress then 0 when t.had_legacy then 1 else 2 end,
    coalesce(t.due_on, t.legacy_due), t.scope_order, t.sense_id
  limit least(greatest(p_limit, 1), 50)
$$;

revoke execute on function public.read_vocabulary_sense_queue(uuid[],integer) from public, anon, authenticated;
grant execute on function public.read_vocabulary_sense_queue(uuid[],integer) to authenticated;
