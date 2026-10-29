-- Disposable database only. Exercise actual task_initialize metadata, ownership and retries.
begin;
insert into auth.users(id) values('30000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.task_initialize('[{"name":"Composition","subject":"english","mode":"checklist","trigger":"confirmed","target":"current","checklist":["作文"],"estimated_minutes":30,"deadline":{"kind":"next_class"},"reminders":[],"trigger_minutes":0,"weekdays":[1],"lesson_filter":3,"material_kind":"general","item_source":"template","activity_key":"english:composition","scope":{"kind":"lessons","lesson_keys":["5a-u3l3"]},"progress_mode":"percentage","material_selector":{"kind":"none"}},{"name":"Weekly","scheduled_at":"2026-11-01T00:00:00Z","subject":"english","mode":"checklist","trigger":"weekly","target":"current","checklist":[],"estimated_minutes":10,"deadline":{"kind":"same_day"},"reminders":[],"trigger_minutes":0,"weekdays":[1],"material_kind":"general","item_source":"template","activity_key":"weekly"},{"name":"Once","subject":"english","mode":"checklist","trigger":"once","target":"current","checklist":[],"estimated_minutes":10,"deadline":{"kind":"same_day"},"reminders":[],"trigger_minutes":0,"weekdays":[],"scheduled_at":"2026-11-01T00:00:00Z","material_kind":"general","item_source":"template","activity_key":"once"}]'::jsonb);
do $$ begin
 if not exists(select 1 from public.task_templates where activity_key='english:composition' and scope='{"kind":"lessons","lesson_keys":["5a-u3l3"]}'::jsonb and progress_mode='percentage' and material_selector='{"kind":"none"}'::jsonb and lesson_filter=3 and estimated_minutes=30) then raise exception 'pool metadata lost'; end if;
 if (select count(*) from public.task_courses)<>6 then raise exception 'default courses missing'; end if;
 if (select count(*) from public.task_course_pool_bindings)<>1 then raise exception 'new account binding missing or independent activity bound'; end if;
 if not exists(select 1 from public.task_templates where activity_key='once' and scheduled_at='2026-11-01T00:00:00Z') then raise exception 'once scheduling lost'; end if;
end $$;
create temporary table pool_ids as select id from public.task_templates;
create temporary table binding_ids as select id from public.task_course_pool_bindings;
update public.task_course_pool_bindings set enabled=false,estimated_minutes_override=17,material_override='{"kind":"none"}';
select public.task_initialize('[]'::jsonb);
do $$ begin
 if exists(select id from pool_ids except select id from public.task_templates) or (select count(*) from public.task_templates)<>3 then raise exception 'template IDs changed'; end if;
 if exists(select id from binding_ids except select id from public.task_course_pool_bindings) then raise exception 'binding IDs changed'; end if;
 if not exists(select 1 from public.task_course_pool_bindings where not enabled and estimated_minutes_override=17 and material_override='{"kind":"none"}'::jsonb) then raise exception 'custom disabled binding overwritten'; end if;
end $$;
delete from public.task_course_pool_bindings;
select public.task_initialize('[]'::jsonb);
do $$ begin
 if exists(select 1 from public.task_course_pool_bindings) then raise exception 'deleted binding resurrected'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.task_initialize(jsonb)','EXECUTE') then raise exception 'anon initialize grant'; end if;
end $$;
rollback;
