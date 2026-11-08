create or replace function public.math_replay_catalog(p_lesson text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'lessonKey', p_lesson,
    'keys', coalesce(jsonb_agg(r.problem_id order by r.problem_id), '[]'),
    'summaryNames', coalesce(jsonb_object_agg(r.problem_id, r.current_name)
      filter (where starts_with(r.problem_id, p_lesson || '-summary-')), '{}'),
    'syncedAt', (
      select l.saved_at from public.math_replay_lessons l
      join public.baidu_oauth_credentials a on a.id = 'primary' and a.account_id = l.account_id
      where l.lesson_key = p_lesson
    )
  )
  from public.math_replay_resolved r
  where r.lesson_key = p_lesson and r.available
$$;
