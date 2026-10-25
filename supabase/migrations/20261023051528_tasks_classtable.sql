-- Forward-only ClassTable configuration. No push, workers or Cron.
create table public.task_calendars (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 120), starts_on date not null, ends_on date, created_at timestamptz not null default now(),
 unique(user_id,id), check(ends_on is null or ends_on>=starts_on)
);
alter table public.task_courses
 add column calendar_id uuid, add column teacher text not null default '', add column location text not null default '',
 add column credits numeric check(credits>=0), add column notes text not null default '', add column color text not null default '#39765c' check(color ~ '^#[0-9a-fA-F]{6}$'),
 add column reminder_minutes int default 10 check(reminder_minutes between 0 and 10080), add column archived_at timestamptz,
 add foreign key(user_id,calendar_id) references public.task_calendars(user_id,id);
alter table public.task_timetable_rules
 add column recurrence text not null default 'weekly' check(recurrence in ('weekly','once','weeks')),
 add column interval_weeks int not null default 1 check(interval_weeks between 1 and 520),
 add column anchor_date date, add column teaching_weeks int[] not null default '{}', add column disabled_from date;
update public.task_timetable_rules set anchor_date=valid_from;
alter table public.task_timetable_rules alter column anchor_date set not null;
alter table public.task_timetable_rules alter column anchor_date set default current_date;
alter table public.task_timetable_rules add column created_at timestamptz not null default '-infinity';
alter table public.task_timetable_rules alter column created_at set default now();
alter table public.task_courses add check(length(teacher)<=200 and length(location)<=500 and length(notes)<=10000);
alter table public.task_timetable_rules add check(cardinality(teaching_weeks)<=520 and (cardinality(teaching_weeks)=0 or (0<all(teaching_weeks) and 520>=all(teaching_weeks))));
create table public.task_exams (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), calendar_id uuid, course_id uuid,
 title text not null check(length(title) between 1 and 200), starts_at timestamptz not null, ends_at timestamptz not null,
 location text not null default '', notes text not null default '', reminder_minutes int default 30 check(reminder_minutes between 0 and 10080),
 unique(user_id,id), check(ends_at>starts_at), foreign key(user_id,calendar_id) references public.task_calendars(user_id,id),
 foreign key(user_id,course_id) references public.task_courses(user_id,id)
);
create table public.task_timetable_preferences (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade unique,
 settings jsonb not null default '{}' check(jsonb_typeof(settings)='object')
);
create table public.task_timetable_snapshots (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 120), payload jsonb not null check(jsonb_typeof(payload)='object'), created_at timestamptz not null default now()
);
alter table public.task_reminders add column exam_id uuid, add foreign key(user_id,exam_id) references public.task_exams(user_id,id) on delete cascade;
do $$ declare t text; begin
 foreach t in array array['task_calendars','task_exams','task_timetable_preferences','task_timetable_snapshots'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
 execute format('create index on public.%I(user_id)',t);
 end loop;
end $$;
-- Existing FK cascades must never be reached by the client: archives preserve all history.
revoke delete on public.task_courses,public.task_timetable_rules from authenticated;

create function public.task_rule_occurs(r public.task_timetable_rules,d date) returns boolean
language sql immutable security invoker set search_path='' as $$
 select d>=r.valid_from and (r.valid_until is null or d<=r.valid_until) and (r.disabled_from is null or d<r.disabled_from)
 and extract(dow from d)=r.weekday and case r.recurrence
 when 'once' then d=r.anchor_date
 when 'weeks' then d-extract(isodow from d)::int+1>=r.anchor_date-extract(isodow from r.anchor_date)::int+1 and (((d-extract(isodow from d)::int+1)-(r.anchor_date-extract(isodow from r.anchor_date)::int+1))/7+1)=any(r.teaching_weeks)
 else d-extract(isodow from d)::int+1>=r.anchor_date-extract(isodow from r.anchor_date)::int+1
 and mod(((d-extract(isodow from d)::int+1)-(r.anchor_date-extract(isodow from r.anchor_date)::int+1))/7,r.interval_weeks)=0 end
$$;

-- Materialize only each rule's next eligible class, including far-away recurrence.
-- This runs during task reconciliation, never from client calendar browsing.
create function public.task_ensure_next(p_user uuid,p_course uuid,p_after timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.task_timetable_rules; d date; base date; horizon date; ex_count int; stride interval;
begin
 perform public.task_user_lock(p_user);
 if exists(select 1 from public.task_courses where user_id=p_user and id=p_course and archived_at is not null) then return; end if;
 for r in select * from public.task_timetable_rules where user_id=p_user and course_id=p_course loop
 base:=greatest(r.valid_from,(p_after at time zone 'Asia/Shanghai')::date,(r.created_at at time zone 'Asia/Shanghai')::date,r.anchor_date-extract(isodow from r.anchor_date)::int+1);
 base:=base+mod(r.weekday-extract(dow from base)::int+7,7);
 stride:=interval '7 days';
 if r.recurrence='weekly' then
 base:=base+mod(r.interval_weeks-mod(((base-extract(isodow from base)::int+1)-(r.anchor_date-extract(isodow from r.anchor_date)::int+1))/7,r.interval_weeks),r.interval_weeks)*7;
 stride:=make_interval(weeks=>r.interval_weeks);
 end if;
 select count(*) into ex_count from public.task_course_exceptions where user_id=p_user and rule_id=r.id;
 horizon:=case r.recurrence when 'once' then r.anchor_date when 'weeks' then r.anchor_date+coalesce((select max(w) from unnest(r.teaching_weeks) w),0)*7 else base+(r.interval_weeks*7*(ex_count+2)) end;
 horizon:=least(horizon,coalesce(r.valid_until,horizon),coalesce(r.disabled_from-1,horizon));
 select g::date into d from generate_series(base::timestamp,horizon::timestamp,stride) g
 left join public.task_course_exceptions e on e.user_id=p_user and e.rule_id=r.id and e.original_date=g::date
 where public.task_rule_occurs(r,g::date) and not coalesce(e.cancelled,false) and coalesce(e.ends_at,(g::date+r.end_time) at time zone 'Asia/Shanghai')>r.created_at
 and coalesce(e.starts_at,(g::date+r.start_time) at time zone 'Asia/Shanghai')>p_after
 order by coalesce(e.starts_at,(g::date+r.start_time) at time zone 'Asia/Shanghai') limit 1;
 if d is not null then
 insert into public.task_course_occurrences(user_id,course_id,rule_id,original_date,starts_at,ends_at)
 select p_user,p_course,r.id,d,coalesce(e.starts_at,(d+r.start_time) at time zone 'Asia/Shanghai'),coalesce(e.ends_at,(d+r.end_time) at time zone 'Asia/Shanghai')
 from (select 1) dummy left join public.task_course_exceptions e on e.user_id=p_user and e.rule_id=r.id and e.original_date=d
 on conflict(user_id,rule_id,original_date) do nothing;
 end if;
 -- Moved exceptions can originate before the anchor but now be the next class.
 insert into public.task_course_occurrences(user_id,course_id,rule_id,original_date,starts_at,ends_at)
 select p_user,p_course,r.id,e.original_date,e.starts_at,e.ends_at from public.task_course_exceptions e
 where e.user_id=p_user and e.rule_id=r.id and not e.cancelled and e.starts_at>p_after and public.task_rule_occurs(r,e.original_date)
 order by e.starts_at limit 1 on conflict(user_id,rule_id,original_date) do nothing;
 end loop;
end $$;

create function public.task_save_course(p_course jsonb,p_rules jsonb,p_effective_from date default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); cid uuid; rid uuid; old_rid uuid; is_new boolean; rule_start date; item jsonb; old_rule public.task_timetable_rules; new_rule public.task_timetable_rules; effective date:=coalesce(p_effective_from,(now() at time zone 'Asia/Shanghai')::date); seen uuid[]:='{}';
begin
 perform public.task_user_lock(u);
 if jsonb_typeof(p_course) is distinct from 'object' then raise exception 'invalid_course'; end if;
 if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules) not between 1 and 100 then raise exception 'invalid_rules'; end if;
 if effective<(now() at time zone 'Asia/Shanghai')::date then raise exception 'invalid_effective_date'; end if;
 cid:=nullif(p_course->>'id','')::uuid;
 is_new:=cid is null;
 if cid is null then
 insert into public.task_courses(user_id,name,subject) values(u,p_course->>'name',p_course->>'subject') returning id into cid;
 elsif not exists(select 1 from public.task_courses where user_id=u and id=cid) then raise exception 'course_not_owned'; end if;
 update public.task_courses set name=p_course->>'name',subject=p_course->>'subject',calendar_id=nullif(p_course->>'calendar_id','')::uuid,
 teacher=coalesce(p_course->>'teacher',''),location=coalesce(p_course->>'location',''),credits=nullif(p_course->>'credits','')::numeric,
 notes=coalesce(p_course->>'notes',''),color=coalesce(p_course->>'color','#39765c'),reminder_minutes=case when p_course ? 'reminder_minutes' then (p_course->>'reminder_minutes')::int else 10 end
 where user_id=u and id=cid;
 for item in select * from jsonb_array_elements(p_rules) loop
 if item ? 'teaching_weeks' and jsonb_typeof(item->'teaching_weeks') is distinct from 'array' then raise exception 'invalid_teaching_weeks'; end if;
 if coalesce(item->>'recurrence','weekly')='weeks' and (jsonb_typeof(item->'teaching_weeks') is distinct from 'array' or jsonb_array_length(item->'teaching_weeks')=0) then raise exception 'teaching_weeks_required'; end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(item->'teaching_weeks','[]')) w where w::int<1 or w::int>520) then raise exception 'invalid_teaching_week'; end if;
 rid:=nullif(item->>'id','')::uuid;
 old_rid:=rid;
 rule_start:=case when is_new then (item->>'valid_from')::date else greatest(effective,(item->>'valid_from')::date) end;
 if rid is not null then
 select * into strict old_rule from public.task_timetable_rules where user_id=u and id=rid and course_id=cid;
 -- Keep unchanged rules and their exception/occurrence identities intact.
 if old_rule.weekday=(item->>'weekday')::int and old_rule.start_time=(item->>'start_time')::time and old_rule.end_time=(item->>'end_time')::time
 and old_rule.valid_from=(item->>'valid_from')::date and old_rule.valid_until is not distinct from (item->>'valid_until')::date
 and old_rule.recurrence=coalesce(item->>'recurrence','weekly') and old_rule.interval_weeks=coalesce((item->>'interval_weeks')::int,1)
 and old_rule.anchor_date=coalesce((item->>'anchor_date')::date,(item->>'valid_from')::date)
 and old_rule.teaching_weeks=array(select jsonb_array_elements_text(coalesce(item->'teaching_weeks','[]'))::int) and old_rule.disabled_from is null then
 seen:=array_append(seen,rid); continue;
 end if;
 if exists(select 1 from public.task_course_occurrences where user_id=u and rule_id=rid and original_date=rule_start and status='confirmed') then rule_start:=rule_start+1; end if;
 update public.task_timetable_rules set disabled_from=least(coalesce(disabled_from,effective),effective) where user_id=u and id=rid;
 end if;
 insert into public.task_timetable_rules(user_id,course_id,weekday,start_time,end_time,valid_from,valid_until,recurrence,interval_weeks,anchor_date,teaching_weeks)
 values(u,cid,(item->>'weekday')::int,(item->>'start_time')::time,(item->>'end_time')::time,rule_start,(item->>'valid_until')::date,
 coalesce(item->>'recurrence','weekly'),coalesce((item->>'interval_weeks')::int,1),coalesce((item->>'anchor_date')::date,(item->>'valid_from')::date),array(select jsonb_array_elements_text(coalesce(item->'teaching_weeks','[]'))::int)) returning id into rid;
 -- Carry forward actual future class/task identities when a replacement still has
 -- a class in the same teaching week (including weekday moves).
 if old_rid is not null then
 select * into new_rule from public.task_timetable_rules where id=rid and user_id=u;
 update public.task_course_exceptions e set rule_id=rid,
 original_date=e.original_date-extract(isodow from e.original_date)::int+1+mod(new_rule.weekday+6,7)
 where e.user_id=u and e.rule_id=old_rid and e.original_date>=effective
 and coalesce(e.ends_at,((e.original_date-extract(isodow from e.original_date)::int+1+mod(new_rule.weekday+6,7))+new_rule.end_time) at time zone 'Asia/Shanghai')>now()
 and public.task_rule_occurs(new_rule,e.original_date-extract(isodow from e.original_date)::int+1+mod(new_rule.weekday+6,7))
 and not exists(select 1 from public.task_course_occurrences o where o.user_id=u and o.rule_id=old_rid and o.original_date=e.original_date and (o.status='confirmed' or o.ends_at<=now()));
 update public.task_course_occurrences o set rule_id=rid,
 original_date=o.original_date-extract(isodow from o.original_date)::int+1+mod(new_rule.weekday+6,7)
 where o.user_id=u and o.rule_id=old_rid and o.original_date>=effective and o.status<>'confirmed' and o.ends_at>now()
 and (((o.original_date-extract(isodow from o.original_date)::int+1+mod(new_rule.weekday+6,7))+new_rule.end_time) at time zone 'Asia/Shanghai'>now()
 or exists(select 1 from public.task_course_exceptions moved where moved.user_id=u and moved.rule_id=rid and moved.original_date=o.original_date-extract(isodow from o.original_date)::int+1+mod(new_rule.weekday+6,7) and moved.ends_at>now()))
 and public.task_rule_occurs(new_rule,o.original_date-extract(isodow from o.original_date)::int+1+mod(new_rule.weekday+6,7));
 end if;
 seen:=array_append(seen,rid);
 end loop;
 update public.task_timetable_rules set disabled_from=least(coalesce(disabled_from,effective),effective) where user_id=u and course_id=cid and not(id=any(seen));
 perform public.task_tick(u); return cid;
