begin;
insert into auth.users(id) values('74747474-7474-7474-7474-747474747474');
select set_config('request.jwt.claim.sub','74747474-7474-7474-7474-747474747474',true);
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
do $$
declare u uuid:='74747474-7474-7474-7474-747474747474'; c uuid; t uuid; e public.task_course_events; r public.task_timetable_rules; day date:=(now() at time zone 'Asia/Shanghai')::date; answer uuid; xid uuid;
begin
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,auto_advance) values(u,'activation','art','flexible',false,false) returning id into c;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date) values(u,c,'flexible',extract(dow from day)::int,null,null,day-7,day-7) returning * into r;
 insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,deadline)
 values(u,c,'review','checklist','after_class','current','review','{"kind":"none"}','{"kind":"same_day","time":"20:30","days":1,"at":null}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 perform private.task_process_due_user(u,now(),100);
 select * into strict e from public.task_course_events where course_id=c and on_date=day;
 if not e.after_processed or e.assignment_state<>'skipped' then raise exception 'fixture_not_skipped'; end if;
 answer:=public.task_save_course(jsonb_build_object('id',c,'name','activation','subject','art','course_type','flexible','rules_revision',1,'auto_assign',true),jsonb_build_array(to_jsonb(r)),day);
 if answer is null then raise exception 'activation_save_retry'; end if;
 perform private.task_process_due_user(u,now(),100);
 if (select count(*) from public.task_instances where course_id=c and status<>'cancelled')<>1 then raise exception 'same_day_first_activation_lost'; end if;
 if exists(select 1 from public.task_instances where course_id=c and release_at<(select automation_enabled_at from public.task_courses where id=c)) then raise exception 'activation_release_backdated'; end if;
 perform private.task_process_due_user(u,now()+interval '1 second',100);
 if (select count(*) from public.task_instances where course_id=c)<>1 then raise exception 'activation_duplicate_or_historical_backfill'; end if;
end $$;
rollback;
