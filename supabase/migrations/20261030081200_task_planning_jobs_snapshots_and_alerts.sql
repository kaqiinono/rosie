-- Local-only planning infrastructure. No secrets or live scheduler configuration.
create table private.task_planning_shared_epoch(singleton boolean primary key default true check(singleton),revision bigint not null default 1);
insert into private.task_planning_shared_epoch values(true,1);
create table public.task_planning_jobs(user_id uuid primary key references auth.users(id),lease_id uuid,lease_until timestamptz,attempts integer not null default 0,next_attempt_at timestamptz not null default now(),last_error text);
create table public.task_planning_snapshots(user_id uuid primary key references auth.users(id),input_revision bigint not null,shared_revision bigint not null,computed_at timestamptz not null,next_recompute_at timestamptz not null,horizon_end timestamptz not null,input jsonb not null,result jsonb not null,risks jsonb not null);
create table public.task_planning_settings(user_id uuid primary key references auth.users(id),tight_ratio numeric not null default .2 check(tight_ratio between 0 and 1));
create table public.task_planning_alerts(user_id uuid not null references auth.users(id),batch_key text not null,reason text not null,risk jsonb not null,updated_at timestamptz not null default now(),read_at timestamptz,resolved_at timestamptz,primary key(user_id,batch_key,reason));
alter table public.task_planning_jobs enable row level security;
grant select on public.task_planning_jobs to authenticated;
create policy owned_read on public.task_planning_jobs for select to authenticated using(user_id=auth.uid());
alter table public.task_planning_snapshots enable row level security;
grant select on public.task_planning_snapshots to authenticated;
create policy owned_read on public.task_planning_snapshots for select to authenticated using(user_id=auth.uid());
alter table public.task_planning_settings enable row level security;
grant select on public.task_planning_settings to authenticated;
create policy owned_read on public.task_planning_settings for select to authenticated using(user_id=auth.uid());
alter table public.task_planning_alerts enable row level security;
grant select on public.task_planning_alerts to authenticated;
create policy owned_read on public.task_planning_alerts for select to authenticated using(user_id=auth.uid());
-- Owner revision mutations enqueue under the existing owner -> revision -> job ordering.
create function private.task_planning_enqueue() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.task_planning_jobs(user_id) values(new.user_id) on conflict(user_id) do update set next_attempt_at=least(public.task_planning_jobs.next_attempt_at,now()); return new;
end $$;
create trigger task_planning_enqueue after insert or update on public.task_user_planning_revisions for each row execute function private.task_planning_enqueue();
insert into public.task_planning_jobs(user_id) select user_id from public.task_user_planning_revisions on conflict do nothing;
create function private.task_planning_shared_dirty() returns trigger language plpgsql security definer set search_path='' as $$begin
 update private.task_planning_shared_epoch set revision=revision+1; return null;
end $$;
create trigger task_planning_shared_dirty after insert or update or delete on public.material_assets for each statement execute function private.task_planning_shared_dirty();
create trigger task_planning_dependency_dirty before insert or update or delete on public.task_templates for each row execute function private.task_capacity_dirty();
create trigger task_planning_dependency_dirty before insert or update or delete on public.task_course_pool_bindings for each row execute function private.task_capacity_dirty();
create trigger task_planning_dependency_dirty before insert or update or delete on public.task_course_catalog_snapshots for each row execute function private.task_capacity_dirty();
create trigger task_planning_dependency_dirty before insert or update or delete on public.course_material_links for each row execute function private.task_capacity_dirty();
create trigger task_planning_dependency_dirty before insert or update or delete on public.task_course_occurrences for each row execute function private.task_capacity_dirty();
create trigger task_planning_dependency_dirty before insert or update or delete on public.task_planning_settings for each row execute function private.task_capacity_dirty();
create function public.task_planning_input(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',p_user,'input_revision',coalesce((select revision from public.task_user_planning_revisions where user_id=p_user),0),'shared_revision',(select revision from private.task_planning_shared_epoch),'now',statement_timestamp(),'tight_ratio',coalesce((select tight_ratio from public.task_planning_settings where user_id=p_user),.2),'previous_allocations',coalesce((select result->'allow_weekend'->'allocations' from public.task_planning_snapshots where user_id=p_user),'[]'::jsonb))
 || jsonb_build_object('courses',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_courses x where user_id=p_user))
 || jsonb_build_object('rules',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_timetable_rules x where user_id=p_user))
 || jsonb_build_object('exceptions',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_course_exceptions x where user_id=p_user))
 || jsonb_build_object('occurrences',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_course_occurrences x where user_id=p_user))
 || jsonb_build_object('events',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_course_events x where user_id=p_user))
 || jsonb_build_object('catalog_snapshots',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_course_catalog_snapshots x where user_id=p_user))
 || jsonb_build_object('bindings',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_course_pool_bindings x where user_id=p_user))
 || jsonb_build_object('pool_items',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_templates x where user_id=p_user))
 || jsonb_build_object('tasks',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_instances x where user_id=p_user))
 || jsonb_build_object('day_states',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_availability_day_states x where user_id=p_user))
 || jsonb_build_object('windows',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_availability_windows x where user_id=p_user))
 || jsonb_build_object('blocks',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_time_blocks x where user_id=p_user))
 || jsonb_build_object('exams',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.task_exams x where user_id=p_user))
 || jsonb_build_object('material_links',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.course_material_links x where user_id=p_user))
 || jsonb_build_object('material_assets',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.material_assets x))
