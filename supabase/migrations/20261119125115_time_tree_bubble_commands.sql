set local lock_timeout='5s';

create function public.add_time_tree_crown(p_user uuid,p_id text,p_day text,p_name text,p_operation uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  account public.time_tree_accounts;
  prior public.time_tree_receipts;
  today text := to_char(now() at time zone 'Asia/Shanghai','YYYY-MM-DD');
  command jsonb := jsonb_build_object('kind','addCrown','id',p_id,'day',p_day,'name',p_name);
  occurrence_key text := 'crown/'||p_day||'/'||p_id;
  available_slot integer;
  item jsonb;
  empty_items jsonb := '{"put":[],"remove":[]}';
begin
  select * into account from public.time_tree_accounts where user_id=p_user for update;
  if not found then return null; end if;
  select * into prior from public.time_tree_receipts where user_id=p_user and operation_id=p_operation;
  if found then
    if prior.command_hash<>sha256(convert_to(command::text,'UTF8')) then raise exception 'operation_mismatch'; end if;
    return jsonb_build_object('revision',prior.revision,'baseRevision',prior.revision-1,'delta',prior.delta);
  end if;
  if p_day is distinct from today then raise exception 'crown_day_changed'; end if;
  if p_id is null or p_id !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'invalid_crown'; end if;
  -- Midnight and first-time initialization still belong to the scheduling engine.
  if account.state->>'today' is distinct from today or account.state->'tomatoWallet' is null then return null; end if;
  if exists(select 1 from public.time_tree_steps where user_id=p_user and step_id=occurrence_key||'/0') then
    return jsonb_build_object('revision',account.revision,'baseRevision',account.revision,'unchanged',true);
  end if;
  with used_slots as materialized (
    select (body->>'slot')::integer as slot from public.time_tree_steps where user_id=p_user
      and phase in ('pending','running','awaiting_pop','flower') and body->>'slot' is not null
  )
  select min(candidate) into available_slot from generate_series(0,(select count(*)::int from used_slots)) candidate
    where not exists(select 1 from used_slots where slot=candidate);
  item := jsonb_build_object('id',occurrence_key||'/0','occurrence',occurrence_key,'crown',true,'name',btrim(p_name),
    'notes','','practice',null,'subject','life','priority','P2','minutes',0,'scheduled',today,'planned',today,'deadline',today,
    'start',null,'end',null,'settled',false,'popped',false,'slot',available_slot,'returned',null,'sun',0,'water',0,
    'stages','[0]'::jsonb,'audit','[]'::jsonb);
  return public.commit_time_tree_rows(p_user,account.revision,p_operation,command,jsonb_build_object('state','{}'::jsonb,
    'unset','[]'::jsonb,'steps',jsonb_build_array(item),'held','[]'::jsonb,'removed','[]'::jsonb,
    'diary',empty_items,'apples',empty_items,'tomatoSpends',empty_items),null);
end $$;
revoke all on function public.add_time_tree_crown(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.add_time_tree_crown(uuid,text,text,text,uuid) to service_role;

create or replace function public.pop_time_tree_step(p_user uuid,p_id text,p_operation uuid)
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
  excluded_open integer := 0;
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
    -- Match isExhaustedPendingStep. A frozen practice (including explicit null)
    -- takes precedence over the binding cursor.
    if account.state->>'goalAwardedOn' is distinct from today and summary.required_open>0 then
      select count(*) into excluded_open
      from public.time_tree_steps s
      left join public.time_tree_cursors c on c.user_id=s.user_id and c.collection='practiceProgress'
        and not (s.body ? 'practice') and c.binding_key=s.body->>'practiceBindingKey'
      where s.user_id=p_user and s.display_day=today and s.body->>'planned'=today
        and s.phase='pending' and s.body->>'subject'<>'life' and s.body->>'priority' in ('P0','P1')
        and not (split_part(s.occurrence,'/',2)='weekly' and split_part(s.occurrence,'/',4)='week')
        and (case when s.body ? 'practice' then s.body#>>'{practice,exhausted}' else c.body->>'exhausted' end)::boolean
        and jsonb_array_length(s.body->'audit')=0 and s.body#>>'{practice,questions}' is null
        and s.body#>>'{flowers,availableFrom}' is null and coalesce((s.body#>>'{flowers,collected}')::int,0)=0
        and coalesce((s.body#>>'{flowers,elapsedMs}')::bigint,0)=0
        and coalesce(jsonb_array_length(s.body#>'{flowers,answered}'),0)=0
        and not exists(select 1 from jsonb_array_elements_text(s.body->'stages') stage where stage::int>0);
    end if;
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
    if account.state->>'goalAwardedOn' is distinct from today and summary.required>excluded_open
      and summary.required_open-excluded_open=must_done then
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
notify pgrst,'reload schema';
