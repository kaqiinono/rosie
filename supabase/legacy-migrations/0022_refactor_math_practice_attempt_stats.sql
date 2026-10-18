-- math_practice_attempts is the single source of truth for per-problem practice.
-- This migration validates and backfills math_solved before removing the legacy tables.

alter table public.math_practice_attempts
  add column if not exists record_origin text not null default 'native',
  add column if not exists legacy_solve_ordinal integer;

alter table public.math_practice_attempts
  drop constraint if exists math_practice_attempts_record_origin_check;

alter table public.math_practice_attempts
  add constraint math_practice_attempts_record_origin_check
  check (record_origin in ('native', 'math_solved_backfill'));

alter table public.math_practice_attempts
  drop constraint if exists math_practice_attempts_legacy_ordinal_check;

alter table public.math_practice_attempts
  add constraint math_practice_attempts_legacy_ordinal_check
  check (
    (record_origin = 'native' and legacy_solve_ordinal is null)
    or
    (record_origin = 'math_solved_backfill' and legacy_solve_ordinal is not null)
  );

create unique index if not exists math_practice_attempts_legacy_solve_ordinal_key
  on public.math_practice_attempts (
    user_id,
    problem_id,
    record_origin,
    legacy_solve_ordinal
  )
  where record_origin = 'math_solved_backfill';

create or replace view public.math_problem_practice_stats
with (security_invoker = true)
as
select
  user_id,
  problem_id,
  count(*)::integer as practice_count,
  count(*) filter (where correct is true)::integer as correct_count,
  count(*) filter (where correct is false)::integer as wrong_count,
  coalesce(
    max(attempted_at) filter (where record_origin = 'native'),
    max(attempted_at)
  ) as last_attempted_at,
  max(attempted_at) filter (where correct is true) as last_correct_at
from public.math_practice_attempts
where status = 'completed'
group by user_id, problem_id;

grant select on public.math_problem_practice_stats to authenticated;

comment on view public.math_problem_practice_stats is
  'Per-user completed math attempt statistics. RLS is inherited from math_practice_attempts via security_invoker.';

