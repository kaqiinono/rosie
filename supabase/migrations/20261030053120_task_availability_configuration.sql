-- Explicit recurring/date states. Existing windows remain the multi-window editor source.
create table public.task_availability_day_states (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 weekday integer check(weekday between 0 and 6), on_date date,
 state text not null check(state in ('unconfigured','zero','configured')),
 check((weekday is null) <> (on_date is null))
);
create unique index task_day_state_weekday on public.task_availability_day_states(user_id,weekday) where on_date is null;
create unique index task_day_state_date on public.task_availability_day_states(user_id,on_date) where on_date is not null;
alter table public.task_availability_day_states enable row level security;
grant select,insert,update,delete on public.task_availability_day_states to authenticated;
create policy owned on public.task_availability_day_states to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
insert into public.task_availability_day_states(user_id,weekday,on_date,state)
 select user_id,case when on_date is null then weekday end,on_date,case when bool_and(unavailable) then 'zero' else 'configured' end
 from public.task_availability_windows group by user_id,case when on_date is null then weekday end,on_date;
-- A single owner transaction configures the scope; never deletes accepted arrangements.
create function public.task_set_availability(p_weekday integer,p_date date,p_state text,p_start time default null,p_end time default null) returns void
 language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'unauthorized'; end if;
 perform public.task_user_lock(u);
 if (p_weekday is null)=(p_date is null) or p_weekday not between 0 and 6 or p_state is null or p_state not in ('unconfigured','zero','configured','inherit') then raise exception 'invalid_availability'; end if;
 if p_state='inherit' and p_date is null then raise exception 'date_override_required'; end if;
 if p_state='configured' and (p_start is null or p_end is null or p_end<=p_start) then raise exception 'invalid_window'; end if;
 delete from public.task_availability_day_states where user_id=u and (on_date=p_date or (p_date is null and on_date is null and weekday=p_weekday));
 if p_state='inherit' then
 delete from public.task_availability_windows where user_id=u and on_date=p_date;
 return; end if;
 insert into public.task_availability_day_states(user_id,weekday,on_date,state) values(u,p_weekday,p_date,p_state);
 if p_state<>'configured' then
 delete from public.task_availability_windows where user_id=u and (on_date=p_date or (p_date is null and on_date is null and weekday=p_weekday));
 else
 delete from public.task_availability_windows where user_id=u and unavailable and (on_date=p_date or (p_date is null and on_date is null and weekday=p_weekday));
 insert into public.task_availability_windows(user_id,weekday,on_date,start_time,end_time,unavailable) values(u,coalesce(p_weekday,extract(dow from p_date)::int),p_date,p_start,p_end,false);
 end if;
end $$;
revoke all on function public.task_set_availability(integer,date,text,time,time) from public,anon;
grant execute on function public.task_set_availability(integer,date,text,time,time) to authenticated;
-- Dirty revisions include deletions, and serialize capacity mutations with task execution.
create function private.task_capacity_dirty() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 if tg_op='UPDATE' and new is not distinct from old then return new; end if;
 u:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 insert into public.task_user_planning_revisions(user_id,revision) values(u,1) on conflict(user_id) do update set revision=public.task_user_planning_revisions.revision+1;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function private.task_capacity_dirty() from public,anon,authenticated;
do $$declare t text; begin foreach t in array array['task_availability_day_states','task_availability_windows','task_time_blocks','task_exams','task_timetable_rules','task_course_exceptions','task_course_events','task_courses'] loop
 execute format('create trigger task_capacity_dirty before insert or update or delete on public.%I for each row execute function private.task_capacity_dirty()',t);
