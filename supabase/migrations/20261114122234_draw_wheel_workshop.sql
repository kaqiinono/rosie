-- Forward migration only. /draw and the life tree continue sharing the same catalog.
alter table public.draw_pool_entries
  add column emoji text not null default '🎁' check (char_length(emoji) between 1 and 24),
  add column color text not null default '#FF6B6B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  add column weight smallint not null default 1 check (weight between 1 and 3),
  add column enabled boolean not null default true,
  add column position integer not null default 0;
update public.draw_pool_entries set emoji='😜',color='#9B5DE5' where kind='penalty';

create table public.draw_wheel_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  revision bigint not null default 0,
  initialized boolean not null default false,
  preferences jsonb not null default '{"mode":"reward","soundOn":true,"voiceOn":false,"mysteryMode":false,"noRepeatMode":false}'
);
create table public.draw_wheel_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  entry_id uuid, -- Snapshot survives catalog deletion/reset.
  kind text not null check (kind in ('reward','penalty')),
  name text not null,
  emoji text not null,
  color text not null,
  weight smallint not null,
  probability numeric not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  cleared_at timestamptz
);
create index draw_wheel_history_owner_time on public.draw_wheel_history(user_id,created_at desc,id) where cleared_at is null;
create table public.draw_wheel_receipts (
  user_id uuid not null references auth.users on delete cascade,
  operation_id uuid not null,
  command jsonb not null,
  result jsonb,
  primary key(user_id,operation_id)
);
alter table public.draw_wheel_profiles enable row level security;
alter table public.draw_wheel_history enable row level security;
alter table public.draw_wheel_receipts enable row level security;
revoke all on public.draw_wheel_profiles,public.draw_wheel_history,public.draw_wheel_receipts from public,anon,authenticated;
grant all on public.draw_wheel_profiles,public.draw_wheel_history,public.draw_wheel_receipts to service_role;

-- Any writer, including the existing tree/manager, invalidates workshop snapshots.
create function public.bump_draw_wheel_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.draw_wheel_profiles(user_id,revision)
    values(coalesce(new.user_id,old.user_id),1)
    on conflict(user_id) do update set revision=public.draw_wheel_profiles.revision+1;
  return coalesce(new,old);
end $$;
revoke all on function public.bump_draw_wheel_revision() from public,anon,authenticated;
create trigger draw_wheel_catalog_revision after insert or update or delete on public.draw_pool_entries
  for each row execute function public.bump_draw_wheel_revision();

-- Keep pre-upgrade pending tickets redeemable without consuming their catalog entries.
insert into public.draw_wheel_history(id,user_id,entry_id,kind,name,emoji,color,weight,probability)
select s.ticket,s.user_id,e.id,e.kind,e.name,e.emoji,e.color,e.weight,0
from public.draw_pool_state s join public.draw_pool_entries e on e.id=s.pending_id
where s.ticket is not null;

create function public.draw_wheel_snapshot(p_user uuid) returns jsonb
language sql security invoker set search_path='' as $$
select jsonb_build_object(
  'revision',p.revision,'preferences',p.preferences,
  'entries',coalesce((select jsonb_agg(jsonb_build_object(
    'id',e.id,'text',e.name,'kind',e.kind,'emoji',e.emoji,'color',e.color,
    'weight',e.weight,'enabled',e.enabled,'position',e.position,
    'reserved',e.tree_ticket is not null or coalesce(s.pending_id=e.id,false),'treeEligible',e.tree_eligible
  ) order by e.position,e.id) from public.draw_pool_entries e
    left join public.draw_pool_state s on s.user_id=e.user_id and s.kind=e.kind
    where e.user_id=p_user),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(jsonb_build_object(
    'id',h.id,'entryId',h.entry_id,'mode',case when h.kind='reward' then 'reward' else 'punishment' end,
    'text',h.name,'emoji',h.emoji,'color',h.color,'weight',h.weight,
    'pct',round(h.probability,1),'done',h.done,'createdAt',h.created_at,
    'treeReserved',exists(select 1 from public.draw_pool_entries r where r.user_id=p_user and r.tree_ticket=h.id)
  ) order by h.created_at desc,h.id) from (select * from public.draw_wheel_history
    where user_id=p_user and cleared_at is null order by created_at desc,id limit 80) h),'[]'::jsonb)
) from public.draw_wheel_profiles p where p.user_id=p_user
$$;
revoke all on function public.draw_wheel_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.draw_wheel_snapshot(uuid) to service_role;

