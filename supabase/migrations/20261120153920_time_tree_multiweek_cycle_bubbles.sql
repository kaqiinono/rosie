set local lock_timeout = '3s';

create or replace function public.read_time_tree_rows(p_user uuid,p_full boolean,p_from text,p_through text,p_ids text[] default '{}',
  p_cycles_from text default null)
returns jsonb language sql stable security invoker set search_path='' as $$
with groups as (
  select occurrence from public.time_tree_steps where user_id=p_user and p_full
  union select occurrence from public.time_tree_steps where user_id=p_user and phase in ('pending','running','awaiting_pop','flower')
  union select occurrence from public.time_tree_steps where user_id=p_user and held and display_day>=p_from
  union select occurrence from public.time_tree_steps where user_id=p_user and
    split_part(occurrence,'/',3) between p_cycles_from and p_through
  union select occurrence from public.time_tree_steps where user_id=p_user and display_day between p_from and p_through
  union select occurrence from public.time_tree_steps where user_id=p_user and finished_day between p_from and p_through
  union select occurrence from public.time_tree_steps where user_id=p_user and started_day<=p_through and finished_day>p_through
  union select occurrence from public.time_tree_steps where user_id=p_user and step_id=any(p_ids)
  -- Include completed peers even after their individual display dates leave the scene window.
  union select occurrence from public.time_tree_steps where user_id=p_user and not held
    and split_part(occurrence,'/',2) in ('biweekly','three_weekly')
    and split_part(occurrence,'/',3) <= p_through and body->>'deadline' >= p_from
), records as (
  select s.* from groups join public.time_tree_steps s using(occurrence) where s.user_id=p_user
), items as (
  select collection,jsonb_agg(body order by case when collection='apples' then position else -position end) as entries
  from (
    select collection,body,position from public.time_tree_objects where user_id=p_user and collection in ('apples','diary')
    union all select collection,body,position from public.time_tree_objects where user_id=p_user
      and collection='tomatoSpends' and p_full
    union all select collection,body,position from public.time_tree_objects where user_id=p_user
      and collection='tomatoSpends' and not p_full and event_day between p_from and p_through
  ) objects
  group by collection
)
select jsonb_build_object('revision',a.revision,'appliedHomework',a.applied_homework,'tree',a.state ||
  coalesce((select jsonb_object_agg(collection,entries) from (
    select collection,jsonb_object_agg(binding_key,body) entries from public.time_tree_cursors
    where user_id=p_user group by collection) cursors),'{}') ||
  jsonb_build_object('steps',coalesce((select jsonb_agg(body order by position) from records where not held),'[]'),
    'weekendExcludedSteps',coalesce((select jsonb_agg(body order by position) from records where held),'[]'),
    'apples',coalesce((select entries from items where collection='apples'),'[]'),
    'diary',coalesce((select entries from items where collection='diary'),'[]'),
    'tomatoSpends',coalesce((select entries from items where collection='tomatoSpends'),'[]')))
from public.time_tree_accounts a where a.user_id=p_user
$$;

create or replace function public.read_time_tree_history(p_user uuid,p_days text[])
returns jsonb language sql stable security invoker set search_path='' as $$
with groups as (
  select occurrence from public.time_tree_steps where user_id=p_user and display_day=any(p_days)
  union select occurrence from public.time_tree_steps where user_id=p_user and finished_day=any(p_days)
  union select s.occurrence from unnest(p_days) day join public.time_tree_steps s
    on s.user_id=p_user and s.started_day<=day and s.finished_day>day
  union select occurrence from public.time_tree_steps where user_id=p_user and not held
    and split_part(occurrence,'/',2) in ('biweekly','three_weekly') and body->>'deadline'=any(p_days)
), cycles as (
  select distinct split_part(occurrence,'/',1) as template, split_part(occurrence,'/',2) as cycle,
    split_part(occurrence,'/',3) as cycle_start from groups
  where split_part(occurrence,'/',2) in ('biweekly','three_weekly')
), related as (
  select occurrence from groups
  union select s.occurrence from cycles join public.time_tree_steps s on s.user_id=p_user and not s.held
    and split_part(s.occurrence,'/',1)=cycles.template and split_part(s.occurrence,'/',2)=cycles.cycle
    and split_part(s.occurrence,'/',3)=cycles.cycle_start
)
select jsonb_build_object('revision',a.revision,'steps',coalesce((select jsonb_agg(s.body order by s.position)
  from related join public.time_tree_steps s using(occurrence) where s.user_id=p_user and not s.held),'[]'),
  'spends',coalesce((select jsonb_agg(body order by position desc) from public.time_tree_objects
    where user_id=p_user and collection='tomatoSpends' and event_day=any(p_days)),'[]'))
from public.time_tree_accounts a where a.user_id=p_user
$$;