end $$;
create function public.task_archive_course(p_course uuid) returns void language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); begin
 perform public.task_user_lock(u);
 update public.task_courses set archived_at=coalesce(archived_at,now()) where user_id=u and id=p_course;
 if not found then raise exception 'course_not_owned'; end if;
 update public.task_course_occurrences set status='cancelled' where user_id=u and course_id=p_course and starts_at>now() and status='scheduled';
 update public.task_reminders set status='cancelled' where user_id=u and remind_at>=now() and status in ('pending','sending','failed') and
 (occurrence_id in(select id from public.task_course_occurrences where user_id=u and course_id=p_course) or task_id in(select id from public.task_instances where user_id=u and course_id=p_course) or exam_id in(select id from public.task_exams where user_id=u and course_id=p_course));
end $$;

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
 select p_user,o.id,'course-start:'||o.id,'即将上课：'||c.name,o.starts_at-make_interval(mins=>c.reminder_minutes),case when c.reminder_minutes=0 then o.ends_at else o.starts_at end
 from public.task_course_occurrences o join public.task_courses c on c.id=o.course_id and c.user_id=o.user_id
 where o.user_id=p_user and o.status='scheduled' and o.ends_at>now() and (c.reminder_minutes=0 or o.starts_at>now()) and c.archived_at is null and c.reminder_minutes is not null
 on conflict(user_id,source_key) do update set remind_at=excluded.remind_at,expires_at=excluded.expires_at,title=excluded.title,status=case when task_reminders.read_at is null then 'pending' else task_reminders.status end;
 insert into public.task_reminders(user_id,exam_id,source_key,title,remind_at,expires_at)
 select p_user,e.id,'exam:'||e.id,'即将考试：'||e.title,e.starts_at-make_interval(mins=>e.reminder_minutes),e.ends_at
 from public.task_exams e where e.user_id=p_user and e.ends_at>now() and e.reminder_minutes is not null
 and (e.course_id is null or exists(select 1 from public.task_courses c where c.id=e.course_id and c.user_id=p_user and c.archived_at is null))
 on conflict(user_id,source_key) do update set remind_at=excluded.remind_at,expires_at=excluded.expires_at,title=excluded.title,status=case when task_reminders.read_at is null then 'pending' else task_reminders.status end;
 update public.task_reminders rem set status='cancelled' where rem.user_id=p_user and rem.status in ('pending','sending','failed') and (
 (rem.source_key like 'course-start:%' and exists(select 1 from public.task_course_occurrences o join public.task_courses c on c.id=o.course_id and c.user_id=o.user_id where o.id=rem.occurrence_id and o.user_id=p_user and (c.reminder_minutes is null or c.archived_at is not null)))
 or (rem.exam_id is not null and exists(select 1 from public.task_exams e where e.id=rem.exam_id and e.user_id=p_user and (e.reminder_minutes is null or exists(select 1 from public.task_courses c where c.id=e.course_id and c.user_id=p_user and c.archived_at is not null)))));
 update public.task_reminders rem set status='cancelled' where rem.user_id=p_user and rem.status in ('pending','sending','failed') and (
 (rem.expires_at is not null and rem.expires_at<=now())
 or exists(select 1 from public.task_instances inst where inst.id=rem.task_id and inst.status in ('completed','cancelled'))
 or exists(select 1 from public.task_course_occurrences occ where occ.id=rem.occurrence_id and (occ.status='cancelled' or (rem.task_id is null and occ.status='confirmed'))));
