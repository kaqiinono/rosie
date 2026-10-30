begin;
insert into auth.users(id) values('74747474-7474-7474-7474-747474747474');
select set_config('request.jwt.claim.sub','74747474-7474-7474-7474-747474747474',true);
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
do $$
declare u uuid:='74747474-7474-7474-7474-747474747474'; c uuid; t uuid; sid uuid; e public.task_course_events; r public.task_timetable_rules; day date:=(now() at time zone 'Asia/Shanghai')::date; answer uuid; xid uuid;
begin
 insert into public.task_course_catalog_snapshots(user_id,subject,version,source,progression_mode,ordered_lessons,teaching_segments) values(u,'art','early','manual','lesson','[{"key":"a","title":"A","book":"B","unit":"1","kind":"lesson"},{"key":"b","title":"B","book":"B","unit":"1","kind":"lesson"}]','[]') returning id into sid;
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,auto_advance,catalog_snapshot_id,cursor,automation_enabled_at) values(u,'early','art','timetabled',true,true,sid,'{"lesson_key":"a","segment_key":null}','2026-10-26T00:00:00+08:00') returning id into c;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date) values(u,c,'timetabled',1,'16:00','17:00','2026-10-26','2026-10-26') returning * into r;
 insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,deadline)
 values(u,c,'review','checklist','after_class','current','review','{"kind":"none"}','{"kind":"same_day","time":"20:30","days":1,"at":null}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 perform private.task_materialize(u,c,to_jsonb(x),null) from private.task_candidates(u,c,'2026-10-26','2026-10-26') x;
 select * into strict e from public.task_course_events where course_id=c;
 perform private.task_complete_event(u,e.id,e.revision,'2026-10-26T15:00:00+08:00');
 if (select count(*) from public.task_instances where course_id=c and status<>'cancelled')<>1 then raise exception 'early_manual_completion_lost_after_task'; end if;
 if (select ends_at from public.task_course_events where id=e.id)<>'2026-10-26T17:00:00+08:00'::timestamptz or (select release_at from public.task_course_events where id=e.id)<>'2026-10-26T17:00:00+08:00'::timestamptz then raise exception 'manual_changed_scheduled_clock'; end if;
 if (select due_at from public.task_instances where course_id=c)<>'2026-10-26T20:30:00+08:00'::timestamptz then raise exception 'manual_changed_deadline_policy'; end if;
 if (select release_at from public.task_instances where course_id=c)>'2026-10-26T15:00:00+08:00' then raise exception 'manual_task_not_available'; end if;
 perform private.task_process_due_user(u,'2026-10-26T18:00:00+08:00',100);
 select * into e from public.task_course_events where id=e.id;
 perform private.task_complete_event(u,e.id,e.revision,'2026-10-26T18:01:00+08:00');
 if (select count(*) from public.task_instances where course_id=c)<>1 or e.completion_state<>'completed' then raise exception 'manual_duplicate_or_completion_lost'; end if;
 if (select cursor->>'lesson_key' from public.task_courses where id=c)<>'b' or (select cursor_revision from public.task_courses where id=c)<>2 then raise exception 'early_completion_advanced_twice'; end if;
end $$;
rollback;
