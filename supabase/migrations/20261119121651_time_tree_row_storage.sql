set local lock_timeout = '5s';
lock table public.time_tree_gardens in access exclusive mode;
alter table public.time_tree_gardens rename to time_tree_gardens_legacy;
revoke all on public.time_tree_gardens_legacy from service_role;
revoke execute on function public.commit_time_tree(uuid,bigint,jsonb,text,uuid) from service_role;

create table public.time_tree_accounts (
  user_id uuid primary key references auth.users on delete cascade,
  revision bigint not null default 0,
  applied_homework text,
  state jsonb not null
);
create table public.time_tree_cursors (
  user_id uuid not null references public.time_tree_accounts on delete cascade,
  collection text not null check(collection in ('practiceProgress','mathQuestionProgress')),
  binding_key text not null,
  body jsonb not null,
  primary key(user_id,collection,binding_key)
);
alter table public.time_tree_cursors enable row level security;
revoke all on public.time_tree_cursors from public,anon,authenticated;
grant select,insert,update,delete on public.time_tree_cursors to service_role;
create table public.time_tree_steps (
  user_id uuid not null references public.time_tree_accounts on delete cascade,
  step_id text not null,
  body jsonb not null,
  held boolean not null default false,
  version bigint not null,
  position bigint generated always as identity,
  occurrence text generated always as (body->>'occurrence') stored,
  display_day text generated always as (coalesce(body->>'planned',body->>'scheduled')) stored,
  finished_day text,
  started_day text,
  phase text generated always as (case
    when held then 'held'
    when (body->>'skipped')::boolean then 'skipped'
    when (body->>'settled')::boolean then 'settled'
    when body->>'end' is not null then case when (body->>'popped')::boolean then 'flower' else 'awaiting_pop' end
    when body->>'start' is not null then 'running'
    else 'pending' end) stored,
  primary key(user_id,step_id),
  check(step_id=body->>'id')
);
create function private.tree_set_finished_day() returns trigger language plpgsql set search_path='' as $$
begin
  new.started_day := to_char((new.body->>'start')::timestamptz at time zone 'Asia/Shanghai','YYYY-MM-DD');
  new.finished_day := case when length(new.body->>'end')=10 then new.body->>'end'
    else to_char((new.body->>'end')::timestamptz at time zone 'Asia/Shanghai','YYYY-MM-DD') end;
  return new;
end $$;
create trigger time_tree_step_date before insert or update of body on public.time_tree_steps
for each row execute function private.tree_set_finished_day();
create index tree_steps_day on public.time_tree_steps(user_id,display_day,step_id);
create index tree_steps_finish on public.time_tree_steps(user_id,finished_day) where finished_day is not null;
create index tree_steps_active on public.time_tree_steps(user_id,occurrence) where phase in ('pending','running','awaiting_pop','flower');
create index tree_steps_held on public.time_tree_steps(user_id,display_day) where held;
create index tree_steps_occurrence on public.time_tree_steps(user_id,occurrence);
create index tree_steps_cycle_day on public.time_tree_steps(user_id,split_part(occurrence,'/',3));
create index tree_steps_interval on public.time_tree_steps(user_id,finished_day,started_day) where started_day is not null;
create table public.time_tree_objects (
  user_id uuid not null references public.time_tree_accounts on delete cascade,
  collection text not null check(collection in ('apples','diary','tomatoSpends')),
  object_id text not null,
  position bigint generated always as identity,
  event_day text,
  body jsonb not null,
  primary key(user_id,collection,object_id)
);
create index tree_objects_page on public.time_tree_objects(user_id,collection,position desc);
create index tree_objects_day on public.time_tree_objects(user_id,event_day) where collection='tomatoSpends';
create function private.tree_set_event_day() returns trigger language plpgsql set search_path='' as $$
begin
  new.event_day := to_char((new.body->>'t')::timestamptz at time zone 'Asia/Shanghai','YYYY-MM-DD');
  return new;
