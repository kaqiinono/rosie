begin;
insert into auth.users(id) values ('78787878-7878-7878-7878-787878787871'), ('78787878-7878-7878-7878-787878787872');
insert into public.material_assets(id,subject,kind,title,created_by,text_content) values ('78787878-7878-7878-7878-787878787873','english','text','Shared asset from another user','78787878-7878-7878-7878-787878787872','notes');
select set_config('request.jwt.claim.sub','78787878-7878-7878-7878-787878787871',true);
do $$
declare u uuid:=auth.uid();activity text;selector text;template_id uuid;begin
 foreach activity in array array['once','weekly'] loop
  foreach selector in array array['assets','none','auto'] loop
   insert into public.task_templates(user_id,name,subject,mode,trigger,target,scheduled_at,weekdays,material_selector,deadline)
   values(u,activity||':'||selector,'english','reading',activity,'current',now()-interval '1 minute',array[extract(dow from now() at time zone 'Asia/Shanghai')::int],case when selector='assets' then '{"kind":"assets","asset_ids":["78787878-7878-7878-7878-787878787873"]}'::jsonb else jsonb_build_object('kind',selector) end,'{"kind":"same_day","time":"20:30"}') returning id into template_id;
  end loop;
 end loop;
end $$;
set local role authenticated;
select public.task_tick(auth.uid());
do $$
declare t public.task_instances;begin
 for t in select * from public.task_instances where user_id=auth.uid() loop
  if t.template_snapshot->'material_selector'->>'kind'='assets' then
   if t.course_id is not null or t.material_status<>'selected' or t.material_assets<>'["78787878-7878-7878-7878-787878787873"]'::jsonb then raise exception 'independent_explicit_material_lost:%',t.title;end if;
  elsif t.template_snapshot->'material_selector'->>'kind'='none' then
   if t.material_status<>'not_required' or t.material_assets<>'[]'::jsonb then raise exception 'independent_none_material';end if;
  else
   if t.material_status<>'pending' or t.estimated_minutes<>20 then raise exception 'independent_auto_not_pending';end if;
  end if;
  if t.material_selector_snapshot is distinct from t.template_snapshot->'material_selector' then raise exception 'independent_selector_snapshot';end if;
 end loop;
 if (select count(*) from public.task_instances where user_id=auth.uid())<>6 then raise exception 'independent_sources_missing';end if;
 perform public.task_tick(auth.uid());
 if (select count(*) from public.task_instances where user_id=auth.uid())<>6 then raise exception 'independent_sources_duplicated';end if;
 begin perform public.task_emit('78787878-7878-7878-7878-787878787872',(select template_id from public.task_instances where user_id=auth.uid() limit 1),'foreign-source');raise exception 'foreign_emitter_allowed';exception when raise_exception then if SQLERRM='foreign_emitter_allowed' then raise;end if;end;
end $$;
rollback;
