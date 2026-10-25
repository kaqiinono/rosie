-- Disambiguate SQL aliases from the PL/pgSQL occurrence variable.
create or replace function public.task_tick(p_user uuid) returns void language plpgsql security invoker set search_path='' as $$
declare r public.task_timetable_rules; o public.task_course_occurrences; t public.task_templates; i public.task_instances; rr jsonb; d date; sub text; fire timestamptz; anchor timestamptz; due public.task_course_occurrences; rec record;
begin
 perform public.task_user_lock(p_user);
 for r in select * from public.task_timetable_rules where user_id=p_user and course_id in (select id from public.task_courses where user_id=p_user and archived_at is null) loop
 for d in select g::date from generate_series(greatest(r.valid_from,(now() at time zone 'Asia/Shanghai')::date-35),least(coalesce(r.valid_until,'infinity'::date),(now() at time zone 'Asia/Shanghai')::date+35),interval '1 day') g where public.task_rule_occurs(r,g::date) and (g::date+r.end_time) at time zone 'Asia/Shanghai'>r.created_at loop
 insert into public.task_course_occurrences(user_id,course_id,rule_id,original_date,starts_at,ends_at,status)
 select p_user,r.course_id,r.id,d,coalesce(e.starts_at,(d+r.start_time) at time zone 'Asia/Shanghai'),coalesce(e.ends_at,(d+r.end_time) at time zone 'Asia/Shanghai'),case when coalesce(e.cancelled,false) then 'cancelled' else 'scheduled' end
 from (select 1) dummy left join public.task_course_exceptions e on e.user_id=p_user and e.rule_id=r.id and e.original_date=d
 on conflict(user_id,rule_id,original_date) do nothing;
 end loop;
 end loop;
 -- Preserve confirmed occurrences and reconcile rule/exception changes per original date.
 for o in select * from public.task_course_occurrences where user_id=p_user and status<>'confirmed' and ends_at>now() loop
 select * into r from public.task_timetable_rules where id=o.rule_id;
 select * into rec from public.task_course_exceptions where user_id=p_user and rule_id=o.rule_id and original_date=o.original_date;
 update public.task_course_occurrences set starts_at=coalesce(rec.starts_at,(o.original_date+r.start_time) at time zone 'Asia/Shanghai'),ends_at=coalesce(rec.ends_at,(o.original_date+r.end_time) at time zone 'Asia/Shanghai'),status=case when coalesce(rec.cancelled,false) or not public.task_rule_occurs(r,o.original_date) or exists(select 1 from public.task_courses c where c.id=o.course_id and c.user_id=p_user and c.archived_at is not null) then 'cancelled' else 'scheduled' end where id=o.id;
 end loop;
 for rec in select id from public.task_courses where user_id=p_user and archived_at is null loop
 perform public.task_ensure_next(p_user,rec.id,now());
 end loop;
 for o in select * from public.task_course_occurrences where user_id=p_user and status<>'cancelled' and ends_at>=now()-interval '35 days' and course_id in(select id from public.task_courses where user_id=p_user and archived_at is null) loop
 select subject into sub from public.task_courses where id=o.course_id;
 if o.status='scheduled' and o.ends_at<=now() then
 insert into public.task_reminders(user_id,occurrence_id,source_key,title,remind_at,expires_at)
 values(p_user,o.id,'confirm:'||o.id,'请确认课程：'||(select name from public.task_courses where id=o.course_id),o.ends_at,o.ends_at+interval '1 day') on conflict(user_id,source_key) do nothing;
 end if;
 for t in select * from public.task_templates where user_id=p_user and enabled and trigger in ('before_class','after_class') and (course_id=o.course_id or (course_id is null and subject=sub)) loop
 fire:=case t.trigger when 'before_class' then o.starts_at-make_interval(mins=>t.trigger_minutes) else o.ends_at end;
 if fire<=now() and ((t.trigger='before_class' and o.starts_at>now() and t.created_at<o.starts_at) or (t.trigger='after_class' and t.created_at<=o.ends_at)) then perform public.task_emit(p_user,t.id,'class:'||o.id||':'||t.id,o.id,null,null,fire); end if;
 end loop;
 end loop;
 for t in select * from public.task_templates where user_id=p_user and enabled and trigger in ('weekly','once') loop
 if t.trigger='once' and t.scheduled_at<=now() then perform public.task_emit(p_user,t.id,'once:'||t.id,null,null,null,t.scheduled_at);
 elsif t.trigger='weekly' then
 for d in select g::date from generate_series(greatest((t.scheduled_at at time zone 'Asia/Shanghai')::date,(t.created_at at time zone 'Asia/Shanghai')::date,coalesce((t.generated_through at time zone 'Asia/Shanghai')::date,'-infinity'::date)),(now() at time zone 'Asia/Shanghai')::date,interval '1 day') g where extract(dow from g)::int=any(t.weekdays) loop
 fire:=(d+(t.scheduled_at at time zone 'Asia/Shanghai')::time) at time zone 'Asia/Shanghai';
 if fire<=now() then perform public.task_emit(p_user,t.id,'weekly:'||t.id||':'||d,null,null,null,fire); end if;
 end loop;
 end if;
 update public.task_templates set generated_through=now() where id=t.id;
 end loop;
 -- Relative next-class deadlines follow the actual current timetable, fixed deadlines do not.
 for i in select * from public.task_instances where user_id=p_user and status in ('pending','active') and due_kind='next_class' and course_id is not null loop
 select * into o from public.task_course_occurrences where id=i.occurrence_id;
 select * into t from jsonb_populate_record(null::public.task_templates,i.template_snapshot);
 perform public.task_ensure_next(p_user,i.course_id,case when i.occurrence_id is null then i.created_at when t.trigger='before_class' then o.starts_at-interval '1 microsecond' else o.starts_at end);
 select * into due from public.task_course_occurrences where user_id=p_user and course_id=i.course_id and status<>'cancelled'
 and (case when i.occurrence_id is null then starts_at>i.created_at when t.trigger='before_class' then starts_at>=o.starts_at else starts_at>o.starts_at end) order by starts_at limit 1;
 update public.task_instances set due_at=due.starts_at,due_occurrence_id=due.id where id=i.id;
 end loop;
 for i in select * from public.task_instances where user_id=p_user and status in ('pending','active') and template_id is not null loop
 select * into t from jsonb_populate_record(null::public.task_templates,i.template_snapshot);
 select * into o from public.task_course_occurrences where id=i.occurrence_id;
 for rr in select * from jsonb_array_elements(t.reminders) loop
 anchor:=case rr->>'anchor' when 'course_start' then o.starts_at when 'course_end' then o.ends_at else i.due_at end;
 if anchor is null then continue; end if;
 fire:=anchor+make_interval(mins=>(rr->>'minutes')::int);
 insert into public.task_reminders(user_id,task_id,occurrence_id,source_key,title,remind_at,expires_at)
 values(p_user,i.id,i.occurrence_id,i.id||':'||(rr->>'anchor')||':'||(rr->>'minutes'),i.title,fire,case when rr->>'anchor'='course_start' then o.starts_at end)
 on conflict(user_id,source_key) do update set remind_at=excluded.remind_at,expires_at=excluded.expires_at,title=excluded.title where task_reminders.status='pending';
 end loop;
 end loop;
 insert into public.task_reminders(user_id,occurrence_id,source_key,title,remind_at,expires_at)
 select p_user,course_occ.id,'course-start:'||course_occ.id,'即将上课：'||c.name,course_occ.starts_at-make_interval(mins=>c.reminder_minutes),case when c.reminder_minutes=0 then course_occ.ends_at else course_occ.starts_at end
 from public.task_course_occurrences course_occ join public.task_courses c on c.id=course_occ.course_id and c.user_id=course_occ.user_id
 where course_occ.user_id=p_user and course_occ.status='scheduled' and course_occ.ends_at>now() and (c.reminder_minutes=0 or course_occ.starts_at>now()) and c.archived_at is null and c.reminder_minutes is not null
 on conflict(user_id,source_key) do update set remind_at=excluded.remind_at,expires_at=excluded.expires_at,title=excluded.title,status=case when task_reminders.read_at is null then 'pending' else task_reminders.status end;
 insert into public.task_reminders(user_id,exam_id,source_key,title,remind_at,expires_at)
 select p_user,e.id,'exam:'||e.id,'即将考试：'||e.title,e.starts_at-make_interval(mins=>e.reminder_minutes),e.ends_at
 from public.task_exams e where e.user_id=p_user and e.ends_at>now() and e.reminder_minutes is not null
 and (e.course_id is null or exists(select 1 from public.task_courses c where c.id=e.course_id and c.user_id=p_user and c.archived_at is null))
 on conflict(user_id,source_key) do update set remind_at=excluded.remind_at,expires_at=excluded.expires_at,title=excluded.title,status=case when task_reminders.read_at is null then 'pending' else task_reminders.status end;
 update public.task_reminders rem set status='cancelled' where rem.user_id=p_user and rem.status in ('pending','sending','failed') and (
 (rem.source_key like 'course-start:%' and exists(select 1 from public.task_course_occurrences course_occ join public.task_courses c on c.id=course_occ.course_id and c.user_id=course_occ.user_id where course_occ.id=rem.occurrence_id and course_occ.user_id=p_user and (c.reminder_minutes is null or c.archived_at is not null)))
 or (rem.exam_id is not null and exists(select 1 from public.task_exams e where e.id=rem.exam_id and e.user_id=p_user and (e.reminder_minutes is null or exists(select 1 from public.task_courses c where c.id=e.course_id and c.user_id=p_user and c.archived_at is not null)))));
 update public.task_reminders rem set status='cancelled' where rem.user_id=p_user and rem.status in ('pending','sending','failed') and (
 (rem.expires_at is not null and rem.expires_at<=now())
 or exists(select 1 from public.task_instances inst where inst.id=rem.task_id and inst.status in ('completed','cancelled'))
 or exists(select 1 from public.task_course_occurrences occ where occ.id=rem.occurrence_id and (occ.status='cancelled' or (rem.task_id is null and occ.status='confirmed'))));
end $$;
