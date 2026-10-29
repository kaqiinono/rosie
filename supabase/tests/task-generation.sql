-- Disposable PostgreSQL assertion suite. No hosted mutation; all fixtures roll back.
begin;
insert into auth.users(id) values('44444444-4444-4444-4444-444444444444');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
do $$
declare u uuid:='44444444-4444-4444-4444-444444444444'; c uuid; s uuid; t uuid; e public.task_course_events; flags int; n int; answer jsonb;
begin
 insert into public.task_course_catalog_snapshots(user_id,subject,version,source,progression_mode,ordered_lessons,teaching_segments)
 values(u,'math','runtime-fixture','manual','lesson','[{"key":"a","title":"A","book":"B","unit":"1","kind":"lesson"},{"key":"b","title":"B","book":"B","unit":"1","kind":"lesson"}]','[]') returning id into s;
 for flags in 0..3 loop
  insert into public.task_courses(user_id,name,subject,course_type,auto_assign,auto_advance,catalog_snapshot_id,cursor,automation_enabled_at)
  values(u,'switch '||flags,'math','flexible',(flags&1)>0,(flags&2)>0,s,'{"lesson_key":"a","segment_key":null}','2026-10-26T09:00:00+08:00') returning id into c;
  insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date) values(u,c,'flexible',1,null,null,'2026-10-26','2026-10-26');
  insert into public.task_templates(user_id,course_id,name,subject,mode,trigger,target,activity_key,material_selector,deadline) values(u,c,'练习',null,'checklist','confirmed','current','练习:a/!','{"kind":"none"}','{"kind":"course_default","time":"20:30","days":1,"at":null}') returning id into t;
  insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
  perform private.task_process_due_user(u,'2026-10-26T09:01:00+08:00',100);
  select * into strict e from public.task_course_events where course_id=c and on_date='2026-10-26';
  if e.completed_at is not null or e.completion_state<>'pending' then raise exception 'assignment_is_not_completion'; end if;
  if e.release_at<>'2026-10-26T09:00:00+08:00'::timestamptz then raise exception 'flexible_activation'; end if;
  select count(*) into n from public.task_instances where course_id=c;
  if n<>(case when (flags&1)>0 then 1 else 0 end) then raise exception 'switch_assignment_%_%',flags,n; end if;
  if (select cursor->>'lesson_key' from public.task_courses where id=c)<>(case when (flags&2)>0 then 'b' else 'a' end) then raise exception 'switch_advance_%',flags; end if;
  if exists(select 1 from public.task_instances where course_id=c and (subject<>'math' or items<>'[]' or selection_state<>'pending')) then raise exception 'fake_math_problem_or_subject'; end if;
  perform private.task_complete_event(u,e.id,e.revision,'2026-10-26T09:02:00+08:00');
  select * into e from public.task_course_events where id=e.id;
  perform private.task_complete_event(u,e.id,e.revision,'2026-10-26T09:03:00+08:00');
  if (select count(*) from public.task_instances where course_id=c)<>1 then raise exception 'duplicate_manual_assignment'; end if;
  if (select cursor->>'lesson_key' from public.task_courses where id=c)<>(case when (flags&2)>0 then 'b' else 'a' end) then raise exception 'double_advance'; end if;
 end loop;
 -- Durable day cursor must make progress through long gaps in bounded calls.
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,automation_enabled_at) values(u,'catchup','art','flexible',true,'2026-08-01T00:00:00+08:00') returning id into c;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date) values(u,c,'flexible',1,null,null,'2026-08-01','2026-08-01');
 insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,deadline) values(u,c,'draw','checklist','after_class','current','draw','{"kind":"none"}','{"kind":"same_day","time":"20:30","days":1,"at":null}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 for n in 1..30 loop perform private.task_process_due_user(u,'2026-10-26T12:00:00+08:00',12); end loop;
 if (select count(*) from public.task_instances where course_id=c)<>13 then raise exception 'long_catchup'; end if;
 perform private.task_process_due_user(u,'2026-10-26T12:00:00+08:00',100);
 if (select count(*) from public.task_instances where course_id=c)<>13 then raise exception 'catchup_duplicates'; end if;
 if has_function_privilege('authenticated','private.task_process_due_user(uuid,timestamptz,integer)','execute') then raise exception 'browser_worker_access'; end if;
end $$;
-- Phase lifecycle: before-class work is independent from once-only after-class progress.
do $$
declare u uuid:='44444444-4444-4444-4444-444444444444'; c uuid; s uuid; t uuid; e public.task_course_events; first_task uuid; r uuid;
begin
 select id into s from public.task_course_catalog_snapshots where user_id=u and version='runtime-fixture';
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,auto_advance,catalog_snapshot_id,cursor,automation_enabled_at) values(u,'phase','english','timetabled',true,true,s,'{"lesson_key":"a","segment_key":null}','2026-11-01T00:00:00+08:00') returning id into c;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date) values(u,c,'timetabled',1,'16:00','17:00','2026-11-01','2026-11-01') returning id into r;
 insert into public.task_templates(user_id,course_id,name,subject,mode,trigger,target,activity_key,material_selector,trigger_minutes,progress_mode,deadline) values(u,c,'preview','english','reading','before_class','current','read','{"kind":"none"}',1440,'percentage','{"kind":"course_default","time":"20:30","days":1,"at":null}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 insert into public.task_templates(user_id,course_id,name,subject,mode,trigger,target,activity_key,material_selector,progress_mode,deadline) values(u,c,'review','english','reading','confirmed','current','read','{"kind":"none"}','percentage','{"kind":"course_default","time":"20:30","days":1,"at":null}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 perform private.task_process_due_user(u,'2026-11-01T15:59:00+08:00',100);
 if exists(select 1 from public.task_instances where course_id=c) then raise exception 'preview_early'; end if;
 perform private.task_process_due_user(u,'2026-11-01T16:00:00+08:00',100);
 select * into strict e from public.task_course_events where course_id=c and on_date='2026-11-02';
 if e.after_processed or e.cursor_advanced or e.assignment_state<>'pending' then raise exception 'preview_marked_after'; end if;
 if (select count(*) from public.task_instances where course_id=c)<>1 then raise exception 'preview_phase_only'; end if;
 if (select cursor->>'lesson_key' from public.task_courses where id=c)<>'a' then raise exception 'preview_moved_cursor'; end if;
 select id into first_task from public.task_instances where course_id=c;
 if (select due_at from public.task_instances where id=first_task)<>'2026-11-02T16:00:00+08:00'::timestamptz then raise exception 'preview_wrong_deadline'; end if;
 perform private.task_process_due_user(u,'2026-11-02T17:00:00+08:00',100);
 if (select count(*) from public.task_instances where course_id=c)<>2 then raise exception 'preview_suppressed_after'; end if;
 if (select cursor->>'lesson_key' from public.task_courses where id=c)<>'b' then raise exception 'after_did_not_advance'; end if;
 if (select lesson_snapshot->'lesson'->>'key' from public.task_course_events where id=e.id)<>'a' then raise exception 'content_followed_cursor'; end if;
 update public.task_instances set completion_percent=60,status='active' where id=first_task;
 perform private.task_revise_event(u,e.id,'{"cursor":{"lesson_key":"b","segment_key":null}}',e.revision,'2026-11-02T18:00:00+08:00');
 if (select completion_percent from public.task_instances where id=first_task)<>0 then raise exception 'changed_content_transferred_percentage'; end if;
 if not exists(select 1 from public.task_progress_events where task_id=first_task) then raise exception 'old_progress_lost'; end if;
 begin perform private.task_revise_event(u,e.id,'{"cursor":{"lesson_key":"a","segment_key":null}}',e.revision,'2026-11-02T18:01:00+08:00'); raise exception 'stale_not_rejected'; exception when others then if sqlerrm<>'stale_event_revision' then raise; end if; end;
 update public.task_instances set status='completed',completion_percent=100 where id=first_task;
 select * into e from public.task_course_events where id=e.id;
 perform private.task_revise_event(u,e.id,'{"cursor":{"lesson_key":"a","segment_key":null}}',e.revision,'2026-11-02T18:02:00+08:00');
 if (select content_snapshot->'lesson'->>'key' from public.task_instances where id=first_task)<>'b' then raise exception 'completed_history_overwritten'; end if;
end $$;
-- Actual public save path must retain the LIVE post-hook cursor and bounded retry commits.
do $$
declare u uuid:='44444444-4444-4444-4444-444444444444'; c uuid; s uuid; r public.task_timetable_rules; result uuid; day date:=(now() at time zone 'Asia/Shanghai')::date; tries int; rev int;
begin
 -- Retire preceding dated fixtures so their intentionally synthetic timelines do not affect this acceptance.
 update public.task_courses set archived_at=now() where user_id=u;
 select id into s from public.task_course_catalog_snapshots where user_id=u and version='runtime-fixture';
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,auto_advance,catalog_snapshot_id,cursor,automation_enabled_at) values(u,'unchanged','math','flexible',false,true,s,'{"lesson_key":"a","segment_key":null}',now()-interval '1 minute') returning id into c;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date) values(u,c,'flexible',extract(dow from day)::int,null,null,day,day) returning * into r;
 result:=public.task_save_course(jsonb_build_object('id',c,'name','renamed','subject','math','course_type','flexible','rules_revision',1),jsonb_build_array(to_jsonb(r)),day);
 if result is null or (select cursor->>'lesson_key' from public.task_courses where id=c)<>'b' then raise exception 'save_restored_old_cursor'; end if;
 select cursor_revision into rev from public.task_courses where id=c;
 begin perform public.task_save_course(jsonb_build_object('id',c,'name','bad','subject','math','course_type','flexible','rules_revision',2,'cursor',jsonb_build_object('lesson_key','a','segment_key',null),'expected_cursor_revision',rev-1),jsonb_build_array(to_jsonb(r)),day); raise exception 'stale_cursor_accepted'; exception when others then if sqlerrm<>'stale_cursor_revision' then raise; end if; end;
 if (select name from public.task_courses where id=c)<>'renamed' then raise exception 'stale_partial_mutation'; end if;
 update public.task_courses set archived_at=now() where id=c;
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,automation_enabled_at) values(u,'before catchup','art','flexible',false,(day-250)::timestamp at time zone 'Asia/Shanghai') returning id into c;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date) values(u,c,'flexible',extract(dow from day)::int,null,null,day-250,day-250) returning * into r;
 for tries in 1..2 loop
 result:=public.task_save_course(jsonb_build_object('id',c,'name','after catchup','subject','art','course_type','flexible','rules_revision',1),jsonb_build_array(to_jsonb(r)),day);
 if result is not null or (select name from public.task_courses where id=c)<>'before catchup' then raise exception 'retry_partially_saved_configuration'; end if;
 if (select generation_date from public.task_courses where id=c)<>day-250+tries*100 then raise exception 'retry_rolled_back_catchup'; end if;
 end loop;
 result:=public.task_save_course(jsonb_build_object('id',c,'name','after catchup','subject','art','course_type','flexible','rules_revision',1),jsonb_build_array(to_jsonb(r)),day);
 if result is null or (select name from public.task_courses where id=c)<>'after catchup' then raise exception 'catchup_never_finishes'; end if;
