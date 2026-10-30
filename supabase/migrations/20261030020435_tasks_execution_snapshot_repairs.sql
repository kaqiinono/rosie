-- Repair accepted content snapshots and preserve progress on metadata-only writes.
create or replace function private.task_execution(p_id uuid,p_op text,p_value jsonb,p_expected integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); t public.task_instances; old public.task_instances; v jsonb; its jsonb; total int; finished int; changed boolean:=false; item_order integer:=0;
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
   if old.status='cancelled' and t.status='pending' then
    t.status:=case when t.completion_percent=100 and t.selection_state<>'pending' then 'completed'
     when t.progress_mode='items' and exists(select 1 from public.task_instance_items where user_id=u and task_id=p_id and not cancelled and done) then 'active'
     else 'pending' end;
   end if;
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
   -- Compare the same accepted fields, with absent href normalized to JSON null.
   select coalesce(jsonb_agg(jsonb_build_object('id',x->>'id','label',x->>'label','href',x->>'href') order by ord),'[]') into its from jsonb_array_elements(its) with ordinality rows(x,ord);
   if its is distinct from (select coalesce(jsonb_agg(jsonb_build_object('id',x->>'id','label',x->>'label','href',x->>'href') order by ord),'[]') from jsonb_array_elements(t.items) with ordinality rows(x,ord)) then
    update public.task_instance_items set cancelled=true where user_id=u and task_id=p_id;
    for v in select * from jsonb_array_elements(its) loop
     item_order:=item_order+1;
     insert into public.task_instance_items(user_id,task_id,item_key,label,href,done,sort_order) values(u,p_id,v->>'id',v->>'label',v->>'href',false,item_order)
     on conflict(user_id,task_id,item_key) do update set label=excluded.label,href=excluded.href,sort_order=excluded.sort_order,cancelled=false,done=case when t.subject='math' then public.task_instance_items.done else false end;
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
 -- Metadata operations preserve legacy progress, including completed empty checklists.
 -- Intentional content/mode/item changes derive a new snapshot for BOTH progress modes.
 if p_op='item' and not changed then return to_jsonb(t); end if;
 if p_op='item' or changed or t.progress_mode is distinct from old.progress_mode then
  select count(*),count(*) filter(where done),coalesce(jsonb_agg(jsonb_build_object('id',item_key,'label',label,'done',done,'href',href) order by sort_order,item_key),'[]') into total,finished,its from public.task_instance_items where user_id=u and task_id=p_id and not cancelled;
  t.items:=its;
  if t.progress_mode='items' then
   t.completion_percent:=case when total>0 then 100.0*finished/total else 0 end;
   if t.status<>'cancelled' then t.status:=case when total>0 and total=finished and t.selection_state<>'pending' then 'completed' when finished>0 then 'active' when t.status='completed' then 'pending' else t.status end; end if;
  end if;
 end if;
 if to_jsonb(t)=to_jsonb(old) and not changed then return to_jsonb(t); end if;
 -- Snapshot at the prior revision also preserves content history before reset.
 insert into public.task_progress_events(user_id,task_id,revision,kind,payload) values(u,p_id,old.revision,p_op,jsonb_build_object('task',to_jsonb(old),'change',p_value));
 t.revision:=old.revision+1;
 update public.task_instances set title=t.title,subject=t.subject,items=t.items,status=t.status,completion_percent=t.completion_percent,progress_mode=t.progress_mode,estimated_minutes=t.estimated_minutes,due_at=t.due_at,due_kind=t.due_kind,due_occurrence_id=t.due_occurrence_id,selection_state=t.selection_state,revision=t.revision where id=p_id;
 return to_jsonb(t);
end $$;
