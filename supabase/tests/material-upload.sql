begin;
insert into auth.users(id) values('11111111-2222-4333-8444-555555555555'),('22222222-2222-4333-8444-555555555555') on conflict do nothing;
select public.baidu_store_verified_credentials('{"account_id":"100","app_key":"fixture","access_token":"a","refresh_token":"b","expires_at":"2099-01-01","scope":"basic"}');
do $$
declare g uuid;s jsonb;sid uuid:='99999999-1111-4111-8111-111111111111';u uuid:='11111111-2222-4333-8444-555555555555';begin
 select account_generation into g from public.baidu_oauth_credentials where id='primary';
 perform public.material_upload_transition(sid,u,'100',g,'new','{"path":"/apps/test/upload","name":"x","subject":"math","mime":"video/mp4","size":4194305,"hashes":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]}');
 begin perform public.material_upload_transition(sid,'22222222-2222-4333-8444-555555555555','100',g,'read');raise exception 'foreign accepted';exception when no_data_found then null;end;
 perform public.material_upload_transition(sid,u,'100',g,'prepareclaim');
 s:=public.material_upload_transition(sid,u,'100',g,'prepareclaim');if (s->>'claimed')::boolean then raise exception 'duplicate precreate';end if;
 perform public.material_upload_transition(sid,u,'100',g,'prepared','{"upload_id":"u","rapid":false,"parts":{"0":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}');
 begin perform public.material_upload_transition(sid,u,'100',g,'claim');raise exception 'incomplete accepted';exception when raise_exception then if sqlerrm<>'upload_incomplete' then raise;end if;end;
 begin perform public.material_upload_transition(sid,u,'100',g,'part','{"index":1,"hash":"wrong"}');raise exception 'hash accepted';exception when raise_exception then if sqlerrm<>'upload_part' then raise;end if;end;
 perform public.material_upload_transition(sid,u,'100',g,'part','{"index":1,"hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}');
 perform public.material_upload_transition(sid,u,'100',g,'part','{"index":1,"hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}');
 s:=public.material_upload_transition(sid,u,'100',g,'claim');if not (s->>'claimed')::boolean then raise exception 'claim missing';end if;
 s:=public.material_upload_transition(sid,u,'100',g,'claim');if (s->>'claimed')::boolean then raise exception 'duplicate create';end if;
 begin perform public.material_upload_transition(sid,u,'100',g,'publish','{"path":"/wrong","size":4194305,"fs_id":"9223372036854775807"}');raise exception 'wrong path';exception when raise_exception then if sqlerrm<>'upload_verification' then raise;end if;end;
 s:=public.material_upload_transition(sid,u,'100',g,'publish','{"path":"/apps/test/upload","size":4194305,"fs_id":"9223372036854775807"}');
 perform public.material_upload_transition(sid,u,'100',g,'publish','{"path":"/apps/test/upload","size":4194305,"fs_id":"9223372036854775807"}');
 if(select count(*) from public.material_assets where fs_id='9223372036854775807' and account_id='100')<>1 then raise exception 'duplicate asset';end if;
 sid:='99999999-2222-4111-8111-111111111111';
 perform public.material_upload_transition(sid,u,'100',g,'new','{"path":"/apps/test/cancel","name":"x","subject":"math","mime":"x","size":1,"hashes":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]}');
 perform public.material_upload_transition(sid,u,'100',g,'cancel');
 begin perform public.material_upload_transition(sid,u,'100',g,'publish','{"path":"/apps/test/cancel","size":1,"fs_id":"10"}');raise exception 'cancel accepted';exception when raise_exception then if sqlerrm<>'upload_verification' then raise;end if;end;
 perform public.baidu_store_verified_credentials('{"account_id":"200","app_key":"fixture","access_token":"a","refresh_token":"b","expires_at":"2099-01-01","scope":"basic"}');
 begin perform public.material_upload_transition(sid,u,'100',g,'claim');raise exception 'switch accepted';exception when raise_exception then if sqlerrm<>'baidu_account_changed' then raise;end if;end;
end $$;
set local role authenticated;
do $$ begin
 begin perform * from public.material_upload_sessions;raise exception 'browser reads sessions';exception when insufficient_privilege then null;end;
 begin perform public.material_upload_transition(gen_random_uuid(),gen_random_uuid(),'100',gen_random_uuid(),'new','{}');raise exception 'browser calls transition';exception when insufficient_privilege then null;end;
end $$;
rollback;
