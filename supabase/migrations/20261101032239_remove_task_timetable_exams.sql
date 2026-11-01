-- Remove timetable exams from the shared runtime before dropping their storage.
CREATE OR REPLACE FUNCTION public.task_import_timetable(p_payload jsonb, p_calendar uuid DEFAULT NULL::uuid, p_name text DEFAULT NULL::text, p_import_key text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); target uuid; cid uuid; rid uuid; c jsonb; r jsonb; e jsonb; first_calendar jsonb; course_map jsonb:='{}'; rule_map jsonb:='{}'; start_date date; end_date date; cname text;
begin
 perform public.task_user_lock(u);
 if p_import_key is null or length(p_import_key) not between 1 and 200 then raise exception 'import_key_required'; end if;
 if coalesce(p_payload->>'version','') not in ('1','2') or jsonb_typeof(p_payload->'courses') is distinct from 'array'
 or jsonb_typeof(p_payload->'rules') is distinct from 'array'
 or jsonb_typeof(p_payload->'calendars') is distinct from 'array' then raise exception 'invalid_import'; end if;
 if p_payload ? 'exceptions' and jsonb_typeof(p_payload->'exceptions') is distinct from 'array' then raise exception 'invalid_exceptions'; end if;
 if jsonb_array_length(p_payload->'courses')>500 or jsonb_array_length(p_payload->'rules')>5000
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
 insert into public.task_timetable_imports(user_id,import_key,calendar_id) values(u,p_import_key,target);
 -- No tick here: applying config cannot retroactively emit learning tasks.
 return target;
end $function$;

CREATE OR REPLACE FUNCTION public.task_planning_input(p_user uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 || jsonb_build_object('material_links',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.course_material_links x where user_id=p_user))
 || jsonb_build_object('material_assets',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('current_available',x.status in ('ready','archived') and (x.source<>'baidu' or exists(select 1 from public.baidu_oauth_credentials c where c.id='primary' and c.account_id=x.account_id))) order by id),'[]') from public.material_assets x))
$function$;

