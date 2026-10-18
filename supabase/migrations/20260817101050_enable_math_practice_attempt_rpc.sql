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

notify pgrst, 'reload schema';
