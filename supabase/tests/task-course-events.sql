-- Run only against a disposable validation database with the task migrations installed.
-- Every fixture and assertion is rolled back. Never run against production.
begin;
insert into auth.users(id) values ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
insert into public.task_courses(id,user_id,name,subject,course_type) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','SQL assertion A','english','flexible'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','SQL assertion B','english','timetabled');
insert into public.task_timetable_rules(id,user_id,course_id,weekday,kind,valid_from,start_time,end_time) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',4,'flexible','2026-10-29',null,null);
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ begin
 if (select count(*) from public.task_courses where name like 'SQL assertion %')<>1 then raise exception 'RLS leaked courses'; end if;
 begin
  insert into public.task_timetable_rules(user_id,course_id,weekday,kind,valid_from,start_time,end_time)
  values(auth.uid(),'20000000-0000-0000-0000-000000000001',4,'flexible','2026-10-29','09:00','10:00');
  raise exception 'flexible clock was accepted';
 exception when check_violation then null; end;
 begin
  insert into public.task_timetable_rules(user_id,course_id,weekday,kind,valid_from,start_time,end_time)
  values(auth.uid(),'20000000-0000-0000-0000-000000000001',4,'timetabled','2026-10-29',null,null);
  raise exception 'missing timetable clock was accepted';
 exception when check_violation then null; end;
 begin
  insert into public.task_timetable_rules(user_id,course_id,weekday,kind,valid_from,start_time,end_time)
  values(auth.uid(),'20000000-0000-0000-0000-000000000002',4,'timetabled','2026-10-29','09:00','10:00');
  raise exception 'cross-owner rule was accepted';
 exception when foreign_key_violation then null; end;
 begin
  insert into public.task_course_events(user_id,course_id,event_key,on_date,release_at)
  values(auth.uid(),'20000000-0000-0000-0000-000000000002','foreign-owner','2026-10-29','2026-10-28T16:00:00Z');
  raise exception 'cross-owner FK was accepted';
 exception when foreign_key_violation then null; end;
 begin
  insert into public.task_course_events(user_id,course_id,event_key,on_date,release_at)
  values('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','foreign-user','2026-10-29','2026-10-28T16:00:00Z');
  raise exception 'cross-owner write was accepted';
 exception when insufficient_privilege then null; end;
end $$;
insert into public.task_course_events(user_id,course_id,event_key,on_date,release_at) values
 (auth.uid(),'20000000-0000-0000-0000-000000000001','flexible:20000000-0000-0000-0000-000000000001:2026-10-29','2026-10-29','2026-10-28T16:00:00Z');
do $$ begin
 begin
  insert into public.task_course_events(user_id,course_id,event_key,on_date,release_at)
  values(auth.uid(),'20000000-0000-0000-0000-000000000001','flexible:20000000-0000-0000-0000-000000000001:2026-10-29','2026-10-29','2026-10-28T16:00:00Z');
  raise exception 'duplicate event was accepted';
 exception when unique_violation then null; end;
 begin
  insert into public.task_course_events(user_id,course_id,event_key,on_date,release_at)
  values(auth.uid(),'20000000-0000-0000-0000-000000000001','wrong-midnight','2026-10-29','2026-10-29T00:00:00Z');
  raise exception 'host midnight was accepted';
 exception when check_violation then null; end;
 if has_table_privilege('authenticated','public.task_progress_events','SELECT') or has_table_privilege('authenticated','public.task_progress_events','INSERT') then raise exception 'browser can access audit control table'; end if;
 if has_table_privilege('anon','public.task_course_events','SELECT') then raise exception 'anonymous event access'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
 if exists(select 1 from public.task_course_events where event_key like 'flexible:20000000%') then raise exception 'RLS leaked event'; end if;
 update public.task_course_events set assignment_state='assigned' where event_key like 'flexible:20000000%';
 if found then raise exception 'RLS allowed foreign event update'; end if;
end $$;
reset role;
-- Current course type is not a constraint on retired rule/occurrence history.
update public.task_timetable_rules set disabled_from='2026-10-30' where id='30000000-0000-0000-0000-000000000001';
update public.task_courses set course_type='timetabled' where id='20000000-0000-0000-0000-000000000001';
do $$ begin
 if not exists(select 1 from public.task_timetable_rules where id='30000000-0000-0000-0000-000000000001' and kind='flexible' and start_time is null) then raise exception 'course type change rewrote historical rule'; end if;
end $$;
rollback;
