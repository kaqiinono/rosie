do $$begin
 if (select count(*) from public.task_course_pool_bindings where user_id='15151515-0000-4000-8000-000000000001')<>1 then raise exception 'legacy binding mapping lost';end if;
 if not exists(select 1 from public.task_course_events where id='15151515-0000-4000-8000-000000000005' and completion_state='completed' and completed_at is null and legacy_confirmation->'lesson'->>'key'='5a-u1l1') then raise exception 'legacy confirmation mapping lost';end if;
 if not exists(select 1 from public.task_instances where id='15151515-0000-4000-8000-000000000006' and status='completed' and completion_percent=100 and items->0->>'done'='true') then raise exception 'legacy completion lost';end if;
 if not exists(select 1 from public.task_materials where user_id='15151515-0000-4000-8000-000000000001' and audio->0->>'path'='private-fixture-recording') then raise exception 'private recording lost';end if;
 if exists(select 1 from public.material_assets where created_by='15151515-0000-4000-8000-000000000001') then raise exception 'private recording leaked to shared';end if;
end $$;
