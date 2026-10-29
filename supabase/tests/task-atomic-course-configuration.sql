begin;
insert into auth.users(id) values('22000000-0000-0000-0000-000000000001'),('22000000-0000-0000-0000-000000000002');
insert into public.task_templates(id,user_id,name,subject,enabled,mode,trigger,target,estimated_minutes,deadline)
values('22000000-0000-0000-0000-000000000010','22000000-0000-0000-0000-000000000001','练习','math',true,'checklist','after_class','current',20,'{"kind":"same_day"}'),
('22000000-0000-0000-0000-000000000011','22000000-0000-0000-0000-000000000002','他人练习','math',true,'checklist','after_class','current',20,'{"kind":"same_day"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','22000000-0000-0000-0000-000000000001',true);
do $$ declare c uuid; copy_id uuid; timed uuid; rid uuid; history_id uuid; snap_id uuid; before_count int; r jsonb; payload jsonb; catalog jsonb; saved public.task_courses; rule_ids uuid[]; begin
 r:=jsonb_build_array(jsonb_build_object('kind','flexible','weekday',1,'start_time',null,'end_time',null,'valid_from','2099-01-01','valid_until',null));
 payload:='{"name":"校内数学","subject":"math","course_type":"flexible","auto_assign":false,"auto_advance":false,"bindings":[]}'::jsonb;
 c:=public.task_save_course(payload,r,null);
 select * into saved from public.task_courses where id=c;
 if saved.course_type<>'flexible' then raise exception 'course_type_not_saved'; end if;
 if not exists(select 1 from public.task_timetable_rules where course_id=c and kind='flexible' and start_time is null) then raise exception 'flexible_rule_missing'; end if;
 perform public.task_tick(auth.uid()); perform public.task_ensure_next(auth.uid(),c,now());
 if exists(select 1 from public.task_course_occurrences where course_id=c) then raise exception 'fabricated_flexible_clock'; end if;
 select jsonb_agg(to_jsonb(t)),array_agg(id) into r,rule_ids from public.task_timetable_rules t where course_id=c;
 payload:=payload||jsonb_build_object('id',c,'rules_revision',saved.rules_revision);
 perform public.task_save_course(payload,r,null);
 if (select array_agg(id) from public.task_timetable_rules where course_id=c) is distinct from rule_ids then raise exception 'unchanged_rule_identity_lost'; end if;
 begin perform public.task_save_course(payload,r,null); raise exception 'expected_stale_rejection'; exception when others then if sqlerrm<>'stale_course_revision' then raise; end if; end;
 catalog:=jsonb_build_object('id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','user_id',auth.uid(),'created_at','1900-01-01','subject','math','source','manual','progression_mode','lesson','version','v-1','ordered_lessons','[{"key":"manual:1","title":"小数","book":"学校数学","unit":"一","kind":"manual"}]'::jsonb,'teaching_segments','[]'::jsonb);
 select * into saved from public.task_courses where id=c;
 payload:=payload||jsonb_build_object('rules_revision',saved.rules_revision,'catalog_snapshot',catalog,'cursor',jsonb_build_object('lesson_key','manual:1','segment_key',null),'auto_assign',true,'auto_advance',true,'bindings','[{"pool_item_id":"22000000-0000-0000-0000-000000000010","enabled":true,"scope_override":null,"estimated_minutes_override":30,"material_override":{"kind":"none"}}]'::jsonb);
 perform public.task_save_course(payload,r,null);
 select * into saved from public.task_courses where id=c; snap_id:=saved.catalog_snapshot_id;
 if snap_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' or not exists(select 1 from public.task_course_catalog_snapshots where id=snap_id and created_at>'2026-01-01') then raise exception 'snapshot_identity_time_trusted_client'; end if;
 if saved.cursor->>'lesson_key'<>'manual:1' or not saved.auto_assign or not saved.auto_advance or saved.automation_enabled_at is null then raise exception 'configuration_missing'; end if;
 if not exists(select 1 from public.task_course_pool_bindings where course_id=c and estimated_minutes_override=30) then raise exception 'bindings_missing'; end if;
 -- Same-content new course reuses snapshot; mismatching version rolls back everything.
 copy_id:=public.task_save_course((payload-'id'-'rules_revision')||'{"name":"副本","bindings":[]}'::jsonb,jsonb_build_array((r->0)-'id'-'course_id'-'user_id'),null);
 if (select catalog_snapshot_id from public.task_courses where id=copy_id)<>snap_id then raise exception 'snapshot_not_reused'; end if;
 select count(*) into before_count from public.task_courses;
 begin
 perform public.task_save_course((payload-'id'-'rules_revision')||jsonb_build_object('catalog_snapshot',jsonb_set(catalog,'{ordered_lessons,0,title}','"伪造内容"')),'[{"kind":"flexible","weekday":1,"start_time":null,"end_time":null,"valid_from":"2099-01-01","valid_until":null}]',null);
 raise exception 'expected_snapshot_conflict';
 exception when others then if sqlerrm<>'snapshot_version_content_mismatch' then raise; end if; end;
 if (select count(*) from public.task_courses)<>before_count then raise exception 'snapshot_conflict_not_atomic'; end if;
 begin
 perform public.task_save_course((payload-'id'-'rules_revision')||jsonb_build_object('catalog_snapshot',catalog||'{"user_id":"22000000-0000-0000-0000-000000000002"}'::jsonb),jsonb_build_array((r->0)-'id'),null);
 raise exception 'expected_owner_failure'; exception when others then if sqlerrm<>'snapshot_owner_or_subject_mismatch' then raise; end if; end;
 -- A late bad binding rolls back the course, snapshot and rules.
 begin
 perform public.task_save_course((payload-'id'-'rules_revision')||jsonb_build_object('catalog_snapshot',catalog||'{"version":"should-roll-back"}'::jsonb,'bindings','[{"pool_item_id":"22000000-0000-0000-0000-000000000011"}]'::jsonb),'[{"kind":"flexible","weekday":2,"start_time":null,"end_time":null,"valid_from":"2099-01-01","valid_until":null}]',null);
 raise exception 'expected_binding_failure'; exception when others then if sqlerrm<>'invalid_pool_binding' then raise; end if; end;
 if exists(select 1 from public.task_course_catalog_snapshots where version='should-roll-back') or (select count(*) from public.task_courses)<>before_count then raise exception 'binding_failure_not_atomic'; end if;
 -- Timed history survives a future flexible conversion and a later re-edit.
 timed:=public.task_save_course('{"name":"课表转自由","subject":"math"}','[{"weekday":1,"start_time":"09:00","end_time":"10:00","valid_from":"2026-01-01","valid_until":null}]',null);
 select id into rid from public.task_timetable_rules where course_id=timed;
 insert into public.task_course_occurrences(user_id,course_id,rule_id,original_date,starts_at,ends_at,status) values(auth.uid(),timed,rid,'2026-01-05','2026-01-05T01:00Z','2026-01-05T02:00Z','confirmed') returning id into history_id;
 select rules_revision into saved.rules_revision from public.task_courses where id=timed;
 perform public.task_save_course(jsonb_build_object('id',timed,'rules_revision',saved.rules_revision,'name','课表转自由','subject','math','course_type','flexible'),'[{"kind":"flexible","weekday":1,"start_time":null,"end_time":null,"valid_from":"2026-01-01","valid_until":null}]','2099-02-01');
 if not exists(select 1 from public.task_timetable_rules where id=rid and kind='timetabled' and start_time='09:00' and disabled_from='2099-02-01') then raise exception 'old_timed_rule_lost'; end if;
 if not exists(select 1 from public.task_course_occurrences where id=history_id and status='confirmed' and rule_id=rid) then raise exception 'confirmed_history_lost'; end if;
 select jsonb_agg(to_jsonb(t)) into r from public.task_timetable_rules t where course_id=timed and disabled_from is null;
 select rules_revision into saved.rules_revision from public.task_courses where id=timed;
 perform public.task_save_course(jsonb_build_object('id',timed,'rules_revision',saved.rules_revision,'name','课表转自由','subject','math','course_type','flexible'),r,'2099-03-01');
 if not exists(select 1 from public.task_timetable_rules where id=rid and disabled_from='2099-03-01') then raise exception 'pending_transition_gap'; end if;
 if not exists(select 1 from public.task_timetable_rules where course_id=timed and kind='flexible' and valid_from='2099-03-01' and disabled_from is null) then raise exception 'pending_transition_date_not_changed'; end if;
 -- Flexible to timed revision keeps the earlier flexible rule date-only.
 select rules_revision into saved.rules_revision from public.task_courses where id=copy_id;
 select jsonb_agg((to_jsonb(t)-'start_time'-'end_time'-'kind')||'{"kind":"timetabled","start_time":"14:00","end_time":"15:00"}'::jsonb) into r from public.task_timetable_rules t where course_id=copy_id and disabled_from is null;
 perform public.task_save_course(jsonb_build_object('id',copy_id,'rules_revision',saved.rules_revision,'name','副本','subject','math','course_type','timetabled'),r,'2099-04-01');
 if not exists(select 1 from public.task_timetable_rules where course_id=copy_id and kind='flexible' and start_time is null and disabled_from='2099-04-01') or not exists(select 1 from public.task_timetable_rules where course_id=copy_id and kind='timetabled' and start_time='14:00' and disabled_from is null) then raise exception 'flexible_to_timed_history_lost'; end if;
 -- Additive schedule import explicitly drops activation/progress even for malicious v2 JSON.
 perform public.task_import_timetable('{"version":2,"calendars":[],"exams":[],"courses":[{"id":"import-c","name":"导入自由课程","subject":"math","course_type":"flexible","auto_assign":true,"auto_advance":true,"cursor":{"lesson_key":"secret","segment_key":null}}],"rules":[{"id":"import-r","course_id":"import-c","kind":"flexible","weekday":3,"start_time":null,"end_time":null,"valid_from":"2099-01-01","valid_until":null}]}',null,'导入测试','task2-import');
 if not exists(select 1 from public.task_courses where name='导入自由课程' and course_type='flexible' and not auto_assign and not auto_advance and cursor is null and catalog_snapshot_id is null) then raise exception 'import_activated_learning'; end if;
end $$;
rollback;
