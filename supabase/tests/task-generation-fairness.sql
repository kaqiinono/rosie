begin;
insert into auth.users(id) values('99999999-9999-9999-9999-999999999999');
select set_config('request.jwt.claim.sub','99999999-9999-9999-9999-999999999999',true);
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
do $$ declare u uuid:=auth.uid(); c uuid; first_course uuid; s uuid; rid uuid; t uuid; i int; answer jsonb; day date:=(now() at time zone 'Asia/Shanghai')::date; point timestamptz:=day::timestamp at time zone 'Asia/Shanghai'; r public.task_timetable_rules; saved uuid; begin
insert into public.task_course_catalog_snapshots(user_id,subject,version,source,progression_mode,ordered_lessons,teaching_segments) values(u,'art','repair','manual','lesson','[{"key":"a","title":"A","book":"B","unit":"1","kind":"lesson"},{"key":"b","title":"B","book":"B","unit":"1","kind":"lesson"},{"key":"c","title":"C","book":"B","unit":"2","kind":"lesson"}]','[]') returning id into s;
 for i in 1..3 loop
 insert into public.task_courses(id,user_id,name,subject,course_type,auto_assign,auto_advance,catalog_snapshot_id,cursor,automation_enabled_at) values(('99999999-9999-9999-9999-99999999990'||i)::uuid,u,'fair '||i,'art','flexible',true,true,s,'{"lesson_key":"a","segment_key":null}',point) returning id into c;
 if i=1 then first_course:=c; end if;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date,recurrence) values(u,c,'flexible',extract(dow from day)::int,null,null,day,day,'once') returning id into rid;
 insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,deadline) values(u,c,'review','reading','after_class','current','review','{"kind":"none"}','{"kind":"same_day","time":"20:30","days":1,"at":null}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 end loop;
 answer:=private.task_process_due_user(u,point,2);
 if not (answer->>'has_more')::boolean or (select count(*) from public.task_instances where user_id=u)<>2 then raise exception 'first_batch_not_bounded'; end if;
 answer:=private.task_process_due_user(u,point,2);
 if (answer->>'has_more')::boolean or (select count(*) from public.task_instances where user_id=u)<>3 then raise exception 'same_day_third_course_starved'; end if;
 for i in 1..2 loop
 answer:=private.task_process_due_user(u,point+make_interval(secs=>i),2);
 if (answer->>'has_more')::boolean or (answer->>'processed')::int<>0 then raise exception 'empty_today_consumes_changed_now_budget'; end if;
 end loop;
 -- Today remains open for a later explicit release with no fabricated clocks.
 insert into public.task_course_events(user_id,course_id,event_key,on_date,release_at) values(u,first_course,'flexible:'||first_course||':'||day||':extra:fairness',day,point+interval '1 hour');
 answer:=private.task_process_due_user(u,point+interval '1 hour',2);
 if (answer->>'has_more')::boolean or (select count(*) from public.task_instances where user_id=u)<>4 or (select cursor->>'lesson_key' from public.task_courses where id=first_course)<>'c' then raise exception 'later_today_release_missed'; end if;
 select * into r from public.task_timetable_rules where course_id=first_course;
 saved:=public.task_save_course((select to_jsonb(x)-'cursor' from public.task_courses x where x.id=first_course)||'{"name":"saved after converged catchup"}',jsonb_build_array(to_jsonb(r)),day);
 if saved is null then raise exception 'converged_save_still_retries'; end if;
end $$;
rollback;
