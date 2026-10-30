begin;
insert into auth.users(id) values('74747474-7474-7474-7474-747474747474');
select set_config('request.jwt.claim.sub','74747474-7474-7474-7474-747474747474',true);
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
do $$
declare u uuid:='74747474-7474-7474-7474-747474747474'; c uuid; t uuid; e public.task_course_events; r public.task_timetable_rules; day date:=(now() at time zone 'Asia/Shanghai')::date; answer uuid; xid uuid;
begin
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,automation_enabled_at) values(u,'restore','art','timetabled',true,now()-interval '1 day') returning id into c;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date,created_at) values(u,c,'timetabled',extract(dow from day)::int,'23:00','23:30',day,day,now()-interval '1 day') returning * into r;
 insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,deadline)
 values(u,c,'review','checklist','after_class','current','review','{"kind":"none"}','{"kind":"same_day","time":"20:30","days":1,"at":null}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 update public.task_templates set trigger='before_class',trigger_minutes=2880 where id=t;
 perform private.task_process_due_user(u,now(),100);
 select * into strict e from public.task_course_events where course_id=c and on_date=day;
 if (select count(*) from public.task_instances where course_id=c and status<>'cancelled')<>1 then raise exception 'fixture_preview_missing'; end if;
 perform public.task_cancel_event(e.id,e.revision);
 select id into strict xid from public.task_course_exceptions where rule_id=r.id and original_date=day;
 set local role authenticated;
 delete from public.task_course_exceptions where id=xid;
 reset role;
 perform public.task_tick(u);
 select * into strict e from public.task_course_events where id=e.id;
 if (select status from public.task_course_occurrences where id=e.occurrence_id)<>'scheduled' then raise exception 'restored_occurrence_missing'; end if;
 if e.assignment_state='cancelled' then raise exception 'restore_left_event_cancelled'; end if;
 if (select count(*) from public.task_instances where course_id=c and status<>'cancelled')<>1 then raise exception 'restore_left_tasks_absent'; end if;
 if e.after_processed or e.cursor_advanced then raise exception 'restore_advanced_early'; end if;
 if (select count(*) from public.task_instances where course_id=c)<>1 then raise exception 'restore_duplicate_identity'; end if;
end $$;
do $$
declare u uuid:='74747474-7474-7474-7474-747474747474'; c uuid; t uuid; sid uuid; e public.task_course_events; r public.task_timetable_rules; day date:=(now() at time zone 'Asia/Shanghai')::date-1; xid uuid;
begin
 update public.task_courses set archived_at=now() where user_id=u;
 insert into public.task_course_catalog_snapshots(user_id,subject,version,source,progression_mode,ordered_lessons,teaching_segments)
 values(u,'art','restore-progress','manual','lesson','[{"key":"a","title":"A","book":"B","unit":"1","kind":"lesson"},{"key":"b","title":"B","book":"B","unit":"1","kind":"lesson"}]','[]') returning id into sid;
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,auto_advance,catalog_snapshot_id,cursor,automation_enabled_at)
 values(u,'past restoration','art','flexible',true,true,sid,'{"lesson_key":"a","segment_key":null}',day::timestamp at time zone 'Asia/Shanghai') returning id into c;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date,recurrence)
 values(u,c,'flexible',extract(dow from day)::int,null,null,day,day,'once') returning * into r;
 insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,progress_mode,deadline)
 values(u,c,'review','reading','after_class','current','review','{"kind":"none"}','percentage','{"kind":"same_day","time":"20:30","days":1,"at":null}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,progress_mode,deadline)
 values(u,c,'done','reading','after_class','current','done','{"kind":"none"}','percentage','{"kind":"same_day","time":"20:30","days":1,"at":null}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 perform private.task_process_due_user(u,now(),100);
 select * into strict e from public.task_course_events where course_id=c;
 update public.task_instances set completion_percent=50,status='active' where course_id=c and template_id<>t;
 update public.task_instances set completion_percent=100,status='completed' where course_id=c and template_id=t;
 perform public.task_cancel_event(e.id,e.revision);
 -- Already assigned work survives disabled automation and retains stable progress/history.
 update public.task_courses set auto_assign=false,auto_advance=false where id=c;
 select id into strict xid from public.task_course_exceptions where rule_id=r.id and original_date=day;
 set local role authenticated;
 delete from public.task_course_exceptions where id=xid;
 reset role;
 perform public.task_tick(u);
 perform public.task_tick(u);
 select * into strict e from public.task_course_events where id=e.id;
 if e.assignment_state<>'assigned' or not e.after_processed or not e.cursor_advanced then raise exception 'past_restore_phase_lost'; end if;
 if (select count(*) from public.task_instances where course_id=c)<>2 then raise exception 'past_restore_duplicate'; end if;
 if not exists(select 1 from public.task_instances where course_id=c and template_id<>t and status='pending' and completion_percent=50) then raise exception 'restored_progress_lost'; end if;
 if not exists(select 1 from public.task_instances where course_id=c and template_id=t and status='completed' and completion_percent=100) then raise exception 'restored_completed_history_lost'; end if;
 if (select cursor->>'lesson_key' from public.task_courses where id=c)<>'b' or (select cursor_revision from public.task_courses where id=c)<>2 then raise exception 'restore_advanced_cursor_twice'; end if;
end $$;
rollback;
