alter table public.task_courses
  add column priority text not null default 'P2',
  add constraint task_courses_priority_check check (priority in ('P0','P1','P2','P3','P4'));

-- Keep the saved priority for callers that omit it.
create or replace function public.task_save_course(p_course jsonb,p_rules jsonb,p_effective_from date default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 u uuid := auth.uid();
 cid uuid;
 rid uuid;
 old_rid uuid;
 is_new boolean;
 rule_start date;
 item jsonb;
 old_rule public.task_timetable_rules;
 new_rule public.task_timetable_rules;
 effective date := coalesce(p_effective_from,(now() at time zone 'Asia/Shanghai')::date);
 seen uuid[] := '{}';
 prior public.task_courses;
 kind text;
begin
 if u is null then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,228));
 if jsonb_typeof(p_course) is distinct from 'object' then raise exception 'invalid_course'; end if;
 if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules) not between 1 and 100 then raise exception 'invalid_rules'; end if;
 if effective<(now() at time zone 'Asia/Shanghai')::date then raise exception 'invalid_effective_date'; end if;
 cid:=nullif(p_course->>'id','')::uuid;
 is_new:=cid is null;
 kind:=coalesce(p_course->>'course_type','timetabled');
 if kind not in ('timetabled','flexible') then raise exception 'invalid_course_type'; end if;
 if cid is not null then
 select * into prior from public.task_courses where user_id=u and id=cid for update;
 if not found then raise exception 'course_not_owned'; end if;
 if (p_course->>'rules_revision')::int is distinct from prior.rules_revision then raise exception 'stale_course_revision'; end if;
 if prior.archived_at is not null then raise exception 'course_archived'; end if;
 end if;
 if is_new then
   cid := coalesce((p_course->>'create_id')::uuid, gen_random_uuid());
   if exists (select from public.task_courses where id=cid and user_id=u) then return cid; end if;
   insert into public.task_courses(id,user_id,name,subject) values(cid,u,p_course->>'name',p_course->>'subject');
 end if;
 update public.task_courses set name=p_course->>'name',subject=p_course->>'subject',calendar_id=nullif(p_course->>'calendar_id','')::uuid,
 teacher=coalesce(p_course->>'teacher',''),location=coalesce(p_course->>'location',''),credits=nullif(p_course->>'credits','')::numeric,
 notes=coalesce(p_course->>'notes',''), color=coalesce(p_course->>'color','#39765c'),
 reminder_minutes=case when kind='timetabled' then (p_course->>'reminder_minutes')::int end,
 priority=coalesce(p_course->>'priority',prior.priority,'P2'),
 course_type=kind, rules_revision=coalesce(prior.rules_revision,0)+1, effective_from=effective
 where user_id=u and id=cid;
 -- A pending revision can move again without stranding the still-valid earlier rules.
 if not is_new and prior.effective_from>(now() at time zone 'Asia/Shanghai')::date and prior.effective_from<>effective then
 update public.task_timetable_rules set disabled_from=effective
 where user_id=u and course_id=cid and disabled_from=prior.effective_from and valid_from<prior.effective_from;
 end if;
 for item in select * from jsonb_array_elements(p_rules) loop
 if coalesce(item->>'kind',kind)<>kind then raise exception 'course_rule_type_mismatch'; end if;
 if kind='flexible' and (item->>'start_time' is not null or item->>'end_time' is not null) then raise exception 'flexible_rule_has_time'; end if;
 if item ? 'teaching_weeks' and jsonb_typeof(item->'teaching_weeks') is distinct from 'array' then raise exception 'invalid_teaching_weeks'; end if;
 if coalesce(item->>'recurrence','weekly')='weeks' and (jsonb_typeof(item->'teaching_weeks') is distinct from 'array' or jsonb_array_length(item->'teaching_weeks')=0) then raise exception 'teaching_weeks_required'; end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(item->'teaching_weeks','[]')) w where w::int<1 or w::int>520) then raise exception 'invalid_teaching_week'; end if;
 rid:=nullif(item->>'id','')::uuid;
 old_rid:=rid;
 rule_start:=case when is_new then (item->>'valid_from')::date when prior.effective_from>(now() at time zone 'Asia/Shanghai')::date and (item->>'valid_from')::date=prior.effective_from then effective else greatest(effective,(item->>'valid_from')::date) end;
 if rid is not null then
 select * into strict old_rule from public.task_timetable_rules where user_id=u and id=rid and course_id=cid;
 -- Keep unchanged rules and their exception/occurrence identities intact.
 if not (coalesce(prior.effective_from>(now() at time zone 'Asia/Shanghai')::date,false) and prior.effective_from<>effective and old_rule.valid_from=prior.effective_from) and old_rule.weekday=(item->>'weekday')::int and old_rule.kind=kind and old_rule.start_time is not distinct from (item->>'start_time')::time and old_rule.end_time is not distinct from (item->>'end_time')::time
 and old_rule.valid_from=(item->>'valid_from')::date and old_rule.valid_until is not distinct from (item->>'valid_until')::date
 and old_rule.recurrence=coalesce(item->>'recurrence','weekly') and old_rule.interval_weeks=coalesce((item->>'interval_weeks')::int,1)
 and old_rule.anchor_date=coalesce((item->>'anchor_date')::date,(item->>'valid_from')::date)
 and old_rule.teaching_weeks=array(select jsonb_array_elements_text(coalesce(item->'teaching_weeks','[]'))::int) and old_rule.disabled_from is null then
 seen:=array_append(seen,rid); continue;
 end if;
 update public.task_timetable_rules set disabled_from=least(coalesce(disabled_from,effective),effective,case when prior.effective_from>(now() at time zone 'Asia/Shanghai')::date and valid_from>=prior.effective_from then valid_from else effective end) where user_id=u and id=rid;
 end if;
 insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,valid_from,valid_until,recurrence,interval_weeks,anchor_date,teaching_weeks)
 values(u,cid,kind,(item->>'weekday')::int,(item->>'start_time')::time,(item->>'end_time')::time,rule_start,(item->>'valid_until')::date,
 coalesce(item->>'recurrence','weekly'),coalesce((item->>'interval_weeks')::int,1),coalesce((item->>'anchor_date')::date,(item->>'valid_from')::date),array(select jsonb_array_elements_text(coalesce(item->'teaching_weeks','[]'))::int)) returning id into rid;
 if old_rid is not null and old_rule.kind='timetabled' and kind='timetabled' then
 select * into new_rule from public.task_timetable_rules where id=rid and user_id=u;
 update public.task_course_exceptions e set rule_id=rid,
 original_date=e.original_date-extract(isodow from e.original_date)::int+1+mod(new_rule.weekday+6,7)
 where e.user_id=u and e.rule_id=old_rid and e.original_date>=effective
 and coalesce(e.ends_at,((e.original_date-extract(isodow from e.original_date)::int+1+mod(new_rule.weekday+6,7))+new_rule.end_time) at time zone 'Asia/Shanghai')>now()
 and private.task_rule_occurs(new_rule,e.original_date-extract(isodow from e.original_date)::int+1+mod(new_rule.weekday+6,7));
 end if;
 seen:=array_append(seen,rid);
 end loop;
 update public.task_timetable_rules set disabled_from=least(coalesce(disabled_from,effective),effective,case when prior.effective_from>(now() at time zone 'Asia/Shanghai')::date and valid_from>=prior.effective_from then valid_from else effective end) where user_id=u and course_id=cid and not(id=any(seen));
 return cid;