CREATE OR REPLACE FUNCTION private.task_reconcile(p_user uuid, p_now timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.task_timetable_rules; o public.task_course_occurrences; t public.task_templates; i public.task_instances; rr jsonb; d date; sub text; fire timestamptz; anchor timestamptz; due public.task_course_occurrences; rec record;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,228));
 -- Exception DELETE is the existing restore API. Reconcile the event and its stable
 -- task sources too, not only the timetable occurrence. Completed history is immutable.
 for rec in select e.*,x.starts_at restored_starts,x.ends_at restored_ends,x.release_at restored_release from public.task_course_events e
 join public.task_courses c on c.user_id=e.user_id and c.id=e.course_id
 cross join lateral private.task_candidates(p_user,e.course_id,e.on_date,e.on_date) x
 where e.user_id=p_user and e.assignment_state='cancelled' and e.completion_state='pending'
 and e.rule_id is not null and c.archived_at is null
 and x.event_key=e.event_key
 loop
 update public.task_course_events set assignment_state='pending',
 starts_at=rec.restored_starts,ends_at=rec.restored_ends,release_at=rec.restored_release,revision=revision+1 where id=rec.id;
 update public.task_course_occurrences set status='scheduled',starts_at=rec.restored_starts,ends_at=rec.restored_ends
 where user_id=p_user and id=rec.occurrence_id and status<>'confirmed';
 if exists(select 1 from public.task_instances where user_id=p_user and course_event_id=rec.id and template_snapshot->>'trigger'='before_class') then
 perform private.task_emit_event(p_user,rec.id,'before_class',p_now,true);
 end if;
 if rec.restored_release<=p_now then
 if exists(select 1 from public.task_instances where user_id=p_user and course_event_id=rec.id and template_snapshot->>'trigger'<>'before_class') then
 perform private.task_emit_event(p_user,rec.id,'after_class',p_now,true);
 update public.task_course_events set assignment_state='assigned' where id=rec.id;
 end if;
 perform private.task_finish_phase(p_user,rec.id,p_now);
 end if;
 end loop;

 for r in select * from public.task_timetable_rules where user_id=p_user and kind='timetabled' and course_id in (select id from public.task_courses where user_id=p_user and archived_at is null) loop
 for d in select g::date from generate_series(greatest(r.valid_from,(p_now at time zone 'Asia/Shanghai')::date-35),least(coalesce(r.valid_until,'infinity'::date),(p_now at time zone 'Asia/Shanghai')::date+35),interval '1 day') g where public.task_rule_occurs(r,g::date) and (g::date+r.end_time) at time zone 'Asia/Shanghai'>r.created_at loop
 insert into public.task_course_occurrences(user_id,course_id,rule_id,original_date,starts_at,ends_at,status)
 select p_user,r.course_id,r.id,d,coalesce(e.starts_at,(d+r.start_time) at time zone 'Asia/Shanghai'),coalesce(e.ends_at,(d+r.end_time) at time zone 'Asia/Shanghai'),case when coalesce(e.cancelled,false) then 'cancelled' else 'scheduled' end
 from (select 1) dummy left join public.task_course_exceptions e on e.user_id=p_user and e.rule_id=r.id and e.original_date=d
 on conflict(user_id,rule_id,original_date) do nothing;
 end loop;
 end loop;
 -- Preserve confirmed occurrences and reconcile rule/exception changes per original date.
 for o in select * from public.task_course_occurrences where user_id=p_user and status<>'confirmed' and ends_at>p_now loop
 select * into r from public.task_timetable_rules where id=o.rule_id;
 select * into rec from public.task_course_exceptions where user_id=p_user and rule_id=o.rule_id and original_date=o.original_date;
 update public.task_course_occurrences set starts_at=coalesce(rec.starts_at,(o.original_date+r.start_time) at time zone 'Asia/Shanghai'),ends_at=coalesce(rec.ends_at,(o.original_date+r.end_time) at time zone 'Asia/Shanghai'),status=case when coalesce(rec.cancelled,false) or not public.task_rule_occurs(r,o.original_date) or exists(select 1 from public.task_courses c where c.id=o.course_id and c.user_id=p_user and c.archived_at is not null) then 'cancelled' else 'scheduled' end where id=o.id;
 end loop;
 for t in select * from public.task_templates where user_id=p_user and enabled and trigger in ('weekly','once') loop
 if t.trigger='once' and t.scheduled_at<=p_now then perform private.task_emit_independent(p_user,t.id,'once:'||t.id,null,null,null,t.scheduled_at);
 elsif t.trigger='weekly' then
 for d in select g::date from generate_series(greatest((t.scheduled_at at time zone 'Asia/Shanghai')::date,(t.created_at at time zone 'Asia/Shanghai')::date,coalesce((t.generated_through at time zone 'Asia/Shanghai')::date,'-infinity'::date)),(p_now at time zone 'Asia/Shanghai')::date,interval '1 day') g where extract(dow from g)::int=any(t.weekdays) loop
 fire:=(d+(t.scheduled_at at time zone 'Asia/Shanghai')::time) at time zone 'Asia/Shanghai';
 if fire<=p_now then perform private.task_emit_independent(p_user,t.id,'weekly:'||t.id||':'||d,null,null,null,fire); end if;
 end loop;
 end if;
 update public.task_templates set generated_through=p_now where id=t.id;
 end loop;
 -- Formal relative deadlines use immutable event phase and resolved policy.
 for i in select * from public.task_instances where user_id=p_user and status in ('pending','active') and due_kind='next_class' and course_event_id is not null and (due_at is null or due_at>p_now) loop
 select * into rec from public.task_course_events where user_id=p_user and id=i.course_event_id;
 update public.task_instances set due_at=(private.task_deadline(coalesce(i.template_snapshot->'resolved_deadline',i.template_snapshot->'deadline'),null,to_jsonb(rec),private.task_next_candidate(p_user,i.course_id,to_jsonb(rec)),i.template_snapshot->>'trigger')->>'due_at')::timestamptz where id=i.id;
 end loop;
 update public.task_reminders set status='cancelled' where user_id=p_user and source_key like 'confirm:%' and status in ('pending','sending','failed');
 for rec in select id from public.task_courses where user_id=p_user loop perform private.task_reconcile_previews(p_user,rec.id,p_now); end loop;
 for i in select * from public.task_instances where user_id=p_user and status in ('pending','active') and template_id is not null loop
 select * into t from jsonb_populate_record(null::public.task_templates,i.template_snapshot);
 select * into o from public.task_course_occurrences where id=i.occurrence_id;
 for rr in select * from jsonb_array_elements(t.reminders) loop
 anchor:=case rr->>'anchor' when 'course_start' then o.starts_at when 'course_end' then o.ends_at else i.due_at end;
 if anchor is null then continue; end if;
 fire:=anchor+make_interval(mins=>(rr->>'minutes')::int);
 insert into public.task_reminders(user_id,task_id,occurrence_id,source_key,title,remind_at,expires_at)
 values(p_user,i.id,i.occurrence_id,i.id||':'||(rr->>'anchor')||':'||(rr->>'minutes'),i.title,fire,case when rr->>'anchor'='course_start' then o.starts_at end)
 on conflict(user_id,source_key) do update set remind_at=excluded.remind_at,expires_at=excluded.expires_at,title=excluded.title where task_reminders.status='pending';
 end loop;
 end loop;
 insert into public.task_reminders(user_id,occurrence_id,source_key,title,remind_at,expires_at)
 select p_user,occ_row.id,'course-start:'||occ_row.id,'即将上课：'||c.name,occ_row.starts_at-make_interval(mins=>c.reminder_minutes),case when c.reminder_minutes=0 then occ_row.ends_at else occ_row.starts_at end
 from public.task_course_occurrences occ_row join public.task_courses c on c.id=occ_row.course_id and c.user_id=occ_row.user_id
 where occ_row.user_id=p_user and occ_row.status='scheduled' and occ_row.ends_at>p_now and (c.reminder_minutes=0 or occ_row.starts_at>p_now) and c.archived_at is null and c.reminder_minutes is not null
 on conflict(user_id,source_key) do update set remind_at=excluded.remind_at,expires_at=excluded.expires_at,title=excluded.title,status=case when task_reminders.read_at is null then 'pending' else task_reminders.status end;
 update public.task_reminders rem set status='cancelled' where rem.user_id=p_user and rem.status in ('pending','sending','failed')
 and rem.source_key like 'course-start:%' and exists(select 1 from public.task_course_occurrences occ_row join public.task_courses c on c.id=occ_row.course_id and c.user_id=occ_row.user_id where occ_row.id=rem.occurrence_id and occ_row.user_id=p_user and (c.reminder_minutes is null or c.archived_at is not null));
 update public.task_reminders rem set status='cancelled' where rem.user_id=p_user and rem.status in ('pending','sending','failed') and (
 (rem.expires_at is not null and rem.expires_at<=p_now)
 or exists(select 1 from public.task_instances inst where inst.id=rem.task_id and inst.status in ('completed','cancelled'))
 or exists(select 1 from public.task_course_occurrences occ where occ.id=rem.occurrence_id and (occ.status='cancelled' or (rem.task_id is null and occ.status='confirmed'))));
