begin;
do $$ begin
 perform private.task_complete_event('44444444-4444-4444-4444-444444444442','44444444-4444-4444-4444-444444444403',1,now());
 if (select count(*) from public.task_instances where course_id='44444444-4444-4444-4444-444444444401')<>1 then raise exception 'legacy_source_reemitted'; end if;
 if (select completion_percent from public.task_instances where id='44444444-4444-4444-4444-444444444405')<>40 then raise exception 'legacy_progress_changed'; end if;
end $$;
rollback;