end $$;

-- A priority-only edit can update an expired course without touching its schedule.
create function public.task_set_course_priority(p_course uuid, p_revision integer, p_priority text)
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,228));
  update public.task_courses
    set priority=p_priority, rules_revision=rules_revision+1
    where user_id=u and id=p_course and rules_revision=p_revision and archived_at is null;
  if not found then raise exception 'stale_course_revision'; end if;
end $$;

revoke all on function public.task_set_course_priority(uuid,integer,text) from public,anon;
grant execute on function public.task_set_course_priority(uuid,integer,text) to authenticated;

create or replace function public.task_copy_calendar(p_source uuid, p_target uuid, p_name text, p_start date, p_end date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  shift_days integer;
  new_course uuid;
  new_rule uuid;
  course public.task_courses;
  rule public.task_timetable_rules;
begin
  if u is null then raise exception 'unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,228));
  select p_start - starts_on into strict shift_days from public.task_calendars where id=p_source and user_id=u;
  if shift_days % 7 <> 0 then raise exception '学期开始日须与原学期为同一星期'; end if;
  if exists (select from public.task_calendars where id=p_target and user_id=u) then return p_target; end if;
  insert into public.task_calendars(id,user_id,name,starts_on,ends_on) values(p_target,u,p_name,p_start,p_end);
  for course in select * from public.task_courses where calendar_id=p_source and user_id=u and archived_at is null loop
    insert into public.task_courses(user_id,calendar_id,name,subject,teacher,location,notes,credits,color,course_type,reminder_minutes,effective_from,priority)
      values(u,p_target,course.name,course.subject,course.teacher,course.location,course.notes,course.credits,course.color,course.course_type,course.reminder_minutes,course.effective_from + shift_days,course.priority)
      returning id into new_course;
    for rule in select * from public.task_timetable_rules where course_id=course.id and user_id=u
      and (p_end is null or valid_from + shift_days <= p_end) loop
      insert into public.task_timetable_rules(user_id,course_id,kind,weekday,start_time,end_time,recurrence,interval_weeks,teaching_weeks,valid_from,valid_until,anchor_date,disabled_from)
        values(u,new_course,rule.kind,rule.weekday,rule.start_time,rule.end_time,rule.recurrence,rule.interval_weeks,rule.teaching_weeks,
          rule.valid_from + shift_days,least(rule.valid_until + shift_days,p_end),rule.anchor_date + shift_days,rule.disabled_from + shift_days)
        returning id into new_rule;
      insert into public.task_course_exceptions(user_id,rule_id,original_date,cancelled,starts_at,ends_at)
        select u,new_rule,original_date + shift_days,cancelled,starts_at + shift_days * interval '24 hours',ends_at + shift_days * interval '24 hours'
        from public.task_course_exceptions where user_id=u and rule_id=rule.id;
    end loop;
  end loop;
  return p_target;
end $$;
