-- Shared execution target: no original deadline/progress metadata is rewritten.
create function public.task_effective_execution_window(p_release timestamptz,p_created timestamptz,p_due timestamptz,p_recovery timestamptz,p_now timestamptz)
 returns table(release_at timestamptz,due_at timestamptz,deadline_source text,issue text)
 language plpgsql immutable security invoker set search_path='' as $$
begin
 release_at:=coalesce(p_release,p_created); due_at:=p_due;
 deadline_source:=case when p_due is null then 'missing' else 'original' end;
 if release_at is null or p_now is null then issue:='execution_window_invalid';
 elsif p_due is null then issue:='missing_deadline';
 elsif p_due<p_now then
  if p_recovery>p_now then due_at:=p_recovery;deadline_source:='explicit_recovery';
  else
   due_at:=((p_now at time zone 'Asia/Shanghai')::date+time '23:59') at time zone 'Asia/Shanghai';
   deadline_source:='suggested_recovery';
   if due_at<=p_now then issue:='recovery_window_elapsed'; end if;
  end if;
 end if;
 return next;
end $$;
revoke all on function public.task_effective_execution_window(timestamptz,timestamptz,timestamptz,timestamptz,timestamptz) from public,anon;
grant execute on function public.task_effective_execution_window(timestamptz,timestamptz,timestamptz,timestamptz,timestamptz) to authenticated;
create or replace function public.task_validate_block() returns trigger language plpgsql security invoker set search_path='' as $$
declare d date:=(new.starts_at at time zone 'Asia/Shanghai')::date; st text; overridden boolean; effective record;
begin
 perform public.task_user_lock(new.user_id);
 if not exists(select 1 from public.task_instances where id=new.task_id and user_id=new.user_id and status in ('pending','active')) then raise exception 'task_not_open'; end if;
 select w.* into effective from public.task_instances t cross join lateral public.task_effective_execution_window(t.release_at,t.created_at,t.due_at,t.recovery_due_at,now()) w where t.id=new.task_id and t.user_id=new.user_id;
 if effective.issue is not null and effective.issue<>'missing_deadline' then raise exception '%',effective.issue; end if;
 if new.starts_at<effective.release_at or (effective.due_at is not null and new.ends_at>effective.due_at) then raise exception 'outside_task_window'; end if;
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
