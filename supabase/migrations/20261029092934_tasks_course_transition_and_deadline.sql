-- Preserve mutually exclusive pending rule revisions and schedule-only transition metadata.
-- Course deadline policy is stored now; Task4 resolves explicit pool inheritance at runtime.
create or replace function public.task_valid_course_deadline(policy jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 if policy is null then return true; end if;
 if jsonb_typeof(policy) is distinct from 'object'
 or coalesce(policy->>'kind','') not in ('next_class','same_day','days_after','fixed')
 or jsonb_typeof(policy->'time') is distinct from 'string'
 or (policy->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
 or jsonb_typeof(policy->'days') is distinct from 'number'
 or (policy->>'days')::numeric not between 0 and 365
 or trunc((policy->>'days')::numeric)<>(policy->>'days')::numeric then return false; end if;
 if policy->>'kind'='fixed' then
   if jsonb_typeof(policy->'at') is distinct from 'string' or (policy->>'at') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$' then return false; end if;
   return isfinite((policy->>'at')::timestamptz);
 end if;
 return policy ? 'at' and policy->'at'='null'::jsonb;
exception when others then return false;
end $$;
alter table public.task_courses add column default_deadline jsonb;
alter table public.task_courses add constraint task_courses_default_deadline_valid check(public.task_valid_course_deadline(default_deadline));
comment on column public.task_courses.default_deadline is 'Nullable concrete deadline policy. Null uses system next_class (days=1,time=20:30); Task4 resolves pool course_default. Existing pool concrete policies override.';

create or replace function public.task_save_course(p_course jsonb,p_rules jsonb,p_effective_from date default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; rid uuid; old_rid uuid; is_new boolean; rule_start date; item jsonb; old_rule public.task_timetable_rules; new_rule public.task_timetable_rules; effective date:=coalesce(p_effective_from,(now() at time zone 'Asia/Shanghai')::date); seen uuid[]:='{}'; prior public.task_courses; snapshot public.task_course_catalog_snapshots; proposed jsonb; sid uuid; binding jsonb; binding_ids uuid[]:='{}'; bid uuid; kind text; cur jsonb;
begin
 perform public.task_user_lock(u);
 if jsonb_typeof(p_course) is distinct from 'object' then raise exception 'invalid_course'; end if;
 if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules) not between 1 and 100 then raise exception 'invalid_rules'; end if;
 if effective<(now() at time zone 'Asia/Shanghai')::date then raise exception 'invalid_effective_date'; end if;
 cid:=nullif(p_course->>'id','')::uuid;
 is_new:=cid is null;
 kind:=coalesce(p_course->>'course_type','timetabled');
 if kind not in ('timetabled','flexible') then raise exception 'invalid_course_type'; end if;
 if cid is not null then
 select * into prior from public.task_courses where user_id=u and id=cid for update;
 if not found then raise exception 'course_not_owned'; end if;
 if (p_course->>'rules_revision')::int is distinct from prior.rules_revision then raise exception 'stale_course_revision'; end if;
 if prior.archived_at is not null then raise exception 'course_archived'; end if;
 end if;
 -- Task4 replaces this pre-mutation hook with due-event catch-up under the same lock.
 perform public.task_course_before_configuration_change(u,cid);
 proposed:=nullif(p_course->'catalog_snapshot','null'::jsonb);
 sid:=case when p_course ? 'catalog_snapshot_id' then nullif(p_course->>'catalog_snapshot_id','')::uuid else prior.catalog_snapshot_id end;
 if proposed is not null then
 if proposed->>'user_id' is distinct from u::text or proposed->>'subject' is distinct from p_course->>'subject' then raise exception 'snapshot_owner_or_subject_mismatch'; end if;
 if jsonb_typeof(proposed->'ordered_lessons') is distinct from 'array' or jsonb_array_length(proposed->'ordered_lessons')=0
 or jsonb_typeof(proposed->'teaching_segments') is distinct from 'array' then raise exception 'invalid_catalog_snapshot'; end if;
 if exists(select 1 from jsonb_array_elements(proposed->'ordered_lessons') l where coalesce(l->>'key','')='' or coalesce(l->>'title','')='')
 or (select count(*) from jsonb_array_elements(proposed->'ordered_lessons'))<>(select count(distinct l->>'key') from jsonb_array_elements(proposed->'ordered_lessons') l)
 then raise exception 'invalid_catalog_lessons'; end if;
 if exists(select 1 from jsonb_array_elements(proposed->'teaching_segments') s where coalesce(s->>'key','')='' or coalesce(s->>'title','')='' or jsonb_typeof(s->'problem_keys') is distinct from 'array' or not exists(select 1 from jsonb_array_elements(proposed->'ordered_lessons') l where l->>'key'=s->>'lesson_key'))
 or (select count(*) from jsonb_array_elements(proposed->'teaching_segments'))<>(select count(distinct s->>'key') from jsonb_array_elements(proposed->'teaching_segments') s) then raise exception 'invalid_catalog_segments'; end if;
 if exists(select 1 from jsonb_array_elements(proposed->'teaching_segments') s where (s ? 'completes_lesson' and jsonb_typeof(s->'completes_lesson')<>'boolean')
 or exists(select 1 from jsonb_array_elements(s->'problem_keys') p where jsonb_typeof(p)<>'string' or length(p#>>'{}')=0)
 or (select count(*) from jsonb_array_elements(s->'problem_keys'))<>(select count(distinct p) from jsonb_array_elements(s->'problem_keys') p)) then raise exception 'invalid_segment_problems'; end if;
 if exists(select 1 from jsonb_array_elements(proposed->'teaching_segments') with ordinality a(s,n) join jsonb_array_elements(proposed->'teaching_segments') with ordinality b(s,n) on a.s->>'lesson_key'=b.s->>'lesson_key' and a.n<b.n where coalesce((a.s->>'completes_lesson')::boolean,false)) then raise exception 'premature_lesson_completion'; end if;
 select * into snapshot from public.task_course_catalog_snapshots where user_id=u and subject=p_course->>'subject' and version=proposed->>'version';
 if found then
 if snapshot.source is distinct from proposed->>'source' or snapshot.progression_mode is distinct from proposed->>'progression_mode' or snapshot.ordered_lessons is distinct from proposed->'ordered_lessons' or snapshot.teaching_segments is distinct from proposed->'teaching_segments' then raise exception 'snapshot_version_content_mismatch'; end if;
 sid:=snapshot.id;
 else
 insert into public.task_course_catalog_snapshots(user_id,subject,version,source,progression_mode,ordered_lessons,teaching_segments)
 values(u,p_course->>'subject',proposed->>'version',proposed->>'source',proposed->>'progression_mode',proposed->'ordered_lessons',proposed->'teaching_segments') returning id into sid;
 end if;
 end if;
 if sid is not null then
 select * into snapshot from public.task_course_catalog_snapshots where user_id=u and id=sid and subject=p_course->>'subject';
 if not found then raise exception 'snapshot_not_owned_or_subject_mismatch'; end if;
 end if;
 cur:=case when p_course ? 'cursor' then nullif(p_course->'cursor','null'::jsonb) else prior.cursor end;
 if cur is not null and (jsonb_typeof(cur) is distinct from 'object' or sid is null or not exists(select 1 from jsonb_array_elements(snapshot.ordered_lessons) l where l->>'key'=cur->>'lesson_key')
 or (snapshot.progression_mode='segment' and not exists(select 1 from jsonb_array_elements(snapshot.teaching_segments) s where s->>'key'=cur->>'segment_key' and s->>'lesson_key'=cur->>'lesson_key'))
 or (snapshot.progression_mode='lesson' and cur->>'segment_key' is not null)) then raise exception 'invalid_course_cursor'; end if;
 if (coalesce((p_course->>'auto_assign')::boolean,prior.auto_assign,false) or coalesce((p_course->>'auto_advance')::boolean,prior.auto_advance,false)) and (sid is null or cur is null) then raise exception 'automation_requires_catalog_cursor'; end if;
 if cid is null then
 insert into public.task_courses(user_id,name,subject) values(u,p_course->>'name',p_course->>'subject') returning id into cid;
 elsif not exists(select 1 from public.task_courses where user_id=u and id=cid) then raise exception 'course_not_owned'; end if;
 update public.task_courses set name=p_course->>'name',subject=p_course->>'subject',calendar_id=nullif(p_course->>'calendar_id','')::uuid,
 teacher=coalesce(p_course->>'teacher',''),location=coalesce(p_course->>'location',''),credits=nullif(p_course->>'credits','')::numeric,
 notes=coalesce(p_course->>'notes',''),color=coalesce(p_course->>'color','#39765c'),reminder_minutes=case when p_course ? 'reminder_minutes' then (p_course->>'reminder_minutes')::int else 10 end
 where user_id=u and id=cid;
 update public.task_courses set course_type=kind, auto_assign=coalesce((p_course->>'auto_assign')::boolean,prior.auto_assign,false), auto_advance=coalesce((p_course->>'auto_advance')::boolean,prior.auto_advance,false),
 default_deadline=case when p_course ? 'default_deadline' then nullif(p_course->'default_deadline','null'::jsonb) else prior.default_deadline end,
 catalog_snapshot_id=sid,cursor=cur,rules_revision=coalesce(prior.rules_revision,0)+1,effective_from=effective,
 automation_enabled_at=case when (coalesce((p_course->>'auto_assign')::boolean,prior.auto_assign,false) or coalesce((p_course->>'auto_advance')::boolean,prior.auto_advance,false)) then coalesce(prior.automation_enabled_at,now()) else null end
 where user_id=u and id=cid;
 -- A pending revision can move again without stranding the still-valid earlier rules.
 if not is_new and prior.effective_from>(now() at time zone 'Asia/Shanghai')::date and prior.effective_from<>effective then
 update public.task_timetable_rules set disabled_from=effective
 where user_id=u and course_id=cid and disabled_from=prior.effective_from and valid_from<prior.effective_from;
 end if;
 for item in select * from jsonb_array_elements(p_rules) loop
 if coalesce(item->>'kind',kind)<>kind then raise exception 'course_rule_type_mismatch'; end if;
 if kind='flexible' and (item->>'start_time' is not null or item->>'end_time' is not null) then raise exception 'flexible_rule_has_time'; end if;
 if item ? 'teaching_weeks' and jsonb_typeof(item->'teaching_weeks') is distinct from 'array' then raise exception 'invalid_teaching_weeks'; end if;
 if coalesce(item->>'recurrence','weekly')='weeks' and (jsonb_typeof(item->'teaching_weeks') is distinct from 'array' or jsonb_array_length(item->'teaching_weeks')=0) then raise exception 'teaching_weeks_required'; end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(item->'teaching_weeks','[]')) w where w::int<1 or w::int>520) then raise exception 'invalid_teaching_week'; end if;
 rid:=nullif(item->>'id','')::uuid;
 old_rid:=rid;
 rule_start:=case when is_new then (item->>'valid_from')::date when prior.effective_from>(now() at time zone 'Asia/Shanghai')::date and (item->>'valid_from')::date=prior.effective_from then effective else greatest(effective,(item->>'valid_from')::date) end;
 if rid is not null then
 select * into strict old_rule from public.task_timetable_rules where user_id=u and id=rid and course_id=cid;
 -- Keep unchanged rules and their exception/occurrence identities intact.
 if not (coalesce(prior.effective_from>(now() at time zone 'Asia/Shanghai')::date,false) and prior.effective_from<>effective and old_rule.valid_from=prior.effective_from) and old_rule.weekday=(item->>'weekday')::int and old_rule.kind=kind and old_rule.start_time is not distinct from (item->>'start_time')::time and old_rule.end_time is not distinct from (item->>'end_time')::time
 and old_rule.valid_from=(item->>'valid_from')::date and old_rule.valid_until is not distinct from (item->>'valid_until')::date
 and old_rule.recurrence=coalesce(item->>'recurrence','weekly') and old_rule.interval_weeks=coalesce((item->>'interval_weeks')::int,1)
 and old_rule.anchor_date=coalesce((item->>'anchor_date')::date,(item->>'valid_from')::date)
 and old_rule.teaching_weeks=array(select jsonb_array_elements_text(coalesce(item->'teaching_weeks','[]'))::int) and old_rule.disabled_from is null then
 seen:=array_append(seen,rid); continue;
 end if;
 if exists(select 1 from public.task_course_occurrences where user_id=u and rule_id=rid and original_date=rule_start and status='confirmed') then rule_start:=rule_start+1; end if;
 update public.task_timetable_rules set disabled_from=least(coalesce(disabled_from,effective),effective,case when prior.effective_from>(now() at time zone 'Asia/Shanghai')::date and valid_from>=prior.effective_from then valid_from else effective end) where user_id=u and id=rid;
 end if;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,valid_until,recurrence,interval_weeks,anchor_date,teaching_weeks)
 values(u,cid,kind,(item->>'weekday')::int,(item->>'start_time')::time,(item->>'end_time')::time,rule_start,(item->>'valid_until')::date,
 coalesce(item->>'recurrence','weekly'),coalesce((item->>'interval_weeks')::int,1),coalesce((item->>'anchor_date')::date,(item->>'valid_from')::date),array(select jsonb_array_elements_text(coalesce(item->'teaching_weeks','[]'))::int)) returning id into rid;
 -- Carry forward actual future class/task identities when a replacement still has
 -- a class in the same teaching week (including weekday moves).
 if old_rid is not null and old_rule.kind='timetabled' and kind='timetabled' then
 select * into new_rule from public.task_timetable_rules where id=rid and user_id=u;
 update public.task_course_exceptions e set rule_id=rid,
 original_date=e.original_date-extract(isodow from e.original_date)::int+1+mod(new_rule.weekday+6,7)
 where e.user_id=u and e.rule_id=old_rid and e.original_date>=effective
 and coalesce(e.ends_at,((e.original_date-extract(isodow from e.original_date)::int+1+mod(new_rule.weekday+6,7))+new_rule.end_time) at time zone 'Asia/Shanghai')>now()
 and public.task_rule_occurs(new_rule,e.original_date-extract(isodow from e.original_date)::int+1+mod(new_rule.weekday+6,7))
 and not exists(select 1 from public.task_course_occurrences o where o.user_id=u and o.rule_id=old_rid and o.original_date=e.original_date and (o.status='confirmed' or o.ends_at<=now()));
 update public.task_course_occurrences o set rule_id=rid,
 original_date=o.original_date-extract(isodow from o.original_date)::int+1+mod(new_rule.weekday+6,7)
 where o.user_id=u and o.rule_id=old_rid and o.original_date>=effective and o.status<>'confirmed' and o.ends_at>now()
 and (((o.original_date-extract(isodow from o.original_date)::int+1+mod(new_rule.weekday+6,7))+new_rule.end_time) at time zone 'Asia/Shanghai'>now()
 or exists(select 1 from public.task_course_exceptions moved where moved.user_id=u and moved.rule_id=rid and moved.original_date=o.original_date-extract(isodow from o.original_date)::int+1+mod(new_rule.weekday+6,7) and moved.ends_at>now()))
 and public.task_rule_occurs(new_rule,o.original_date-extract(isodow from o.original_date)::int+1+mod(new_rule.weekday+6,7));
 end if;
 seen:=array_append(seen,rid);
 end loop;
 update public.task_timetable_rules set disabled_from=least(coalesce(disabled_from,effective),effective,case when prior.effective_from>(now() at time zone 'Asia/Shanghai')::date and valid_from>=prior.effective_from then valid_from else effective end) where user_id=u and course_id=cid and not(id=any(seen));
 if p_course ? 'bindings' then
 if jsonb_typeof(p_course->'bindings') is distinct from 'array' or jsonb_array_length(p_course->'bindings')>500 then raise exception 'invalid_bindings'; end if;
 for binding in select * from jsonb_array_elements(p_course->'bindings') loop
 if not exists(select 1 from public.task_templates where user_id=u and id=(binding->>'pool_item_id')::uuid and trigger in ('before_class','after_class','confirmed','unit_completed') and (subject is null or subject=p_course->>'subject')) then raise exception 'invalid_pool_binding'; end if;
 if (binding->>'pool_item_id')::uuid=any(binding_ids) then raise exception 'duplicate_pool_binding'; end if;
 binding_ids:=array_append(binding_ids,(binding->>'pool_item_id')::uuid);
 bid:=nullif(binding->>'id','')::uuid;
 if bid is not null and not exists(select 1 from public.task_course_pool_bindings where user_id=u and id=bid and course_id=cid and pool_item_id=(binding->>'pool_item_id')::uuid) then raise exception 'binding_not_owned'; end if;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id,enabled,scope_override,estimated_minutes_override,material_override)
 values(u,cid,(binding->>'pool_item_id')::uuid,coalesce((binding->>'enabled')::boolean,true),nullif(binding->'scope_override','null'::jsonb),(binding->>'estimated_minutes_override')::int,nullif(binding->'material_override','null'::jsonb))
 on conflict(user_id,course_id,pool_item_id) do update set enabled=excluded.enabled,scope_override=excluded.scope_override,estimated_minutes_override=excluded.estimated_minutes_override,material_override=excluded.material_override;
 end loop;
 delete from public.task_course_pool_bindings where user_id=u and course_id=cid and not(pool_item_id=any(binding_ids));
 end if;
 perform public.task_tick(u); return cid;