end $$;


create or replace function public.task_emit(p_user uuid,p_template uuid,p_source text,p_occurrence uuid default null,p_lesson jsonb default null,p_items jsonb default null,p_anchor timestamptz default now(),p_course uuid default null) returns void
language plpgsql security invoker set search_path='' as $$
declare t public.task_templates; c public.task_course_occurrences; n public.task_course_occurrences; due timestamptz; task_id uuid; its jsonb; title text;
begin
 perform public.task_user_lock(p_user);
 select * into t from public.task_templates where id=p_template and user_id=p_user and enabled;
 if not found then return; end if;
 if t.target='next' and p_lesson is null then return; end if;
 if p_occurrence is not null then select * into strict c from public.task_course_occurrences where id=p_occurrence and user_id=p_user; end if;
 if p_occurrence is not null then
   perform public.task_ensure_next(p_user,c.course_id,case when t.trigger='before_class' then c.starts_at-interval '1 microsecond' else c.starts_at end);
   select * into n from public.task_course_occurrences where user_id=p_user and course_id=c.course_id and status<>'cancelled'
   and (case when t.trigger='before_class' then starts_at>=c.starts_at else starts_at>c.starts_at end) order by starts_at limit 1;
 end if;
 if p_occurrence is null and coalesce(p_course,t.course_id) is not null then
 perform public.task_ensure_next(p_user,coalesce(p_course,t.course_id),p_anchor);
 select * into n from public.task_course_occurrences where user_id=p_user and course_id=coalesce(p_course,t.course_id) and status<>'cancelled' and starts_at>p_anchor order by starts_at limit 1;
 end if;
 due := case t.deadline->>'kind'
 when 'same_day' then (((p_anchor at time zone 'Asia/Shanghai')::date)::text||' '||coalesce(t.deadline->>'time','20:30'))::timestamp at time zone 'Asia/Shanghai'
 when 'days_after' then ((((p_anchor at time zone 'Asia/Shanghai')::date+coalesce((t.deadline->>'days')::int,1))::text)||' '||coalesce(t.deadline->>'time','20:30'))::timestamp at time zone 'Asia/Shanghai'
 when 'fixed' then (t.deadline->>'at')::timestamptz
 when 'next_class' then n.starts_at end;
 its:=p_items;
 if its is null then select coalesce(jsonb_agg(jsonb_build_object('id',ord::text,'label',v,'done',false) order by ord),'[]') into its from jsonb_array_elements_text(t.checklist) with ordinality x(v,ord); end if;
 if t.target='unit' and p_lesson is not null then p_lesson:=jsonb_build_object('key',(p_lesson->>'book')||':unit:'||(p_lesson->>'unit'),'title','第 '||(p_lesson->>'unit')||' 单元','book',p_lesson->>'book','unit',p_lesson->>'unit','kind','unit'); end if;
 title:=t.name||case when p_lesson is not null then ' · '||coalesce(p_lesson->>'title','') else '' end;
 insert into public.task_instances(user_id,title,subject,course_id,occurrence_id,template_id,source_key,mode,items,lesson,due_at,due_kind,due_occurrence_id,estimated_minutes,material_kind,template_snapshot)
 values(p_user,title,coalesce(t.subject,(select subject from public.task_courses where id=coalesce(c.course_id,p_course,t.course_id) and user_id=p_user)),coalesce(c.course_id,p_course,t.course_id),p_occurrence,t.id,p_source,t.mode,its,p_lesson,due,t.deadline->>'kind',case when t.deadline->>'kind'='next_class' then n.id end,t.estimated_minutes,t.material_kind,to_jsonb(t))
 on conflict(user_id,source_key) do nothing returning id into task_id;