end $function$;

CREATE OR REPLACE FUNCTION public.task_validate_block()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare d date:=(new.starts_at at time zone 'Asia/Shanghai')::date; st text; overridden boolean; effective record;
begin
 perform public.task_user_lock(new.user_id);
 if not exists(select 1 from public.task_instances where id=new.task_id and user_id=new.user_id and status in ('pending','active')) then raise exception 'task_not_open'; end if;
 select w.* into effective from public.task_instances t cross join lateral public.task_effective_execution_window(t.release_at,t.created_at,t.due_at,t.recovery_due_at,now()) w where t.id=new.task_id and t.user_id=new.user_id;
 if effective.issue is not null and effective.issue<>'missing_deadline' then raise exception '%',effective.issue; end if;
 if new.starts_at<effective.release_at or (effective.due_at is not null and new.ends_at>effective.due_at) then raise exception 'outside_task_window'; end if;
 if new.starts_at<now() then raise exception 'time_in_past'; end if;
 if new.ends_at<=new.starts_at or date_trunc('minute',new.starts_at)<>new.starts_at or date_trunc('minute',new.ends_at)<>new.ends_at or (new.ends_at at time zone 'Asia/Shanghai')::date<>d then raise exception 'invalid_block_time'; end if;
 select exists(select 1 from public.task_availability_day_states where user_id=new.user_id and on_date=d) or exists(select 1 from public.task_availability_windows where user_id=new.user_id and on_date=d) into overridden;
 select s.state into st from public.task_availability_day_states s where s.user_id=new.user_id and (s.on_date=d or (not overridden and s.on_date is null and s.weekday=extract(dow from d)));
 if st in ('zero','unconfigured') then raise exception 'outside_available_window'; end if;
 if not coalesce((select range_agg(tstzrange((d+w.start_time) at time zone 'Asia/Shanghai',(d+w.end_time) at time zone 'Asia/Shanghai','[)')) @> tstzrange(new.starts_at,new.ends_at,'[)') from public.task_availability_windows w where w.user_id=new.user_id and not w.unavailable and (w.on_date=d or (not overridden and w.on_date is null and w.weekday=extract(dow from d)))),false) then raise exception 'outside_available_window'; end if;
 if exists(select 1 from public.task_availability_windows w where w.user_id=new.user_id and w.unavailable and (w.on_date=d or (not overridden and w.on_date is null and w.weekday=extract(dow from d))) and (d+w.start_time) at time zone 'Asia/Shanghai'<new.ends_at and (d+w.end_time) at time zone 'Asia/Shanghai'>new.starts_at)
 or exists(select 1 from public.task_course_occurrences c where c.user_id=new.user_id and c.status<>'cancelled' and c.starts_at<new.ends_at and c.ends_at>new.starts_at)
 or exists(select 1 from public.task_course_events c where c.user_id=new.user_id and c.assignment_state<>'cancelled' and c.starts_at<new.ends_at and c.ends_at>new.starts_at)
 or exists(select 1 from public.task_time_blocks b where b.user_id=new.user_id and b.id<>new.id and b.starts_at<new.ends_at and b.ends_at>new.starts_at) then raise exception 'time_conflict'; end if;
 return new;
end $function$;

DROP FUNCTION public.task_clear_exams(uuid[]);

-- Row deletion also advances the planning revision for every affected owner.
DELETE FROM public.task_exams;
DELETE FROM public.task_reminders WHERE exam_id IS NOT NULL OR source_key LIKE 'exam:%';
ALTER TABLE public.task_reminders DROP COLUMN exam_id;
DROP TABLE public.task_exams;

UPDATE public.task_timetable_snapshots SET payload = payload - 'exams' WHERE payload ? 'exams';
-- Prevent older clients from saving the retired data back into a snapshot.
ALTER TABLE public.task_timetable_snapshots ADD CONSTRAINT task_timetable_snapshot_schedule_only
  CHECK (NOT (payload ? 'exams'));