$$;
revoke all on function public.task_planning_input(uuid) from public,anon,authenticated;
grant execute on function public.task_planning_input(uuid) to service_role;
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
  if p_value ? 'recovery_due_at' then
   t.recovery_due_at:=(p_value->>'recovery_due_at')::timestamptz;
   if t.recovery_due_at is not null and (t.due_at is null or t.due_at>=now() or t.recovery_due_at<=now() or t.status not in ('active','pending')) then raise exception 'invalid_recovery_target'; end if;
  end if;
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
 update public.task_instances set title=t.title,subject=t.subject,items=t.items,status=t.status,completion_percent=t.completion_percent,progress_mode=t.progress_mode,estimated_minutes=t.estimated_minutes,due_at=t.due_at,recovery_due_at=t.recovery_due_at,due_kind=t.due_kind,due_occurrence_id=t.due_occurrence_id,selection_state=t.selection_state,revision=t.revision where id=p_id;
 return to_jsonb(t);
end $$;
-- Claim never waits for an owner lock while holding a job row. Publication takes owner first.
create function public.task_claim_planning_jobs(p_limit integer,p_user uuid default null) returns setof public.task_planning_jobs language plpgsql security definer set search_path='' as $$begin
 return query with candidates as (
 select j.user_id from public.task_planning_jobs j left join public.task_planning_snapshots s using(user_id)
 left join public.task_user_planning_revisions r using(user_id)
 where (p_user is null or j.user_id=p_user) and j.next_attempt_at<=clock_timestamp()
 and (j.lease_until is null or j.lease_until<=clock_timestamp())
 and (s.user_id is null or s.next_recompute_at<=clock_timestamp() or s.input_revision<>coalesce(r.revision,0) or s.shared_revision<>(select revision from private.task_planning_shared_epoch))
 order by j.next_attempt_at,j.user_id limit greatest(0,least(p_limit,20)) for update of j skip locked
 ) update public.task_planning_jobs j set lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',attempts=j.attempts+1 from candidates c where j.user_id=c.user_id returning j.*;
end $$;
create function public.task_renew_planning_job(p_user uuid,p_lease uuid) returns boolean language sql security definer set search_path='' as $$
 with renewed as(update public.task_planning_jobs set lease_until=clock_timestamp()+interval '2 minutes' where user_id=p_user and lease_id=p_lease and lease_until>clock_timestamp() returning 1) select exists(select 1 from renewed)
$$;
create function public.task_fail_planning_job(p_user uuid,p_lease uuid) returns boolean language sql security definer set search_path='' as $$
 with failed as(update public.task_planning_jobs set lease_id=null,lease_until=null,next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,10*power(2,least(attempts,8)))::integer),last_error='computation_failed' where user_id=p_user and lease_id=p_lease returning 1) select exists(select 1 from failed)
