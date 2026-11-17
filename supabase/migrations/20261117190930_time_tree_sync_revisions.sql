set local lock_timeout = '3s';

create table private.time_tree_homework_revisions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0)
);
alter table private.time_tree_homework_revisions enable row level security;
revoke all on private.time_tree_homework_revisions from public, anon, authenticated, service_role;
grant select on private.time_tree_homework_revisions to service_role;

create function private.bump_time_tree_homework_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  previous_owner uuid;
  next_owner uuid;
begin
  if tg_op <> 'INSERT' then previous_owner := old.user_id; end if;
  if tg_op <> 'DELETE' then next_owner := new.user_id; end if;

  -- Skip an owner being deleted by an auth.users cascade.
  insert into private.time_tree_homework_revisions as versions (user_id)
  select account.id from auth.users as account
  where account.id in (previous_owner, next_owner)
  order by account.id
  on conflict (user_id) do update set revision = versions.revision + 1;
  return null;
end $$;
revoke all on function private.bump_time_tree_homework_revision() from public, anon, authenticated, service_role;

create trigger task_homework_time_tree_revision
after insert or update or delete on public.task_homework
for each row execute function private.bump_time_tree_homework_revision();

create function public.get_time_tree_sync_state(p_user uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'revision', (select revision::text from public.time_tree_gardens where user_id = p_user),
    'homeworkRevision', coalesce((select revision from private.time_tree_homework_revisions where user_id = p_user), 0)::text
  );
$$;
revoke all on function public.get_time_tree_sync_state(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_time_tree_sync_state(uuid) to service_role;

notify pgrst, 'reload schema';