end $$;

do $$
declare u uuid:='44444444-4444-4444-4444-444444444444'; c uuid; s uuid; r public.task_timetable_rules; day date:=(now() at time zone 'Asia/Shanghai')::date; proposed jsonb; answer uuid; unit_pool uuid;
begin
 update public.task_courses set archived_at=now() where user_id=u;
 insert into public.task_course_catalog_snapshots(user_id,subject,version,source,progression_mode,ordered_lessons,teaching_segments) values(u,'math','open-segment','manual','segment','[{"key":"a","title":"A","book":"B","unit":"1","kind":"lesson"}]','[{"key":"a1","lesson_key":"a","title":"10-20","problem_keys":["a:lesson:real1"]}]') returning id into s;
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,auto_advance,catalog_snapshot_id,cursor,automation_enabled_at) values(u,'paused','math','flexible',true,true,s,'{"lesson_key":"a","segment_key":"a1"}',(day-14)::timestamp at time zone 'Asia/Shanghai') returning id into c;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date) values(u,c,'flexible',extract(dow from day)::int,null,null,day-14,day-14) returning * into r;
 insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,deadline) values(u,c,'unit review','reading','unit_completed','current','unit-review','{"kind":"none"}','{"kind":"same_day","time":"20:30","days":1,"at":null}') returning id into unit_pool;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,unit_pool);
 perform private.task_process_due_user(u,(day-14)::timestamp at time zone 'Asia/Shanghai',100);
 if exists(select 1 from public.task_instances where course_id=c and template_id=unit_pool) then raise exception 'missing_segment_implies_unit_completion'; end if;
 if (select generation_state from public.task_courses where id=c)<>'paused' then raise exception 'missing_segment_did_not_pause'; end if;
 perform private.task_process_due_user(u,(day-1)::timestamp at time zone 'Asia/Shanghai',100);
 if (select count(*) from public.task_course_events where course_id=c)<>1 then raise exception 'paused_interval_emitted'; end if;
 select to_jsonb(x)||jsonb_build_object('version','closed-segment','teaching_segments','[{"key":"a1","lesson_key":"a","title":"10-20","problem_keys":["a:lesson:real1"]},{"key":"a2","lesson_key":"a","title":"21-30","problem_keys":["a:lesson:real2"],"completes_lesson":true}]'::jsonb) into proposed from public.task_course_catalog_snapshots x where id=s;
 answer:=public.task_save_course(jsonb_build_object('id',c,'name','resumed','subject','math','course_type','flexible','rules_revision',1,'expected_cursor_revision',2,'cursor_intent','resume','cursor','{"lesson_key":"a","segment_key":"a1"}'::jsonb,'catalog_snapshot',proposed),jsonb_build_array(to_jsonb(r)),day);
 if answer is null or (select count(*) from public.task_course_events where course_id=c)<>2 then raise exception 'resume_event_count'; end if;
 if (select lesson_snapshot->'cursor'->>'segment_key' from public.task_course_events where course_id=c and on_date=day)<>'a2' then raise exception 'resume_repeated_consumed_segment'; end if;
 if (select generation_state from public.task_courses where id=c)<>'finished' then raise exception 'closed_catalog_not_finished'; end if;
 if (select count(*) from public.task_instances where course_id=c and template_id=unit_pool)<>1 then raise exception 'closed_unit_not_emitted'; end if;
