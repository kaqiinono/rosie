-- Preserve task_templates IDs/history and initialize complete pool metadata for future users.
-- Existing users/configuration remain untouched; only rows inserted in this call get bindings.
create or replace function public.task_initialize(p_templates jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare
 u uuid:=auth.uid(); t jsonb; pool_id uuid; inserted_pool_ids uuid[]:='{}';
begin
 if u is null then raise exception 'authentication_required'; end if;
 perform public.task_user_lock(u);
 if not exists(select 1 from public.task_courses where user_id=u) then
   insert into public.task_courses(user_id,name,subject) values
   (u,'语文','chinese'),(u,'纳约数学','math'),(u,'厚海英语','english'),
   (u,'舞蹈','dance'),(u,'钢琴','piano'),(u,'游泳','swimming');
 end if;
 if not exists(select 1 from public.task_templates where user_id=u) then
   for t in select * from jsonb_array_elements(p_templates) loop
     insert into public.task_templates(user_id,name,subject,course_id,enabled,mode,trigger,target,
       checklist,estimated_minutes,deadline,reminders,trigger_minutes,weekdays,scheduled_at,
       lesson_filter,material_kind,item_source,activity_key,scope,progress_mode,material_selector)
     values(u,t->>'name',t->>'subject',null,coalesce((t->>'enabled')::boolean,true),
       t->>'mode',t->>'trigger',t->>'target',coalesce(t->'checklist','[]'::jsonb),
       (t->>'estimated_minutes')::integer,t->'deadline',coalesce(t->'reminders','[]'::jsonb),
       coalesce((t->>'trigger_minutes')::integer,0),
       array(select jsonb_array_elements_text(coalesce(t->'weekdays','[]'::jsonb))::integer),
       (t->>'scheduled_at')::timestamptz,(t->>'lesson_filter')::integer,
       t->>'material_kind',t->>'item_source',coalesce(nullif(t->>'activity_key',''),'custom:'||gen_random_uuid()::text),
       coalesce(t->'scope','{"kind":"all"}'::jsonb),
       coalesce(t->>'progress_mode',case when t->>'mode'='checklist' then 'items' else 'percentage' end),
       coalesce(t->'material_selector','{"kind":"auto"}'::jsonb)) returning id into pool_id;
     inserted_pool_ids:=array_append(inserted_pool_ids,pool_id);
   end loop;
   insert into public.task_course_pool_bindings(user_id,course_id,pool_item_id,enabled)
     select u,c.id,t.id,t.enabled from public.task_courses c
     join public.task_templates t on t.user_id=c.user_id and t.subject=c.subject
     where c.user_id=u and t.id=any(inserted_pool_ids)
       and t.trigger in ('before_class','after_class','confirmed','unit_completed')
     on conflict(user_id,course_id,pool_item_id) do nothing;
 end if;
end $$;
revoke all on function public.task_initialize(jsonb) from public,anon;
grant execute on function public.task_initialize(jsonb) to authenticated;
