-- Authoritative execution writes. All user mutations share the event-runtime lock.
create table public.task_user_planning_revisions(user_id uuid primary key references auth.users(id),revision bigint not null default 1);
alter table public.task_user_planning_revisions enable row level security;
grant select on public.task_user_planning_revisions to authenticated;
create policy own_read on public.task_user_planning_revisions for select to authenticated using(user_id=auth.uid());
create function private.task_progress_dirty() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new is not distinct from old then return new; end if;
 insert into public.task_user_planning_revisions(user_id,revision) values(new.user_id,1) on conflict(user_id) do update set revision=public.task_user_planning_revisions.revision+1;
 return new;
end $$;
create trigger task_progress_dirty after insert or update on public.task_instances for each row execute function private.task_progress_dirty();
revoke all on function private.task_progress_dirty() from public,anon,authenticated;
revoke insert,update,delete on public.task_instances,public.task_instance_items from authenticated;
grant select on public.task_progress_events to authenticated;
create policy own_read on public.task_progress_events for select to authenticated using(user_id=auth.uid());
-- Existing completed/partially checked legacy tasks retain their original mode and items.
update public.task_instances set completion_percent=100 where status='completed' and completion_percent<>100;

create function private.task_execution(p_id uuid,p_op text,p_value jsonb,p_expected integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); t public.task_instances; old public.task_instances; v jsonb; its jsonb; total int; finished int; changed boolean:=false;
begin
 if u is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 select * into t from public.task_instances where id=p_id and user_id=u for update;
 if not found then raise insufficient_privilege; end if;
 old:=t;
 if p_op in ('completion','estimate') and p_expected is null then raise exception 'expected_revision_required'; end if;
 if p_expected is not null and t.revision<>p_expected then raise serialization_failure using message='任务已更新，请刷新后重试'; end if;
 if p_op='completion' then
  if t.progress_mode<>'percentage' or t.selection_state='pending' or t.status='cancelled' then raise exception 'invalid_completion_mode'; end if;
  if (p_value->>'value')::int not between 0 and 100 then raise exception 'invalid_percent'; end if;
  t.completion_percent:=(p_value->>'value')::int;
  t.status:=case when t.completion_percent=100 then 'completed' when t.completion_percent=0 then 'pending' else 'active' end;
 elsif p_op='estimate' then
  t.estimated_minutes:=(p_value->>'value')::int;
  if t.estimated_minutes not between 1 and 1440 then raise exception 'invalid_minutes'; end if;
 elsif p_op='item' then
  if t.progress_mode<>'items' or t.selection_state='pending' or t.status='cancelled' then raise exception 'invalid_item_mode'; end if;
  update public.task_instance_items set done=(p_value->>'done')::boolean,revision=revision+1 where user_id=u and task_id=p_id and item_key=p_value->>'key' and not cancelled and done is distinct from (p_value->>'done')::boolean;
  changed:=found;
  if not exists(select 1 from public.task_instance_items where user_id=u and task_id=p_id and item_key=p_value->>'key' and not cancelled) then raise exception 'unknown_item'; end if;
 elsif p_op='edit' then
  if p_value ? 'title' then t.title:=p_value->>'title'; end if;
  if p_value ? 'subject' then t.subject:=p_value->>'subject'; end if;
  if p_value ? 'due_at' then t.due_at:=(p_value->>'due_at')::timestamptz; t.due_kind:='fixed'; t.due_occurrence_id:=null; end if;
  if p_value ? 'status' then
   if p_value->>'status' not in ('active','cancelled','pending') then raise exception 'use_progress_api'; end if;
   t.status:=p_value->>'status';
   if t.status='pending' and t.progress_mode='percentage' and t.completion_percent=100 then t.status:='completed'; end if;
   if old.selection_state='no_homework' and t.status<>'cancelled' then t.selection_state:=case when jsonb_array_length(t.items)=0 then 'pending' else 'ready' end; end if;
  end if;
  if p_value ? 'estimated_minutes' then t.estimated_minutes:=(p_value->>'estimated_minutes')::int; end if;
  if p_value ? 'items' then
   if t.course_event_id is not null and t.subject<>'math' then raise exception 'use_event_content_revision'; end if;
   its:=p_value->'items';
   if jsonb_typeof(its)<>'array' then raise exception 'invalid_items'; end if;
   if exists(select 1 from jsonb_array_elements(its) x where coalesce(x->>'id','')='' or coalesce(x->>'label','')='') or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(its) x) then raise exception 'invalid_item_identity'; end if;
   -- Generated math selections may only use real keys of the saved lesson.
   if t.subject='math' and t.lesson is not null and exists(select 1 from jsonb_array_elements(its) x where x->>'id' not like (replace(t.lesson->>'key',':','%3A')||':%:%')) then raise exception 'invalid_math_identity'; end if;
   if (select coalesce(jsonb_agg(x-'done'),'[]') from jsonb_array_elements(its) x) is distinct from (select coalesce(jsonb_agg(x-'done'),'[]') from jsonb_array_elements(t.items) x) then
    update public.task_instance_items set cancelled=true where user_id=u and task_id=p_id;
    for v in select * from jsonb_array_elements(its) loop
     insert into public.task_instance_items(user_id,task_id,item_key,label,href,done,sort_order) values(u,p_id,v->>'id',v->>'label',v->>'href',false,0)
     on conflict(user_id,task_id,item_key) do update set label=excluded.label,href=excluded.href,cancelled=false,done=case when t.subject='math' then public.task_instance_items.done else false end;
    end loop;
    t.completion_percent:=0; t.status:='pending'; changed:=true;
   end if;
   if p_value ? 'progress_mode' then t.progress_mode:=p_value->>'progress_mode'; end if;
   t.selection_state:=case when jsonb_array_length(its)=0 and t.subject='math' then 'pending' else 'ready' end;
  end if;
  if p_value->>'selection_state'='no_homework' then
   if t.subject<>'math' or t.template_snapshot->>'item_source'='class' then raise exception 'homework_only'; end if;
   t.selection_state:='no_homework'; t.status:='cancelled';
  end if;
 else raise exception 'unknown_execution_operation'; end if;
 if t.estimated_minutes not between 1 and 1440 then raise exception 'invalid_minutes'; end if;
 if t.progress_mode='items' then
  select count(*),count(*) filter(where done),coalesce(jsonb_agg(jsonb_build_object('id',item_key,'label',label,'done',done,'href',href) order by sort_order,item_key),'[]') into total,finished,its from public.task_instance_items where user_id=u and task_id=p_id and not cancelled;
  t.items:=its; t.completion_percent:=case when total>0 then 100.0*finished/total else 0 end;
  if t.status<>'cancelled' then t.status:=case when total>0 and total=finished and t.selection_state<>'pending' then 'completed' when finished>0 then 'active' when t.status='completed' then 'pending' else t.status end; end if;
 end if;
 if to_jsonb(t)=to_jsonb(old) and not changed then return to_jsonb(t); end if;
 -- Snapshot at the prior revision also preserves content history before reset.
 insert into public.task_progress_events(user_id,task_id,revision,kind,payload) values(u,p_id,old.revision,p_op,jsonb_build_object('task',to_jsonb(old),'change',p_value));
 t.revision:=old.revision+1;
 update public.task_instances set title=t.title,subject=t.subject,items=t.items,status=t.status,completion_percent=t.completion_percent,progress_mode=t.progress_mode,estimated_minutes=t.estimated_minutes,due_at=t.due_at,due_kind=t.due_kind,due_occurrence_id=t.due_occurrence_id,selection_state=t.selection_state,revision=t.revision where id=p_id;
 return to_jsonb(t);