end $$;

-- Future previews use revisions when cursor/schedule changes; completed history stays historical.
do $$
declare u uuid:='44444444-4444-4444-4444-444444444444'; c uuid; s uuid; r public.task_timetable_rules; tomorrow date:=(now() at time zone 'Asia/Shanghai')::date+1; t uuid; e public.task_course_events; taskid uuid; result jsonb;
begin
 update public.task_courses set archived_at=now() where user_id=u;
 insert into public.task_course_catalog_snapshots(user_id,subject,version,source,progression_mode,ordered_lessons,teaching_segments) select u,'english','preview-fixture',source,progression_mode,ordered_lessons,teaching_segments from public.task_course_catalog_snapshots where user_id=u and version='runtime-fixture' returning id into s;
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,auto_advance,catalog_snapshot_id,cursor,automation_enabled_at) values(u,'preview revision','english','timetabled',true,true,s,'{"lesson_key":"a","segment_key":null}',now()) returning id into c;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date,recurrence) values(u,c,'timetabled',extract(dow from tomorrow)::int,'16:00','17:00',tomorrow,tomorrow,'once') returning * into r;
 insert into public.task_templates(user_id,course_id,name,subject,mode,trigger,target,activity_key,material_selector,trigger_minutes,progress_mode,deadline,reminders) values(u,c,'preview','english','reading','before_class','current','read','{"kind":"none"}',4000,'percentage','{"kind":"course_default","time":"20:30","days":1,"at":null}','[{"anchor":"course_start","minutes":-60}]') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 perform public.task_tick(u);
 select * into strict e from public.task_course_events where course_id=c;
 select id into strict taskid from public.task_instances where course_id=c;
 update public.task_instances set completion_percent=50,status='active' where id=taskid;
 result:=public.task_set_course_progress(c,'{"lesson_key":"b","segment_key":null}',1);
 if result->>'status'<>'updated' or (select completion_percent from public.task_instances where id=taskid)<>0 or (select content_snapshot->'lesson'->>'key' from public.task_instances where id=taskid)<>'b' then raise exception 'preview_cursor_revision'; end if;
 if (select count(*) from public.task_instances where course_id=c)<>1 then raise exception 'preview_revision_duplicates'; end if;
 -- A type change cancels the superseded timed event and its pending reminders.
 perform public.task_save_course(jsonb_build_object('id',c,'name','now flexible','subject','english','course_type','flexible','rules_revision',1),jsonb_build_array(to_jsonb(r)||'{"kind":"flexible","start_time":null,"end_time":null}'),(now() at time zone 'Asia/Shanghai')::date);
 if (select assignment_state from public.task_course_events where id=e.id)<>'cancelled' then raise exception 'superseded_preview_live'; end if;
 if (select status from public.task_instances where id=taskid)<>'cancelled' then raise exception 'superseded_preview_task_live'; end if;
 if exists(select 1 from public.task_reminders where task_id=taskid and status in ('pending','sending','failed')) then raise exception 'superseded_preview_reminder_live'; end if;
