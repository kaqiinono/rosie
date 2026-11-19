-- Run manually under the migration owner with tree traffic drained.
begin;
set local lock_timeout = '5s';
lock table public.time_tree_accounts,public.time_tree_steps,public.time_tree_cursors,
  public.time_tree_objects,public.time_tree_receipts,public.time_tree_days,
  public.time_tree_gardens_legacy in access exclusive mode;

insert into public.time_tree_gardens_legacy(user_id,revision,garden)
select a.user_id,a.revision,public.read_time_tree_rows(a.user_id,true,null,null)->'tree'
from public.time_tree_accounts a
on conflict(user_id) do update set revision=excluded.revision,garden=excluded.garden;

do $$
begin
  if exists (
    select 1 from public.time_tree_accounts a full join public.time_tree_gardens_legacy g using(user_id)
    where a.revision is distinct from g.revision or
      g.garden is distinct from (public.read_time_tree_rows(a.user_id,true,null,null)->'tree')
  ) then raise exception 'tree rollback mismatch'; end if;
end $$;

revoke all on public.time_tree_accounts,public.time_tree_steps,public.time_tree_cursors,public.time_tree_objects,
  public.time_tree_receipts,public.time_tree_days from service_role;
alter table public.time_tree_gardens_legacy rename to time_tree_gardens;
grant select,insert,update on public.time_tree_gardens to service_role;
grant execute on function public.commit_time_tree(uuid,bigint,jsonb,text,uuid) to service_role;
create or replace function public.get_time_tree_sync_state(p_user uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('revision',(select revision::text from public.time_tree_gardens where user_id=p_user),
  'homeworkRevision',coalesce((select revision from private.time_tree_homework_revisions where user_id=p_user),0)::text)
$$;
notify pgrst,'reload schema';
commit;