end $$;
revoke all on function private.task_execution(uuid,text,jsonb,integer) from public,anon,authenticated;
create function public.task_set_completion(p_task_id uuid,p_percent integer,p_expected_revision integer) returns jsonb language sql security definer set search_path='' as $$select private.task_execution(p_task_id,'completion',jsonb_build_object('value',p_percent),p_expected_revision)$$;
create function public.task_set_item_done(p_task_id uuid,p_item_key text,p_done boolean) returns jsonb language sql security definer set search_path='' as $$select private.task_execution(p_task_id,'item',jsonb_build_object('key',p_item_key,'done',p_done))$$;
create function public.task_set_estimate(p_task_id uuid,p_minutes integer,p_expected_revision integer) returns jsonb language sql security definer set search_path='' as $$select private.task_execution(p_task_id,'estimate',jsonb_build_object('value',p_minutes),p_expected_revision)$$;
create function public.task_save_execution(p_task jsonb,p_expected_revision integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); t public.task_instances; begin
 if u is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 if p_task ? 'id' then
  if p_expected_revision is null then raise exception 'expected_revision_required'; end if;
  return private.task_execution((p_task->>'id')::uuid,'edit',p_task,p_expected_revision);
 end if;
 if coalesce(p_task->>'subject','')='' then raise exception 'subject_required'; end if;
 insert into public.task_instances(user_id,title,subject,source_key,mode,progress_mode,status,estimated_minutes,due_at,due_kind,items,selection_state)
 values(u,p_task->>'title',p_task->>'subject','custom:'||gen_random_uuid()::text,coalesce(p_task->>'mode','checklist'),coalesce(p_task->>'progress_mode','percentage'),'pending',coalesce((p_task->>'estimated_minutes')::int,20),(p_task->>'due_at')::timestamptz,'fixed',(select coalesce(jsonb_agg(x||jsonb_build_object('done',false)),'[]') from jsonb_array_elements(coalesce(p_task->'items','[]')) x),case when p_task->>'subject'='math' and coalesce(p_task->>'progress_mode','percentage')='items' and jsonb_array_length(coalesce(p_task->'items','[]'))=0 then 'pending' else 'ready' end) returning * into t;
 if t.estimated_minutes not between 1 and 1440 then raise exception 'invalid_minutes'; end if;
 insert into public.task_instance_items(user_id,task_id,item_key,label,done,href) select u,t.id,x->>'id',x->>'label',false,x->>'href' from jsonb_array_elements(t.items) x on conflict(user_id,task_id,item_key) do nothing;
 return to_jsonb(t);