end $$;
-- Actual scheduler entry with no browser JWT: a private bounded service path, not live cron.
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$ declare result jsonb; begin
 result:=private.task_run_due(now(),20,100);
 if (result->>'failed')::int<>0 then raise exception 'cron_simulation_failed_%',(select error from private.task_worker_log where error is not null limit 1); end if;
 if not exists(select 1 from private.task_worker_log where finished_at is not null and error is null) then raise exception 'worker_not_observable'; end if;
 if (select cron_enabled from private.task_runtime_config) then raise exception 'fixture_without_cron_claims_enabled'; end if;
 begin perform public.task_tick('44444444-4444-4444-4444-444444444444'); raise exception 'anonymous_tick_accepted'; exception when others then if sqlerrm<>'unauthorized' then raise; end if; end;
end $$;

-- The browser cannot bypass atomic control-plane RPCs or mutate immutable catalogs.
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if has_table_privilege('authenticated','public.task_courses','UPDATE') or has_table_privilege('authenticated','public.task_timetable_rules','UPDATE') or has_table_privilege('authenticated','public.task_course_catalog_snapshots','UPDATE') then raise exception 'browser_control_plane_bypass'; end if;
 perform public.task_initialize('[]');
 begin perform public.task_complete_event('00000000-0000-0000-0000-000000000001',1); raise exception 'foreign_event_accepted'; exception when others then if sqlerrm<>'event_not_owned' then raise; end if; end;
 begin perform public.task_save_course('{"id":"00000000-0000-0000-0000-000000000001","name":"forged","subject":"math","rules_revision":1}','[{}]',null); raise exception 'foreign_course_accepted'; exception when others then if sqlerrm<>'course_not_owned' then raise; end if; end;
