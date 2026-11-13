create schema if not exists pet_private;
revoke all on schema pet_private from public, anon;
grant usage on schema pet_private to authenticated;

create table public.pet_word_content (
  word_entry_id uuid primary key references public.word_entries(id) on delete cascade,
  revision text not null check (length(revision) > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  published boolean not null default true
);

create table public.pet_exercise_sets (
  id text primary key check (length(id) > 0),
  revision text not null check (length(revision) > 0),
  kind text not null check (kind in ('sentence', 'exam', 'forms')),
  title text not null,
  topic text,
  passage text,
  word_pool text[] not null default '{}',
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  published boolean not null default false
);

create table public.pet_practice_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  mode text not null check (mode in ('context', 'spelling', 'listening', 'word_form', 'sentence', 'exam', 'forms', 'review')),
  track text not null check (track in ('daily', 'specialist')),
  feedback_mode text not null check (feedback_mode in ('training', 'assessment')),
  source text not null,
  set_id text,
  set_revision text,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  passage text,
  word_pool text[] not null default '{}',
  review_word_ids uuid[] not null default '{}',
  timer_enabled boolean not null default false,
  time_zone text not null,
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  item_index integer not null default 0,
  request_ids uuid[] not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index pet_one_active_session_per_user on public.pet_practice_sessions (user_id)
where status = 'active';
create index pet_practice_sessions_user_recent on public.pet_practice_sessions (user_id, completed_at desc, id)
where status = 'completed';

create table public.pet_review_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_entry_id uuid not null references public.word_entries(id) on delete cascade,
  interval_index integer not null default 0 check (interval_index between 0 and 4),
  due_on date not null,
  last_reviewed_on date,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_entry_id)
);

create index pet_review_word_fk on public.pet_review_progress (word_entry_id);
create index pet_review_due on public.pet_review_progress (user_id, due_on, word_entry_id);

alter table public.pet_word_content enable row level security;
alter table public.pet_exercise_sets enable row level security;
alter table public.pet_practice_sessions enable row level security;
alter table public.pet_review_progress enable row level security;

revoke all on public.pet_word_content, public.pet_exercise_sets,
  public.pet_practice_sessions, public.pet_review_progress from public, anon, authenticated;

grant select, insert, update, delete on public.pet_word_content, public.pet_exercise_sets to authenticated;
grant select on public.pet_review_progress to authenticated;
grant select (id, user_id, version, status, mode, track, feedback_mode, source, set_id, set_revision,
  items, passage, word_pool, review_word_ids, timer_enabled, answers, item_index,
  started_at, completed_at, updated_at) on public.pet_practice_sessions to authenticated;
grant all on public.pet_word_content, public.pet_exercise_sets,
  public.pet_practice_sessions, public.pet_review_progress to service_role;

create policy pet_word_content_read on public.pet_word_content for select to authenticated
using (published);
create policy pet_word_content_admin on public.pet_word_content for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy pet_exercise_sets_read on public.pet_exercise_sets for select to authenticated
using (published);
create policy pet_exercise_sets_admin on public.pet_exercise_sets for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy pet_sessions_owner on public.pet_practice_sessions for select to authenticated
using ((select auth.uid()) = user_id);
create policy pet_review_owner on public.pet_review_progress for select to authenticated
using ((select auth.uid()) = user_id);