end loop; end $$;
create or replace function public.task_validate_block() returns trigger language plpgsql security invoker set search_path='' as $$
declare d date:=(new.starts_at at time zone 'Asia/Shanghai')::date; st text; overridden boolean;
begin
 perform public.task_user_lock(new.user_id);
 if not exists(select 1 from public.task_instances where id=new.task_id and user_id=new.user_id and status in ('pending','active')) then raise exception 'task_not_open'; end if;
 if exists(select 1 from public.task_instances t where t.id=new.task_id and t.user_id=new.user_id and (new.starts_at<t.created_at or (t.due_at is not null and new.ends_at>t.due_at))) then raise exception 'outside_task_window'; end if;
 if new.starts_at<now() then raise exception 'time_in_past'; end if;
 if new.ends_at<=new.starts_at or date_trunc('minute',new.starts_at)<>new.starts_at or date_trunc('minute',new.ends_at)<>new.ends_at or (new.ends_at at time zone 'Asia/Shanghai')::date<>d then raise exception 'invalid_block_time'; end if;
 select exists(select 1 from public.task_availability_day_states where user_id=new.user_id and on_date=d) or exists(select 1 from public.task_availability_windows where user_id=new.user_id and on_date=d) into overridden;
 select s.state into st from public.task_availability_day_states s where s.user_id=new.user_id and (s.on_date=d or (not overridden and s.on_date is null and s.weekday=extract(dow from d)));
 if st in ('zero','unconfigured') then raise exception 'outside_available_window'; end if;
 if not coalesce((select range_agg(tstzrange((d+w.start_time) at time zone 'Asia/Shanghai',(d+w.end_time) at time zone 'Asia/Shanghai','[)')) @> tstzrange(new.starts_at,new.ends_at,'[)') from public.task_availability_windows w where w.user_id=new.user_id and not w.unavailable and (w.on_date=d or (not overridden and w.on_date is null and w.weekday=extract(dow from d)))),false) then raise exception 'outside_available_window'; end if;
 if exists(select 1 from public.task_availability_windows w where w.user_id=new.user_id and w.unavailable and (w.on_date=d or (not overridden and w.on_date is null and w.weekday=extract(dow from d))) and (d+w.start_time) at time zone 'Asia/Shanghai'<new.ends_at and (d+w.end_time) at time zone 'Asia/Shanghai'>new.starts_at)
 or exists(select 1 from public.task_course_occurrences c where c.user_id=new.user_id and c.status<>'cancelled' and c.starts_at<new.ends_at and c.ends_at>new.starts_at)
 or exists(select 1 from public.task_course_events c where c.user_id=new.user_id and c.assignment_state<>'cancelled' and c.starts_at<new.ends_at and c.ends_at>new.starts_at)
 or exists(select 1 from public.task_exams e where e.user_id=new.user_id and e.starts_at<new.ends_at and e.ends_at>new.starts_at)
 or exists(select 1 from public.task_time_blocks b where b.user_id=new.user_id and b.id<>new.id and b.starts_at<new.ends_at and b.ends_at>new.starts_at) then raise exception 'time_conflict'; end if;
 return new;
end $$;
-- Existing recurrence/exception guard remains: validates far future rules without materializing tasks.
-- Explicit flexible rules never have clocks and are excluded from this guard.
create or replace function public.task_validate_timetable_block() returns trigger language plpgsql security invoker set search_path='' as $$
declare d date:=(new.starts_at at time zone 'Asia/Shanghai')::date;
begin
 perform public.task_user_lock(new.user_id);
 if exists(
 select 1 from public.task_timetable_rules r join public.task_courses c on c.user_id=r.user_id and c.id=r.course_id
 left join public.task_course_exceptions e on e.user_id=r.user_id and e.rule_id=r.id and e.original_date=d
 where r.user_id=new.user_id and c.archived_at is null and r.kind='timetabled' and public.task_rule_occurs(r,d) and not coalesce(e.cancelled,false)
 and coalesce(e.starts_at,(d+r.start_time) at time zone 'Asia/Shanghai')<new.ends_at
 and coalesce(e.ends_at,(d+r.end_time) at time zone 'Asia/Shanghai')>new.starts_at
 ) or exists(
 select 1 from public.task_course_exceptions e join public.task_timetable_rules r on r.user_id=e.user_id and r.id=e.rule_id
 join public.task_courses c on c.user_id=r.user_id and c.id=r.course_id
 where e.user_id=new.user_id and c.archived_at is null and r.kind='timetabled' and not e.cancelled and public.task_rule_occurs(r,e.original_date)
 and e.starts_at<new.ends_at and e.ends_at>new.starts_at
 ) then raise exception 'time_conflict'; end if;
 return new;
end $$;
