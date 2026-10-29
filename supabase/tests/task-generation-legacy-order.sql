begin;
insert into auth.users(id) values('99999999-9999-9999-9999-999999999999');
select set_config('request.jwt.claim.sub','99999999-9999-9999-9999-999999999999',true);
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
do $$ declare u uuid:=auth.uid(); c uuid; s uuid; rid uuid; oid uuid; target uuid; t uuid; n int; day date:=(now() at time zone 'Asia/Shanghai')::date; e public.task_course_events; begin
insert into public.task_course_catalog_snapshots(user_id,subject,version,source,progression_mode,ordered_lessons,teaching_segments) values(u,'art','repair','manual','lesson','[{"key":"a","title":"A","book":"B","unit":"1","kind":"lesson"},{"key":"b","title":"B","book":"B","unit":"1","kind":"lesson"},{"key":"c","title":"C","book":"B","unit":"2","kind":"lesson"}]','[]') returning id into s;
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,auto_advance,catalog_snapshot_id,cursor,automation_enabled_at) values(u,'legacy order','art','timetabled',true,true,s,'{"lesson_key":"a","segment_key":null}',(day-3)::timestamp at time zone 'Asia/Shanghai') returning id into c;
 insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,deadline) values(u,c,'review','reading','confirmed','current','review','{"kind":"none"}','{"kind":"course_default","time":"20:30","days":1,"at":null}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 for n in 1..2 loop
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date,recurrence) values(u,c,'timetabled',extract(dow from day-3+n)::int,'16:00','17:00',day-3+n,day-3+n,'once') returning id into rid;
 insert into public.task_course_occurrences(user_id,course_id,rule_id,original_date,starts_at,ends_at) values(u,c,rid,day-3+n,(day-3+n+time '16:00') at time zone 'Asia/Shanghai',(day-3+n+time '17:00') at time zone 'Asia/Shanghai') returning id into oid;
 if n=2 then target:=oid; end if;
 end loop;
 perform public.task_confirm_course(target,'{}');
 if (select count(*) from public.task_course_events where course_id=c)<>2 then raise exception 'legacy_skipped_prior_due_event'; end if;
 if (select lesson_snapshot->'lesson'->>'key' from public.task_course_events where course_id=c and on_date=day-2)<>'a' or (select lesson_snapshot->'lesson'->>'key' from public.task_course_events where occurrence_id=target)<>'b' then raise exception 'legacy_reverse_content_order'; end if;
 if (select cursor->>'lesson_key' from public.task_courses where id=c)<>'c' then raise exception 'legacy_wrong_cursor'; end if;
 select * into strict e from public.task_course_events where occurrence_id=target;
 if e.completion_state<>'completed' or (select count(*) from public.task_instances where course_id=c)<>2 then raise exception 'legacy_completion_or_tasks'; end if;
 perform public.task_confirm_course(target,'{}');
 if (select count(*) from public.task_instances where course_id=c)<>2 or (select cursor->>'lesson_key' from public.task_courses where id=c)<>'c' then raise exception 'legacy_repeat_advanced'; end if;
 begin perform public.task_complete_event(e.id,e.revision-1); raise exception 'stale_version_accepted'; exception when others then if sqlerrm<>'stale_event_revision' then raise; end if; end;
end $$;
rollback;
