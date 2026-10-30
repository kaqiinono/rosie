begin;
insert into auth.users(id) values('77777777-7777-7777-7777-777777777771'),('77777777-7777-7777-7777-777777777772');
insert into public.task_courses(id,user_id,name,subject) values('77777777-7777-7777-7777-777777777773','77777777-7777-7777-7777-777777777772','B course','math');
insert into public.task_course_catalog_snapshots(id,user_id,version,subject,progression_mode,ordered_lessons,teaching_segments) values('77777777-7777-7777-7777-777777777775','77777777-7777-7777-7777-777777777772','material-fixture','math','segment','[{"key":"12","book":"NY","unit":"12","title":"Real lesson"}]','[{"key":"12:a","lesson_key":"12","problem_keys":["12:class:real1"],"completes_lesson":true}]');
update public.task_courses set catalog_snapshot_id='77777777-7777-7777-7777-777777777775' where id='77777777-7777-7777-7777-777777777773';
insert into public.task_instances(id,user_id,course_id,title,subject,mode,material_status,estimated_minutes,source_key) values('77777777-7777-7777-7777-777777777774','77777777-7777-7777-7777-777777777772','77777777-7777-7777-7777-777777777773','Pending material task','math','reading','pending',25,'material:pending-fixture');
select set_config('request.jwt.claim.sub','77777777-7777-7777-7777-777777777771',true);
set local role authenticated;
do $$declare a jsonb;begin
 a:=public.material_save_asset('{"subject":"english","kind":"text","title":"Shared A notes","text_content":"A content"}');
 perform set_config('test.asset',a->>'id',true);
 begin perform public.material_link_course('77777777-7777-7777-7777-777777777773',jsonb_build_array(jsonb_build_object('asset_id',a->>'id','scope','{"kind":"all"}'::jsonb)));raise exception 'cross_course_allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','77777777-7777-7777-7777-777777777772',true);
set local role authenticated;
do $$declare a uuid:=current_setting('test.asset')::uuid;links jsonb;begin
 if not exists(select 1 from public.material_assets where id=a) then raise exception 'shared_read_denied';end if;
 links:=public.material_link_course('77777777-7777-7777-7777-777777777773',jsonb_build_array(jsonb_build_object('asset_id',a,'scope','{"kind":"all"}'::jsonb,'role','review')));
 perform set_config('test.link',links->0->>'id',true);
 begin perform public.material_save_asset(jsonb_build_object('id',a,'title','B takeover'));raise exception 'creator_edit_allowed';exception when insufficient_privilege then null;end;
 perform public.material_link_course('77777777-7777-7777-7777-777777777773',jsonb_build_array(jsonb_build_object('asset_id',a,'scope','{"kind":"problems","problem_keys":["12:class:real1"]}'::jsonb)));
 begin
 perform public.material_link_course('77777777-7777-7777-7777-777777777773',jsonb_build_array(jsonb_build_object('asset_id',a,'scope','{"kind":"problems","problem_keys":["13:class:real1"]}'::jsonb)));
 raise exception 'unknown_problem_accepted';exception when raise_exception then if SQLERRM<>'unknown_scope_key' then raise;end if;end;
 perform set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',true);
 perform public.material_save_asset(jsonb_build_object('id',a,'title','Admin metadata correction'));
 perform set_config('request.jwt.claims','{}',true);
 begin update public.material_assets set created_by=auth.uid() where id=a;raise exception 'direct_mutation_allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$declare r jsonb;begin
 r:=private.task_resolve_materials('77777777-7777-7777-7777-777777777772','77777777-7777-7777-7777-777777777773','{"kind":"all"}','{"kind":"auto"}','{}');
 if r->>'status'<>'selected' or r->'asset_ids'->>0<>current_setting('test.asset') then raise exception 'cross_creator_resolve_failed';end if;
 if not exists(select 1 from public.task_instances where id='77777777-7777-7777-7777-777777777774' and material_status='selected' and revision=2 and estimated_minutes=25) then raise exception 'pending_task_not_refreshed';end if;
 if not exists(select 1 from public.task_progress_events where task_id='77777777-7777-7777-7777-777777777774' and revision=1 and kind='material_resolution' and payload->'task'->>'material_status'='pending') then raise exception 'pending_history_lost';end if;
 if private.material_scope_matches('{"kind":"problems","problem_keys":["12:class:1"]}','{"problem_keys":["13:class:1"]}') then raise exception 'problem_namespace_collision';end if;
end $$;
select set_config('request.jwt.claim.sub','77777777-7777-7777-7777-777777777771',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.course_material_links) then raise exception 'private_links_visible';end if;
 begin perform public.material_unlink_course(current_setting('test.link')::uuid);raise exception 'foreign_unlink_allowed';exception when insufficient_privilege then null;end;
 perform public.material_save_asset(jsonb_build_object('id',current_setting('test.asset'),'status','archived'));
 begin perform public.material_save_asset(jsonb_build_object('id',current_setting('test.asset'),'status','ready'));raise exception 'browser_promoted_asset_readiness';exception when raise_exception then if SQLERRM<>'readiness_is_server_owned' then raise;end if;end;
end $$;
reset role;
do $$declare r jsonb;begin
 if not exists(select 1 from public.course_material_links where id=current_setting('test.link')::uuid) then raise exception 'archive_destroyed_link';end if;
 r:=private.task_resolve_materials('77777777-7777-7777-7777-777777777772','77777777-7777-7777-7777-777777777773','{"kind":"all"}','{"kind":"auto"}','{}');
 if not exists(select 1 from public.task_instances where id='77777777-7777-7777-7777-777777777774' and material_status='selected' and material_assets ? current_setting('test.asset')) then raise exception 'archive_changed_task_reference';end if;
 if r->>'status'<>'pending' then raise exception 'archived_new_selection';end if;
end $$;
select set_config('request.jwt.claim.sub','77777777-7777-7777-7777-777777777772',true);
set local role authenticated;
do $$begin
 if not exists(select 1 from public.material_assets where id=current_setting('test.asset')::uuid and status='archived') then raise exception 'archived_reference_unreadable';end if;
 perform public.material_unlink_course(current_setting('test.link')::uuid);
end $$;
reset role;
set local role anon;
do $$begin
 begin perform 1 from public.material_assets;raise exception 'anon_read_allowed';exception when insufficient_privilege then null;end;
 begin perform public.material_save_asset('{"kind":"text"}');raise exception 'anon_write_allowed';exception when insufficient_privilege then null;end;
end $$;
rollback;