end $$;
reset role;

do $$
declare u uuid:='44444444-4444-4444-4444-444444444444'; c uuid; t uuid; n int;
begin
 perform set_config('request.jwt.claim.sub',u::text,true); perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 update public.task_courses set archived_at=now() where user_id=u;
 for n in 0..2 loop
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,automation_enabled_at) values(u,'flexible preview '||n,'art','flexible',true,case when n=1 then '2026-11-02T09:00:00+08:00'::timestamptz else '2026-10-01T00:00:00+08:00'::timestamptz end) returning id into c;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date,recurrence) values(u,c,'flexible',1,null,null,'2026-11-02','2026-11-02','once');
 insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,trigger_minutes,deadline) values(u,c,'prepare','reading','before_class','current','prepare','{"kind":"none"}',case when n=2 then 0 else 1440 end,'{"kind":"course_default","time":"20:30","days":1,"at":null}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 perform private.task_process_due_user(u,'2026-11-03T12:00:00+08:00',100);
 if (select count(*) from public.task_instances where course_id=c)<>(case when n=1 then 0 else 1 end) then raise exception 'flexible_before_activation_or_late_%',n; end if;
 if exists(select 1 from public.task_course_events where course_id=c and starts_at is not null) then raise exception 'flexible_invented_clock'; end if;
 if n=0 and (select release_at from public.task_instances where course_id=c)<>'2026-11-01T00:00:00+08:00'::timestamptz then raise exception 'flexible_preview_release'; end if;
 if n=2 and not exists(select 1 from public.task_course_events where course_id=c and runtime_issues @> '[{"code":"release_after_deadline"}]') then raise exception 'missing_invalid_window_issue'; end if;
 end loop;
end $$;

-- Original overdue deadlines survive recurrence changes; recovery deadlines stay independent.
do $$ declare selected_id uuid; before_due timestamptz:='2026-01-01T20:30:00+08:00'; begin
 select t.id into strict selected_id from public.task_instances t where user_id='44444444-4444-4444-4444-444444444444' and due_kind='next_class' and status='pending' limit 1;
 update public.task_instances set due_at=before_due where task_instances.id=selected_id;
 perform private.task_reconcile('44444444-4444-4444-4444-444444444444',now());
 if (select due_at from public.task_instances t where t.id=selected_id) is distinct from before_due then raise exception 'overdue_deadline_rewritten'; end if;
end $$;
-- Cross-owner IDs are real fixture rows, rather than only missing UUIDs.
insert into public.task_course_catalog_snapshots(id,user_id,subject,version,source,progression_mode,ordered_lessons,teaching_segments) values('44444444-4444-4444-4444-444444444409','44444444-4444-4444-4444-444444444442','art','foreign','manual','lesson','[{"key":"x","title":"X","book":"B","unit":"1","kind":"lesson"}]','[]');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
set local role authenticated;
do $$ declare c public.task_courses; r public.task_timetable_rules; payload jsonb; begin
 select * into c from public.task_courses where user_id=auth.uid() and archived_at is null limit 1;
 select * into r from public.task_timetable_rules where user_id=auth.uid() and course_id=c.id limit 1;
 payload:=(to_jsonb(c)-'cursor');
 begin perform public.task_save_course(payload||'{"catalog_snapshot_id":"44444444-4444-4444-4444-444444444409"}',jsonb_build_array(to_jsonb(r)),null); raise exception 'foreign_snapshot_accepted'; exception when others then if sqlerrm<>'snapshot_not_owned_or_subject_mismatch' then raise; end if; end;
 begin perform public.task_save_course(payload,jsonb_build_array(to_jsonb(r)||'{"id":"44444444-4444-4444-4444-444444444402"}'),null); raise exception 'foreign_rule_accepted'; exception when no_data_found then null; end;
 begin perform public.task_complete_event('44444444-4444-4444-4444-444444444403',1); raise exception 'foreign_event_accepted'; exception when others then if sqlerrm<>'event_not_owned' then raise; end if; end;
 begin perform public.task_archive_course_runtime('44444444-4444-4444-4444-444444444401'); raise exception 'foreign_archive_accepted'; exception when others then if sqlerrm<>'course_not_owned' then raise; end if; end;
end $$;
reset role;
insert into auth.users(id) values('44444444-4444-4444-4444-444444444443');
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444443',true);
set local role authenticated;
select public.task_initialize('[]');
do $$ begin if (select count(*) from public.task_courses where user_id=auth.uid())<>6 then raise exception 'new_user_initialization_broken'; end if; end $$;
reset role;

-- Explicit makeup shares scheduled processing and request idempotence.
do $$ declare u uuid:='44444444-4444-4444-4444-444444444444'; c uuid; s uuid; t uuid; eid uuid; request uuid:=gen_random_uuid(); begin
 perform set_config('request.jwt.claim.sub',u::text,true);
 update public.task_courses set archived_at=now() where user_id=u;
 select id into s from public.task_course_catalog_snapshots where user_id=u and version='runtime-fixture';
 insert into public.task_courses(user_id,name,subject,course_type,auto_assign,auto_advance,catalog_snapshot_id,cursor,automation_enabled_at) values(u,'makeup','math','flexible',true,true,s,'{"lesson_key":"a","segment_key":null}',now()) returning id into c;
 insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,deadline) values(u,c,'makeup review','reading','after_class','current','review','{"kind":"none"}','{"kind":"same_day","time":"20:30","days":1,"at":null}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
 eid:=public.task_makeup_event(c,request,(now() at time zone 'Asia/Shanghai')::date);
 perform private.task_process_due_user(u,now(),100);
 if (select count(*) from public.task_instances where course_event_id=eid)<>1 then raise exception 'makeup_not_processed'; end if;
 if (select cursor->>'lesson_key' from public.task_courses where id=c)<>'b' then raise exception 'makeup_did_not_advance'; end if;
 if public.task_makeup_event(c,request,(now() at time zone 'Asia/Shanghai')::date)<>eid then raise exception 'makeup_not_idempotent'; end if;
 if (select count(*) from public.task_instances where course_event_id=eid)<>1 or (select cursor->>'lesson_key' from public.task_courses where id=c)<>'b' then raise exception 'makeup_processed_twice'; end if;
end $$;
rollback;