end $$;
create trigger time_tree_object_date before insert or update of body on public.time_tree_objects
for each row execute function private.tree_set_event_day();
create table public.time_tree_receipts (
  user_id uuid not null references public.time_tree_accounts on delete cascade,
  operation_id uuid not null,
  command_hash bytea not null,
  revision bigint not null,
  delta jsonb,
  created_at timestamptz not null default now(),
  primary key(user_id,operation_id),
  unique(user_id,revision)
);
alter table public.time_tree_accounts enable row level security;
alter table public.time_tree_steps enable row level security;
alter table public.time_tree_objects enable row level security;
alter table public.time_tree_receipts enable row level security;
revoke all on public.time_tree_accounts,public.time_tree_steps,public.time_tree_objects,public.time_tree_receipts from public,anon,authenticated;
grant select,insert,update,delete on public.time_tree_accounts,public.time_tree_steps,public.time_tree_objects,public.time_tree_receipts to service_role;
grant usage on sequence public.time_tree_steps_position_seq,public.time_tree_objects_position_seq to service_role;

insert into public.time_tree_accounts(user_id,revision,state)
select user_id,revision,garden - array['steps','weekendExcludedSteps','apples','diary','tomatoSpends']
from public.time_tree_gardens_legacy;
insert into public.time_tree_cursors(user_id,collection,binding_key,body)
select user_id,name,key,value from public.time_tree_accounts cross join unnest(array['practiceProgress','mathQuestionProgress']) name
cross join lateral jsonb_each(state->name);
update public.time_tree_accounts set state=state || jsonb_strip_nulls(jsonb_build_object(
  'practiceProgress',case when state?'practiceProgress' then '{}'::jsonb end,
  'mathQuestionProgress',case when state?'mathQuestionProgress' then '{}'::jsonb end));
insert into public.time_tree_steps(user_id,step_id,body,held,version)
select legacy.user_id,item->>'id',item,collection='weekendExcludedSteps',legacy.revision
from public.time_tree_gardens_legacy legacy cross join unnest(array['steps','weekendExcludedSteps']) collection
cross join lateral jsonb_array_elements(legacy.garden->collection) with ordinality as records(item,ordinal)
order by legacy.user_id,collection,ordinal;
insert into public.time_tree_objects(user_id,collection,object_id,body)
select legacy.user_id,collection,item->>'id',item
from public.time_tree_gardens_legacy legacy cross join unnest(array['apples','diary','tomatoSpends']) collection
cross join lateral jsonb_array_elements(legacy.garden->collection) with ordinality as records(item,ordinal)
order by legacy.user_id,collection,case when collection='apples' then ordinal else -ordinal end;