end $$;

-- Prevent hard deletes through other client write paths as well.
create function public.task_preserve_course_history() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null then raise exception 'archive_course_instead'; end if;
 return old;
end $$;
create trigger task_course_history_guard before delete on public.task_courses for each row execute function public.task_preserve_course_history();

-- Far-future planning checks the pure recurrence model, not just materialized rows.
create function public.task_validate_timetable_block() returns trigger language plpgsql security invoker set search_path='' as $$
declare d date:=(new.starts_at at time zone 'Asia/Shanghai')::date;
begin
 perform public.task_user_lock(new.user_id);
 if exists(
 select 1 from public.task_timetable_rules r join public.task_courses c on c.user_id=r.user_id and c.id=r.course_id
 left join public.task_course_exceptions e on e.user_id=r.user_id and e.rule_id=r.id and e.original_date=d
 where r.user_id=new.user_id and c.archived_at is null and public.task_rule_occurs(r,d) and not coalesce(e.cancelled,false)
 and coalesce(e.starts_at,(d+r.start_time) at time zone 'Asia/Shanghai')<new.ends_at
 and coalesce(e.ends_at,(d+r.end_time) at time zone 'Asia/Shanghai')>new.starts_at
 ) or exists(
 select 1 from public.task_course_exceptions e join public.task_timetable_rules r on r.user_id=e.user_id and r.id=e.rule_id
 join public.task_courses c on c.user_id=r.user_id and c.id=r.course_id
 where e.user_id=new.user_id and c.archived_at is null and not e.cancelled and public.task_rule_occurs(r,e.original_date)
 and e.starts_at<new.ends_at and e.ends_at>new.starts_at
 ) then raise exception 'time_conflict'; end if;
 return new;