-- Complete an existing draft or insert a completed attempt, and project the result
-- into math_wrong in the same transaction. RLS on both tables remains authoritative.
create or replace function public.submit_math_practice_attempt(
  p_user_id uuid,
  p_problem_id text,
  p_lesson_id text,
  p_section text,
  p_result text,
  p_objects jsonb,
  p_answer_snapshot jsonb,
  p_paper_id uuid,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  completed_attempt_id uuid;
  is_correct boolean;
  recorded_new boolean := true;
begin
  if p_result not in ('correct', 'wrong', 'dont_know') then
    raise exception 'Unsupported practice result: %', p_result;
  end if;
  is_correct := p_result = 'correct';

  if p_attempt_id is not null then
    update public.math_practice_attempts
    set lesson_id = p_lesson_id,
        section = p_section,
        paper_id = p_paper_id,
        correct = is_correct,
        answer_snapshot = p_answer_snapshot,
        objects = coalesce(p_objects, '[]'::jsonb),
        attempted_at = now(),
        status = 'completed',
        record_origin = 'native',
        legacy_solve_ordinal = null
    where id = p_attempt_id
      and user_id = p_user_id
      and problem_id = p_problem_id
      and status = 'in_progress'
    returning id into completed_attempt_id;
  end if;

  if completed_attempt_id is null then
    if p_paper_id is not null then
      select id
      into completed_attempt_id
      from public.math_practice_attempts
      where user_id = p_user_id
        and problem_id = p_problem_id
        and paper_id = p_paper_id
        and status = 'completed'
        and record_origin = 'native'
      order by attempted_at desc
      limit 1;

      if completed_attempt_id is not null then
        recorded_new := false;
        update public.math_practice_attempts
        set lesson_id = p_lesson_id,
            section = p_section,
            correct = is_correct,
            answer_snapshot = p_answer_snapshot,
            objects = coalesce(p_objects, '[]'::jsonb),
            attempted_at = now()
        where id = completed_attempt_id;
      end if;
    end if;
  end if;

  if completed_attempt_id is null then
    select id
    into completed_attempt_id
    from public.math_practice_attempts
    where user_id = p_user_id
      and problem_id = p_problem_id
      and status = 'in_progress'
      and paper_id is not distinct from p_paper_id
    order by attempted_at desc
    limit 1;

    if completed_attempt_id is not null then
      update public.math_practice_attempts
      set lesson_id = p_lesson_id,
          section = p_section,
          correct = is_correct,
          answer_snapshot = p_answer_snapshot,
          objects = coalesce(p_objects, '[]'::jsonb),
          attempted_at = now(),
          status = 'completed',
          record_origin = 'native',
          legacy_solve_ordinal = null
      where id = completed_attempt_id;
    end if;
  end if;

  if completed_attempt_id is null then
    insert into public.math_practice_attempts (
      user_id,
      problem_id,
      lesson_id,
      section,
      paper_id,
      correct,
      answer_snapshot,
      objects,
      status,
      record_origin
    ) values (
      p_user_id,
      p_problem_id,
      p_lesson_id,
      p_section,
      p_paper_id,
      is_correct,
      p_answer_snapshot,
      coalesce(p_objects, '[]'::jsonb),
      'completed',
      'native'
    )
    returning id into completed_attempt_id;
  end if;

  if is_correct then
    update public.math_wrong
    set resolved = true,
        resolved_at = now()
    where user_id = p_user_id
      and problem_id = p_problem_id;
  else
    insert into public.math_wrong (
      user_id,
      problem_id,
      resolved,
      resolved_at,
      last_wrong_attempt_id
    ) values (
      p_user_id,
      p_problem_id,
      false,
      null,
      completed_attempt_id
    )
    on conflict (user_id, problem_id) do update
    set resolved = false,
        resolved_at = null,
        added_at = now(),
        last_wrong_attempt_id = excluded.last_wrong_attempt_id;
  end if;

  return jsonb_build_object(
    'attempt_id', completed_attempt_id,
    'recorded_new', recorded_new
  );
end
$$;

revoke all on function public.submit_math_practice_attempt(
  uuid, text, text, text, text, jsonb, jsonb, uuid, uuid
) from public;
grant execute on function public.submit_math_practice_attempt(
  uuid, text, text, text, text, jsonb, jsonb, uuid, uuid
) to authenticated;

-- Refuse to guess catalog metadata. These contiguous section limits are generated
-- from the registered ProblemSet exports; a missing section or out-of-range id aborts.
do $$
declare
  invalid_ids text;
begin
  with catalog_limits(lesson_id, section_code, max_ordinal) as (
    values
      ('1-12','H',10),('1-12','L',22),('1-12','P',5),('1-12','W',15),
      ('1-13','H',6),('1-13','L',17),('1-13','P',5),('1-13','W',12),
      ('1-15','H',6),('1-15','L',12),('1-15','P',5),('1-15','W',9),
      ('1-18','H',6),('1-18','L',14),('1-18','P',5),('1-18','W',12),
      ('1-23','H',6),('1-23','L',12),('1-23','P',5),('1-23','W',12),
      ('1-29','H',6),('1-29','L',12),
      ('1-30','L',12),('1-30','P',5),('1-30','W',12),
      ('1-34','H',11),('1-34','L',6),('1-34','P',10),('1-34','S',100),('1-34','W',12),
      ('1-35','H',6),('1-35','L',6),('1-35','P',5),('1-35','W',12),
      ('1-36','H',6),('1-36','L',7),('1-36','P',5),('1-36','W',12),
      ('1-37','H',6),('1-37','L',12),('1-37','P',5),('1-37','S',5),('1-37','W',12),
      ('1-38','H',6),('1-38','L',12),('1-38','P',5),('1-38','S',5),('1-38','W',12),
      ('1-39','H',6),('1-39','L',12),('1-39','P',5),('1-39','S',4),('1-39','W',12),
      ('1-40','H',6),('1-40','L',12),('1-40','P',5),('1-40','S',3),('1-40','W',12),
      ('1-41','H',6),('1-41','L',12),('1-41','P',7),('1-41','W',12),
      ('1-42','H',6),('1-42','L',14),('1-42','P',5),('1-42','S',6),('1-42','W',12),
      ('1-43','H',6),('1-43','L',16),('1-43','P',5),('1-43','S',8),('1-43','W',14),
      ('1-44','H',6),('1-44','L',12),('1-44','P',5),('1-44','S',5),('1-44','W',12),
      ('1-46','H',6),('1-46','L',18),('1-46','P',10),('1-46','S',2),('1-46','W',13),
      ('1-47','H',6),('1-47','L',12),('1-47','W',12),
      ('2-1','H',17),('2-1','L',26),('2-1','P',8),('2-1','S',6),
      ('2-2','H',12),('2-2','L',10),('2-2','P',10),('2-2','S',5),
      ('2-3','H',14),('2-3','L',14),('2-3','P',6),('2-3','S',7),
      ('2-4','H',23),('2-4','L',23),('2-4','P',14),('2-4','S',6),
      ('2-5','H',21),('2-5','L',26),('2-5','S',10),
      ('2-6','H',18),('2-6','L',35),('2-6','P',13),('2-6','S',13),
      ('2-7','H',26),('2-7','L',26),('2-7','P',6),('2-7','S',18)
  ), normalized_solved as (
    select distinct case
      -- Git history proves the only bare ProblemSet ids belonged to lesson 1-35.
      when problem_id ~ '^[PLHWS]\d+$' then '1-35-' || problem_id
      else problem_id
    end as problem_id
    from public.math_solved
  ), parsed as (
    select
      problem_id,
      substring(problem_id from '^(\d+-\d+)-') as lesson_id,
      substring(problem_id from '^\d+-\d+-([PLHWS])\d+$') as section_code,
      substring(problem_id from '(\d+)$')::integer as ordinal
    from normalized_solved
    where problem_id ~ '^\d+-\d+-[PLHWS]\d+$'
  )
  select string_agg(solved.problem_id, ', ' order by solved.problem_id)
  into invalid_ids
  from normalized_solved solved
  left join parsed on parsed.problem_id = solved.problem_id
  left join catalog_limits catalog
    on catalog.lesson_id = parsed.lesson_id
   and catalog.section_code = parsed.section_code
  where parsed.problem_id is null
     or catalog.lesson_id is null
     or parsed.ordinal < 1
     or parsed.ordinal > catalog.max_ordinal;

  if invalid_ids is not null then
    raise exception 'math_solved contains problem ids missing from the registered catalog: %', invalid_ids;
  end if;
end
$$;

-- Backfill only the correct-attempt deficit. Existing native attempts always win.
with solved_normalized as (
  select
    user_id,
    case
      when problem_id ~ '^[PLHWS]\d+$' then '1-35-' || problem_id
      else problem_id
    end as problem_id,
    sum(solve_count)::integer as solve_count,
    max(solved_at) as solved_at
  from public.math_solved
  group by user_id, 2
), native_correct as (
  select user_id, problem_id, count(*)::integer as count
  from public.math_practice_attempts
  where status = 'completed'
    and correct is true
    and record_origin = 'native'
  group by user_id, problem_id
), desired as (
  select
    solved.user_id,
    solved.problem_id,
    solved.solved_at,
    greatest(solved.solve_count - coalesce(native_correct.count, 0), 0) as missing_count
  from solved_normalized solved
  left join native_correct
    on native_correct.user_id = solved.user_id
   and native_correct.problem_id = solved.problem_id
)
insert into public.math_practice_attempts (
  user_id,
  problem_id,
  lesson_id,
  section,
  paper_id,
  correct,
  draft_id,
  answer_snapshot,
  attempted_at,
  status,
  objects,
  record_origin,
  legacy_solve_ordinal
)
select
  desired.user_id,
  desired.problem_id,
  substring(desired.problem_id from '^(\d+-\d+)-'),
  case substring(desired.problem_id from '^\d+-\d+-([PLHWS])\d+$')
    when 'P' then 'pretest'
    when 'L' then 'lesson'
    when 'H' then 'homework'
    when 'W' then 'workbook'
    when 'S' then 'supplement'
  end,
  null,
  true,
  null,
  jsonb_build_object('migration', 'math_solved_backfill'),
  coalesce(desired.solved_at, now()),
  'completed',
  '[]'::jsonb,
  'math_solved_backfill',
  ordinal
from desired
cross join lateral generate_series(1, desired.missing_count) as generated(ordinal)
on conflict (user_id, problem_id, record_origin, legacy_solve_ordinal)
  where record_origin = 'math_solved_backfill'
do nothing;

-- Do not retire math_solved unless every provable historical correct count exists.
do $$
declare
  incomplete_rows text;
begin
  select string_agg(
    format('%s/%s expected=%s actual=%s', user_id, problem_id, solve_count, actual_count),
    ', '
    order by user_id, problem_id
  )
  into incomplete_rows
  from (
    select
      solved.user_id,
      solved.problem_id,
      solved.solve_count,
      count(attempts.id) filter (
        where attempts.status = 'completed' and attempts.correct is true
      )::integer as actual_count
    from (
      select
        user_id,
        case
          when problem_id ~ '^[PLHWS]\d+$' then '1-35-' || problem_id
          else problem_id
        end as problem_id,
        sum(solve_count)::integer as solve_count
      from public.math_solved
      group by user_id, 2
    ) solved
    left join public.math_practice_attempts attempts
      on attempts.user_id = solved.user_id
     and attempts.problem_id = solved.problem_id
    group by solved.user_id, solved.problem_id, solved.solve_count
    having count(attempts.id) filter (
      where attempts.status = 'completed' and attempts.correct is true
    ) < solved.solve_count
  ) incomplete;

  if incomplete_rows is not null then
    raise exception 'math_solved backfill verification failed: %', incomplete_rows;
  end if;
end
$$;

-- Keep one inaccessible migration-time backup for emergency audit/rollback only.
-- The application and API roles cannot access the archive schema.
create schema if not exists archive;
revoke all on schema archive from public, anon, authenticated;
create table if not exists archive.math_solved_pre_attempts_20260817
as table public.math_solved;
revoke all on table archive.math_solved_pre_attempts_20260817
from public, anon, authenticated;

-- The application deployed with this migration no longer reads or writes these projections.
drop function if exists public.increment_math_solved(uuid, text);
drop table if exists public.math_solved;
drop table if exists public.math_skipped;

-- Ensure the newly created RPC/view signatures are visible to PostgREST immediately.
notify pgrst, 'reload schema';
