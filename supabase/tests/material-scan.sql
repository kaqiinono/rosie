begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222') on conflict do nothing;
select public.baidu_store_verified_credentials('{"account_id":"9223372036854775806","app_key":"fixture","access_token":"fixture1","refresh_token":"fixture2","expires_at":"2099-01-01","scope":"basic","authorized_by":"11111111-1111-4111-8111-111111111111"}');
do $$declare g uuid;g2 uuid;s uuid;v jsonb; a uuid;begin
 select account_generation into g from public.baidu_oauth_credentials;
 perform public.baidu_store_verified_credentials('{"account_id":"9223372036854775806","app_key":"fixture","access_token":"fixture-new","refresh_token":"fixture-new","expires_at":"2099-01-01","scope":"basic"}');
 select account_generation into g2 from public.baidu_oauth_credentials;
 if g<>g2 then raise exception 'same_account_rotated';end if;
 insert into public.material_scan_sessions(user_id,account_id,account_generation,root_id,path,recursive,subject,state) values('11111111-1111-4111-8111-111111111111','9223372036854775806',g,'english','/airosie/english',true,'english','{}') returning id into s;
 v:=jsonb_build_object('queue','[]'::jsonb,'complete',true,'entries',jsonb_build_array(jsonb_build_object('account_id','9223372036854775806','fs_id','9223372036854775807','path','/airosie/english/a.mp3','name','a.mp3','mime','audio/mpeg','size',5,'isdir',false)));
 perform public.material_publish_scan(s,'11111111-1111-4111-8111-111111111111',0,'9223372036854775806',g,v);
 select id into a from public.material_assets where fs_id='9223372036854775807';
 if a is null then raise exception 'large_id_lost';end if;
 perform public.material_publish_scan(s,'11111111-1111-4111-8111-111111111111',1,'9223372036854775806',g,replace(v::text,'/a.mp3','/moved.mp3')::jsonb);
 if (select count(*) from public.material_assets where fs_id='9223372036854775807')<>1 then raise exception 'move_duplicated';end if;
 begin perform public.material_publish_scan(s,'22222222-2222-4222-8222-222222222222',2,'9223372036854775806',g,v);raise exception 'foreign_scan_allowed';exception when no_data_found then null;end;
 perform public.baidu_store_verified_credentials('{"account_id":"42","app_key":"fixture","access_token":"switch","refresh_token":"switch","expires_at":"2099-01-01","scope":"basic"}');
 begin perform public.material_publish_scan(s,'11111111-1111-4111-8111-111111111111',2,'9223372036854775806',g,v);raise exception 'old_account_published';exception when raise_exception then if sqlerrm<>'baidu_account_changed' then raise;end if;end;
 if (select status from public.material_assets where id=a)<>'account_mismatch' then raise exception 'mismatch_not_marked';end if;
end $$;
insert into public.task_courses(id,user_id,name,subject) values('11111111-1111-4111-8111-111111111119','11111111-1111-4111-8111-111111111111','Scan confirmation','english');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$declare a jsonb;r jsonb;begin
 a:=public.material_save_asset('{"subject":"english","kind":"text","title":"Atomic fixture","text_content":"fixture"}');
 begin
 perform public.material_link_course('11111111-1111-4111-8111-111111111119',jsonb_build_array(jsonb_build_object('asset_id',a->>'id','scope','{"kind":"all"}'::jsonb),jsonb_build_object('asset_id',a->>'id','scope','{"kind":"lessons","lesson_keys":["missing"]}'::jsonb)));
 raise exception 'invalid_batch_accepted';
 exception when raise_exception then if sqlerrm<>'unknown_scope_key' then raise;end if;end;
 if exists(select 1 from public.course_material_links where course_id='11111111-1111-4111-8111-111111111119') then raise exception 'batch_partially_committed';end if;
 r:=public.material_link_course('11111111-1111-4111-8111-111111111119',jsonb_build_array(jsonb_build_object('asset_id',a->>'id','scope','{"kind":"all"}'::jsonb,'role','general'),jsonb_build_object('asset_id',a->>'id','scope','{"kind":"all"}'::jsonb,'role','review')));
 if jsonb_array_length(r)<>2 then raise exception 'batch_incomplete';end if;
 perform public.material_unlink_course((r->0->>'id')::uuid);
 if not exists(select 1 from public.material_assets where id=(a->>'id')::uuid) then raise exception 'unlink_deleted_asset';end if;
end $$;
reset role;
set local role authenticated;
do $$begin
 begin perform * from public.material_scan_sessions;raise exception 'scan_table_exposed';exception when insufficient_privilege then null;end;
 begin perform public.material_publish_scan(gen_random_uuid(),gen_random_uuid(),0,'1',gen_random_uuid(),'{}');raise exception 'browser_published';exception when insufficient_privilege then null;end;
 begin perform * from public.baidu_oauth_credentials;raise exception 'credentials_exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
