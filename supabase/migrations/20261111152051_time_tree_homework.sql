-- One versioned garden per child. Only the authenticated server route supplies owner and state.
create table public.time_tree_gardens (
  user_id uuid primary key references auth.users on delete cascade,
  revision bigint not null default 0,
  garden jsonb not null
);
alter table public.time_tree_gardens enable row level security;
revoke all on public.time_tree_gardens from public, anon, authenticated;
grant select, insert, update on public.time_tree_gardens to service_role;

alter table public.draw_pool_entries
  add column tree_eligible boolean not null default false,
  add column tree_ticket uuid unique;
create or replace function public.change_draw_pool(p_kind text, p_action text, p_name text default null, p_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  pool public.draw_pool_state;
  entry public.draw_pool_entries;
begin
  if owner_id is null or p_kind is null or p_kind not in ('reward','penalty') then
    raise exception 'invalid pool';
  end if;
  insert into public.draw_pool_state(user_id,kind) values(owner_id,p_kind) on conflict do nothing;
  select * into strict pool from public.draw_pool_state where user_id=owner_id and kind=p_kind for update;

  case p_action
  when 'add' then
    insert into public.draw_pool_entries(user_id,kind,name)
      values(owner_id,p_kind,regexp_replace(p_name,'^[[:space:]]+|[[:space:]]+$','','g')) returning * into entry;
  when 'tree_on', 'tree_off' then
    if p_kind <> 'reward' then raise exception 'invalid pool'; end if;
    update public.draw_pool_entries set tree_eligible = p_action = 'tree_on'
    where id=p_id and user_id=owner_id and kind='reward' and tree_ticket is null;
    if not found then raise exception 'draw_changed'; end if;
    return null;
  when 'delete' then
    if exists(select 1 from public.draw_pool_entries where id=p_id and user_id=owner_id and tree_ticket is not null)
    then raise exception 'draw_changed'; end if;
    delete from public.draw_pool_entries where user_id=owner_id and kind=p_kind and id=p_id;
    return null;
  when 'draw' then
    if pool.pending_id is not null then
      select * into strict entry from public.draw_pool_entries where id=pool.pending_id;
    else
      select * into entry from public.draw_pool_entries
        where user_id=owner_id and kind=p_kind and tree_ticket is null and accepted_round < pool.round_no order by random() limit 1;
      if not found and p_kind='penalty' then
        pool.round_no := pool.round_no + 1;
        select * into entry from public.draw_pool_entries where user_id=owner_id and kind=p_kind
          order by (id is not distinct from pool.last_id), random() limit 1;
      end if;
      if entry.id is null then return null; end if;
      pool.ticket := gen_random_uuid();
      update public.draw_pool_state set pending_id=entry.id,ticket=pool.ticket,round_no=pool.round_no
        where user_id=owner_id and kind=p_kind;
    end if;
  when 'accept' then
    if pool.pending_id is null or pool.ticket is distinct from p_id then raise exception 'draw_changed'; end if;
    update public.draw_pool_state set pending_id=null,ticket=null,last_id=pool.pending_id where user_id=owner_id and kind=p_kind;
    if p_kind='reward' then
      delete from public.draw_pool_entries where id=pool.pending_id;
    else
      update public.draw_pool_entries set accepted_round=pool.round_no where id=pool.pending_id;
    end if;
    return null;
  else raise exception 'invalid action';
  end case;
  return jsonb_build_object('id',entry.id,'kind',entry.kind,'name',entry.name,'ticket',pool.ticket);
end $$;
revoke all on function public.change_draw_pool(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.change_draw_pool(text,text,text,uuid) to authenticated;

-- Share the home draw's pool lock. Reserve/consume the prize and persist its tree ticket atomically.
create function public.commit_time_tree(p_user uuid, p_revision bigint, p_garden jsonb, p_action text, p_ticket uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  current_rev bigint;
  home_pending uuid;
  prize public.draw_pool_entries;
begin
  insert into public.time_tree_gardens(user_id,garden) values(p_user,'{}')
    on conflict do nothing;
  select revision into current_rev from public.time_tree_gardens where user_id=p_user for update;
  if current_rev <> p_revision then raise exception 'tree_changed'; end if;
  if p_action in ('openBox','acceptBox') then
    insert into public.draw_pool_state(user_id,kind) values(p_user,'reward') on conflict do nothing;
    select pending_id into home_pending from public.draw_pool_state where user_id=p_user and kind='reward' for update;
    if p_action='openBox' and p_garden->>'prize' is null then
      select * into prize from public.draw_pool_entries where user_id=p_user and kind='reward'
        and tree_eligible and tree_ticket is null and id is distinct from home_pending order by random() limit 1;
      if found then
        update public.draw_pool_entries set tree_ticket=gen_random_uuid() where id=prize.id returning * into prize;
        p_garden=jsonb_set(p_garden,'{prize}',jsonb_build_object('ticket',prize.tree_ticket,'name',prize.name));
      end if;
    elsif p_action='acceptBox' then
      delete from public.draw_pool_entries where user_id=p_user and kind='reward' and tree_ticket=p_ticket;
      if not found then raise exception 'draw_changed'; end if;
    end if;
  end if;
  update public.time_tree_gardens set garden=p_garden, revision=current_rev+1 where user_id=p_user;
  return jsonb_build_object('tree',p_garden,'revision',current_rev+1);
end $$;
revoke all on function public.commit_time_tree(uuid,bigint,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.commit_time_tree(uuid,bigint,jsonb,text,uuid) to service_role;