end $$;
create trigger task_block_timetable_guard before insert or update on public.task_time_blocks for each row execute function public.task_validate_timetable_block();

create or replace function public.task_replace_rule(p_rule uuid,p_from date,p_weekday int,p_start time,p_end time,p_until date default null) returns void language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); r public.task_timetable_rules;
begin
 perform public.task_user_lock(u);
 select * into strict r from public.task_timetable_rules where user_id=u and id=p_rule for update;
 if p_from<(now() at time zone 'Asia/Shanghai')::date or p_from<r.valid_from then raise exception 'invalid_effective_date'; end if;
 update public.task_timetable_rules set disabled_from=least(coalesce(disabled_from,p_from),p_from) where id=r.id and user_id=u;
 insert into public.task_timetable_rules(user_id,course_id,weekday,start_time,end_time,valid_from,valid_until,recurrence,interval_weeks,anchor_date,teaching_weeks)
 values(u,r.course_id,p_weekday,p_start,p_end,p_from,p_until,r.recurrence,r.interval_weeks,r.anchor_date,r.teaching_weeks);
 perform public.task_tick(u);
end $$;
create table public.task_timetable_imports (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 import_key text not null check(length(import_key) between 1 and 200), calendar_id uuid not null,
 unique(user_id,import_key), foreign key(user_id,calendar_id) references public.task_calendars(user_id,id)
);
alter table public.task_timetable_imports enable row level security;
revoke all on public.task_timetable_imports from anon;
grant select,insert on public.task_timetable_imports to authenticated;
grant all on public.task_timetable_imports to service_role;
create policy own_rows on public.task_timetable_imports for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