end $$;
revoke all on function public.task_set_completion(uuid,integer,integer),public.task_set_item_done(uuid,text,boolean),public.task_set_estimate(uuid,integer,integer),public.task_save_execution(jsonb,integer) from public,anon;
grant execute on function public.task_set_completion(uuid,integer,integer),public.task_set_item_done(uuid,text,boolean),public.task_set_estimate(uuid,integer,integer),public.task_save_execution(jsonb,integer) to authenticated,service_role;

-- Independent once/weekly activities use the same progress mode and authoritative items.
create function private.task_execution_insert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.course_event_id is null and new.template_id is not null then
  select progress_mode into new.progress_mode from public.task_templates where id=new.template_id and user_id=new.user_id;
 end if;
 return new;
end $$;
create trigger task_execution_insert before insert on public.task_instances for each row execute function private.task_execution_insert();
create function private.task_execution_seed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.task_instance_items(user_id,task_id,item_key,label,done,href,sort_order)
 select new.user_id,new.id,x->>'id',coalesce(x->>'label',''),coalesce((x->>'done')::boolean,false),x->>'href',ord::int from jsonb_array_elements(new.items) with ordinality v(x,ord)
 on conflict(user_id,task_id,item_key) do nothing;
 return new;
end $$;
create trigger task_execution_seed after insert on public.task_instances for each row execute function private.task_execution_seed();
revoke all on function private.task_execution_insert(),private.task_execution_seed() from public,anon,authenticated;
insert into public.task_instance_items(user_id,task_id,item_key,label,done,href,sort_order)
 select t.user_id,t.id,x->>'id',coalesce(x->>'label',''),coalesce((x->>'done')::boolean,false),x->>'href',ord::int from public.task_instances t cross join lateral jsonb_array_elements(t.items) with ordinality v(x,ord)
 on conflict(user_id,task_id,item_key) do nothing;