create function public.read_time_tree_rows(p_user uuid,p_full boolean,p_from text,p_through text,p_ids text[] default '{}',
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
revoke all on function public.read_time_tree_rows(uuid,boolean,text,text,text[],text) from public,anon,authenticated;
grant execute on function public.read_time_tree_rows(uuid,boolean,text,text,text[],text) to service_role;

do $$
declare legacy record; rebuilt jsonb; field text;
begin
  for legacy in select * from public.time_tree_gardens_legacy loop
    rebuilt := public.read_time_tree_rows(legacy.user_id,true,null,null)->'tree';
    foreach field in array array['steps','weekendExcludedSteps','apples','diary','tomatoSpends'] loop
      if not (legacy.garden ? field) and rebuilt->field='[]'::jsonb then rebuilt := rebuilt-field; end if;
    end loop;
    if rebuilt is distinct from legacy.garden then raise exception 'tree backfill mismatch'; end if;
  end loop;
end $$;

create or replace function public.get_time_tree_sync_state(p_user uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('revision',(select revision::text from public.time_tree_accounts where user_id=p_user),
  'appliedHomework',(select applied_homework from public.time_tree_accounts where user_id=p_user),
  'homeworkRevision',coalesce((select revision from private.time_tree_homework_revisions where user_id=p_user),0)::text);
$$;

create function private.tree_draw(p_user uuid,p_action text,p_ticket uuid,p_garden jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  home_pending uuid;
  prize public.draw_pool_entries;
  tomato_box_cost bigint;
  tomato_spent bigint;
begin
  if p_action in ('openBox','openTomatoBox','acceptBox') then
    insert into public.draw_pool_state(user_id,kind) values(p_user,'reward') on conflict do nothing;
    select pending_id into home_pending from public.draw_pool_state where user_id=p_user and kind='reward' for update;
    if p_action in ('openBox','openTomatoBox') and p_garden->>'prize' is null then
      if p_action='openTomatoBox' then
        tomato_box_cost := coalesce((p_garden #>> '{rules,tomatoPrices,box}')::bigint,100);
        if tomato_box_cost not between 1 and 9007199254740991 then
          raise exception 'tomato_price_invalid';
        end if;
        tomato_spent := (p_garden #>> '{tomatoWallet,spent}')::bigint;
        if tomato_spent is null or coalesce((p_garden #>> '{tomatoWallet,earned}')::bigint,0) - tomato_spent < tomato_box_cost then
          raise exception 'tomatoes_short';
        end if;
      end if;

      select * into prize from public.draw_pool_entries where user_id=p_user and kind='reward'
        and tree_eligible and enabled and tree_ticket is null and id is distinct from home_pending
        order by -ln(greatest(random(),1e-15))/weight limit 1;
      if found then
        update public.draw_pool_entries set tree_ticket=gen_random_uuid() where id=prize.id returning * into prize;
        insert into public.draw_wheel_history(id,user_id,entry_id,kind,name,emoji,color,weight,probability)
        select prize.tree_ticket,p_user,prize.id,'reward',prize.name,prize.emoji,prize.color,prize.weight,
          100.0*prize.weight/sum(e.weight) from public.draw_pool_entries e
          where e.user_id=p_user and e.kind='reward' and e.tree_eligible and e.enabled
            and (e.tree_ticket is null or e.id=prize.id) and e.id is distinct from home_pending;
        update public.draw_pool_entries set enabled=false where id=prize.id
          and coalesce((select (preferences->>'noRepeatMode')::boolean from public.draw_wheel_profiles where user_id=p_user),false);
        p_garden := jsonb_set(p_garden,'{prize}',jsonb_build_object('ticket',prize.tree_ticket,'name',prize.name));

        if p_action='openTomatoBox' then
          p_garden := jsonb_set(p_garden,'{prize,source}',to_jsonb('tomato'::text));
          p_garden := jsonb_set(p_garden,'{tomatoWallet,spent}',to_jsonb(tomato_spent + tomato_box_cost));
          p_garden := jsonb_set(p_garden,'{tomatoSpends}',
            jsonb_build_array(jsonb_build_object(
              'id',prize.tree_ticket,'t',now(),'kind','box','prize',prize.name,'amount',tomato_box_cost
            )) || coalesce(p_garden->'tomatoSpends','[]'::jsonb));
        end if;
      end if;
    elsif p_action='acceptBox' then
      update public.draw_pool_entries set tree_ticket=null where user_id=p_user and kind='reward' and tree_ticket=p_ticket;
      if not found then raise exception 'draw_changed'; end if;
      update public.draw_wheel_history set done=true where user_id=p_user and id=p_ticket;
    end if;
  end if;
  return p_garden;
end $$;

create function public.commit_time_tree_rows(p_user uuid,p_base bigint,p_operation uuid,p_command jsonb,p_delta jsonb,p_homework text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  account public.time_tree_accounts;
  prior public.time_tree_receipts;
  next_state jsonb;
  drawn jsonb;
  spend jsonb;
  name text;
  changes jsonb;
  changed_rev bigint;
  affected_days text[];
begin
  insert into public.time_tree_accounts(user_id,state) values(p_user,'{}') on conflict do nothing;
  select * into strict account from public.time_tree_accounts where user_id=p_user for update;
  select * into prior from public.time_tree_receipts where user_id=p_user and operation_id=p_operation;
  if found then
    if prior.command_hash<>sha256(convert_to(p_command::text,'UTF8')) then raise exception 'operation_mismatch'; end if;
    return jsonb_build_object('baseRevision',prior.revision-1,'revision',prior.revision,'delta',prior.delta);
  end if;
  if account.revision<>p_base then raise exception 'tree_changed'; end if;
  changed_rev := account.revision+1;
  next_state := (account.state - array(select jsonb_array_elements_text(p_delta->'unset'))) || (p_delta->'state');
  if p_command->>'kind' in ('openBox','openTomatoBox','acceptBox') then
    drawn := private.tree_draw(p_user,p_command->>'kind',case when p_command->>'kind'='acceptBox' then (p_command->>'id')::uuid end,next_state);
    spend := drawn#>'{tomatoSpends,0}';
    if spend is not null then
      p_delta := jsonb_set(p_delta,'{tomatoSpends,put}',jsonb_build_array(spend) || (p_delta#>'{tomatoSpends,put}'));
    end if;
    next_state := drawn-'tomatoSpends';
    p_delta := jsonb_set(p_delta,'{state}',(p_delta->'state') || jsonb_build_object('prize',next_state->'prize','tomatoWallet',next_state->'tomatoWallet'));
  end if;
  select array_agg(distinct day) into affected_days from (
    select body->>'planned' as day from public.time_tree_steps where user_id=p_user and step_id in (
      select jsonb_array_elements_text(p_delta->'removed')
      union all select item->>'id' from jsonb_array_elements((p_delta->'steps')||(p_delta->'held')) item)
    union all select item->>'planned' from jsonb_array_elements(p_delta->'steps') item
  ) days where day < ((next_state->>'today')::date-6)::text;
  delete from public.time_tree_steps where user_id=p_user and step_id in (select jsonb_array_elements_text(p_delta->'removed'));
  insert into public.time_tree_steps(user_id,step_id,body,held,version)
  select p_user,item->>'id',item,source='held',changed_rev from unnest(array['steps','held']) source
  cross join lateral jsonb_array_elements(p_delta->source) item
  on conflict(user_id,step_id) do update set body=excluded.body,held=excluded.held,version=excluded.version;
  update public.time_tree_steps s set body=s.body || (patch-'id'),version=changed_rev
  from jsonb_array_elements(p_delta->'stepFields') patch where s.user_id=p_user and s.step_id=patch->>'id';
  foreach name in array array['apples','diary','tomatoSpends'] loop
    changes := p_delta->name;
    delete from public.time_tree_objects where user_id=p_user and collection=name
      and object_id in (select jsonb_array_elements_text(changes->'remove'));
    insert into public.time_tree_objects(user_id,collection,object_id,body)
    select p_user,name,item->>'id',item from jsonb_array_elements(changes->'put') with ordinality as records(item,ordinal)
    order by case when name='apples' then ordinal else -ordinal end
    on conflict(user_id,collection,object_id) do update set body=excluded.body;
  end loop;
  foreach name in array array['practiceProgress','mathQuestionProgress'] loop
    changes := p_delta->'cursors'->name;
    if changes is null then continue; end if;
    delete from public.time_tree_cursors where user_id=p_user and collection=name and binding_key in
      (select jsonb_array_elements_text(changes->'remove'));
    insert into public.time_tree_cursors(user_id,collection,binding_key,body)
    select p_user,name,key,value from jsonb_each(changes->'put')
    on conflict(user_id,collection,binding_key) do update set body=excluded.body;
  end loop;
  update public.time_tree_accounts set state=next_state,revision=changed_rev,
    applied_homework=coalesce(p_homework,applied_homework) where user_id=p_user;
  if affected_days is not null then
    p_delta := p_delta || jsonb_build_object('historyMinutes',(select jsonb_object_agg(day,
      jsonb_build_object('completed',done_minutes,'total',planned_minutes))
      from public.time_tree_days where user_id=p_user and day=any(affected_days)));
  end if;
  insert into public.time_tree_receipts(user_id,operation_id,command_hash,revision,delta)
  values(p_user,p_operation,sha256(convert_to(p_command::text,'UTF8')),changed_rev,p_delta);
  update public.time_tree_receipts set delta=null where user_id=p_user and revision=changed_rev-128;
  return jsonb_build_object('baseRevision',p_base,'revision',changed_rev,'delta',p_delta);
end $$;
revoke all on function private.tree_draw(uuid,text,uuid,jsonb),public.commit_time_tree_rows(uuid,bigint,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function private.tree_draw(uuid,text,uuid,jsonb),public.commit_time_tree_rows(uuid,bigint,uuid,jsonb,jsonb,text) to service_role;

create table public.time_tree_days (
  user_id uuid not null references public.time_tree_accounts on delete cascade,
  day text not null,
  completed integer not null default 0,
  required integer not null default 0,
  required_open integer not null default 0,
  planned_minutes bigint not null default 0,
  done_minutes bigint not null default 0,
  primary key(user_id,day)
);
alter table public.time_tree_days enable row level security;
revoke all on public.time_tree_days from public,anon,authenticated;
grant select,insert,update,delete on public.time_tree_days to service_role;

create function private.tree_day_effect(p_step public.time_tree_steps,p_sign integer)
returns void language plpgsql security invoker set search_path='' as $$
declare
  step jsonb := p_step.body;
  planned text := step->>'planned';
  weekly boolean := split_part(p_step.occurrence,'/',2)='weekly' and split_part(p_step.occurrence,'/',4)='week';
  required_count integer := case when not weekly and step->>'priority' in ('P0','P1') then p_sign else 0 end;
  minutes bigint := case when weekly then 0 else (step->>'minutes')::bigint*p_sign end;
begin
  if p_step.held or (p_sign < 0 and not exists(select 1 from public.time_tree_accounts where user_id=p_step.user_id)) then return; end if;
  if p_step.finished_day is not null then
    insert into public.time_tree_days as d(user_id,day,completed) values(p_step.user_id,p_step.finished_day,p_sign)
    on conflict(user_id,day) do update set completed=d.completed+excluded.completed;
  end if;
  if planned is not null and not coalesce((step->>'skipped')::boolean,false) then
    insert into public.time_tree_days as d(user_id,day,required,required_open,planned_minutes,done_minutes)
    values(p_step.user_id,planned,required_count,case when p_step.finished_day is null then required_count else 0 end,
      minutes,case when p_step.finished_day is null then 0 else minutes end)
    on conflict(user_id,day) do update set required=d.required+excluded.required,required_open=d.required_open+excluded.required_open,
      planned_minutes=d.planned_minutes+excluded.planned_minutes,done_minutes=d.done_minutes+excluded.done_minutes;
  end if;
end $$;
create function private.tree_update_days() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' and (old.held,old.finished_day,old.occurrence,old.body->>'planned',
      old.body->>'skipped',old.body->>'priority',old.body->>'minutes') is not distinct from
      (new.held,new.finished_day,new.occurrence,new.body->>'planned',
      new.body->>'skipped',new.body->>'priority',new.body->>'minutes') then return null; end if;
  if tg_op<>'INSERT' then perform private.tree_day_effect(old,-1); end if;
  if tg_op<>'DELETE' then perform private.tree_day_effect(new,1); end if;
  return null;
end $$;
do $$ begin perform private.tree_day_effect(s,1) from public.time_tree_steps s; end $$;
create trigger tree_update_days after insert or update or delete on public.time_tree_steps
for each row execute function private.tree_update_days();
revoke all on function private.tree_day_effect(public.time_tree_steps,integer),private.tree_update_days() from public,anon,authenticated;
grant execute on function private.tree_day_effect(public.time_tree_steps,integer),private.tree_update_days() to service_role;

create function public.read_time_tree_history(p_user uuid,p_days text[])
returns jsonb language sql stable security invoker set search_path='' as $$
with groups as (
  select occurrence from public.time_tree_steps where user_id=p_user and display_day=any(p_days)
  union select occurrence from public.time_tree_steps where user_id=p_user and finished_day=any(p_days)
  union select s.occurrence from unnest(p_days) day join public.time_tree_steps s
    on s.user_id=p_user and s.started_day<=day and s.finished_day>day
)
select jsonb_build_object('revision',a.revision,'steps',coalesce((select jsonb_agg(s.body order by s.position)
  from groups join public.time_tree_steps s using(occurrence) where s.user_id=p_user and not s.held),'[]'),
  'spends',coalesce((select jsonb_agg(body order by position desc) from public.time_tree_objects
    where user_id=p_user and collection='tomatoSpends' and event_day=any(p_days)),'[]'))
from public.time_tree_accounts a where a.user_id=p_user
$$;
revoke all on function public.read_time_tree_history(uuid,text[]) from public,anon,authenticated;
grant execute on function public.read_time_tree_history(uuid,text[]) to service_role;

create function private.tree_history_minutes(p_user uuid,p_today text)
returns jsonb language sql stable security invoker set search_path='' as $$
with visible_days as (
  select distinct display_day as day from public.time_tree_steps where user_id=p_user and phase in ('pending','running','awaiting_pop','flower')
  union select body->>'dateKey' from public.time_tree_objects where user_id=p_user and collection='apples'
)
select coalesce(jsonb_object_agg(d.day,jsonb_build_object('completed',d.done_minutes,'total',d.planned_minutes)),'{}')
from visible_days join public.time_tree_days d using(day) where d.user_id=p_user and d.day<(p_today::date-6)::text
$$;
revoke all on function private.tree_history_minutes(uuid,text) from public,anon,authenticated;
grant execute on function private.tree_history_minutes(uuid,text) to service_role;
create function public.read_time_tree_scene(p_user uuid,p_today text)
returns jsonb language sql stable security invoker set search_path='' as $$
select public.read_time_tree_rows(p_user,false,(p_today::date-6)::text,(p_today::date+6)::text)
  || jsonb_build_object('historyMinutes',private.tree_history_minutes(p_user,p_today))
$$;
revoke all on function public.read_time_tree_scene(uuid,text) from public,anon,authenticated;
grant execute on function public.read_time_tree_scene(uuid,text) to service_role;

create function public.pop_time_tree_step(p_user uuid,p_id text,p_operation uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  account public.time_tree_accounts;
  step public.time_tree_steps;
  prior public.time_tree_receipts;
  summary public.time_tree_days;
  command jsonb := jsonb_build_object('kind','pop','id',p_id);
  today text := to_char(now() at time zone 'Asia/Shanghai','YYYY-MM-DD');
  body jsonb;
  patch jsonb := '{}';
  notes jsonb := '[]';
  expired_notes jsonb;
  water integer;
  must_done integer;
  delta jsonb;
begin
  select * into account from public.time_tree_accounts where user_id=p_user for update;
  if not found then return null; end if;
  select * into prior from public.time_tree_receipts where user_id=p_user and operation_id=p_operation;
  if found then
    if prior.command_hash<>sha256(convert_to(command::text,'UTF8')) then raise exception 'operation_mismatch'; end if;
    return jsonb_build_object('baseRevision',prior.revision-1,'revision',prior.revision,'delta',prior.delta);
  end if;
  if account.state->>'today' is distinct from today or account.state->'tomatoWallet' is null then return null; end if;
  select * into step from public.time_tree_steps where user_id=p_user and step_id=p_id and not held;
  if not found or coalesce((step.body->>'skipped')::boolean,false) then return null; end if;
  body := step.body;
  if (body->>'popped')::boolean and body->>'end' is not null then
    return jsonb_build_object('revision',account.revision,'baseRevision',account.revision,'unchanged',true);
  end if;
  if body->>'end' is null then
    if body->>'subject'<>'life' or body->>'scheduled' is distinct from today or
      body->>'planned' is distinct from today then return null; end if;
    select * into summary from public.time_tree_days where user_id=p_user and day=today;
    -- Exhausted practice cursors can change which pending academic steps count toward today's goal.
    if account.state->>'goalAwardedOn' is distinct from today and exists (
      select 1 from public.time_tree_steps s left join public.time_tree_cursors c on
        c.user_id=s.user_id and c.collection='practiceProgress' and c.binding_key=s.body->>'practiceBindingKey'
      where s.user_id=p_user and s.display_day=today and not s.held
        and s.body->>'end' is null and s.body->>'subject'<>'life' and s.body->>'priority' in ('P0','P1')
        and coalesce((s.body#>>'{practice,exhausted}')::boolean,
          (c.body->>'exhausted')::boolean,false)
    ) then return null; end if;
    water := case when coalesce(summary.completed,0)=2 then 2 else 1 end;
    body := body || jsonb_build_object('start',null,'end',today,'stages',jsonb_build_array(0),'sun',1,'water',water);
    notes := jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'t',now(),'icon','🌸','text','做完了「'||(body->>'name')||'」'));
    patch := jsonb_build_object('sun',(account.state->>'sun')::int+1,'water',(account.state->>'water')::int+water);
    if account.state->>'lastDoneDay' is distinct from today then
      patch := patch || jsonb_build_object('lastDoneDay',today,'streak',case when account.state->>'lastDoneDay'=(today::date-1)::text
        then coalesce((account.state->>'streak')::int,0)+1 else 1 end);
    end if;
    must_done := case when body->>'planned'=today and body->>'priority' in ('P0','P1')
      and not (split_part(step.occurrence,'/',2)='weekly' and split_part(step.occurrence,'/',4)='week') then 1 else 0 end;
    if account.state->>'goalAwardedOn' is distinct from today and summary.required>0 and summary.required_open=must_done then
      patch := patch || jsonb_build_object('goalAwardedOn',today,'water',(patch->>'water')::int+2);
      notes := jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'t',now(),'icon','🎯','text','今天要做的都完成啦，奖励水滴 +2')) || notes;
    end if;
  end if;
  body := body || '{"popped":true,"slot":null}'::jsonb;
  expired_notes := '[]';
  if jsonb_array_length(notes)>0 then
    select coalesce(jsonb_agg(object_id),'[]') into expired_notes from (
      select object_id from public.time_tree_objects where user_id=p_user and collection='diary'
      order by position desc offset (80-jsonb_array_length(notes))
    ) old_notes;
  end if;
  select coalesce(jsonb_object_agg(key,value),'{}') || jsonb_build_object('id',step.step_id) into body
    from jsonb_each(body) where value is distinct from step.body->key;
  delta := jsonb_build_object('state',patch,'unset','[]'::jsonb,'stepFields',jsonb_build_array(body),'steps','[]'::jsonb,'held','[]'::jsonb,'removed','[]'::jsonb,
    'diary',jsonb_build_object('put',notes,'remove',expired_notes),'apples','{"put":[],"remove":[]}'::jsonb,'tomatoSpends','{"put":[],"remove":[]}'::jsonb);
  return public.commit_time_tree_rows(p_user,account.revision,p_operation,command,delta,null);
end $$;
revoke all on function public.pop_time_tree_step(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.pop_time_tree_step(uuid,text,uuid) to service_role;

create function public.read_time_tree_command(p_user uuid,p_command jsonb,p_operation uuid,p_today text,p_ids text[],
  p_known bigint,p_known_homework text,p_known_day text,p_weekly int,p_practice int)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  a public.time_tree_accounts;
  prior public.time_tree_receipts;
  homework text;
  sync_needed boolean;
  full_read boolean;
  window_start date := p_today::date;
  window_end date := p_today::date;
  cycles_from text;
  target_version bigint;
begin
  select * into prior from public.time_tree_receipts where user_id=p_user and operation_id=p_operation;
  if found then
    if prior.command_hash<>sha256(convert_to(p_command::text,'UTF8')) then raise exception 'operation_mismatch'; end if;
    if p_command->>'kind'<>'sync' then
      return jsonb_build_object('receipt',jsonb_build_object('baseRevision',prior.revision-1,'revision',prior.revision,'delta',prior.delta));
    end if;
  end if;
  select * into a from public.time_tree_accounts where user_id=p_user;
  select coalesce((select revision from private.time_tree_homework_revisions where user_id=p_user),0)::text into homework;
  sync_needed := a.user_id is null or a.state->>'today' is distinct from p_today
    or (p_command->>'kind'='sync' and (a.applied_homework is distinct from homework
      or (a.state->>'weeklyScheduleVersion')::int is distinct from p_weekly
      or (a.state->>'practiceScheduleVersion')::int is distinct from p_practice));
  if p_command->>'kind'='sync' and not sync_needed and a.revision=p_known and homework=p_known_homework and p_today=p_known_day then
    return jsonb_build_object('unchanged',true);
  end if;
  full_read := a.state->'tomatoWallet' is null;
  if p_command->>'kind'='record' then
    select p_ids || coalesce(array_agg(step_id),'{}') into p_ids from public.time_tree_steps
    where user_id=p_user and (finished_day=to_char((p_command->>'end')::timestamptz at time zone 'Asia/Shanghai','YYYY-MM-DD')
      or (started_day<=to_char((p_command->>'end')::timestamptz at time zone 'Asia/Shanghai','YYYY-MM-DD')
        and finished_day>=to_char((p_command->>'start')::timestamptz at time zone 'Asia/Shanghai','YYYY-MM-DD')));
  end if;
  if p_command->>'kind'='sync' then
    window_start := window_start-6;
    window_end := window_end+6;
  end if;
  if sync_needed or p_command->>'kind' in ('school','regenerate') then
    window_start := least(window_start,(a.state->>'today')::date);
    window_end := greatest(window_end,p_today::date+6);
    if p_command->>'kind'='regenerate' then
      window_end := greatest(window_end,(p_command#>>'{regenerate,through}')::date);
    end if;
    -- The longest recurrence is a calendar month. Include its original key even after rescheduling.
    cycles_from := (window_start-31)::text;
  end if;
  select max(version) into target_version from public.time_tree_steps where user_id=p_user and occurrence in
    (select occurrence from public.time_tree_steps where user_id=p_user and step_id=any(p_ids));
  return jsonb_build_object('saved',public.read_time_tree_rows(p_user,full_read,window_start::text,window_end::text,p_ids,cycles_from),
    'historyMinutes',case when p_command->>'kind'='sync' then private.tree_history_minutes(p_user,p_today) end,
    'schedule',sync_needed,'full',full_read,'homeworkRevision',homework,'targetVersion',target_version);
end $$;
revoke all on function public.read_time_tree_command(uuid,jsonb,uuid,text,text[],bigint,text,text,int,int) from public,anon,authenticated;
grant execute on function public.read_time_tree_command(uuid,jsonb,uuid,text,text[],bigint,text,text,int,int) to service_role;
notify pgrst,'reload schema';