-- Additive, atomic and retry-safe. IDs in input are local mapping labels, never trusted DB identities.
create function public.task_import_timetable(p_payload jsonb,p_calendar uuid default null,p_name text default null,p_import_key text default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); target uuid; cid uuid; rid uuid; eid uuid; c jsonb; r jsonb; e jsonb; first_calendar jsonb; course_map jsonb:='{}'; rule_map jsonb:='{}'; start_date date; end_date date; cname text;
begin
 perform public.task_user_lock(u);
 if p_import_key is null or length(p_import_key) not between 1 and 200 then raise exception 'import_key_required'; end if;
 if p_payload->>'version' is distinct from '1' or jsonb_typeof(p_payload->'courses') is distinct from 'array'
 or jsonb_typeof(p_payload->'rules') is distinct from 'array' or jsonb_typeof(p_payload->'exams') is distinct from 'array'
 or jsonb_typeof(p_payload->'calendars') is distinct from 'array' then raise exception 'invalid_import'; end if;
 if p_payload ? 'exceptions' and jsonb_typeof(p_payload->'exceptions') is distinct from 'array' then raise exception 'invalid_exceptions'; end if;
 if jsonb_array_length(p_payload->'courses')>500 or jsonb_array_length(p_payload->'rules')>5000 or jsonb_array_length(p_payload->'exams')>1000
 or jsonb_array_length(coalesce(p_payload->'exceptions','[]'))>10000 then raise exception 'import_too_large'; end if;
 select calendar_id into target from public.task_timetable_imports where user_id=u and import_key=p_import_key;
 if found then
 if p_calendar is not null and target<>p_calendar then raise exception 'import_key_target_mismatch'; end if;
 return target;
 end if;
 target:=p_calendar;
 if target is not null then
 if not exists(select 1 from public.task_calendars where user_id=u and id=target) then raise exception 'calendar_not_owned'; end if;
 else
 first_calendar:=p_payload->'calendars'->0;
 start_date:=coalesce((first_calendar->>'starts_on')::date,(select min((v->>'valid_from')::date) from jsonb_array_elements(p_payload->'rules') v),(now() at time zone 'Asia/Shanghai')::date);
 end_date:=(first_calendar->>'ends_on')::date;
 insert into public.task_calendars(user_id,name,starts_on,ends_on) values(u,coalesce(nullif(p_name,''),nullif(first_calendar->>'name',''),'导入课表'),start_date,end_date) returning id into target;
 end if;
 for c in select * from jsonb_array_elements(p_payload->'courses') loop
 if coalesce(c->>'id','')='' or course_map ? (c->>'id') then raise exception 'duplicate_or_missing_course_key'; end if;
 cname:=btrim(c->>'name');
 select id into cid from public.task_courses where user_id=u and calendar_id=target and archived_at is null and lower(btrim(name))=lower(cname) and subject=c->>'subject' order by created_at,id limit 1;
 if cid is null then
 insert into public.task_courses(user_id,calendar_id,name,subject,teacher,location,credits,notes,color,reminder_minutes)
 values(u,target,cname,c->>'subject',coalesce(c->>'teacher',''),coalesce(c->>'location',''),(c->>'credits')::numeric,coalesce(c->>'notes',''),coalesce(c->>'color','#39765c'),case when c ? 'reminder_minutes' then (c->>'reminder_minutes')::int else 10 end) returning id into cid;
 end if;
 course_map:=course_map||jsonb_build_object(c->>'id',cid);
 end loop;
 for r in select * from jsonb_array_elements(p_payload->'rules') loop
 if coalesce(r->>'id','')='' or rule_map ? (r->>'id') then raise exception 'duplicate_or_missing_rule_key'; end if;
 cid:=(course_map->>(r->>'course_id'))::uuid;
 if cid is null then raise exception 'unknown_course_reference'; end if;
 if r ? 'teaching_weeks' and jsonb_typeof(r->'teaching_weeks') is distinct from 'array' then raise exception 'invalid_teaching_weeks'; end if;
 if coalesce(r->>'recurrence','weekly')='weeks' and (jsonb_typeof(r->'teaching_weeks') is distinct from 'array' or jsonb_array_length(r->'teaching_weeks')=0) then raise exception 'teaching_weeks_required'; end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(r->'teaching_weeks','[]')) w where w::int<1 or w::int>520) then raise exception 'invalid_teaching_week'; end if;
 select id into rid from public.task_timetable_rules old where old.user_id=u and old.course_id=cid
 and old.weekday=(r->>'weekday')::int and old.start_time=(r->>'start_time')::time and old.end_time=(r->>'end_time')::time
 and old.valid_from=(r->>'valid_from')::date and old.valid_until is not distinct from (r->>'valid_until')::date
 and old.disabled_from is not distinct from (r->>'disabled_from')::date and old.recurrence=coalesce(r->>'recurrence','weekly')
 and old.interval_weeks=coalesce((r->>'interval_weeks')::int,1) and old.anchor_date=coalesce((r->>'anchor_date')::date,(r->>'valid_from')::date)
 and old.teaching_weeks=array(select jsonb_array_elements_text(coalesce(r->'teaching_weeks','[]'))::int) order by id limit 1;
 if rid is null then
 insert into public.task_timetable_rules(user_id,course_id,weekday,start_time,end_time,valid_from,valid_until,recurrence,interval_weeks,anchor_date,teaching_weeks,disabled_from)
 values(u,cid,(r->>'weekday')::int,(r->>'start_time')::time,(r->>'end_time')::time,(r->>'valid_from')::date,(r->>'valid_until')::date,
 coalesce(r->>'recurrence','weekly'),coalesce((r->>'interval_weeks')::int,1),coalesce((r->>'anchor_date')::date,(r->>'valid_from')::date),array(select jsonb_array_elements_text(coalesce(r->'teaching_weeks','[]'))::int),(r->>'disabled_from')::date) returning id into rid;
 end if;
 rule_map:=rule_map||jsonb_build_object(r->>'id',rid);
 end loop;
 for e in select * from jsonb_array_elements(coalesce(p_payload->'exceptions','[]')) loop
 rid:=(rule_map->>(e->>'rule_id'))::uuid;
 if rid is null then raise exception 'unknown_rule_reference'; end if;
 -- Never alter an existing occurrence/confirmation while restoring configuration.
 if exists(select 1 from public.task_course_occurrences where user_id=u and rule_id=rid and original_date=(e->>'original_date')::date) then continue; end if;
 insert into public.task_course_exceptions(user_id,rule_id,original_date,cancelled,starts_at,ends_at)
 values(u,rid,(e->>'original_date')::date,coalesce((e->>'cancelled')::boolean,false),(e->>'starts_at')::timestamptz,(e->>'ends_at')::timestamptz)
 on conflict(user_id,rule_id,original_date) do nothing;
 end loop;
 for e in select * from jsonb_array_elements(p_payload->'exams') loop
 cid:=null;
 if nullif(e->>'course_id','') is not null then cid:=(course_map->>(e->>'course_id'))::uuid; if cid is null then raise exception 'unknown_exam_course'; end if; end if;
 select id into eid from public.task_exams old where old.user_id=u and old.calendar_id=target and old.course_id is not distinct from cid
 and lower(btrim(old.title))=lower(btrim(e->>'title')) and old.starts_at=(e->>'starts_at')::timestamptz and old.ends_at=(e->>'ends_at')::timestamptz and old.location=coalesce(e->>'location','') order by id limit 1;
 if eid is null then
 insert into public.task_exams(user_id,calendar_id,course_id,title,starts_at,ends_at,location,notes,reminder_minutes)
 values(u,target,cid,btrim(e->>'title'),(e->>'starts_at')::timestamptz,(e->>'ends_at')::timestamptz,coalesce(e->>'location',''),coalesce(e->>'notes',''),case when e ? 'reminder_minutes' then (e->>'reminder_minutes')::int else 30 end);
 end if;
 end loop;
 insert into public.task_timetable_imports(user_id,import_key,calendar_id) values(u,p_import_key,target);
 -- No tick here: applying config cannot retroactively emit learning tasks.
 return target;
end $$;

-- Explicit grants for every new callable function; all execute with caller RLS.
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('task_rule_occurs','task_ensure_next','task_save_course','task_archive_course','task_preserve_course_history','task_validate_timetable_block','task_import_timetable') loop
 execute format('revoke all on function %s from public,anon',f.sig);
 execute format('grant execute on function %s to authenticated,service_role',f.sig);
 end loop;
end $$;
create function public.task_clear_exams(p_ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); begin
 perform public.task_user_lock(u);
 if cardinality(p_ids)>1000 then raise exception 'too_many_exams'; end if;
 delete from public.task_exams where user_id=u and id=any(p_ids);
end $$;
revoke all on function public.task_clear_exams(uuid[]) from public,anon;
grant execute on function public.task_clear_exams(uuid[]) to authenticated,service_role;