create function public.change_draw_workshop(
  p_user uuid,p_action text,p_kind text default 'reward',p_payload jsonb default '{}',
  p_revision bigint default null,p_operation uuid default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  profile public.draw_wheel_profiles;
  entry public.draw_pool_entries;
  history public.draw_wheel_history;
  receipt public.draw_wheel_receipts;
  item jsonb;
  result jsonb := null;
  command jsonb := jsonb_build_object('action',p_action,'kind',p_kind,'payload',p_payload);
  items jsonb;
  total_weight integer;
  target uuid;
  next_position integer;
  prefs jsonb;
begin
  if p_user is null or p_kind is null or p_kind not in ('reward','penalty') then raise exception 'invalid_request'; end if;
  -- Same pool row locks as commit_time_tree. Never lock profile ahead of a pool.
  insert into public.draw_pool_state(user_id,kind) values(p_user,'reward'),(p_user,'penalty') on conflict do nothing;
  perform 1 from public.draw_pool_state where user_id=p_user and kind='reward' for update;
  perform 1 from public.draw_pool_state where user_id=p_user and kind='penalty' for update;
  insert into public.draw_wheel_profiles(user_id) values(p_user) on conflict do nothing;
  select * into strict profile from public.draw_wheel_profiles where user_id=p_user for update;
  if p_action <> 'read' then
    if p_operation is null then raise exception 'invalid_request'; end if;
    select * into receipt from public.draw_wheel_receipts where user_id=p_user and operation_id=p_operation;
    if found then
      if receipt.command <> command then raise exception 'operation_conflict'; end if;
      return jsonb_build_object('snapshot',public.draw_wheel_snapshot(p_user),'result',receipt.result);
    end if;
    if p_revision is null or p_revision <> profile.revision then raise exception 'draw_changed'; end if;
  end if;

  case p_action
  when 'read' then
    -- Seed only on first use of a completely empty catalog; subsequent empty lists stay empty.
    if not profile.initialized then
      if not exists(select 1 from public.draw_pool_entries where user_id=p_user) then
        for item in select value from jsonb_array_elements(coalesce(p_payload->'defaults','[]')) loop
          insert into public.draw_pool_entries(user_id,kind,name,emoji,color,weight,position)
          values(p_user,item->>'kind',item->>'text',item->>'emoji',item->>'color',(item->>'weight')::smallint,(item->>'position')::integer);
        end loop;
      end if;
      update public.draw_wheel_profiles set initialized=true where user_id=p_user;
    end if;
  when 'preferences' then
    prefs := profile.preferences || p_payload;
    if prefs->>'mode' not in ('reward','punishment') or jsonb_typeof(prefs->'mode') <> 'string'
      or exists(select 1 from jsonb_each(prefs) kv where kv.key not in ('mode','soundOn','voiceOn','mysteryMode','noRepeatMode'))
      or exists(select 1 from unnest(array['soundOn','voiceOn','mysteryMode','noRepeatMode']) k where jsonb_typeof(prefs->k) is distinct from 'boolean')
    then raise exception 'invalid_request'; end if;
    update public.draw_wheel_profiles set preferences=prefs where user_id=p_user;
  when 'add' then
    if (select count(*) from public.draw_pool_entries where user_id=p_user and kind=p_kind) >= 100 then raise exception 'pool_full'; end if;
    select coalesce(max(position),0)+1 into next_position from public.draw_pool_entries where user_id=p_user and kind=p_kind;
    insert into public.draw_pool_entries(user_id,kind,name,emoji,color,weight,position)
    values(p_user,p_kind,btrim(p_payload->>'text'),p_payload->>'emoji',p_payload->>'color',(p_payload->>'weight')::smallint,next_position);
  when 'edit','delete' then
    target := (p_payload->>'id')::uuid;
    select * into entry from public.draw_pool_entries where user_id=p_user and kind=p_kind and id=target;
    if not found or entry.tree_ticket is not null or exists(select 1 from public.draw_pool_state where user_id=p_user and pending_id=target)
    then raise exception 'draw_reserved'; end if;
    if p_action='delete' then
      delete from public.draw_pool_entries where id=target and user_id=p_user;
    else
      update public.draw_pool_entries set
        name=coalesce(btrim(p_payload->>'text'),name),emoji=coalesce(p_payload->>'emoji',emoji),
        color=coalesce(p_payload->>'color',color),weight=coalesce((p_payload->>'weight')::smallint,weight),
        enabled=coalesce((p_payload->>'enabled')::boolean,enabled)
      where id=target and user_id=p_user;
    end if;
  when 'shuffle' then
    with ordered as (select id,row_number() over(order by random()) as pos from public.draw_pool_entries where user_id=p_user and kind=p_kind)
    update public.draw_pool_entries e set position=o.pos from ordered o where e.id=o.id;
  when 'enableAll' then
    update public.draw_pool_entries e set enabled=true where user_id=p_user and kind=p_kind and tree_ticket is null
      and not exists(select 1 from public.draw_pool_state s where s.user_id=p_user and s.pending_id=e.id);
  when 'reset' then
    if exists(select 1 from public.draw_pool_entries e where user_id=p_user and kind=p_kind and
      (tree_ticket is not null or exists(select 1 from public.draw_pool_state s where s.user_id=p_user and s.pending_id=e.id)))
    then raise exception 'draw_reserved'; end if;
    delete from public.draw_pool_entries where user_id=p_user and kind=p_kind;
    for item in select value from jsonb_array_elements(p_payload->'defaults') loop
      insert into public.draw_pool_entries(user_id,kind,name,emoji,color,weight,position)
      values(p_user,p_kind,item->>'text',item->>'emoji',item->>'color',(item->>'weight')::smallint,(item->>'position')::integer);
    end loop;
  when 'draw' then
    select sum(e.weight),jsonb_agg(jsonb_build_object('id',e.id,'text',e.name,'emoji',e.emoji,'color',e.color,'weight',e.weight,'enabled',true) order by e.position,e.id)
    into total_weight,items from public.draw_pool_entries e where user_id=p_user and kind=p_kind and enabled and tree_ticket is null
      and not exists(select 1 from public.draw_pool_state s where s.user_id=p_user and s.pending_id=e.id);
    if coalesce(total_weight,0)=0 then raise exception 'pool_empty'; end if;
    -- Exponential race gives exact weight / sum(weight) selection probabilities.
    select * into entry from public.draw_pool_entries e where user_id=p_user and kind=p_kind and enabled and tree_ticket is null
      and not exists(select 1 from public.draw_pool_state s where s.user_id=p_user and s.pending_id=e.id)
      order by -ln(greatest(random(),1e-15))/weight limit 1;
    insert into public.draw_wheel_history(user_id,entry_id,kind,name,emoji,color,weight,probability)
      values(p_user,entry.id,p_kind,entry.name,entry.emoji,entry.color,entry.weight,100.0*entry.weight/total_weight) returning * into history;
    if (profile.preferences->>'noRepeatMode')::boolean then
      update public.draw_pool_entries set enabled=false where id=entry.id;
    end if;
    result := jsonb_build_object('id',history.id,'entryId',entry.id,'mode',case when p_kind='reward' then 'reward' else 'punishment' end,
      'text',entry.name,'emoji',entry.emoji,'pct',round(history.probability,1),'done',false,'createdAt',history.created_at,'items',items);
  when 'stamp' then
    target := (p_payload->>'id')::uuid;
    if exists(select 1 from public.draw_pool_entries where user_id=p_user and tree_ticket=target) then raise exception 'draw_reserved'; end if;
    update public.draw_wheel_history set done=(p_payload->>'done')::boolean where user_id=p_user and id=target and cleared_at is null;
    if not found then raise exception 'draw_changed'; end if;
    -- Release legacy pending tickets on first fulfilment; undoing a stamp never reserves again.
    if (p_payload->>'done')::boolean then
      update public.draw_pool_state set pending_id=null,ticket=null where user_id=p_user and ticket=target;
    end if;
  when 'clearHistory' then
    if exists(select 1 from public.draw_pool_state where user_id=p_user and pending_id is not null) then raise exception 'draw_reserved'; end if;
    update public.draw_wheel_history set cleared_at=now() where user_id=p_user and cleared_at is null;
  else raise exception 'invalid_request';
  end case;
  if p_action <> 'read' then
    update public.draw_wheel_profiles set revision=revision+1 where user_id=p_user;
    insert into public.draw_wheel_receipts(user_id,operation_id,command,result) values(p_user,p_operation,command,result);
  end if;
  return jsonb_build_object('snapshot',public.draw_wheel_snapshot(p_user),'result',result);
end $$;
revoke all on function public.change_draw_workshop(uuid,text,text,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function public.change_draw_workshop(uuid,text,text,jsonb,bigint,uuid) to service_role;

-- Preserve the old client RPC signature while adopting repeatable shared entries.
create or replace function public.change_draw_pool(p_kind text,p_action text,p_name text default null,p_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid := auth.uid();
  entry public.draw_pool_entries;
  pool public.draw_pool_state;
  response jsonb;
  rev bigint;
begin
  if owner_id is null or p_kind is null or p_kind not in ('reward','penalty') then raise exception 'invalid pool'; end if;
  -- Workshop acquires both pool locks, including for legacy callers.
  response := public.change_draw_workshop(owner_id,'read',p_kind);
  select revision into rev from public.draw_wheel_profiles where user_id=owner_id;
  select * into pool from public.draw_pool_state where user_id=owner_id and kind=p_kind;
  case p_action
  when 'draw' then
    if pool.pending_id is not null then
      select * into entry from public.draw_pool_entries where id=pool.pending_id;
    else
      begin
        response := public.change_draw_workshop(owner_id,'draw',p_kind,'{}',rev,gen_random_uuid());
      exception when raise_exception then
        if sqlerrm='pool_empty' then return null; else raise; end if;
      end;
      select * into entry from public.draw_pool_entries where id=(response->'result'->>'entryId')::uuid;
      pool.ticket := (response->'result'->>'id')::uuid;
      update public.draw_pool_state set pending_id=entry.id,ticket=pool.ticket where user_id=owner_id and kind=p_kind;
    end if;
    return jsonb_build_object('id',entry.id,'kind',entry.kind,'name',entry.name,'ticket',pool.ticket);
  when 'accept' then
    -- Idempotent ticket fulfilment; never delete the shared catalog item.
    if exists(select 1 from public.draw_pool_entries where user_id=owner_id and tree_ticket=p_id) then raise exception 'draw_changed'; end if;
    update public.draw_wheel_history set done=true where user_id=owner_id and kind=p_kind and id=p_id;
    if not found then raise exception 'draw_changed'; end if;
    update public.draw_pool_state set pending_id=null,ticket=null where user_id=owner_id and kind=p_kind and ticket=p_id;
    update public.draw_wheel_profiles set revision=revision+1 where user_id=owner_id;
  when 'add' then
    perform public.change_draw_workshop(owner_id,'add',p_kind,jsonb_build_object('text',p_name,'emoji',case when p_kind='reward' then '🎁' else '😜' end,'color',case when p_kind='reward' then '#FF6B6B' else '#9B5DE5' end,'weight',1),rev,gen_random_uuid());
    select * into entry from public.draw_pool_entries where user_id=owner_id and kind=p_kind and name=btrim(p_name);
    return jsonb_build_object('id',entry.id,'kind',entry.kind,'name',entry.name,'tree_eligible',entry.tree_eligible);
  when 'delete' then
    perform public.change_draw_workshop(owner_id,'delete',p_kind,jsonb_build_object('id',p_id),rev,gen_random_uuid());
  when 'tree_on','tree_off' then
    if p_kind <> 'reward' then raise exception 'invalid pool'; end if;
    update public.draw_pool_entries set tree_eligible=p_action='tree_on' where user_id=owner_id and kind=p_kind and id=p_id and tree_ticket is null;
    if not found then raise exception 'draw_changed'; end if;
  else raise exception 'invalid action';
  end case;
  return null;
end $$;
revoke all on function public.change_draw_pool(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.change_draw_pool(text,text,text,uuid) to authenticated;

-- Life-tree redemption releases its reservation instead of deleting the prize.
create or replace function public.commit_time_tree(p_user uuid, p_revision bigint, p_garden jsonb, p_action text, p_ticket uuid default null)
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
        and tree_eligible and enabled and tree_ticket is null and id is distinct from home_pending order by -ln(greatest(random(),1e-15))/weight limit 1;
      if found then
        update public.draw_pool_entries set tree_ticket=gen_random_uuid() where id=prize.id returning * into prize;
        insert into public.draw_wheel_history(id,user_id,entry_id,kind,name,emoji,color,weight,probability)
        select prize.tree_ticket,p_user,prize.id,'reward',prize.name,prize.emoji,prize.color,prize.weight,
          100.0*prize.weight/sum(e.weight) from public.draw_pool_entries e
          where e.user_id=p_user and e.kind='reward' and e.tree_eligible and e.enabled
            and (e.tree_ticket is null or e.id=prize.id) and e.id is distinct from home_pending;
        update public.draw_pool_entries set enabled=false where id=prize.id
          and coalesce((select (preferences->>'noRepeatMode')::boolean from public.draw_wheel_profiles where user_id=p_user),false);
        p_garden=jsonb_set(p_garden,'{prize}',jsonb_build_object('ticket',prize.tree_ticket,'name',prize.name));
      end if;
    elsif p_action='acceptBox' then
      update public.draw_pool_entries set tree_ticket=null where user_id=p_user and kind='reward' and tree_ticket=p_ticket;
      if not found then raise exception 'draw_changed'; end if;
      update public.draw_wheel_history set done=true where user_id=p_user and id=p_ticket;
    end if;
  end if;
  update public.time_tree_gardens set garden=p_garden, revision=current_rev+1 where user_id=p_user;
  return jsonb_build_object('tree',p_garden,'revision',current_rev+1);
end $$;
revoke all on function public.commit_time_tree(uuid,bigint,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.commit_time_tree(uuid,bigint,jsonb,text,uuid) to service_role;
