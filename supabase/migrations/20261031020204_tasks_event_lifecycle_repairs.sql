-- Forward-only repair of explicit completion, current-date activation and exception restoration.
begin;

-- manual_after_class uses the ordinary after-class identity, with an explicit early release.
create or replace function private.task_emit_event(p_user uuid,p_event uuid,p_phase text,p_now timestamptz,p_revise boolean default false) returns void language plpgsql set search_path='' as $$
declare e public.task_course_events; c public.task_courses; matches jsonb; m jsonb; t jsonb; target jsonb; material jsonb; deadline jsonb; next_event jsonb; completed_unit jsonb; item public.task_instances; new_items jsonb; changed boolean; keys text[]:='{}'; key text; label text; taskid uuid; selection text; old_item jsonb; phase_release timestamptz; raw_release timestamptz; window_issue jsonb;
begin
 select * into strict e from public.task_course_events where user_id=p_user and id=p_event;
 select * into strict c from public.task_courses where user_id=p_user and id=e.course_id;
 if e.assignment_state='cancelled' or c.archived_at is not null then return; end if;
 if e.lesson_snapshot->'lesson'->>'key' is not null and (e.progression_result->>'kind'='finished' or (e.next_snapshot->'lesson'->>'key' is not null and (e.next_snapshot->'lesson'->>'book' is distinct from e.lesson_snapshot->'lesson'->>'book' or e.next_snapshot->'lesson'->>'unit' is distinct from e.lesson_snapshot->'lesson'->>'unit'))) then completed_unit:=jsonb_build_object('book',e.lesson_snapshot->'lesson'->>'book','unit',e.lesson_snapshot->'lesson'->>'unit'); end if;
 matches:=private.task_matches(to_jsonb(e),(select coalesce(jsonb_agg(to_jsonb(b)),'[]') from public.task_course_pool_bindings b where b.user_id=p_user and b.course_id=c.id),(select coalesce(jsonb_agg(to_jsonb(tx)),'[]') from public.task_templates tx where tx.user_id=p_user),e.next_snapshot,completed_unit);
 next_event:=private.task_next_candidate(p_user,c.id,to_jsonb(e));
 for m in select v from jsonb_array_elements(matches) v loop
 t:=m->'template';
 if (p_phase='before_class') is distinct from (t->>'trigger'='before_class') then continue; end if;
 raw_release:=case when p_phase='before_class' then coalesce(e.starts_at,e.on_date::timestamp at time zone 'Asia/Shanghai')-make_interval(mins=>(t->>'trigger_minutes')::int) when p_phase='manual_after_class' then least(e.release_at,p_now) else e.release_at end;
 phase_release:=greatest(raw_release,coalesce(c.automation_enabled_at,raw_release));
 if not p_revise and phase_release>p_now then continue; end if;
 key:=m->>'source_key'; keys:=array_append(keys,key); target:=m->'target_snapshot';
 material:=private.task_resolve_materials(p_user,c.id,m->'scope',m->'material_selector',target);
 deadline:=private.task_deadline(t->'deadline',c.default_deadline,to_jsonb(e),next_event,p_phase);
 if not p_revise and p_phase='before_class' and raw_release<c.automation_enabled_at and (deadline->>'due_at')::timestamptz<=c.automation_enabled_at then continue; end if;
 if raw_release>(deadline->>'due_at')::timestamptz then
 window_issue:=jsonb_build_object('code','release_after_deadline','source_key',key);
 update public.task_course_events set runtime_issues=runtime_issues||jsonb_build_array(window_issue) where id=e.id and not runtime_issues @> jsonb_build_array(window_issue);
 end if;
 selection:=case when c.subject='math' and t->>'mode'='checklist' and t->>'item_source'<>'class' then 'pending' else 'ready' end;
 new_items:='[]';
 if c.subject='math' and t->>'item_source'='class' then
 select coalesce(jsonb_agg(jsonb_build_object('id',v,'label',v,'done',false)),'[]') into new_items from jsonb_array_elements_text(coalesce(target->'problem_keys','[]')) v;
 if new_items='[]' then selection:='pending'; end if;
 elsif selection='ready' and t->>'progress_mode'='items' then
 select coalesce(jsonb_agg(jsonb_build_object('id','check:'||private.task_uri(coalesce(target->'lesson'->>'key',''))||':'||ord,'label',v,'done',false) order by ord),'[]') into new_items from jsonb_array_elements_text(t->'checklist') with ordinality x(v,ord);
 end if;
 select * into item from public.task_instances where user_id=p_user and source_key=key;
 if found then
 if not p_revise or item.status='completed' then continue; end if;
 changed:=coalesce(item.content_snapshot->'lesson'->>'key','') is distinct from coalesce(target->'lesson'->>'key','') or item.content_snapshot->'cursor' is distinct from target->'cursor' or item.content_snapshot->'problem_keys' is distinct from target->'problem_keys';
 insert into public.task_progress_events(user_id,task_id,revision,kind,payload) values(p_user,item.id,item.revision,'content_revision',jsonb_build_object('task',to_jsonb(item))) on conflict do nothing;
 select coalesce(jsonb_agg(v||jsonb_build_object('done',coalesce((select done from public.task_instance_items x where x.user_id=p_user and x.task_id=item.id and x.item_key=v->>'id'),false))),'[]') into new_items from jsonb_array_elements(new_items) v;
 update public.task_instances set title=(t->>'name')||case when target->'lesson'->>'title' is not null then ' · '||(target->'lesson'->>'title') else '' end,
 lesson=target->'lesson',content_snapshot=target,items=new_items,revision=revision+1,
 completion_percent=case when changed and progress_mode='percentage' then 0 else completion_percent end,
 status=case when status='cancelled' or (changed and progress_mode='percentage') then 'pending' else status end,
 -- Content/schedule revision is not an explicit original-deadline edit.
 due_at=case when item.due_at<=p_now then item.due_at else (deadline->>'due_at')::timestamptz end,
 due_kind=case when item.due_at<=p_now then item.due_kind else deadline->>'kind' end,template_snapshot=t||jsonb_build_object('resolved_deadline',deadline->'policy'),selection_state=selection,material_status=material->>'status',material_assets=material->'asset_ids' where id=item.id;
 taskid:=item.id;
 else
 insert into public.task_instances(user_id,title,subject,course_id,occurrence_id,template_id,source_key,mode,items,lesson,due_at,due_kind,estimated_minutes,material_kind,template_snapshot,course_event_id,event_key,progress_mode,release_at,selection_state,material_status,material_assets,content_snapshot)
 values(p_user,(t->>'name')||case when target->'lesson'->>'title' is not null then ' · '||(target->'lesson'->>'title') else '' end,c.subject,c.id,e.occurrence_id,(t->>'id')::uuid,key,t->>'mode',new_items,target->'lesson',(deadline->>'due_at')::timestamptz,deadline->>'kind',(m->>'estimated_minutes')::int,t->>'material_kind',t||jsonb_build_object('resolved_deadline',deadline->'policy'),e.id,e.event_key,t->>'progress_mode',phase_release,selection,material->>'status',material->'asset_ids',target)
 on conflict(user_id,source_key) do nothing returning id into taskid;
 end if;
 if taskid is not null then
 update public.task_instance_items set cancelled=true where user_id=p_user and task_id=taskid and not(item_key in(select v->>'id' from jsonb_array_elements(new_items) v));
 insert into public.task_instance_items(user_id,task_id,item_key,label,done,sort_order)
 select p_user,taskid,v->>'id',v->>'label',coalesce((v->>'done')::boolean,false),ord::int from jsonb_array_elements(new_items) with ordinality x(v,ord)
 on conflict(user_id,task_id,item_key) do update set label=excluded.label,cancelled=false,sort_order=excluded.sort_order;
 end if;
 end loop;
 if p_revise then
 update public.task_instances set status='cancelled' where user_id=p_user and course_event_id=e.id and status<>'completed' and not(source_key=any(keys)) and ((template_snapshot->>'trigger'='before_class')=(p_phase='before_class'));
 update public.task_reminders set status='cancelled' where user_id=p_user and task_id in(select id from public.task_instances where user_id=p_user and course_event_id=e.id and status='cancelled') and status in ('pending','sending','failed');
 end if;
 update public.task_course_events set runtime_issues=runtime_issues||case when e.next_snapshot is null and exists(select 1 from public.task_course_pool_bindings b join public.task_templates t on t.user_id=b.user_id and t.id=b.pool_item_id where b.user_id=p_user and b.course_id=c.id and b.enabled and t.enabled and t.target='next') then '[{"code":"missing_next_lesson"}]'::jsonb else '[]'::jsonb end where id=e.id and not runtime_issues @> '[{"code":"missing_next_lesson"}]';
