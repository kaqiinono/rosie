create table public.draw_pool_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('reward','penalty')),
  name text not null check (char_length(name) between 1 and 100),
  accepted_round bigint not null default 0,
  unique (user_id, kind, name)
);

create table public.draw_pool_state (
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('reward','penalty')),
  round_no bigint not null default 1,
  last_id uuid,
  pending_id uuid references public.draw_pool_entries on delete set null,
  ticket uuid,
  primary key (user_id, kind)
);

alter table public.draw_pool_entries enable row level security;
alter table public.draw_pool_state enable row level security;
revoke all on public.draw_pool_entries, public.draw_pool_state from public, anon, authenticated;
grant select on public.draw_pool_entries to authenticated;
create policy read_own_entries on public.draw_pool_entries for select to authenticated using (user_id = (select auth.uid()));

-- All writes take the same owner/pool row lock. A fresh ticket distinguishes
-- separate draws of the same penalty, even with just one entry in the pool.
create function public.change_draw_pool(p_kind text, p_action text, p_name text default null, p_id uuid default null)
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
  when 'delete' then
    delete from public.draw_pool_entries where user_id=owner_id and kind=p_kind and id=p_id;
    return null;
  when 'draw' then
    if pool.pending_id is not null then
      select * into strict entry from public.draw_pool_entries where id=pool.pending_id;
    else
      select * into entry from public.draw_pool_entries
        where user_id=owner_id and kind=p_kind and accepted_round < pool.round_no order by random() limit 1;
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
