begin;
insert into auth.users(id) values('99999999-9999-9999-9999-999999999999');
select set_config('request.jwt.claim.sub','99999999-9999-9999-9999-999999999999',true);
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
do $$ declare u uuid:=auth.uid(); c uuid; s uuid; rid uuid; eid uuid; tid uuid; taskid uuid; n int; point timestamptz:=now(); before_due timestamptz; new_start timestamptz; begin
insert into public.task_course_catalog_snapshots(user_id,subject,version,source,progression_mode,ordered_lessons,teaching_segments) values(u,'art','repair','manual','lesson','[{"key":"a","title":"A","book":"B","unit":"1","kind":"lesson"},{"key":"b","title":"B","book":"B","unit":"1","kind":"lesson"},{"key":"c","title":"C","book":"B","unit":"2","kind":"lesson"}]','[]') returning id into s;
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,catalog_snapshot_id,cursor,automation_enabled_at) values(u,'preview deadline','art','timetabled',true,s,'{"lesson_key":"a","segment_key":null}',point-interval '3 days') returning id into c;
 insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,trigger_minutes,progress_mode,deadline) values(u,c,'preview','reading','before_class','current','preview','{"kind":"none"}',2880,'percentage','{"kind":"course_default","time":"20:30","days":1,"at":null}') returning id into tid;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,tid);
 for n in 0..1 loop
 before_due:=point+case when n=0 then interval '-1 hour' else interval '1 day' end;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date,recurrence) values(u,c,'timetabled',extract(dow from before_due at time zone 'Asia/Shanghai')::int,'16:00','17:00',(before_due at time zone 'Asia/Shanghai')::date,(before_due at time zone 'Asia/Shanghai')::date,'once') returning id into rid;
 eid:=private.task_materialize(u,c,jsonb_build_object('event_key','timetabled:'||rid||':'||(before_due at time zone 'Asia/Shanghai')::date,'rule_id',rid,'on_date',(before_due at time zone 'Asia/Shanghai')::date,'starts_at',before_due,'ends_at',before_due+interval '2 hours','release_at',before_due+interval '2 hours'),'{"lesson_key":"a","segment_key":null}');
 perform private.task_emit_event(u,eid,'before_class',point);
 select id into strict taskid from public.task_instances where course_event_id=eid;
 update public.task_instances set completion_percent=40 where id=taskid;
 new_start:=point+interval '2 days';
 update public.task_course_events set on_date=(new_start at time zone 'Asia/Shanghai')::date,starts_at=new_start,ends_at=new_start+interval '1 hour',release_at=new_start+interval '1 hour' where id=eid;
 perform private.task_revise_event(u,eid,'{"cursor":{"lesson_key":"b","segment_key":null}}',1,point,false);
 if (select due_at from public.task_instances where id=taskid) is distinct from (case when n=0 then before_due else new_start end) then raise exception 'preview_deadline_revision_%',n; end if;
 if (select completion_percent from public.task_instances where id=taskid)<>0 or (select count(*) from public.task_instances where course_event_id=eid)<>1 then raise exception 'preview_progress_or_identity'; end if;
 end loop;
end $$;
rollback;