end $$;

create or replace function private.task_finish_phase(p_user uuid,p_event uuid,p_now timestamptz,p_manual boolean default false) returns void language plpgsql set search_path='' as $$
declare e public.task_course_events; c public.task_courses; s jsonb; advancement jsonb;
begin
 select * into strict e from public.task_course_events where user_id=p_user and id=p_event;
 select * into strict c from public.task_courses where user_id=p_user and id=e.course_id;
 if e.assignment_state='cancelled' or c.archived_at is not null then return; end if;
 if not p_manual and e.release_at>p_now then return; end if;

 if (c.auto_assign or p_manual) and (not e.after_processed or e.assignment_state='skipped' or e.assignment_state='pending') then
 perform private.task_emit_event(p_user,e.id,case when p_manual then 'manual_after_class' else 'after_class' end,p_now);
 update public.task_course_events set assignment_state='assigned' where id=e.id;
 elsif not e.after_processed then update public.task_course_events set assignment_state='skipped' where id=e.id; end if;
 if c.auto_advance and not e.cursor_advanced and (not e.after_processed or p_manual) and c.cursor is not null then
 select to_jsonb(x) into s from public.task_course_catalog_snapshots x where x.user_id=p_user and x.id=c.catalog_snapshot_id;
 -- Advance the live cursor, never restore an old projected preview cursor.
 advancement:=private.task_advance(s,c.cursor);
 update public.task_courses set cursor=case when advancement->>'kind'='next' then advancement->'cursor' else cursor end,cursor_revision=cursor_revision+1,
 generation_state=case advancement->>'kind' when 'finished' then 'finished' when 'missing_segment' then 'paused' else 'active' end,
 generation_issue=case when advancement->>'kind'='missing_segment' then advancement else null end where id=c.id;
 update public.task_course_events set cursor_advanced=true where id=e.id;
 end if;
 update public.task_course_events set after_processed=true where id=e.id;
