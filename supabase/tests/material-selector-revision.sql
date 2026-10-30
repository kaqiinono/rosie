begin;
insert into auth.users(id) values ('79797979-7979-7979-7979-797979797971');
select set_config('request.jwt.claim.sub','79797979-7979-7979-7979-797979797971',true);
do $$
declare u uuid:=auth.uid();c uuid;t uuid;e uuid;taskid uuid;a uuid;b uuid;content jsonb:='{"lesson":{"key":"a","title":"Reading A","book":"B","unit":"1"},"cursor":null,"problem_keys":[]}';old_template jsonb;result jsonb;begin
 insert into public.material_assets(subject,kind,title,created_by,text_content) values('english','text','Old A',u,'A') returning id into a;
 insert into public.material_assets(subject,kind,title,created_by,text_content) values('english','text','New B',u,'B') returning id into b;
 insert into public.task_courses(user_id,name,subject,course_type) values(u,'Revision material policy','english','flexible') returning id into c;
 insert into public.task_templates(user_id,course_id,name,subject,mode,trigger,target,material_selector,progress_mode,deadline) values(u,c,'Read','english','reading','after_class','current','{"kind":"auto"}','percentage','{"kind":"same_day","time":"20:30"}') returning id into t;
 insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id,material_override) values(u,c,t,jsonb_build_object('kind','assets','asset_ids',jsonb_build_array(a)));
 insert into public.task_course_events(user_id,course_id,event_key,on_date,release_at,lesson_snapshot,assignment_state,after_processed) values(u,c,'material-policy-event',(now() at time zone 'Asia/Shanghai')::date,now()-interval '1 minute',content,'assigned',true) returning id into e;
 perform private.task_emit_event(u,e,'after_class',now());
 select id,template_snapshot into strict taskid,old_template from public.task_instances where course_event_id=e;
 if not exists(select 1 from public.task_instances where id=taskid and material_status='selected' and material_selector_snapshot->'asset_ids' ? a::text) then raise exception 'initial_explicit_policy';end if;
 perform public.material_save_asset(jsonb_build_object('id',a,'status','archived'));
 update public.task_course_pool_bindings set material_override='{"kind":"auto"}' where course_id=c;
 perform public.task_set_completion(taskid,25,1);
 if not exists(select 1 from public.task_instances where id=taskid and material_selector_snapshot->'asset_ids' ? a::text) then raise exception 'progress_rebased_selector';end if;
 result:=public.task_revise_event(e,jsonb_build_object('lesson',content->'lesson'),1);
 if result->>'status'='retry' then raise exception 'unexpected_fixture_catchup';end if;
 if not exists(select 1 from public.task_instances where id=taskid and template_snapshot=old_template and material_status='pending' and material_selector_snapshot='{"kind":"auto"}'::jsonb and completion_percent=25) then raise exception 'revision_kept_obsolete_selector';end if;
 -- A later unrelated binding edit and progress update must not replace the revised frozen policy.
 update public.task_course_pool_bindings set material_override=jsonb_build_object('kind','assets','asset_ids',jsonb_build_array(a)) where course_id=c;
 perform public.task_set_completion(taskid,30,(select revision from public.task_instances where id=taskid));
 perform public.material_link_course(c,jsonb_build_array(jsonb_build_object('asset_id',b,'scope','{"kind":"all"}'::jsonb)));
 if not exists(select 1 from public.task_instances where id=taskid and material_status='selected' and material_assets=jsonb_build_array(b) and material_selector_snapshot='{"kind":"auto"}'::jsonb and completion_percent=30) then raise exception 'new_link_never_resolved_revised_policy';end if;
 if not exists(select 1 from public.task_progress_events where task_id=taskid and kind='material_resolution' and payload->'task'->>'material_status'='pending') then raise exception 'resolution_history_lost';end if;
end $$;
rollback;
