-- Early completion consumes live progress once; future preview projection must skip it.
begin;
insert into auth.users(id) values('75757575-7575-7575-7575-757575757575');
select set_config('request.jwt.claim.sub','75757575-7575-7575-7575-757575757575',true);
do $$
declare
 u uuid:='75757575-7575-7575-7575-757575757575';
 c uuid; sid uuid; t uuid; first_id uuid; next_id uuid; preview_task_id uuid;
 r public.task_timetable_rules; prior_event jsonb; prior_task jsonb;
 scenario int; failures text[]:='{}'; actual text;
begin
 insert into public.task_course_catalog_snapshots(user_id,subject,version,source,progression_mode,ordered_lessons,teaching_segments)
 values(u,'art','processed-preview','manual','lesson','[{"key":"a","title":"A","book":"B","unit":"1","kind":"lesson"},{"key":"b","title":"B","book":"B","unit":"1","kind":"lesson"},{"key":"c","title":"C","book":"B","unit":"1","kind":"lesson"}]','[]') returning id into sid;
 for scenario in 0..1 loop
 begin
  insert into public.task_courses(user_id,name,subject,course_type,auto_assign,auto_advance,catalog_snapshot_id,cursor,automation_enabled_at)
  values(u,'processed preview '||scenario,'art','timetabled',true,true,sid,'{"lesson_key":"a","segment_key":null}','2026-10-26T00:00:00+08:00') returning id into c;
  insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,anchor_date)
  values(u,c,'timetabled',1,'16:00','17:00','2026-10-26','2026-10-26') returning * into r;
  insert into public.task_templates(user_id,course_id,name,mode,trigger,target,activity_key,material_selector,trigger_minutes,progress_mode,deadline)
  values(u,c,'preview','reading','before_class','current','read','{"kind":"none"}',12000,'percentage','{"kind":"course_default","time":"20:30","days":1,"at":null}') returning id into t;
  insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id) values(u,c,t);
  select private.task_materialize(u,c,to_jsonb(x),'{"lesson_key":"a","segment_key":null}') into first_id
  from private.task_candidates(u,c,'2026-10-26','2026-10-26') x;
  if scenario=1 then
   -- Existing valid B preview must retain its identity and partial progress on reconcile.
   select private.task_materialize(u,c,to_jsonb(x),'{"lesson_key":"b","segment_key":null}') into next_id
   from private.task_candidates(u,c,'2026-11-02','2026-11-02') x;
   perform private.task_emit_event(u,next_id,'before_class','2026-10-26T14:59:00+08:00');
   update public.task_instances set completion_percent=60,status='active' where course_event_id=next_id returning id into preview_task_id;
   select to_jsonb(e) into prior_event from public.task_course_events e where id=next_id;
   select to_jsonb(i) into prior_task from public.task_instances i where id=preview_task_id;
  end if;
  perform private.task_complete_event(u,first_id,1,'2026-10-26T15:00:00+08:00');
  if (select cursor->>'lesson_key' from public.task_courses where id=c)<>'b' then raise exception 'fixture_live_cursor_not_b'; end if;
  if scenario=0 then
   perform private.task_process_due_user(u,'2026-10-26T15:01:00+08:00',100);
  else
   perform private.task_reconcile_previews(u,c,'2026-10-26T15:01:00+08:00');
  end if;
  select lesson_snapshot->'lesson'->>'key' into actual from public.task_course_events where course_id=c and on_date='2026-11-02';
  if actual is distinct from 'b' then raise exception 'processed_preview_case_%: actual=%, expected=b',scenario,actual; end if;
  if scenario=0 then
   if (select count(*) from public.task_instances where course_id=c and course_event_id<>first_id and content_snapshot->'lesson'->>'key'='b')<>1 then raise exception 'first_preview_task_not_b'; end if;
   if exists(select 1 from public.task_instances where course_event_id=first_id) then raise exception 'processed_event_emitted_preview'; end if;
  else
   if (select to_jsonb(e) from public.task_course_events e where id=next_id) is distinct from prior_event then raise exception 'existing_preview_event_rewritten'; end if;
   if (select to_jsonb(i) from public.task_instances i where id=preview_task_id) is distinct from prior_task then raise exception 'existing_preview_task_or_progress_rewritten'; end if;
   if exists(select 1 from public.task_progress_events where task_id=preview_task_id) then raise exception 'existing_preview_progress_reset'; end if;
  end if;
  if (select lesson_snapshot->'lesson'->>'key' from public.task_course_events where id=first_id)<>'a'
   or (select cursor->>'lesson_key' from public.task_courses where id=c)<>'b'
   or (select cursor_revision from public.task_courses where id=c)<>2 then raise exception 'historical_snapshot_or_live_progress_changed'; end if;
 exception when others then
  failures:=array_append(failures,sqlerrm);
 end;
 end loop;
 if cardinality(failures)>0 then raise exception '%',array_to_string(failures,'; '); end if;
end $$;
rollback;
