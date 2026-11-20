create extension if not exists pg_net with schema extensions;

create or replace function public.read_time_tree_scene(p_user uuid, p_today text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select public.read_time_tree_rows(p_user, false, (saved.day::date - 6)::text, (saved.day::date + 6)::text)
    || jsonb_build_object('historyMinutes', private.tree_history_minutes(p_user, saved.day))
  from (
    select coalesce(a.state->>'today', p_today) as day
    from public.time_tree_accounts a
    where a.user_id = p_user
  ) saved;
$$;

create function public.list_due_time_tree_owners(
  p_today text,
  p_weekly int,
  p_practice int,
  p_after uuid default null,
  p_limit int default 20
)
returns table(user_id uuid)
language sql stable security invoker set search_path = '' as $$
  select due.user_id
  from (
    select a.user_id
    from public.time_tree_accounts a
    left join private.time_tree_homework_revisions h using (user_id)
    where (p_after is null or a.user_id > p_after)
      and (
        coalesce(a.state->>'today', '') < p_today
        or a.applied_homework is distinct from coalesce(h.revision, 0)::text
        or (p_weekly is not null and a.state->>'weeklyScheduleVersion' is distinct from p_weekly::text)
        or (p_practice is not null and a.state->>'practiceScheduleVersion' is distinct from p_practice::text)
        or exists (
          select 1 from public.time_tree_steps s
          where s.user_id = a.user_id and s.finished_day < p_today
            and s.phase in ('awaiting_pop', 'flower')
        )
      )
    union all
    select t.user_id
    from public.task_homework t
    where t.enabled and (p_after is null or t.user_id > p_after)
      and not exists (select 1 from public.time_tree_accounts a where a.user_id = t.user_id)
    group by t.user_id
  ) due
  order by due.user_id
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.list_due_time_tree_owners(text, int, int, uuid, int) from public, anon, authenticated;
grant execute on function public.list_due_time_tree_owners(text, int, int, uuid, int) to service_role;

create function private.dispatch_time_tree_maintenance()
returns void language plpgsql security invoker set search_path = '' as $$
declare
  today text := to_char(now() at time zone 'Asia/Shanghai', 'YYYY-MM-DD');
  endpoint text;
  secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null
    or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return;
  end if;

  -- The app owns the schedule versions. A new Beijing date or changed homework revision
  -- wakes the worker, which also checks the current versions before processing each account.
  if not exists (select 1 from public.list_due_time_tree_owners(today, null, null, null, 1)) then
    return;
  end if;

  execute $vault$
    select max(decrypted_secret) filter (where name = 'time_tree_maintenance_url'),
           max(decrypted_secret) filter (where name = 'time_tree_maintenance_secret')
    from vault.decrypted_secrets
    where name in ('time_tree_maintenance_url', 'time_tree_maintenance_secret')
  $vault$ into endpoint, secret;
  if endpoint is null or endpoint !~ '^https://[^/?#[:space:]]+/api/internal/time-tree-maintenance$'
    or secret is null or btrim(secret) = '' then
    return;
  end if;

  execute $http$
    select net.http_post(
      url := $1,
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || $2),
      timeout_milliseconds := 50000
    )
  $http$ using endpoint, secret;
end;
$$;

revoke all on function private.dispatch_time_tree_maintenance() from public, anon, authenticated, service_role;

do $$ begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'Life tree maintenance requires pg_cron. Schedule private.dispatch_time_tree_maintenance() after enabling it.';
  else
    perform cron.schedule('time-tree-maintenance', '* * * * *', 'select private.dispatch_time_tree_maintenance()');
  end if;
end $$;

notify pgrst, 'reload schema';