end $$;

create or replace function public.task_import_timetable(p_payload jsonb,p_calendar uuid default null,p_name text default null,p_import_key text default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); target uuid; cid uuid; rid uuid; eid uuid; c jsonb; r jsonb; e jsonb; first_calendar jsonb; course_map jsonb:='{}'; rule_map jsonb:='{}'; start_date date; end_date date; cname text;
begin
 perform public.task_user_lock(u);
 if p_import_key is null or length(p_import_key) not between 1 and 200 then raise exception 'import_key_required'; end if;
 if coalesce(p_payload->>'version','') not in ('1','2') or jsonb_typeof(p_payload->'courses') is distinct from 'array'
 or jsonb_typeof(p_payload->'rules') is distinct from 'array' or jsonb_typeof(p_payload->'exams') is distinct from 'array'
 or jsonb_typeof(p_payload->'calendars') is distinct from 'array' then raise exception 'invalid_import'; end if;
 if p_payload ? 'exceptions' and jsonb_typeof(p_payload->'exceptions') is distinct from 'array' then raise exception 'invalid_exceptions'; end if;
 if jsonb_array_length(p_payload->'courses')>500 or jsonb_array_length(p_payload->'rules')>5000 or jsonb_array_length(p_payload->'exams')>1000
 or jsonb_array_length(coalesce(p_payload->'exceptions','[]'))>10000 then raise exception 'import_too_large'; end if;
 select calendar_id into target from public.task_timetable_imports where user_id=u and import_key=p_import_key;
 if found then
 if p_calendar is not null and target<>p_calendar then raise exception 'import_key_target_mismatch'; end if;
 return target;
 end if;
 target:=p_calendar;
 if target is not null then
 if not exists(select 1 from public.task_calendars where user_id=u and id=target) then raise exception 'calendar_not_owned'; end if;
 else
 first_calendar:=p_payload->'calendars'->0;
 start_date:=coalesce((first_calendar->>'starts_on')::date,(select min((v->>'valid_from')::date) from jsonb_array_elements(p_payload->'rules') v),(now() at time zone 'Asia/Shanghai')::date);
 end_date:=(first_calendar->>'ends_on')::date;
 insert into public.task_calendars(user_id,name,starts_on,ends_on) values(u,coalesce(nullif(p_name,''),nullif(first_calendar->>'name',''),'导入课表'),start_date,end_date) returning id into target;
 end if;
 for c in select * from jsonb_array_elements(p_payload->'courses') loop
 if coalesce(c->>'id','')='' or course_map ? (c->>'id') then raise exception 'duplicate_or_missing_course_key'; end if;
 cname:=btrim(c->>'name');
 select id into cid from public.task_courses where user_id=u and calendar_id=target and archived_at is null and lower(btrim(name))=lower(cname) and subject=c->>'subject' and course_type=coalesce(c->>'course_type','timetabled') and effective_from is not distinct from (c->>'effective_from')::date order by created_at,id limit 1;
 if cid is null then
 insert into public.task_courses(user_id,calendar_id,name,subject,course_type,effective_from,teacher,location,credits,notes,color,reminder_minutes)
 values(u,target,cname,c->>'subject',coalesce(c->>'course_type','timetabled'),(c->>'effective_from')::date,coalesce(c->>'teacher',''),coalesce(c->>'location',''),(c->>'credits')::numeric,coalesce(c->>'notes',''),coalesce(c->>'color','#39765c'),case when c ? 'reminder_minutes' then (c->>'reminder_minutes')::int else 10 end) returning id into cid;
 end if;
 course_map:=course_map||jsonb_build_object(c->>'id',cid);
 end loop;
 for r in select * from jsonb_array_elements(p_payload->'rules') loop
 if coalesce(r->>'id','')='' or rule_map ? (r->>'id') then raise exception 'duplicate_or_missing_rule_key'; end if;
 cid:=(course_map->>(r->>'course_id'))::uuid;
 if cid is null then raise exception 'unknown_course_reference'; end if;
 if r ? 'teaching_weeks' and jsonb_typeof(r->'teaching_weeks') is distinct from 'array' then raise exception 'invalid_teaching_weeks'; end if;
 if coalesce(r->>'recurrence','weekly')='weeks' and (jsonb_typeof(r->'teaching_weeks') is distinct from 'array' or jsonb_array_length(r->'teaching_weeks')=0) then raise exception 'teaching_weeks_required'; end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(r->'teaching_weeks','[]')) w where w::int<1 or w::int>520) then raise exception 'invalid_teaching_week'; end if;
 select id into rid from public.task_timetable_rules old where old.user_id=u and old.course_id=cid
 and old.weekday=(r->>'weekday')::int and old.kind=coalesce(r->>'kind','timetabled') and old.start_time is not distinct from (r->>'start_time')::time and old.end_time is not distinct from (r->>'end_time')::time
 and old.valid_from=(r->>'valid_from')::date and old.valid_until is not distinct from (r->>'valid_until')::date
 and old.disabled_from is not distinct from (r->>'disabled_from')::date and old.recurrence=coalesce(r->>'recurrence','weekly')
 and old.interval_weeks=coalesce((r->>'interval_weeks')::int,1) and old.anchor_date=coalesce((r->>'anchor_date')::date,(r->>'valid_from')::date)
 and old.teaching_weeks=array(select jsonb_array_elements_text(coalesce(r->'teaching_weeks','[]'))::int) order by id limit 1;
 if rid is null then
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,valid_until,recurrence,interval_weeks,anchor_date,teaching_weeks,disabled_from)
 values(u,cid,coalesce(r->>'kind','timetabled'),(r->>'weekday')::int,(r->>'start_time')::time,(r->>'end_time')::time,(r->>'valid_from')::date,(r->>'valid_until')::date,
 coalesce(r->>'recurrence','weekly'),coalesce((r->>'interval_weeks')::int,1),coalesce((r->>'anchor_date')::date,(r->>'valid_from')::date),array(select jsonb_array_elements_text(coalesce(r->'teaching_weeks','[]'))::int),(r->>'disabled_from')::date) returning id into rid;
 end if;
 rule_map:=rule_map||jsonb_build_object(r->>'id',rid);
 end loop;
 for e in select * from jsonb_array_elements(coalesce(p_payload->'exceptions','[]')) loop
 rid:=(rule_map->>(e->>'rule_id'))::uuid;
 if rid is null then raise exception 'unknown_rule_reference'; end if;
 -- Never alter an existing occurrence/confirmation while restoring configuration.
 if exists(select 1 from public.task_course_occurrences where user_id=u and rule_id=rid and original_date=(e->>'original_date')::date) then continue; end if;
 insert into public.task_course_exceptions(user_id,rule_id,original_date,cancelled,starts_at,ends_at)
 values(u,rid,(e->>'original_date')::date,coalesce((e->>'cancelled')::boolean,false),(e->>'starts_at')::timestamptz,(e->>'ends_at')::timestamptz)
 on conflict(user_id,rule_id,original_date) do nothing;
 end loop;
 for e in select * from jsonb_array_elements(p_payload->'exams') loop
 cid:=null;
 if nullif(e->>'course_id','') is not null then cid:=(course_map->>(e->>'course_id'))::uuid; if cid is null then raise exception 'unknown_exam_course'; end if; end if;
 select id into eid from public.task_exams old where old.user_id=u and old.calendar_id=target and old.course_id is not distinct from cid
 and lower(btrim(old.title))=lower(btrim(e->>'title')) and old.starts_at=(e->>'starts_at')::timestamptz and old.ends_at=(e->>'ends_at')::timestamptz and old.location=coalesce(e->>'location','') order by id limit 1;
 if eid is null then
 insert into public.task_exams(user_id,calendar_id,course_id,title,starts_at,ends_at,location,notes,reminder_minutes)
 values(u,target,cid,btrim(e->>'title'),(e->>'starts_at')::timestamptz,(e->>'ends_at')::timestamptz,coalesce(e->>'location',''),coalesce(e->>'notes',''),case when e ? 'reminder_minutes' then (e->>'reminder_minutes')::int else 30 end);
 end if;
 end loop;
 insert into public.task_timetable_imports(user_id,import_key,calendar_id) values(u,p_import_key,target);
 -- No tick here: applying config cannot retroactively emit learning tasks.
 return target;
end $$;


commit;
