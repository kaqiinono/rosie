begin;
-- Deterministic parity with the pure helper; midnight uses Shanghai, never host timezone.
do $$declare w record; begin
 select * into w from public.task_effective_execution_window('2026-10-30T08:00Z','2026-10-29T08:00Z','2026-10-29T09:00Z','2026-11-01T09:00Z','2026-10-30T09:00Z');
 if w.release_at<>'2026-10-30T08:00Z'::timestamptz or w.due_at<>'2026-11-01T09:00Z'::timestamptz or w.deadline_source<>'explicit_recovery' or w.issue is not null then raise exception 'explicit recovery policy'; end if;
 select * into w from public.task_effective_execution_window(null,'2026-10-29T08:00Z','2026-10-29T09:00Z',null,'2026-10-30T09:00Z');
 if w.release_at<>'2026-10-29T08:00Z'::timestamptz or w.due_at<>'2026-10-30T15:59Z'::timestamptz or w.deadline_source<>'suggested_recovery' or w.issue is not null then raise exception 'missing recovery policy'; end if;
 select * into w from public.task_effective_execution_window(null,'2026-10-29T08:00Z','2026-10-29T09:00Z','2026-10-29T10:00Z','2026-10-30T09:00Z');
 if w.due_at<>'2026-10-30T15:59Z'::timestamptz or w.deadline_source<>'suggested_recovery' then raise exception 'expired recovery policy'; end if;
 select * into w from public.task_effective_execution_window(null,'2026-10-29T08:00Z',null,null,'2026-10-30T09:00Z');
 if w.due_at is not null or w.deadline_source<>'missing' or w.issue<>'missing_deadline' then raise exception 'undated default invented'; end if;
 select * into w from public.task_effective_execution_window(null,'2026-10-29T08:00Z','2026-10-29T09:00Z',null,'2026-10-30T15:59:01Z');
 if w.due_at<>'2026-10-30T15:59Z'::timestamptz or w.issue<>'recovery_window_elapsed' then raise exception 'silently jumped to tomorrow'; end if;
 select * into w from public.task_effective_execution_window(null,'2026-10-29T08:00Z','2026-10-29T09:00Z',null,'2026-10-30T16:00Z');
 if w.due_at<>'2026-10-31T15:59Z'::timestamptz or w.issue is not null then raise exception 'Shanghai midnight not rolled'; end if;
end $$;
insert into auth.users(id) values('10101010-4444-4444-8444-444444444444');
set local role authenticated;
select set_config('request.jwt.claim.sub','10101010-4444-4444-8444-444444444444',true);
select public.task_save_execution('{"title":"recovery","subject":"other","estimated_minutes":60,"due_at":"2020-01-01T00:00:00Z"}',null);
-- Server fixture only: metadata is not editable by direct authenticated task DML.
reset role;
update public.task_instances set release_at='2099-01-05T09:30Z',recovery_due_at='2099-01-10T10:00Z' where title='recovery';
set local role authenticated;
select public.task_set_availability(null,'2099-01-05','configured','17:00','20:00');
select public.task_set_availability(null,'2099-01-06','configured','17:00','20:00');
select public.task_set_availability(null,'2099-01-07','configured','17:00','20:00');
do $$declare t uuid; b uuid; begin
 select id into t from public.task_instances where title='recovery';
 begin insert into public.task_time_blocks(user_id,task_id,starts_at,ends_at) values(auth.uid(),t,'2099-01-05T09:00Z','2099-01-05T10:00Z');
 raise exception 'persisted release ignored'; exception when others then if sqlerrm<>'outside_task_window' then raise; end if; end;
 insert into public.task_time_blocks(user_id,task_id,starts_at,ends_at) values(auth.uid(),t,'2099-01-05T09:30Z','2099-01-05T10:00Z') returning id into b;
 update public.task_time_blocks set starts_at='2099-01-06T09:30Z',ends_at='2099-01-06T10:00+00:00' where id=b;
 if (select count(*) from public.task_time_blocks where task_id=t)<>1 or (select starts_at from public.task_time_blocks where id=b)<>'2099-01-06T09:30Z'::timestamptz then raise exception 'crossday update lost identity'; end if;
 insert into public.task_exams(user_id,title,starts_at,ends_at) values(auth.uid(),'target exam','2099-01-07T09:00Z','2099-01-07T11:00Z');
 begin update public.task_time_blocks set starts_at='2099-01-07T09:30Z',ends_at='2099-01-07T10:00Z' where id=b;
 raise exception 'crossday conflict accepted'; exception when others then if sqlerrm<>'time_conflict' then raise; end if; end;
 if (select starts_at from public.task_time_blocks where id=b)<>'2099-01-06T09:30Z'::timestamptz or (select count(*) from public.task_time_blocks where task_id=t)<>1 then raise exception 'rejected crossday move mutated original'; end if;
 if exists(select 1 from public.task_instances where id=t and (due_at<>'2020-01-01T00:00Z'::timestamptz or recovery_due_at<>'2099-01-10T10:00Z'::timestamptz or completion_percent<>0)) then raise exception 'execution metadata rewritten'; end if;
end $$;
-- Undated explicit block remains permitted, but must honor the persisted release.
select public.task_save_execution('{"title":"undated","subject":"other","estimated_minutes":60}',null);
reset role;
update public.task_instances set release_at='2099-01-05T10:30Z' where title='undated';
set local role authenticated;
do $$declare t uuid; begin
 select id into t from public.task_instances where title='undated';
 begin insert into public.task_time_blocks(user_id,task_id,starts_at,ends_at) values(auth.uid(),t,'2099-01-05T10:00Z','2099-01-05T11:00Z');
 raise exception 'undated early release accepted'; exception when others then if sqlerrm<>'outside_task_window' then raise; end if; end;
 insert into public.task_time_blocks(user_id,task_id,starts_at,ends_at) values(auth.uid(),t,'2099-01-05T10:30Z','2099-01-05T11:00Z');
 if exists(select 1 from public.task_instances where id=t and (due_at is not null or recovery_due_at is not null)) then raise exception 'undated block invented deadline'; end if;
end $$;
rollback;