end $$;

create or replace function public.task_save_course(p_course jsonb,p_rules jsonb,p_effective_from date default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; rid uuid; old_rid uuid; is_new boolean; rule_start date; item jsonb; old_rule public.task_timetable_rules; new_rule public.task_timetable_rules; effective date:=coalesce(p_effective_from,(now() at time zone 'Asia/Shanghai')::date); seen uuid[]:='{}'; prior public.task_courses; snapshot public.task_course_catalog_snapshots; proposed jsonb; sid uuid; binding jsonb; binding_ids uuid[]:='{}'; bid uuid; kind text; cur jsonb; resume_result jsonb;
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
 if p_course ? 'cursor' and (p_course->>'expected_cursor_revision')::int is distinct from prior.cursor_revision then raise exception 'stale_cursor_revision'; end if;
 end if;
 -- Task4 replaces this pre-mutation hook with due-event catch-up under the same lock.
 perform public.task_course_before_configuration_change(u,cid);
 if current_setting('task.catchup_pending',true)='true' then return null; end if;
 -- Hook may advance the cursor; never restore the pre-hook full draft.
 if cid is not null then select * into prior from public.task_courses where user_id=u and id=cid; end if;
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
 if p_course->>'cursor_intent'='resume' then
 if prior.generation_state<>'paused' or prior.generation_issue->>'kind'<>'missing_segment' or prior.cursor is distinct from cur or snapshot.progression_mode<>'segment'
 or not exists(select 1 from public.task_course_events where user_id=u and course_id=cid and cursor_advanced and lesson_snapshot->'cursor'=prior.cursor)
 then raise exception 'invalid_resume_intent'; end if;
 resume_result:=private.task_advance(to_jsonb(snapshot),cur);
 if resume_result->>'kind'='next' then cur:=resume_result->'cursor'; end if;
 elsif p_course ? 'cursor_intent' and p_course->>'cursor_intent'<>'set' then raise exception 'invalid_cursor_intent'; end if;
 if coalesce((p_course->>'auto_advance')::boolean,prior.auto_advance,false) and (sid is null or cur is null) then raise exception 'automation_requires_catalog_cursor'; end if;
 if cid is null then
 insert into public.task_courses(user_id,name,subject) values(u,p_course->>'name',p_course->>'subject') returning id into cid;
 elsif not exists(select 1 from public.task_courses where user_id=u and id=cid) then raise exception 'course_not_owned'; end if;
 update public.task_courses set name=p_course->>'name',subject=p_course->>'subject',calendar_id=nullif(p_course->>'calendar_id','')::uuid,
 teacher=coalesce(p_course->>'teacher',''),location=coalesce(p_course->>'location',''),credits=nullif(p_course->>'credits','')::numeric,
 notes=coalesce(p_course->>'notes',''),color=coalesce(p_course->>'color','#39765c'),reminder_minutes=case when p_course ? 'reminder_minutes' then (p_course->>'reminder_minutes')::int else 10 end
 where user_id=u and id=cid;
 update public.task_courses set course_type=kind, auto_assign=coalesce((p_course->>'auto_assign')::boolean,prior.auto_assign,false), auto_advance=coalesce((p_course->>'auto_advance')::boolean,prior.auto_advance,false),
 default_deadline=case when p_course ? 'default_deadline' then nullif(p_course->'default_deadline','null'::jsonb) else prior.default_deadline end,
 catalog_snapshot_id=sid,cursor=cur,
 cursor_revision=case when is_new then 1 else prior.cursor_revision+case when p_course ? 'cursor' then 1 else 0 end end,
 generation_date=case when prior.generation_state in ('paused','finished') and (p_course ? 'cursor' or sid is distinct from prior.catalog_snapshot_id) then (now() at time zone 'Asia/Shanghai')::date when prior.automation_enabled_at is null then null else prior.generation_date end,
 generation_state=case when resume_result->>'kind'='missing_segment' then 'paused' when resume_result->>'kind'='finished' then 'finished' when p_course ? 'cursor' or sid is distinct from prior.catalog_snapshot_id then 'active' else coalesce(prior.generation_state,'active') end,
 generation_issue=case when resume_result->>'kind'='missing_segment' then resume_result when p_course ? 'cursor' or sid is distinct from prior.catalog_snapshot_id then null else prior.generation_issue end,
 rules_revision=coalesce(prior.rules_revision,0)+1,effective_from=effective,
 automation_enabled_at=case when (coalesce((p_course->>'auto_assign')::boolean,prior.auto_assign,false) or coalesce((p_course->>'auto_advance')::boolean,prior.auto_advance,false)) then coalesce(prior.automation_enabled_at,now()) else null end
 where user_id=u and id=cid;
 -- A skipped current flexible date is still eligible on first assignment activation.
 -- Retain its content/completion/cursor history; re-arm only its unassigned phase.
 if not coalesce(prior.auto_assign,false) and coalesce((p_course->>'auto_assign')::boolean,false) then
 update public.task_course_events e set after_processed=false,assignment_state='pending',
 release_at=greatest(e.on_date::timestamp at time zone 'Asia/Shanghai',now())
 where e.user_id=u and e.course_id=cid and e.on_date=(now() at time zone 'Asia/Shanghai')::date
 and e.starts_at is null and e.completion_state='pending' and e.assignment_state='skipped';
 end if;
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

create or replace function private.task_reconcile(p_user uuid,p_now timestamptz) returns void language plpgsql security definer set search_path='' as $$
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
 insert into public.task_reminders(user_id,exam_id,source_key,title,remind_at,expires_at)
 select p_user,e.id,'exam:'||e.id,'即将考试：'||e.title,e.starts_at-make_interval(mins=>e.reminder_minutes),e.ends_at
 from public.task_exams e where e.user_id=p_user and e.ends_at>p_now and e.reminder_minutes is not null
 and (e.course_id is null or exists(select 1 from public.task_courses c where c.id=e.course_id and c.user_id=p_user and c.archived_at is null))
 on conflict(user_id,source_key) do update set remind_at=excluded.remind_at,expires_at=excluded.expires_at,title=excluded.title,status=case when task_reminders.read_at is null then 'pending' else task_reminders.status end;
 update public.task_reminders rem set status='cancelled' where rem.user_id=p_user and rem.status in ('pending','sending','failed') and (
 (rem.source_key like 'course-start:%' and exists(select 1 from public.task_course_occurrences occ_row join public.task_courses c on c.id=occ_row.course_id and c.user_id=occ_row.user_id where occ_row.id=rem.occurrence_id and occ_row.user_id=p_user and (c.reminder_minutes is null or c.archived_at is not null)))
 or (rem.exam_id is not null and exists(select 1 from public.task_exams e where e.id=rem.exam_id and e.user_id=p_user and (e.reminder_minutes is null or exists(select 1 from public.task_courses c where c.id=e.course_id and c.user_id=p_user and c.archived_at is not null)))));
 update public.task_reminders rem set status='cancelled' where rem.user_id=p_user and rem.status in ('pending','sending','failed') and (
 (rem.expires_at is not null and rem.expires_at<=p_now)
 or exists(select 1 from public.task_instances inst where inst.id=rem.task_id and inst.status in ('completed','cancelled'))
 or exists(select 1 from public.task_course_occurrences occ where occ.id=rem.occurrence_id and (occ.status='cancelled' or (rem.task_id is null and occ.status='confirmed'))));
end $$;

commit;