$$;
create function public.task_publish_planning(p_user uuid,p_lease uuid,p_shared_revision bigint,p_input jsonb,p_result jsonb,p_risks jsonb,p_next timestamptz) returns boolean language plpgsql security definer set search_path='' as $$
declare j public.task_planning_jobs; r bigint; computed timestamptz:=(p_input->>'now')::timestamptz; item record; prior public.task_planning_alerts; alert_reason text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,228));
 -- A row share lock prevents epoch mutation between validation and publication commit.
 select revision into r from private.task_planning_shared_epoch for share;
 select * into j from public.task_planning_jobs where user_id=p_user for update;
 if not found or p_lease is null or j.lease_until is null or j.lease_id is distinct from p_lease or j.lease_until<=clock_timestamp() then return false; end if;
 if r<>p_shared_revision or (p_input->>'input_revision')::bigint<>coalesce((select revision from public.task_user_planning_revisions where user_id=p_user),0)
 or p_next<=clock_timestamp() or computed>clock_timestamp() or exists(select 1 from public.task_planning_snapshots where user_id=p_user and computed_at>=computed) then
 update public.task_planning_jobs set lease_id=null,lease_until=null,next_attempt_at=clock_timestamp() where user_id=p_user; return false; end if;
 insert into public.task_planning_snapshots values(p_user,(p_input->>'input_revision')::bigint,r,computed,least(p_next,computed+interval '1 minute'),(p_input->>'horizon_end')::timestamptz,p_input,p_result,p_risks)
 on conflict(user_id) do update set input_revision=excluded.input_revision,shared_revision=excluded.shared_revision,computed_at=excluded.computed_at,next_recompute_at=excluded.next_recompute_at,horizon_end=excluded.horizon_end,input=excluded.input,result=excluded.result,risks=excluded.risks;
 -- One durable row per batch/reason. Reading does not resolve; only publication resolves.
 update public.task_planning_alerts set resolved_at=clock_timestamp() where user_id=p_user and resolved_at is null and (not(p_risks ? batch_key) or (p_risks->batch_key->>'status' in ('completed','weekday_feasible') and not coalesce((p_risks->batch_key->>'time_near')::boolean,false)));
 for item in select * from jsonb_each(p_risks) loop
  if item.value->>'status' in ('completed','weekday_feasible') and not coalesce((item.value->>'time_near')::boolean,false) then continue; end if;
  alert_reason:='capacity';
  select * into prior from public.task_planning_alerts where user_id=p_user and batch_key=item.key and reason=alert_reason;
  if not found or prior.resolved_at is not null or
   array_position(array['completed','weekday_feasible','tight','weekend_required','adjustment_required','insufficient','incomplete'],item.value->>'status')>array_position(array['completed','weekday_feasible','tight','weekend_required','adjustment_required','insufficient','incomplete'],prior.risk->>'status')
   or (item.value->>'unallocated_minutes')::numeric>(prior.risk->>'unallocated_minutes')::numeric
   or (item.value->>'weekend_minutes')::numeric>(prior.risk->>'weekend_minutes')::numeric
   or (coalesce((item.value->>'time_near')::boolean,false) and not coalesce((prior.risk->>'time_near')::boolean,false)) then
   insert into public.task_planning_alerts(user_id,batch_key,reason,risk) values(p_user,item.key,alert_reason,item.value)
   on conflict(user_id,batch_key,reason) do update set risk=excluded.risk,updated_at=clock_timestamp(),read_at=null,resolved_at=null;
  else
   update public.task_planning_alerts set risk=item.value where user_id=p_user and batch_key=item.key and reason=alert_reason;
  end if;
 end loop;
 update public.task_planning_jobs set lease_id=null,lease_until=null,attempts=0,last_error=null,next_attempt_at=least(p_next,computed+interval '1 minute') where user_id=p_user;
 return true;
end $$;
create function public.task_planning_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.task_planning_snapshots; begin
 if u is null then raise insufficient_privilege; end if;
 select * into s from public.task_planning_snapshots where user_id=u;
 return jsonb_build_object('snapshot',to_jsonb(s),'stale',s.user_id is null or s.next_recompute_at<=statement_timestamp() or s.input_revision<>coalesce((select revision from public.task_user_planning_revisions where user_id=u),0) or s.shared_revision<>(select revision from private.task_planning_shared_epoch),
 'settings',jsonb_build_object('tight_ratio',coalesce((select tight_ratio from public.task_planning_settings where user_id=u),.2)),
 'alerts',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.task_planning_alerts a where user_id=u),
 'background',private.task_planning_background_status());
end $$;
create function public.task_request_planning() returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,228));
 insert into public.task_user_planning_revisions(user_id) values(auth.uid()) on conflict do nothing;
 insert into public.task_planning_jobs(user_id) values(auth.uid()) on conflict(user_id) do update set next_attempt_at=least(public.task_planning_jobs.next_attempt_at,now());
end $$;
create function public.task_set_planning_settings(p_tight_ratio numeric) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or p_tight_ratio is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,228));
 insert into public.task_planning_settings values(auth.uid(),p_tight_ratio) on conflict(user_id) do update set tight_ratio=excluded.tight_ratio;
