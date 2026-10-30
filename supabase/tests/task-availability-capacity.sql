begin;
insert into auth.users(id) values('10101010-1111-4111-8111-111111111111'),('10101010-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claim.sub','10101010-1111-4111-8111-111111111111',true);
select public.task_initialize('[]');
do $$begin
 if exists(select 1 from public.task_availability_windows) or exists(select 1 from public.task_availability_day_states) then raise exception 'bootstrap manufactured capacity'; end if;
end $$;
select public.task_set_availability(1,null,'configured','17:00','20:00');
select public.task_set_availability(1,null,'configured','19:00','21:00');
select public.task_set_availability(null,'2099-01-05','zero');
do $$begin
 if (select count(*) from public.task_availability_windows)<>2 then raise exception 'multiwindow lost'; end if;
 if (select state from public.task_availability_day_states where on_date='2099-01-05')<>'zero' then raise exception 'zero override lost'; end if;
end $$;
-- Create through the authoritative execution protocol, never direct task DML.
select public.task_save_execution('{"title":"capacity","subject":"other","mode":"checklist","progress_mode":"percentage","estimated_minutes":60,"due_at":"2099-02-01T00:00:00Z"}',null);
do $$declare t uuid; b uuid; rev bigint; begin
 select id into t from public.task_instances where title='capacity';
 begin
 insert into public.task_time_blocks(user_id,task_id,starts_at,ends_at) values(auth.uid(),t,'2099-01-05T09:00:00Z','2099-01-05T10:00:00Z');
 raise exception 'zero override accepted block'; exception when others then if sqlerrm<>'outside_available_window' then raise; end if; end;
 perform public.task_set_availability(null,'2099-01-05','inherit');
 insert into public.task_time_blocks(user_id,task_id,starts_at,ends_at) values(auth.uid(),t,'2099-01-05T09:00:00Z','2099-01-05T10:00:00Z') returning id into b;
 select revision into rev from public.task_user_planning_revisions where user_id=auth.uid();
 insert into public.task_exams(user_id,title,starts_at,ends_at) values(auth.uid(),'exam','2099-01-05T10:00:00Z','2099-01-05T11:00:00Z');
 begin update public.task_time_blocks set starts_at='2099-01-05T10:00:00Z',ends_at='2099-01-05T11:00:00Z' where id=b;
 raise exception 'move into exam accepted'; exception when others then if sqlerrm<>'time_conflict' then raise; end if; end;
 if (select starts_at from public.task_time_blocks where id=b)<>'2099-01-05T09:00:00Z'::timestamptz then raise exception 'failed move changed arrangement'; end if;
 if (select revision from public.task_user_planning_revisions where user_id=auth.uid())<=rev then raise exception 'capacity not dirty'; end if;
 perform public.task_set_completion(t,100,(select revision from public.task_instances where id=t));
 perform public.task_save_execution('{"title":"second","subject":"other","estimated_minutes":20,"due_at":"2099-02-01T00:00:00Z"}',null);
 select id into t from public.task_instances where title='second';
 begin insert into public.task_time_blocks(user_id,task_id,starts_at,ends_at) values(auth.uid(),t,'2099-01-05T09:15:00Z','2099-01-05T09:30:00Z');
 raise exception 'completed retained block did not reserve capacity'; exception when others then if sqlerrm<>'time_conflict' then raise; end if; end;
 begin insert into public.task_time_blocks(user_id,task_id,starts_at,ends_at) values(auth.uid(),t,'2099-01-05T11:00:01Z','2099-01-05T11:30:00Z');
 raise exception 'subminute block accepted'; exception when others then if sqlerrm<>'invalid_block_time' then raise; end if; end;

end $$;
select set_config('request.jwt.claim.sub','10101010-2222-4222-8222-222222222222',true);
do $$begin
 if exists(select 1 from public.task_availability_day_states) or exists(select 1 from public.task_time_blocks) then raise exception 'foreign capacity readable'; end if;
 begin insert into public.task_availability_day_states(user_id,weekday,state) values('10101010-1111-4111-8111-111111111111',3,'zero');
 raise exception 'foreign capacity writable'; exception when others then if sqlstate<>'42501' and sqlerrm<>'unauthorized' then raise; end if; end;
end $$;
rollback;