create function pet_private.normalize_answer(p_value text)
returns text
language sql immutable strict
set search_path = ''
as $$
  select lower(btrim(regexp_replace(replace(replace(p_value, '’', ''''), '‘', ''''), '[[:space:]]+', ' ', 'g')))
$$;

create function pet_private.answer_correct(p_item jsonb, p_answers jsonb)
returns boolean
language sql immutable
set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_array_elements(p_item -> 'acceptedAnswerSets') as variants(variant)
    where jsonb_array_length(variant) = jsonb_array_length(p_answers)
      and not exists (
        select 1 from jsonb_array_elements_text(variant) with ordinality as accepted(value, slot)
        where pet_private.normalize_answer(value) is distinct from
          pet_private.normalize_answer(p_answers ->> (slot::integer - 1))
      )
  )
$$;

create function pet_private.empty_answer()
returns jsonb
language sql immutable
set search_path = ''
as $$
  select '{"firstAnswers":null,"firstCorrect":null,"usedHelp":false,"revealed":false,"retries":[],"skippedAudio":false}'::jsonb
$$;

create function pet_private.learning_command(p_command text, p_input jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  v_zone text := case when p_command = 'sync_review' or p_input ->> 'mode' = 'review' then 'Asia/Shanghai'
    else coalesce(nullif(p_input ->> 'timeZone', ''), 'Asia/Shanghai') end;
  v_today date;
  v_id uuid;
  v_request_id uuid;
  v_session public.pet_practice_sessions%rowtype;
  v_set public.pet_exercise_sets%rowtype;
  v_retry_items jsonb;
  v_retry_passage text;
  v_retry_word_pool text[];
  v_items jsonb;
  v_item jsonb;
  v_published_item jsonb;
  v_item_id text;
  v_word_id uuid;
  v_word text;
  v_mode text := p_input ->> 'mode';
  v_track text := coalesce(p_input ->> 'track', case when v_mode in ('sentence', 'exam', 'forms') then 'specialist' else 'daily' end);
  v_feedback text := p_input ->> 'feedbackMode';
  v_review_ids uuid[] := '{}';
  v_review_updates jsonb := '[]';
  v_answers jsonb;
  v_answer jsonb;
  v_values jsonb;
  v_correct boolean;
  v_index integer;
  v_action jsonb := p_input -> 'action';
begin
  if v_user is null or (p_input ->> 'userId')::uuid is distinct from v_user then
    raise exception 'PET sign-in required' using errcode = '42501';
  end if;
  if p_command is null or p_command not in ('sync_review', 'start', 'save', 'complete', 'abandon') then
    raise exception 'Invalid PET session command' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_zone) then
    raise exception 'Invalid PET time zone' using errcode = '22023';
  end if;
  v_today := (v_now at time zone v_zone)::date;

  if p_command = 'sync_review' then
    -- Stage-aware enrollment from the existing main-line ledger, including inactive plans.
    insert into public.pet_review_progress (user_id, word_entry_id, due_on)
    select v_user, word.id, (min(coalesce(completion.completed_at, progress.updated_at)) at time zone v_zone)::date + 1
    from public.adaptive_plan_word_progress progress
    join public.adaptive_word_plans plan on plan.id = progress.plan_id and plan.user_id = v_user
    join public.word_entries word on word.stage = 'PET'
      and progress.word_key = word.unit || '::' || word.lesson || '::' || word.word
    left join lateral (
      select min(log.created_at) as completed_at
      from public.adaptive_practice_word_logs log
      where log.user_id = v_user and log.plan_id = plan.id and log.word_key = progress.word_key
        and (log.status_after = 'MASTERED' or (log.status_after = 'LEARNING_PENDING' and log.box_after = 5))
    ) completion on true
    where progress.user_id = v_user and progress.archived_at is null
      and (progress.status = 'MASTERED'
        or (progress.status = 'LEARNING_PENDING' and progress.box_index = 5 and progress.target_box is null))
      and (plan.scope -> 'stages') ? 'PET'
      and (not (plan.scope ? 'lessonKeys') or plan.scope -> 'lessonKeys' = '[]'::jsonb
        or (plan.scope -> 'lessonKeys') ? (word.unit || '::' || word.lesson))
      and (not (p_input ? 'wordEntryIds') or (p_input -> 'wordEntryIds') ? word.id::text)
      and not exists (
        select 1 from public.pet_review_progress enrolled
        where enrolled.user_id = v_user and enrolled.word_entry_id = word.id
      )
    group by word.id
    on conflict (user_id, word_entry_id) do nothing;

    return jsonb_build_object('today', v_today, 'reviewProgress', coalesce((
      select jsonb_agg(to_jsonb(review) - 'user_id' order by review.due_on, review.word_entry_id)
      from public.pet_review_progress review
      join public.word_entries word on word.id = review.word_entry_id and word.stage = 'PET'
      where review.user_id = v_user
    ), '[]'::jsonb));
  end if;

  v_id := (p_input ->> 'id')::uuid;
  if v_id is null then
    raise exception 'Missing PET session ID' using errcode = '22023';
  end if;

  if p_command = 'start' then
    -- Serialize starts by owner, including concurrent replay of a lost response.
    perform pg_advisory_xact_lock(hashtextextended(v_user::text, 129718));
    select * into v_session from public.pet_practice_sessions where id = v_id and user_id = v_user;
    if found then
      return jsonb_build_object('session', to_jsonb(v_session) - 'request_ids' - 'user_id');
    end if;
    if exists (select 1 from public.pet_practice_sessions where user_id = v_user and status = 'active') then
      raise exception 'A PET session is already active' using errcode = '23505';
    end if;
    if v_track not in ('daily', 'specialist')
      or (v_mode = 'review' and v_track <> 'daily')
      or (v_mode in ('sentence', 'exam', 'forms') and v_track <> 'specialist') then
      raise exception 'Invalid PET practice track' using errcode = '22023';
    end if;

    if p_input ->> 'setId' is not null then
      select * into v_set from public.pet_exercise_sets
      where id = p_input ->> 'setId' and published;
      if not found or v_set.kind is distinct from v_mode
        or (p_input ->> 'setRevision' is not null and v_set.revision <> p_input ->> 'setRevision') then
        raise exception 'PET exercise set is unavailable or has changed' using errcode = '22023';
      end if;
      v_items := v_set.items;
    else
      if v_mode in ('sentence', 'exam', 'forms') then
        raise exception 'PET exercise set required' using errcode = '22023';
      end if;
      v_items := p_input -> 'items';
      if p_input ->> 'retrySessionId' is not null and v_mode <> 'review' then
        select items, passage, word_pool into v_retry_items, v_retry_passage, v_retry_word_pool
        from public.pet_practice_sessions
        where id = (p_input ->> 'retrySessionId')::uuid and user_id = v_user and status = 'completed';
        if not found then
          raise exception 'PET retry session unavailable' using errcode = '42501';
        end if;
      end if;
    end if;

    if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) not between 1 and 100 then
      raise exception 'Invalid PET session items' using errcode = '22023';
    end if;
    if (select count(distinct value ->> 'id') from jsonb_array_elements(v_items)) <> jsonb_array_length(v_items) then
      raise exception 'PET item IDs must be unique' using errcode = '22023';
    end if;

    if v_mode = 'review' then
      select coalesce(array_agg(distinct value::uuid), '{}') into v_review_ids
      from jsonb_array_elements_text(coalesce(p_input -> 'reviewWordIds', '[]'));
      if cardinality(v_review_ids) = 0 or cardinality(v_review_ids) <> (
        select count(*) from public.pet_review_progress review
        join public.word_entries word on word.id = review.word_entry_id and word.stage = 'PET'
        where review.user_id = v_user and review.word_entry_id = any(v_review_ids)
          and review.due_on <= v_today and (review.last_reviewed_on is null or review.last_reviewed_on < v_today)
      ) then
        raise exception 'PET review words must be due' using errcode = '22023';
      end if;
    end if;

    v_answers := '[]';
    for v_item in select value from jsonb_array_elements(v_items) loop
      v_word_id := (v_item ->> 'wordEntryId')::uuid;
      select word into v_word from public.word_entries where id = v_word_id and stage = 'PET';
      if not found or (v_mode = 'review' and not (v_word_id = any(v_review_ids))) then
        raise exception 'PET item requires a matching PET word' using errcode = '22023';
      end if;
      if v_set.id is null then
        if v_item ->> 'kind' in ('context', 'word_form') then
          if v_retry_items is not null then
            select item into v_published_item from jsonb_array_elements(v_retry_items) as items(item)
            where item ->> 'id' = v_item ->> 'id' and item ->> 'wordEntryId' = v_word_id::text
              and item ->> 'kind' = v_item ->> 'kind';
          else
            select item || jsonb_build_object('exerciseSetId', exercise_set.id, 'contentRevision', exercise_set.revision) into v_published_item
            from public.pet_exercise_sets as exercise_set
            cross join lateral jsonb_array_elements(exercise_set.items) as items(item)
            where exercise_set.published and item ->> 'id' = v_item ->> 'id'
              and item ->> 'wordEntryId' = v_word_id::text and item ->> 'kind' = v_item ->> 'kind'
            order by exercise_set.id limit 1;
          end if;
          if not found then
            raise exception 'PET context or word form must reference a published item or a completed snapshot' using errcode = '22023';
          end if;
          v_item := v_published_item;
        elsif v_item ->> 'kind' in ('spelling', 'listening') then
          v_item := v_item || jsonb_build_object(
            'acceptedAnswerSets', jsonb_build_array(jsonb_build_array(v_word)) || coalesce((
              select jsonb_agg(jsonb_build_array(alias.value))
              from public.pet_word_content content
              cross join lateral jsonb_array_elements(content.content -> 'aliases') as alias(value)
              where content.published and content.word_entry_id = v_word_id and jsonb_typeof(alias.value) = 'string'
            ), '[]'),
            'spokenText', v_word,
            'wordContentRevision', (select revision from public.pet_word_content where word_entry_id = v_word_id and published)
          );
        end if;
      else
        v_item := v_item || jsonb_build_object('exerciseSetId', v_set.id, 'contentRevision', v_set.revision);
      end if;
      if coalesce(v_item ->> 'id', '') = '' or coalesce(v_item ->> 'prompt', '') = ''
        or coalesce(v_item ->> 'kind', '') not in ('context', 'spelling', 'listening', 'word_form')
        or jsonb_typeof(v_item -> 'acceptedAnswerSets') is distinct from 'array'
        or jsonb_array_length(v_item -> 'acceptedAnswerSets') = 0
        or exists (
          select 1 from jsonb_array_elements(v_item -> 'acceptedAnswerSets') as variants(variant)
          where jsonb_typeof(variant) is distinct from 'array'
            or jsonb_array_length(variant) = 0
            or jsonb_array_length(variant) <> jsonb_array_length(v_item -> 'acceptedAnswerSets' -> 0)
            or exists (select 1 from jsonb_array_elements(variant) where jsonb_typeof(value) <> 'string')
        ) then
        raise exception 'Invalid PET item shape' using errcode = '22023';
      end if;
      v_answers := v_answers || jsonb_build_array(v_item);
    end loop;
    v_items := v_answers;

    if v_mode = 'review' and cardinality(v_review_ids) <> (
      select count(distinct value ->> 'wordEntryId') from jsonb_array_elements(v_items)
    ) then
      raise exception 'Every PET review word needs an item' using errcode = '22023';
    end if;
    insert into public.pet_practice_sessions (
      id, user_id, mode, track, feedback_mode, source, set_id, set_revision, items, passage,
      word_pool, review_word_ids, timer_enabled, time_zone
    ) values (
      v_id, v_user, v_mode, v_track, v_feedback, coalesce(nullif(p_input ->> 'source', ''), v_set.title, v_mode),
      v_set.id, v_set.revision, v_items,
      case when v_set.id is not null then v_set.passage
        when v_retry_items is not null then v_retry_passage else p_input ->> 'passage' end,
      coalesce(v_set.word_pool, v_retry_word_pool, '{}'), v_review_ids,
      coalesce((p_input ->> 'timerEnabled')::boolean, false), v_zone
    ) returning * into v_session;
    return jsonb_build_object('session', to_jsonb(v_session) - 'request_ids' - 'user_id');
  end if;

  select * into v_session from public.pet_practice_sessions where id = v_id and user_id = v_user for update;
  if not found then
    raise exception 'PET session unavailable' using errcode = '42501';
  end if;
  v_now := clock_timestamp();
  v_today := (v_now at time zone v_session.time_zone)::date;
  v_request_id := (v_action ->> 'requestId')::uuid;

  if (p_command = 'save' and v_request_id = any(v_session.request_ids))
    or (p_command = 'complete' and v_session.status = 'completed')
    or (p_command = 'abandon' and v_session.status = 'abandoned') then
    return jsonb_build_object('session', to_jsonb(v_session) - 'request_ids' - 'user_id',
      'reviewProgress', coalesce((
        select jsonb_agg(to_jsonb(review) - 'user_id')
        from public.pet_review_progress review
        where review.user_id = v_user and review.word_entry_id = any(v_session.review_word_ids)
      ), '[]'::jsonb));
  end if;
  if v_session.status <> 'active' or v_session.version is distinct from (p_input ->> 'version')::integer then
    raise exception 'PET session was updated elsewhere' using errcode = '40001';
  end if;

  v_answers := v_session.answers;
  v_index := v_session.item_index;
  if p_command = 'save' then
    if v_request_id is null then
      raise exception 'PET request ID required' using errcode = '22023';
    end if;
    if v_action ->> 'type' = 'navigate' then
      v_index := (v_action ->> 'itemIndex')::integer;
      if v_index is null or v_index < 0 or v_index >= jsonb_array_length(v_session.items) then
        raise exception 'Invalid PET item index' using errcode = '22023';
      end if;
    else
      v_item_id := v_action ->> 'itemId';
      select value into v_item from jsonb_array_elements(v_session.items) where value ->> 'id' = v_item_id;
      if not found then
        raise exception 'Invalid PET item ID' using errcode = '22023';
      end if;
      v_answer := coalesce(v_answers -> v_item_id, pet_private.empty_answer());
      case v_action ->> 'type'
        when 'draft', 'answer' then
          v_values := v_action -> 'answers';
          if jsonb_typeof(v_values) is distinct from 'array' or jsonb_array_length(v_values) > 100
            or exists (select 1 from jsonb_array_elements(v_values)
              where jsonb_typeof(value) <> 'string' or length(value #>> '{}') > 2000) then
            raise exception 'Invalid PET answer' using errcode = '22023';
          end if;
          if v_action ->> 'type' = 'answer' and v_session.feedback_mode <> 'training' then
            raise exception 'PET assessment is graded on submission' using errcode = '22023';
          end if;
          if v_action ->> 'type' = 'answer' then
            if (v_answer ->> 'skippedAudio')::boolean
              or jsonb_array_length(v_values) <> jsonb_array_length(v_item -> 'acceptedAnswerSets' -> 0)
              or exists (select 1 from jsonb_array_elements_text(v_values)
                where value !~ '[^[:space:]]') then
              raise exception 'PET answer is incomplete or audio was skipped' using errcode = '22023';
            end if;
            v_correct := pet_private.answer_correct(v_item, v_values);
            if v_answer ->> 'firstCorrect' is null then
              v_answer := v_answer || jsonb_build_object('firstAnswers', v_values, 'firstCorrect', v_correct);
            else
              v_answer := jsonb_set(v_answer, '{retries}',
                (v_answer -> 'retries') || jsonb_build_array(jsonb_build_object('answers', v_values, 'correct', v_correct)));
            end if;
          end if;
          v_answer := jsonb_set(jsonb_set(v_answer, '{draftAnswers}', v_values), '{revealed}', 'false');
        when 'help' then
          if v_session.feedback_mode <> 'training' then
            raise exception 'PET assessment does not allow hints' using errcode = '22023';
          end if;
          if (v_answer ->> 'firstCorrect')::boolean is distinct from true then
          v_answer := v_answer || '{"usedHelp":true,"revealed":true}'::jsonb;
          end if;
        when 'skip_audio' then
          if v_item ->> 'kind' <> 'listening' or v_answer ->> 'firstAnswers' is not null then
            raise exception 'Only unanswered PET listening items can be skipped' using errcode = '22023';
          end if;
          v_answer := jsonb_set(v_answer, '{skippedAudio}', 'true');
        else
          raise exception 'Invalid PET session action' using errcode = '22023';
      end case;
      v_answers := jsonb_set(v_answers, array[v_item_id], v_answer);
    end if;
  elsif p_command = 'complete' then
    for v_item in select value from jsonb_array_elements(v_session.items) loop
      v_item_id := v_item ->> 'id';
      v_answer := coalesce(v_answers -> v_item_id, pet_private.empty_answer());
      if v_answer ->> 'firstCorrect' is null and not (v_answer ->> 'skippedAudio')::boolean then
        if v_session.feedback_mode = 'training' then
          raise exception 'Finish all PET training items before submitting' using errcode = '22023';
        end if;
        v_values := coalesce(v_answer -> 'draftAnswers', '[]');
        if jsonb_array_length(v_values) <> jsonb_array_length(v_item -> 'acceptedAnswerSets' -> 0) or exists (
          select 1 from jsonb_array_elements_text(v_values)
          where value !~ '[^[:space:]]'
        ) then
          raise exception 'Finish all PET assessment items before submitting' using errcode = '22023';
        end if;
        v_answer := v_answer || jsonb_build_object('firstAnswers', v_values,
          'firstCorrect', pet_private.answer_correct(v_item, v_values));
        v_answers := jsonb_set(v_answers, array[v_item_id], v_answer);
      end if;
    end loop;

    if v_session.mode = 'review' then
      with outcomes as (
        select (item ->> 'wordEntryId')::uuid as word_entry_id,
          bool_and(coalesce((v_answers -> (item ->> 'id') ->> 'firstCorrect')::boolean, false)
            and not coalesce((v_answers -> (item ->> 'id') ->> 'usedHelp')::boolean, false))
            filter (where not coalesce((v_answers -> (item ->> 'id') ->> 'skippedAudio')::boolean, false)) as independent,
          bool_or(coalesce((v_answers -> (item ->> 'id') ->> 'skippedAudio')::boolean, false)) as skipped
        from jsonb_array_elements(v_session.items) as items(item)
        group by (item ->> 'wordEntryId')::uuid
      ), updated as (
        update public.pet_review_progress review
        set interval_index = case when outcomes.independent then least(review.interval_index + 1, 4) else 0 end,
          due_on = v_today + case when outcomes.independent then (array[3, 7, 14, 30])[least(review.interval_index + 1, 4)] else 1 end,
          last_reviewed_on = v_today,
          updated_at = v_now
        from outcomes
        where review.user_id = v_user and review.word_entry_id = outcomes.word_entry_id
          and review.word_entry_id = any(v_session.review_word_ids)
          and review.due_on <= v_today and (review.last_reviewed_on is null or review.last_reviewed_on < v_today)
          and (outcomes.independent = false or (outcomes.independent and not outcomes.skipped))
          and exists (select 1 from public.word_entries word where word.id = review.word_entry_id and word.stage = 'PET')
        returning review.*
      )
      select coalesce(jsonb_agg(to_jsonb(updated) - 'user_id'), '[]') into v_review_updates from updated;
    end if;
  end if;

  update public.pet_practice_sessions
  set answers = v_answers,
    item_index = v_index,
    status = case p_command when 'complete' then 'completed' when 'abandon' then 'abandoned' else status end,
    completed_at = case when p_command = 'complete' then v_now else completed_at end,
    updated_at = v_now,
    version = version + 1,
    request_ids = case when p_command = 'save' then array_append(request_ids, v_request_id) else request_ids end
  where id = v_id and user_id = v_user
  returning * into v_session;

  return jsonb_build_object('session', to_jsonb(v_session) - 'request_ids' - 'user_id',
    'today', (v_now at time zone 'Asia/Shanghai')::date, 'reviewProgress', v_review_updates);
end;
$$;

-- Expose an invoker wrapper while keeping the privileged implementation outside PostgREST's exposed schemas.
create function public.pet_learning_command(p_command text, p_input jsonb default '{}')
returns jsonb
language sql security invoker
set search_path = ''
as $$
  select pet_private.learning_command(p_command, p_input)
$$;

revoke execute on all functions in schema pet_private from public, anon, authenticated;
grant execute on function pet_private.learning_command(text, jsonb) to authenticated;
revoke execute on function public.pet_learning_command(text, jsonb) from public, anon, authenticated;
grant execute on function public.pet_learning_command(text, jsonb) to authenticated;