end $$;
create function public.task_read_planning_alert(p_batch_key text,p_reason text) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 update public.task_planning_alerts set read_at=clock_timestamp() where user_id=auth.uid() and batch_key=p_batch_key and reason=p_reason and read_at is null;
end $$;
create function public.task_accept_plan(p_input_revision bigint,p_allocations jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.task_planning_snapshots; a jsonb; demand jsonb; epoch bigint; n integer:=0;
begin
 if u is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 select revision into epoch from private.task_planning_shared_epoch for share;
 select * into s from public.task_planning_snapshots where user_id=u;
 if not found or s.input_revision<>p_input_revision or s.input_revision<>coalesce((select revision from public.task_user_planning_revisions where user_id=u),0) or s.shared_revision<>epoch or s.next_recompute_at<=clock_timestamp() then raise serialization_failure using message='stale_plan'; end if;
 if jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)=0 then raise exception 'invalid_allocations'; end if;
 for a in select * from jsonb_array_elements(p_allocations) loop
  if not (s.result->'allow_weekend'->'allocations' @> jsonb_build_array(a)) or coalesce((a->>'fixed')::boolean,true) then raise exception 'unknown_allocation'; end if;
  select x into demand from jsonb_array_elements(s.input->'demands') x where x->>'key'=a->>'demand_key';
  if demand is null or demand->>'task_id' is null or demand->>'origin'<>'actual' then raise exception 'forecast_only_allocation'; end if;
  if (a->>'start')::timestamptz<clock_timestamp() then raise exception 'time_in_past'; end if;
  -- Existing authoritative triggers revalidate owner task, release/recovery, capacity and overlap.
  insert into public.task_time_blocks(user_id,task_id,starts_at,ends_at) values(u,(demand->>'task_id')::uuid,(a->>'start')::timestamptz,(a->>'end')::timestamptz);
  n:=n+1;
 end loop;
 return n;
end $$;
-- Every privileged service endpoint is explicitly closed to browser/public roles.
do $$declare r record; begin
 for r in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('task_claim_planning_jobs','task_renew_planning_job','task_fail_planning_job','task_publish_planning','task_planning_status','task_request_planning','task_set_planning_settings','task_read_planning_alert','task_accept_plan') loop
 execute format('revoke all on function %s from public,anon,authenticated',r.signature);
 execute format('grant execute on function %s to %s',r.signature,case when r.proname in ('task_claim_planning_jobs','task_renew_planning_job','task_fail_planning_job','task_publish_planning') then 'service_role' else 'authenticated' end);
 end loop;
end $$;
revoke all on function private.task_planning_enqueue(),private.task_planning_shared_dirty() from public,anon,authenticated;
-- Capability reporting never treats the existence of pg_cron alone as a running worker.
create function private.task_planning_background_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare capabilities boolean; configured boolean:=false; begin
 capabilities:=to_regnamespace('cron') is not null and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null and to_regclass('vault.decrypted_secrets') is not null;
 if capabilities then
 execute $q$select exists(select 1 from cron.job where jobname='tasks-planning-recompute' and active) and exists(select 1 from vault.decrypted_secrets where name='task_planning_cron_secret' and length(decrypted_secret)>0) and exists(select 1 from vault.decrypted_secrets where name='task_planning_url' and decrypted_secret like 'https://%')$q$ into configured;
 end if;
 return jsonb_build_object('configured',configured,'capabilities_available',capabilities,'reason',case when configured then 'configured_delivery_unverified' else 'scheduler_not_configured' end);
end $$;
create function private.task_planning_dispatch() returns void language plpgsql security definer set search_path='' as $$begin
 if not (private.task_planning_background_status()->>'configured')::boolean then return; end if;
 execute $q$select net.http_post(url:=(select decrypted_secret from vault.decrypted_secrets where name='task_planning_url' limit 1),headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='task_planning_cron_secret' limit 1)),body:='{}'::jsonb,timeout_milliseconds:=10000)$q$;
end $$;
-- Explicit installation seam for a later authorized deployment. Migration does not call it.
create function private.task_install_planning_cron() returns void language plpgsql security definer set search_path='' as $$begin
 if to_regnamespace('cron') is null or to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then raise exception 'scheduler_not_configured'; end if;
 execute $q$select cron.schedule('tasks-planning-recompute','* * * * *','select private.task_planning_dispatch()')$q$;
end $$;
revoke all on function private.task_planning_background_status(),private.task_planning_dispatch(),private.task_install_planning_cron() from public,anon,authenticated;

create trigger task_planning_delete_dirty before delete on public.task_instances for each row execute function private.task_capacity_dirty();
