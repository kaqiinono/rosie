begin;
insert into auth.users(id) values('55555555-5555-5555-5555-555555555558');
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555558',true);
-- Reproduce legitimate pre-migration completed-empty and partially checked checklists.
insert into public.task_instances(id,user_id,title,source_key,progress_mode,status,completion_percent,items) values
 ('55555555-5555-5555-5555-555555555580',auth.uid(),'completed empty','legacy:empty','items','completed',100,'[]'),
 ('55555555-5555-5555-5555-555555555581',auth.uid(),'partial','legacy:partial','items','active',0,'[{"id":"a","label":"A","done":true},{"id":"b","label":"B","done":false}]');
set local role authenticated;
do $$ declare t jsonb; tid uuid; initial_items jsonb; expected_status text; begin
 foreach tid in array array['55555555-5555-5555-5555-555555555580'::uuid,'55555555-5555-5555-5555-555555555581'::uuid] loop
  expected_status:=case when tid='55555555-5555-5555-5555-555555555580' then 'completed' else 'active' end;
  select items into initial_items from public.task_instances where id=tid;
  t:=public.task_set_estimate(tid,30,1);
  if t->'items'<>initial_items or t->>'status'<>expected_status or (tid='55555555-5555-5555-5555-555555555580' and (t->>'status'<>'completed' or (t->>'completion_percent')::numeric<>100)) then raise exception 'legacy_estimate_reset'; end if;
  t:=public.task_save_execution(jsonb_build_object('id',tid,'title','renamed'),2);
  if t->'items'<>initial_items or t->>'status'<>expected_status or (tid='55555555-5555-5555-5555-555555555580' and t->>'status'<>'completed') then raise exception 'legacy_name_reset'; end if;
  t:=public.task_save_execution(jsonb_build_object('id',tid,'status','cancelled'),3);
  if t->>'status'<>'cancelled' or t->'items'<>initial_items then raise exception 'legacy_cancel_lost_progress'; end if;
  t:=public.task_save_execution(jsonb_build_object('id',tid,'status','pending'),4);
  if t->'items'<>initial_items or t->>'status'<>(case when tid='55555555-5555-5555-5555-555555555580' then 'completed' else 'active' end) then raise exception 'legacy_restore_reset'; end if;
  if tid='55555555-5555-5555-5555-555555555580' and (t->>'completion_percent')::numeric<>100 then raise exception 'legacy_restore_percent'; end if;
 end loop;
 t:=public.task_save_execution('{"id":"55555555-5555-5555-5555-555555555580","items":[{"id":"new","label":"intentional replacement"}]}',5);
 if t->>'status'<>'pending' or (t->>'completion_percent')::numeric<>0 then raise exception 'intentional_content_did_not_reopen'; end if;
end $$;
rollback;
